import Foundation

public struct ShapeSystemGenome:Codable,Identifiable,Sendable {
    public let id:String
    public let name:String
    public let operation:String
    public let sourcePosterID:String
    public let sourceImageURL:URL
    public let sourceBounds:UnitBox
    public let promptID:String
    public let retrievalSimilarity:Double?
    public let seed:UInt64?
    public let evidenceURL:URL?
    public let sourceImageSHA256:String?
    public let status:String
    public let explanation:String
    public let invariants:[String]
    public let parameters:[String:Double]
    public let aspect:Double
    public let foreground:String
    public let background:String
}
public struct ShapeSystemCatalog:Codable,Sendable {
    public let version:String
    public let systems:[ShapeSystemGenome]
    public let note:String
}
public enum ShapeSystemLibrary {
    public static let catalog:ShapeSystemCatalog? = {
        guard let url=PosterResources.bundle.url(forResource:"catalog",withExtension:"json",subdirectory:"Resources/ShapeSystems"),let data=try? Data(contentsOf:url) else{return nil}
        return try? JSONDecoder().decode(ShapeSystemCatalog.self,from:data)
    }()
    public static var systems:[ShapeSystemGenome]{catalog?.systems ?? []}
}
public enum ShapeSystemEngine {
    public static let operations:Set<String>=Set(["spiral-stack","wave-lines","mirror-arcs","folded-tiles","circle-clusters","perforated-grid","radial-spokes","petal-rosette"]).union(ReviewedShapeGeometry.operations)
    public static func scene(_ system:ShapeSystemGenome,overrides:[String:Double]=[:])throws->StyleGenome {
        let parameters=system.parameters.merging(overrides){_,new in new}
        guard overrides.keys.allSatisfy({system.parameters[$0] != nil}) else{throw PosterError.invalid("Unknown shape control. Use the parameter names in the saved system.json.")}
        for key in ["count","rows","columns","holes","sides","rings"] {
            if let value=parameters[key],value<1 || value.rounded() != value{throw PosterError.invalid("Shape counts must be positive whole numbers.")}
        }
        guard operations.contains(system.operation),parameters.values.allSatisfy(\.isFinite),system.aspect.isFinite,(0.35...3.7).contains(system.aspect) else{throw PosterError.invalid("Invalid shape system or parameters.")}
        if ReviewedShapeGeometry.operations.contains(system.operation) {
            guard let recipe=PosterShapeLibrary.recipe(system.operation) else{throw PosterError.invalid("Missing reviewed shape recipe.")}
            _ = try recipe.values(parameters)
        }
        var geometry=parameters
        if let seed=system.seed{geometry["shapeSeed"]=Double(seed%9_000_000)}
        let element=SceneElement(sourceElementID:"shape-system:"+system.id,kind:"shape",bounds:UnitBox(x:0.07,y:0.06,width:0.86,height:0.88),rotation:0,text:nil,color:system.foreground,shape:"system-"+system.operation,outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,geometry:geometry,sourcePosterID:system.sourcePosterID,sourceAnchor:system.sourceBounds)
        var scene=StyleGenome(version:"shape-system-scene-v1",posterID:system.id,aspect:system.aspect,background:system.background,font:"HelveticaNeue",textScale:1,tracking:0,elements:[element],score:nil,fittingStatus:system.status+"; "+system.explanation,sourceEmbeddingModel:"source-region discovery; visually-reviewed procedural interpretation")
        scene.composition=CompositionPlan.scene(scene,origin:"declared-shape-system")
        scene.composition?.description=system.name+". "+system.invariants.joined(separator:" ")
        return scene
    }
}
