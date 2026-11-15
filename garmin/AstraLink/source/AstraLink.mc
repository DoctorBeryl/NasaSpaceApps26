// Reads every relevant sensor on the watch and posts it to <serverUrl>/api/watch every few
// seconds, through the phone's Garmin Connect app (Bluetooth). Server side: server/watch.js.
//
// Live (seconds):
//   hr            optical heart rate (Sensor.Info.heartRate)
//   hrv, sdnn     RMSSD and SDNN in ms over the last ~60 beat-to-beat intervals
//   spo2          Pulse Ox: live when the sensor gives it, else the newest stored reading under 30 min old
//   motion        movement intensity, mean deviation from 1 g in milli-g (accelerometer, 10 Hz)
//   pressure      barometer, kPa (cabin-pressure stand-in on the ground)
//   temp          watch temperature sensor, °C (wrist and air, NOT core temperature)
// Minutes:
//   resp          respiration rate, breaths/min
//   stress        Garmin stress score 0-100
//   bodyBattery   Garmin Body Battery 0-100 (energy reserve)
// Today:
//   steps, calories (kcal), activeMin (intensity minutes this week), floors, recoveryHours
// Profile (read once):
//   restingHr, maxHr, vo2max
// Device: battery %
import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Math;
import Toybox.PersistedContent;
import Toybox.Sensor;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;
import Toybox.Timer;
import Toybox.UserProfile;
import Toybox.WatchUi;

class AstraLink {
    const INTERVAL_MS = 3000;

    var code as String = "";
    // live
    var hr as Number? = null;
    var hrv as Float? = null;
    var sdnn as Float? = null;
    var spo2 as Number? = null;
    var motion as Number? = null;
    var pressure as Float? = null;
    var temp as Float? = null;
    // minutes
    var resp as Number? = null;
    var stress as Number? = null;
    var bodyBattery as Number? = null;
    // today
    var steps as Number? = null;
    var calories as Number? = null;
    var activeMin as Number? = null;
    var floors as Number? = null;
    var recoveryHours as Number? = null;
    // profile
    var restingHr as Number? = null;
    var maxHr as Number? = null;
    var vo2max as Number? = null;

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
                    :accelerometer => { :enabled => true, :sampleRate => 10 },
                    :heartBeatIntervals => { :enabled => true }
                });
            } catch (e) {
                // Not supported here: HRV and motion just stay empty.
            }
        }
        readProfile();
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

    // ---------- live sensors ----------
    function onSensor(info as Sensor.Info) as Void {
        if (info.heartRate != null) {
            hr = info.heartRate;
        }
        if (info has :oxygenSaturation && info.oxygenSaturation != null && info.oxygenSaturation > 0) {
            spo2 = info.oxygenSaturation;
            _spo2Live = true;
        }
        if (info.pressure != null) {
            pressure = info.pressure / 1000.0; // Pa -> kPa
        }
        if (info.temperature != null) {
            temp = info.temperature.toFloat();
        }
        WatchUi.requestUpdate();
    }

    function onSensorData(data as Sensor.SensorData) as Void {
        if (data.accelerometerData != null) {
            readMotion(data.accelerometerData);
        }
        if (data.heartRateData != null && data.heartRateData.heartBeatIntervals != null) {
            var ivs = data.heartRateData.heartBeatIntervals;
            for (var i = 0; i < ivs.size(); i++) {
                var ms = ivs[i];
                if (ms != null && ms > 300 && ms < 2000) {
                    _rr.add(ms);
                }
            }
            if (_rr.size() > 60) {
                _rr = _rr.slice(_rr.size() - 60, null);
            }
            computeHrv();
        }
    }

    // Mean |magnitude - 1 g| over the last second, smoothed. ~0-30 still, 100+ walking, 400+ running.
    private function readMotion(acc) as Void {
        var xs = acc.x;
        var ys = acc.y;
        var zs = acc.z;
        if (xs == null || ys == null || zs == null || xs.size() == 0) {
            return;
        }
        var sum = 0.0;
        var n = xs.size();
        for (var i = 0; i < n; i++) {
            var x = xs[i].toFloat();
            var y = ys[i].toFloat();
            var z = zs[i].toFloat();
            var dev = Math.sqrt(x * x + y * y + z * z) - 1000.0;
            sum += dev < 0 ? -dev : dev;
        }
        var now = sum / n;
        var prev = motion;
        motion = (prev == null ? now : prev * 0.7 + now * 0.3).toNumber();
    }

    // RMSSD and SDNN, skipping successive jumps over 20 % (artifacts, ectopic-looking beats).
    private function computeHrv() as Void {
        if (_rr.size() < 8) {
            return;
        }
        var sum = 0.0;
        var n = 0;
        var mean = 0.0;
        for (var i = 0; i < _rr.size(); i++) {
            mean += _rr[i];
        }
        mean = mean / _rr.size();
        var varSum = 0.0;
        for (var i = 0; i < _rr.size(); i++) {
            var dm = _rr[i] - mean;
            varSum += dm * dm;
            if (i == 0) {
                continue;
            }
            var prev = _rr[i - 1];
            var d = (_rr[i] - prev).toFloat();
            if (d.abs() > prev * 0.2) {
                continue;
            }
            sum += d * d;
            n += 1;
        }
        if (n >= 5) {
            hrv = Math.sqrt(sum / n).toFloat();
        }
        sdnn = Math.sqrt(varSum / _rr.size()).toFloat();
    }

    // ---------- slower readings ----------
    private function readSlow() as Void {
        var am = loose(ActivityMonitor.getInfo());
        if (am has :respirationRate && am.respirationRate != null) {
            resp = am.respirationRate;
        }
        if (am.steps != null) {
            steps = am.steps;
        }
        if (am.calories != null) {
            calories = am.calories;
        }
        if (am has :floorsClimbed && am.floorsClimbed != null) {
            floors = am.floorsClimbed;
        }
        if (am has :activeMinutesWeek && am.activeMinutesWeek != null) {
            activeMin = am.activeMinutesWeek.total;
        }
        if (am has :timeToRecovery && am.timeToRecovery != null) {
            recoveryHours = am.timeToRecovery;
        }
        if (am has :stressScore && am.stressScore != null) {
            stress = am.stressScore;
        } else if (SensorHistory has :getStressHistory) {
            stress = toNum(newest(SensorHistory.getStressHistory({ :period => 1 }), 0));
        }
        if (SensorHistory has :getBodyBatteryHistory) {
            bodyBattery = toNum(newest(SensorHistory.getBodyBatteryHistory({ :period => 1 }), 0));
        }
        if (!_spo2Live && SensorHistory has :getOxygenSaturationHistory) {
            spo2 = toNum(newest(SensorHistory.getOxygenSaturationHistory({ :period => 1 }), 1800));
        }
        if (pressure == null && SensorHistory has :getPressureHistory) {
            var p = newest(SensorHistory.getPressureHistory({ :period => 1 }), 1800);
            if (p != null) {
                pressure = p / 1000.0;
            }
        }
        if (temp == null && SensorHistory has :getTemperatureHistory) {
            var t = newest(SensorHistory.getTemperatureHistory({ :period => 1 }), 1800);
            if (t != null) {
                temp = t.toFloat();
            }
        }
    }

    // Resting HR, max HR and VO2 max don't change during a demo: read them once.
    private function readProfile() as Void {
        try {
            var p = loose(UserProfile.getProfile());
            if (p has :restingHeartRate && p.restingHeartRate != null && p.restingHeartRate > 0) {
                restingHr = p.restingHeartRate;
            } else if (p has :averageRestingHeartRate && p.averageRestingHeartRate != null) {
                restingHr = p.averageRestingHeartRate;
            }
            if (p has :vo2maxRunning && p.vo2maxRunning != null && p.vo2maxRunning > 0) {
                vo2max = p.vo2maxRunning;
            }
            var zones = UserProfile.getHeartRateZones(UserProfile.HR_ZONE_SPORT_GENERIC);
            if (zones != null && zones.size() > 0) {
                maxHr = zones[zones.size() - 1]; // the last zone boundary is max HR
            }
        } catch (e) {
            // Profile not available: leave these empty.
        }
    }

    // Newest sample's value, or null. maxAgeSec > 0 also drops samples older than that.
    private function newest(iter, maxAgeSec as Number) {
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
        return s.data;
    }

    // Returns its argument untyped, so members that only exist on newer SDKs (guarded by `has`)
    // don't fail the compile-time type check.
    private function loose(x) {
        return x;
    }

    private function toNum(v) as Number? {
        return v == null ? null : v.toNumber();
    }

    // ---------- upload ----------
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
        put(body, "hr", hr);
        put(body, "hrv", hrv);
        put(body, "sdnn", sdnn);
        put(body, "spo2", spo2);
        put(body, "motion", motion);
        put(body, "pressure", pressure);
        put(body, "temp", temp);
        put(body, "resp", resp);
        put(body, "stress", stress);
        put(body, "bodyBattery", bodyBattery);
        put(body, "steps", steps);
        put(body, "calories", calories);
        put(body, "activeMin", activeMin);
        put(body, "floors", floors);
        put(body, "recoveryHours", recoveryHours);
        put(body, "restingHr", restingHr);
        put(body, "maxHr", maxHr);
        put(body, "vo2max", vo2max);
        body["battery"] = System.getSystemStats().battery.toNumber();

        _busy = true;
        Communications.makeWebRequest(_url + "/api/watch", body, {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        }, method(:onResponse));
    }

    private function put(body as Dictionary, key as String, v) as Void {
        if (v != null) {
            body[key] = v;
        }
    }

    function onResponse(responseCode as Number, data as Null or ByteArray or Dictionary or String or PersistedContent.Iterator) as Void {
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

    // Send now (START button), without waiting for the timer.
    function sendNow() as Void {
        tick();
    }
}
