import Foundation
import CoreGraphics

public enum StylePosterRenderer {
    public static func genome(style:String,seed:UInt64,copy:PosterCopy=PosterCopy())throws->StyleGenome {
        guard StyleCatalog.categories.contains(where:{$0.id==style}) else{throw PosterError.invalid("Unknown style.")}
        var genome=Genome.random(seed:seed);genome.renderStyle=style
        return SourceComposition.recipe(genome,copy:copy)
    }
    public static func render(style:String,seed:UInt64,width:Int=480)throws->CGImage {
        guard StyleCatalog.categories.contains(where:{$0.id==style}) else{throw PosterError.invalid("Unknown style.")}
        var genome=Genome.random(seed:seed);genome.renderStyle=style
        let scene=SourceComposition.recipe(genome,copy:PosterCopy())
        return try LibrarySceneRenderer.render(scene,width:width,seed:seed)
    }
    static func draw(_ g:Genome,copy:PosterCopy,stage:ConstructionStage,in ctx:CGContext) {
        let scene=SourceComposition.recipe(g,copy:copy)
        ctx.saveGState();ctx.scaleBy(x:1000,y:1414)
        LibrarySceneRenderer.drawNormalized(scene,ctx:ctx,width:1000,height:1414,seed:g.seed,variation:0,title:nil,stage:stage)
        ctx.restoreGState()
    }
}
