import Foundation

public struct PaperReliefSurface:Codable,Sendable,Identifiable {
    public var id:String
    public var kind:String
    public var bounds:UnitBox
    public var level:Double
    public var hinge:Int
    public var dark:Bool
    public var role:String
    public var labelBounds:UnitBox?=nil
    public var labelRotation:Double
    public init(id:String,kind:String,bounds:UnitBox,level:Double=0,hinge:Int=0,dark:Bool=false,role:String="title",labelRotation:Double=0){self.id=id;self.kind=kind;self.bounds=bounds;self.level=level;self.hinge=hinge;self.dark=dark;self.role=role;self.labelRotation=labelRotation}
}
public struct PaperReliefGenome:Codable,Sendable {
    public var version="paper-relief-genome-v1"
    public var aspect:Double?=nil
    public var surfaces:[PaperReliefSurface]
    public var titleOverride:String?
    public init(surfaces:[PaperReliefSurface],titleOverride:String?=nil){self.aspect=10.0/7.0;self.surfaces=surfaces;self.titleOverride=titleOverride}
    public func validate()throws {
        guard version=="paper-relief-genome-v1",(1...128).contains(surfaces.count),Set(surfaces.map(\.id)).count==surfaces.count else{throw PosterError.invalid("Invalid paper surface IDs or version.")}
        if let aspect{guard aspect.isFinite,(0.4...3.5).contains(aspect) else{throw PosterError.invalid("Invalid paper proportions.")}}
        for s in surfaces {
            guard s.labelBounds?.valid ?? true else{throw PosterError.invalid("Invalid surface label anchor.")}
            guard !s.id.isEmpty,["panel","flap","recess","hole","disc"].contains(s.kind),s.bounds.valid,s.level.isFinite,(-2...3).contains(s.level),(0...5).contains(s.hinge),s.labelRotation.isFinite,abs(s.labelRotation)<=360 else{throw PosterError.invalid("Invalid paper surface geometry.")}
        }
        if let titleOverride{try PaperReliefCustomization(title:titleOverride).validate()}
    }
}
public struct PaperSurfaceAttachment:Codable,Sendable {
    public var parentID:String
    public var surfaceID:String
    public var localBounds:UnitBox
    public var rotation:Double
    public var role:String
    public init(parentID:String,surfaceID:String,localBounds:UnitBox,rotation:Double=0,role:String="title"){self.parentID=parentID;self.surfaceID=surfaceID;self.localBounds=localBounds;self.rotation=rotation;self.role=role}
}
public struct PaperReliefCustomization:Codable,Sendable {
    public var version="paper-relief-customization-v1"
    public var title:String?
    public var surfaces:[PaperReliefSurface]?
    public init(title:String?=nil,surfaces:[PaperReliefSurface]?=nil){self.title=title;self.surfaces=surfaces}
    public func validate()throws {
        guard version=="paper-relief-customization-v1" else{throw PosterError.invalid("Unsupported paper customization.")}
        if let title{guard !title.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,title.count<=120 else{throw PosterError.invalid("Enter 1–120 visible surface-title characters.")}}
        if let surfaces{try PaperReliefGenome(surfaces:surfaces).validate()}
    }
}
