import AppKit
import PosterCore

/// For checks: with the launch argument -PosterLabKerningSnapshot set to a path prefix, the kerning sheet writes PNGs of itself as opened
/// (-1.png), after a scripted pass (-2.png: optical on every line, a gap selected and kerned, a pair kerned everywhere)
/// and in proof mode is skipped. The window draws itself, so no screen-recording permission is needed.
@MainActor enum KerningSnapshot {
    static var prefix:String? {StudioLaunch.kerningSnapshot}
    static func run(_ model:KerningModel) async {
        guard let prefix else{return}
        try? await Task.sleep(for:.seconds(3));write(prefix+"-1.png")
        model.kerning=TextKerning(mode:.optical);model.applyToAll()
        model.step(1);model.step(1);model.nudge(-30)
        model.everyPair=true;model.step(1);model.nudge(-20);model.everyPair=false
        try? await Task.sleep(for:.seconds(3));write(prefix+"-2.png")
        model.showBefore=true
        try? await Task.sleep(for:.seconds(2));write(prefix+"-3.png")
    }
    static func write(_ path:String) {
        // The sheet is its own window, attached to the main one (or to a source-study sheet).
        let sheets=NSApp.windows.filter{$0.isSheet && $0.isVisible}
        guard let window=sheets.last ?? NSApp.keyWindow,let view=window.contentView,
              let rep=view.bitmapImageRepForCachingDisplay(in:view.bounds) else{return}
        view.cacheDisplay(in:view.bounds,to:rep)
        try? rep.representation(using:.png,properties:[:])?.write(to:URL(fileURLWithPath:path))
    }
}
