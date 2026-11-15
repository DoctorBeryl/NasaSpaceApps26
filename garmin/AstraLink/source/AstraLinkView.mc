// One screen: big heart rate, SpO2 / HRV / breathing row, the pair code, and the link status.
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class AstraLinkView extends WatchUi.View {
    // AstraSight colors (css/styles.css tokens)
    const CYAN = 0x5EF2FF;
    const OK = 0x4DFFB0;
    const WARN = 0xFFC65C;
    const DIM = 0x9AA6C8;

    private var _link as AstraLink;

    function initialize(link as AstraLink) {
        View.initialize();
        _link = link;
    }

    private function str(v, suffix as String) as String {
        if (v == null) {
            return "--";
        }
        return v.toNumber().toString() + suffix;
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var center = Graphics.TEXT_JUSTIFY_CENTER;
        var l = _link;

        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        dc.setColor(CYAN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 8 / 100, Graphics.FONT_XTINY, "ASTRALINK", center);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 17 / 100, Graphics.FONT_NUMBER_MEDIUM, str(l.hr, ""), center);
        dc.setColor(DIM, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 38 / 100, Graphics.FONT_XTINY, "bpm", center);

        var y = h * 48 / 100;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w * 24 / 100, y, Graphics.FONT_TINY, str(l.spo2, "%"), center);
        dc.drawText(cx, y, Graphics.FONT_TINY, str(l.hrv, ""), center);
        dc.drawText(w * 76 / 100, y, Graphics.FONT_TINY, str(l.resp, ""), center);
        dc.setColor(DIM, Graphics.COLOR_TRANSPARENT);
        var ly = y + dc.getFontHeight(Graphics.FONT_TINY) - 2;
        dc.drawText(w * 24 / 100, ly, Graphics.FONT_XTINY, "SpO2", center);
        dc.drawText(cx, ly, Graphics.FONT_XTINY, "HRV ms", center);
        dc.drawText(w * 76 / 100, ly, Graphics.FONT_XTINY, "br/min", center);

        dc.setColor(DIM, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 70 / 100, Graphics.FONT_XTINY, "PAIR CODE", center);
        dc.setColor(CYAN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 76 / 100, Graphics.FONT_SMALL, l.code, center);

        dc.setColor(l.ok ? OK : WARN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 88 / 100, Graphics.FONT_XTINY, l.status, center);
    }
}
