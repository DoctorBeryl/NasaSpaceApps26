// AstraLink: live readings from the watch to AstraSight (docs/GARMIN.md)
import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class AstraLinkApp extends Application.AppBase {
    private var _link as AstraLink?;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
        var link = new AstraLink();
        _link = link;
        link.start();
    }

    function onStop(state as Dictionary?) as Void {
        var link = _link;
        if (link != null) {
            link.stop();
        }
    }

    // Untyped on purpose: the return type annotation differs between SDK versions.
    function getInitialView() {
        var link = _link;
        if (link == null) {
            link = new AstraLink();
            _link = link;
            link.start();
        }
        return [new AstraLinkView(link), new AstraLinkDelegate(link)];
    }
}
