import Foundation
import CoreText
import CoreGraphics

/// Kerning in scenes. A line uses its own settings, else the scene's (new scenes start optical). Scenes saved before kerning
/// existed have neither and keep the exact setting they always had, so they replay unchanged.
extension KerningSystem {
    /// The line's own kerning, else the scene's, else what scenes drew before kerning existed.
    public static func settings(_ element:SceneElement,genome:StyleGenome)->TextKerning {element.kerning ?? genome.kerning ?? .legacy(tracking:element.tracking ?? genome.tracking)}
    /// Whether the line is kerned by this system, rather than drawn as scenes were before it.
    public static func isKerned(_ element:SceneElement,genome:StyleGenome)->Bool {element.kerning != nil || genome.kerning != nil}

    /// A text element's line at the renderer's 100-unit font size.
    public static func layout(_ element:SceneElement,string:String,genome:StyleGenome,measure:Bool=false)->Layout {
        let font=FontLibrary.font(name:element.fontName ?? genome.font,variations:element.fontVariations)
        return layout(string,font:font,tracking:element.tracking ?? genome.tracking,kerning:settings(element,genome:genome),measure:measure)
    }

    public static func validate(_ genome:StyleGenome)throws {_=try genome.kerning?.validated();for e in genome.elements {_=try e.kerning?.validated()}}

    /// The scene's text lines, largest first: the ones a kerning pass offers.
    public static func lines(_ genome:StyleGenome)->[SceneElement] {
        genome.elements.filter{$0.kind=="text" && !($0.text ?? "").trimmingCharacters(in:.whitespacesAndNewlines).isEmpty && $0.physics==nil && $0.paperAttachment==nil}
            .sorted{$0.bounds.area>$1.bounds.area}
    }

    /// Gives every text line (or the lines in `ids`) these settings. Each line keeps its own gap values.
    public static func apply(_ kerning:TextKerning,to genome:StyleGenome,only ids:Set<String>?=nil)->StyleGenome {
        var scene=genome
        for i in scene.elements.indices where scene.elements[i].kind=="text" && (ids?.contains(scene.elements[i].sourceElementID) ?? true) {
            var k=kerning
            if let own=scene.elements[i].kerning,own.gapsText==scene.elements[i].text {k.gaps=own.gaps;k.gapsText=own.gapsText}else{k.gaps=[:];k.gapsText=nil}
            scene.elements[i].kerning=k
        }
        return scene
    }

    /// Removes all kerning settings, returning every line to how scenes were set before kerning existed.
    public static func reset(_ genome:StyleGenome)->StyleGenome {
        var scene=genome;scene.kerning=nil
        for i in scene.elements.indices {scene.elements[i].kerning=nil}
        return scene
    }
}
