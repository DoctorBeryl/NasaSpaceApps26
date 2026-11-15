// START/STOP (select) sends a reading right away. BACK exits as usual.
import Toybox.Lang;
import Toybox.WatchUi;

class AstraLinkDelegate extends WatchUi.BehaviorDelegate {
    private var _link as AstraLink;

    function initialize(link as AstraLink) {
        BehaviorDelegate.initialize();
        _link = link;
    }

    function onSelect() as Boolean {
        _link.sendNow();
        return true;
    }
}
