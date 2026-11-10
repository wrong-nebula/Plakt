import Foundation
import CoreGraphics

/// The studio's judging reference, measured once for a source study: its Vision
/// embedding (scoring and donor choice) and its measured palette (scene colours).
public struct SourceStudyReference:Sendable {
    public let url:URL
    let embedding:VisualEmbedding
    let colors:PosterColorProfile

    public init(url:URL,crop:Bool) throws {
        var image=try PosterRenderer.load(url)
        if crop {
            // Same proportions as PosterJudge: drops the margins of a photographed poster.
            let rect=CGRect(x:Double(image.width)*0.077,y:Double(image.height)*0.055,width:Double(image.width)*0.845,height:Double(image.height)*0.88).integral
            if let cropped=image.cropping(to:rect){image=cropped}
        }
        self.url=url
        embedding=try LibraryVisualEmbedder().embed(image)
        colors=try PosterColorAnalyzer().analyze(image)
    }

    /// Visual similarity blended with palette similarity, both in 0...1.
    func similarity(_ embedding:VisualEmbedding,colors other:PosterColorProfile?)throws->Double {
        let visual=exp(-(try embedding.distance(to:self.embedding))*1.4)
        guard let other else{return visual}
        return visual*0.45+palette(other)*0.55
    }
    func palette(_ other:PosterColorProfile)->Double {
        let a=colors.colorEmbedding,b=other.colorEmbedding
        guard a.count==b.count,!a.isEmpty else{return 0}
        let dot=zip(a,b).reduce(0.0){$0+$1.0*$1.1}
        let norm=sqrt(a.reduce(0.0){$0+$1*$1})*sqrt(b.reduce(0.0){$0+$1*$1})
        return norm>0 ? max(0,dot/norm):0
    }

    /// Paper, ink and accent taken from the reference: the dominant swatch is the
    /// paper, the highest-contrast swatch the ink, the most chromatic remaining one the accent.
    var scenePalette:(background:String,foreground:String,accent:String) {
        let swatches=colors.swatches
        let background=swatches.first?.hex ?? "#f2efe6"
        let foreground=(swatches.map(\.hex)+["#111111","#f7f3e9"]).max{SourceLayoutDNA.contrast($0,background)<SourceLayoutDNA.contrast($1,background)} ?? "#111111"
        // Accents mark display type and forms, so a hue contrast (red on blue) counts even
        // where luminance contrast is low; only near-identical colours are excluded.
        let backgroundLab=PerceptualColor.fromHex(background)
        let accent=swatches.filter{$0.hex != foreground && $0.chroma>0.055 && PerceptualColor.squared(PerceptualColor.fromHex($0.hex),backgroundLab)>0.04}.max{$0.chroma*$0.proportion.squareRoot()<$1.chroma*$1.proportion.squareRoot()}?.hex ?? foreground
        return(background,foreground,accent)
    }
}
