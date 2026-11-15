// Reads the watch's sensors and posts them to <serverUrl>/api/watch every few seconds,
// through the phone's Garmin Connect app (Bluetooth). Server side: server/watch.js.
//
//   hr          optical heart rate, live (Sensor.Info.heartRate)
//   hrv         RMSSD in ms over the last ~40 beat-to-beat intervals (Sensor data listener)
//   spo2        Pulse Ox: live when the sensor gives it, else the newest stored reading under 30 min old
//   resp        respiration rate, breaths/min (ActivityMonitor)
//   stress      Garmin stress score 0-100
//   bodyBattery, steps, battery   extra context
import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Math;
import Toybox.Sensor;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

class AstraLink {
    const INTERVAL_MS = 3000;

    var code as String = "";
    var hr as Number? = null;
    var hrv as Float? = null;
    var spo2 as Number? = null;
    var resp as Number? = null;
    var stress as Number? = null;
    var bodyBattery as Number? = null;
    var steps as Number? = null;
    var status as String = "Starting";
    var ok as Boolean = false;
    var sent as Number = 0;

    private var _url as String = "https://app.healtmonitor.bid";
    private var _timer as Timer.Timer?;
    private var _busy as Boolean = false;
    private var _spo2Live as Boolean = false;
    private var _rr as Array<Number> = [] as Array<Number>;

    function initialize() {
        code = loadCode();
        var u = Application.Properties.getValue("serverUrl");
        if (u instanceof String && u.length() > 8) {
            _url = u;
        }
        // Drop a trailing slash, so the path is exactly /api/watch.
        var chars = _url.toCharArray();
        if (chars[chars.size() - 1] == '/') {
            _url = _url.substring(0, _url.length() - 1) as String;
        }
    }

    // A 6-character code, made once and kept. The web page asks for it to find this watch.
    private function loadCode() as String {
        var saved = Application.Storage.getValue("pairCode");
        if (saved instanceof String && saved.length() == 6) {
            return saved;
        }
        var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray(); // no 0/O, 1/I
        Math.srand(Time.now().value() + System.getTimer());
        var s = "";
        for (var i = 0; i < 6; i++) {
            s += alphabet[Math.rand() % alphabet.size()].toString();
        }
        Application.Storage.setValue("pairCode", s);
        return s;
    }

    function start() as Void {
        if (Sensor has :SENSOR_ONBOARD_PULSE_OXIMETRY) {
            Sensor.setEnabledSensors([Sensor.SENSOR_HEARTRATE, Sensor.SENSOR_ONBOARD_PULSE_OXIMETRY]);
        } else {
            Sensor.setEnabledSensors([Sensor.SENSOR_HEARTRATE]);
        }
        Sensor.enableSensorEvents(method(:onSensor));
        if (Sensor has :registerSensorDataListener) {
            try {
                Sensor.registerSensorDataListener(method(:onSensorData), {
                    :period => 1,
                    :heartBeatIntervals => { :enabled => true }
                });
            } catch (e) {
                // No beat intervals on this device: HRV just stays empty.
            }
        }
        var t = new Timer.Timer();
        t.start(method(:tick), INTERVAL_MS, true);
        _timer = t;
        tick();
    }

    function stop() as Void {
        var t = _timer;
        if (t != null) {
            t.stop();
        }
        if (Sensor has :unregisterSensorDataListener) {
            Sensor.unregisterSensorDataListener();
        }
        Sensor.enableSensorEvents(null);
    }

    // Callbacks are left untyped so they match every SDK's callback signature.
    function onSensor(info) as Void {
        if (info == null) {
            return;
        }
        if (info.heartRate != null) {
            hr = info.heartRate;
        }
        if (info has :oxygenSaturation && info.oxygenSaturation != null && info.oxygenSaturation > 0) {
            spo2 = info.oxygenSaturation;
            _spo2Live = true;
        }
        WatchUi.requestUpdate();
    }

    function onSensorData(data) as Void {
        if (data == null || data.heartRateData == null) {
            return;
        }
        var ivs = data.heartRateData.heartBeatIntervals;
        if (ivs == null) {
            return;
        }
        for (var i = 0; i < ivs.size(); i++) {
            var ms = ivs[i];
            if (ms != null && ms > 300 && ms < 2000) {
                _rr.add(ms);
            }
        }
        if (_rr.size() > 40) {
            _rr = _rr.slice(_rr.size() - 40, null);
        }
        hrv = rmssd();
    }

    // Root mean square of successive differences, skipping jumps over 20 % (artifacts).
    private function rmssd() as Float? {
        if (_rr.size() < 8) {
            return null;
        }
        var sum = 0.0;
        var n = 0;
        for (var i = 1; i < _rr.size(); i++) {
            var prev = _rr[i - 1];
            var d = (_rr[i] - prev).toFloat();
            if (d.abs() > prev * 0.2) {
                continue;
            }
            sum += d * d;
            n += 1;
        }
        if (n < 5) {
            return null;
        }
        return Math.sqrt(sum / n).toFloat();
    }

    // Readings that change slowly: respiration, stress, body battery, steps, stored SpO2.
    private function readSlow() as Void {
        var am = ActivityMonitor.getInfo();
        if (am has :respirationRate && am.respirationRate != null) {
            resp = am.respirationRate;
        }
        if (am.steps != null) {
            steps = am.steps;
        }
        if (am has :stressScore && am.stressScore != null) {
            stress = am.stressScore;
        } else if (SensorHistory has :getStressHistory) {
            stress = newest(SensorHistory.getStressHistory({ :period => 1 }), 0);
        }
        if (SensorHistory has :getBodyBatteryHistory) {
            bodyBattery = newest(SensorHistory.getBodyBatteryHistory({ :period => 1 }), 0);
        }
        if (!_spo2Live && SensorHistory has :getOxygenSaturationHistory) {
            spo2 = newest(SensorHistory.getOxygenSaturationHistory({ :period => 1 }), 1800);
        }
    }

    // Newest sample as a Number, or null. maxAgeSec > 0 also drops samples older than that.
    private function newest(iter, maxAgeSec as Number) as Number? {
        if (iter == null) {
            return null;
        }
        var s = iter.next();
        if (s == null || s.data == null || s.data < 0) {
            return null;
        }
        if (maxAgeSec > 0 && s.when != null && Time.now().subtract(s.when).value() > maxAgeSec) {
            return null;
        }
        return s.data.toNumber();
    }

    function tick() as Void {
        readSlow();
        WatchUi.requestUpdate();
        if (_busy) {
            return;
        }
        if (!System.getDeviceSettings().phoneConnected) {
            status = "No phone link";
            ok = false;
            return;
        }
        if (hr == null && spo2 == null && hrv == null) {
            status = "Waiting for HR";
            return;
        }
        var body = {} as Dictionary;
        body["code"] = code;
        body["device"] = "Forerunner 255";
        if (hr != null) { body["hr"] = hr; }
        if (hrv != null) { body["hrv"] = hrv; }
        if (spo2 != null) { body["spo2"] = spo2; }
        if (resp != null) { body["resp"] = resp; }
        if (stress != null) { body["stress"] = stress; }
        if (bodyBattery != null) { body["bodyBattery"] = bodyBattery; }
        if (steps != null) { body["steps"] = steps; }
        body["battery"] = System.getSystemStats().battery.toNumber();

        _busy = true;
        Communications.makeWebRequest(_url + "/api/watch", body, {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, method(:onResponse));
    }

    function onResponse(responseCode, data) as Void {
        _busy = false;
        ok = responseCode == 200;
        if (ok) {
            sent += 1;
            status = "Live · " + sent;
        } else if (responseCode == -1001) {
            status = "Needs https URL";
        } else if (responseCode == -104 || responseCode == -2) {
            status = "No phone link";
        } else if (responseCode == -300) {
            status = "Server timeout";
        } else if (responseCode == 429) {
            status = "Slow down (429)";
        } else {
            status = "Error " + responseCode;
        }
        WatchUi.requestUpdate();
    }

    // Send now (SELECT button), without waiting for the timer.
    function sendNow() as Void {
        tick();
    }
}
