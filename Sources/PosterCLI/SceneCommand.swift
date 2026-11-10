import Foundation
import PosterCore

struct SceneCommand {
    static func run(_ args:[String])throws {
        guard args.first=="render",!args.contains("--help") else {
            print("poster scene render --genome candidate-genome.json --out output/selected [--seed 0] [--width 3508] [--stage blockout|primary|secondary|finished]")
            return
        }
        var values:[String:String]=[:],i=1
        while i<args.count {
            guard ["--genome","--out","--seed","--width","--stage"].contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown scene render option.")}
            values[args[i]]=args[i+1];i+=2
        }
        guard let input=values["--genome"],let out=values["--out"],let width=Int(values["--width"] ?? "3508"),let seed=UInt64(values["--seed"] ?? "0"),let stage=ConstructionStage(rawValue:values["--stage"] ?? "finished") else{throw PosterError.invalid("Scene render requires --genome, --out and valid width, seed and stage.")}
        let data=try Data(contentsOf:URL(fileURLWithPath:input)),decoder=JSONDecoder()
        let hybrid=try? decoder.decode(HybridScene.self,from:data)
        let variation=try? decoder.decode(TypeSystemVariant.self,from:data)
        let scene=try hybrid?.genome ?? variation?.replay() ?? decoder.decode(StyleGenome.self,from:data)
        let renderSeed=values["--seed"]==nil ? hybrid?.seed ?? seed:seed
        guard scene.elements.compactMap(\.clipBounds).allSatisfy(\.valid) else{throw PosterError.invalid("Scene contains invalid clip bounds.")}
        let root=URL(fileURLWithPath:out)
        guard !FileManager.default.fileExists(atPath:root.appending(path:"poster.png").path) else{throw PosterError.invalid("Scene export already exists. Choose a new folder.")}
        let image=try LibrarySceneRenderer.render(scene,width:width,seed:renderSeed,stage:stage)
        try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
        try PosterRenderer.png(image,to:root.appending(path:"poster.png"))
        try LibrarySceneRenderer.pdf(scene,to:root.appending(path:"poster.pdf"),seed:renderSeed)
        try LibraryRaster.write(scene,to:root.appending(path:"genome.json"))
        try scene.composition?.write(to:root)
        try LibraryRaster.write(PosterColorAnalyzer().analyze(image),to:root.appending(path:"colors.json"))
        try LibraryRaster.write(["source":URL(fileURLWithPath:input).standardizedFileURL.path,"seed":String(renderSeed),"width":String(width),"pngStage":stage.rawValue,"pdfStage":"finished"],to:root.appending(path:"reproduction.json"))
        print("Exported \(width)px PNG, outlined vector PDF and editable scene: \(root.path)")
    }
}
