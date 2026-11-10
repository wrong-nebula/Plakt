import Foundation
import CoreGraphics

public struct TypeSystemSemanticProfile: Codable, Sendable {
    public let id: String
    public let operation: String
    public let recipeHash: String
    public let sourceHash: String
    public let source: VisualEmbedding
    public let probes: [VisualEmbedding]
    public let inputs: [String]
    public let images: [URL]
    public let pixelHashes: [String]
    public let layouts: [[Double]]
    public let behaviorHash: String
    public let representativeScore: Double
}

public struct TypeSystemSemanticIndex: Codable, Sendable {
    public let version: String
    public let model: SigLIPManifest
    public let catalogHash: String
    public let profiles: [TypeSystemSemanticProfile]
    public let failures: [String:String]
    public let note: String
}

public enum TypeSystemSemanticAnalysis {
    public static func inputs(for operation: String) -> [String] {
        switch operation {
        case "grapheme-migration", "permutation-sequence": ["horizons", "material"]
        case "compensated-erosion": ["around|the|sound", "under|the|surface"]
        case "paired-columns", "reflection": ["FORM | TYPE", "OPEN | FORMS"]
        case "word-reflow": ["A FIELD OF OPEN POSSIBILITIES", "NEW WORDS FOR ANOTHER WORLD"]
        case "tittle-substitution": ["Infinite", "Edition"]
        default: ["FORM", "TYPE"]
        }
    }

    private static func embedding(_ vector: [Float], manifest: SigLIPManifest) -> VisualEmbedding {
        var data=Data();data.reserveCapacity(vector.count*4)
        for value in vector { var bits=value.bitPattern.littleEndian;withUnsafeBytes(of:&bits){data.append(contentsOf:$0)} }
        return VisualEmbedding(model:manifest.model,revision:1,dimensions:manifest.dimensions,scalar:"float32-le",data:data,
            preprocessing:manifest.preprocessing+"/"+manifest.fingerprint)
    }

    private static func pixels(_ image: CGImage) throws -> Data {
        var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        let okay=bytes.withUnsafeMutableBytes { memory -> Bool in
            guard let context=CGContext(data:memory.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,
                bytesPerRow:image.width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
            context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height));return true
        }
        guard okay else{throw PosterError.render}
        var result=Data("\(image.width)x\(image.height):".utf8);result.append(contentsOf:bytes);return result
    }

    /// Independent of the old descriptor/Vision bank: two fixed-copy rendered probes plus the actual source crop.
    public static func build(_ catalog: TypeSystemCatalog, output: URL, models: URL? = nil,
                             progress: @Sendable(String)->Void = {_ in}) throws -> TypeSystemSemanticIndex {
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        let runtime=try SigLIPEncoder(directory:models,cpuOnly:true,cacheDirectory:output.appending(path:"compiled"))
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        var profiles:[TypeSystemSemanticProfile]=[],failures:[String:String]=[:]
        for (i,system) in catalog.systems.enumerated() {
            try Task.checkCancellation()
            do {
                let profile=try autoreleasepool {()->TypeSystemSemanticProfile in
                    guard let crop=system.cropURL else{throw PosterError.invalid("No source crop for this type system.")}
                    let sourceHash=try LibraryRaster.hash(Data(contentsOf:crop))
                    let recipeHash=try LibraryRaster.hash(encoder.encode(system))
                    let folder=output.appending(path:system.id),saved=folder.appending(path:"profile.json")
                    if let data=try? Data(contentsOf:saved),let cached=try? JSONDecoder().decode(TypeSystemSemanticProfile.self,from:data),
                       cached.recipeHash==recipeHash,cached.sourceHash==sourceHash,
                       cached.source.preprocessing.hasSuffix(runtime.manifest.fingerprint),
                       cached.images.allSatisfy({FileManager.default.fileExists(atPath:$0.path)}) {return cached}
                    try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                    let source=try embedding(runtime.image(LibraryRaster.oriented(crop)),manifest:runtime.manifest)
                    var probes:[VisualEmbedding]=[],images:[URL]=[],hashes:[String]=[],layouts:[[Double]]=[],traces:[[String:Any]]=[]
                    let inputs=inputs(for:system.operation)
                    for (probe,input) in inputs.enumerated() {
                        let scene=try TypeSystemEngine.scene(system,input:input,foreground:"#171717",accent:"#171717",background:"#ffffff")
                        let image=try LibrarySceneRenderer.render(scene,width:512)
                        let url=folder.appending(path:"probe-\(probe).png")
                        try PosterRenderer.png(image,to:url)
                        images.append(url);hashes.append(LibraryRaster.hash(try pixels(image)))
                        probes.append(try embedding(runtime.image(image),manifest:runtime.manifest))
                        layouts.append(scene.elements.flatMap{[$0.bounds.x,$0.bounds.y,$0.bounds.width,$0.bounds.height,$0.rotation/180]})
                        let steps=scene.appliedTypeSystems?.first?.steps ?? []
                        traces.append(["steps":steps.map{["text":$0.text,"indexMap":$0.indexMap,"transform":$0.typeTransform ?? [:]] as [String:Any]}])
                    }
                    let behavior:[String:Any]=["operation":system.operation,"traces":traces,
                        "parameterKeys":system.parameters.keys.sorted(),"caseMode":system.textParameters["caseMode"] ?? "keep"]
                    let behaviorHash=LibraryRaster.hash(try JSONSerialization.data(withJSONObject:behavior,options:[.sortedKeys]))
                    let result=TypeSystemSemanticProfile(id:system.id,operation:system.operation,recipeHash:recipeHash,sourceHash:sourceHash,
                        source:source,probes:probes,inputs:inputs,images:images,pixelHashes:hashes,layouts:layouts,behaviorHash:behaviorHash,
                        representativeScore:system.representativeScore)
                    try LibraryRaster.write(result,to:saved);return result
                }
                profiles.append(profile)
            }catch is CancellationError{throw CancellationError()}
            catch{failures[system.id]=error.localizedDescription}
            if (i+1)%10==0 || i+1==catalog.systems.count{progress("SigLIP type systems: \(i+1)/\(catalog.systems.count), \(failures.count) failures")}
        }
        let result=TypeSystemSemanticIndex(version:"type-system-siglip-v1",model:runtime.manifest,
            catalogHash:try LibraryRaster.hash(encoder.encode(catalog)),profiles:profiles,failures:failures,
            note:"Original source crops and two neutral fixed-copy vector specimens are independently encoded. SigLIP affinity describes visual resemblance, not symbolic rule equivalence, aesthetic quality, or detection accuracy. Source method IDs and original observations are retained.")
        try LibraryRaster.write(result,to:output.appending(path:"semantic-index.json"))
        return result
    }
}
