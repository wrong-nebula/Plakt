import Foundation

/// One glyph as a rigid body: its outline at rest and its pose at the simulated moment.
public struct PhysicsGlyph:Codable,Sendable {
    public var id:String
    public var character:String
    public var glyph:Int
    public var font:String
    public var fontVariations:[String:Double]?=nil
    /// Ink from the glyph's source element; nil uses the physics element's inks.
    public var color:String?=nil
    /// Affine a, b, c, d, tx, ty from the glyph outline (100-unit font, y up) to world units at rest.
    public var rest:[Double]
    /// Centre of mass at rest. The pose moves this point.
    public var center:[Double]
    /// Centre of mass x, y and rotation (radians, clockwise on the page) at the snapshot.
    public var pose:[Double]
    /// Earlier poses, oldest first, evenly spaced along the path.
    public var trail:[[Double]]?=nil
    /// fixed, fallen or hanging.
    public var state:String
    public var pin:[Double]?=nil
    public var source:String
    /// Link points in world units at rest (garland rings); they move with the glyph's pose.
    public var rivets:[[Double]]?=nil
    /// Pieces of a glyph that broke on impact. When present they are drawn instead of the whole glyph, which keeps
    /// its pose at the moment it broke.
    public var shards:[PhysicsShard]?=nil
    public static let states=["fixed","fallen","hanging"]
}

/// A piece of a broken glyph: the glyph's outline clipped to convex cells, moved as one rigid body.
public struct PhysicsShard:Codable,Sendable {
    /// Convex cells in world units at rest; together the shards' cells cover the whole glyph.
    public var cells:[[[Double]]]
    /// The shard's centre of mass at rest and its x, y, rotation at the snapshot, as for a glyph.
    public var center:[Double]
    public var pose:[Double]
}

/// Scenery that letters land on: a shelf or pivot (fixed) or a beam (moved by the simulation), saved as its
/// world polygon at the snapshot.
public struct PhysicsFixture:Codable,Sendable {
    public var role:String
    public var points:[[Double]]
    public static let roles=["shelf","beam","pivot"]
}

/// Saved result of a simulation. The world is one unit wide, `aspect` units tall, and fills its element's field.
public struct PhysicsTypeGenome:Codable,Sendable {
    public var version="physics-type-genome-v1"
    public var aspect:Double
    public var text:String
    public var glyphs:[PhysicsGlyph]
    /// Resting surface (world y), or nil when letters fall out of the field.
    public var floor:Double?
    public var rule:Bool
    public var time:Double
    public var steps:Int
    public var settled:Bool
    /// recipe: laid out from the title by the system. scene: made from existing text elements.
    public var origin:String
    public var titleOverride:String?=nil
    /// Headline font of a recipe genome; a different element font or title triggers a new simulation.
    public var font:String?=nil
    public var fontVariations:[String:Double]?=nil
    /// Text elements that were fixed obstacles in the world.
    public var obstacleIDs:[String]?=nil
    /// Top of a recipe headline in world units, kept when the title is replaced.
    public var top:Double?=nil
    /// Original text elements of a scene-origin genome, kept so the type can be restored or simulated again.
    public var sources:[SceneElement]?=nil
    public var fixtures:[PhysicsFixture]?=nil
    /// Nails fixed in the wall, in world units, whether or not a letter still hangs on them.
    public var nails:[[Double]]?=nil
    public func validate()throws {
        guard version=="physics-type-genome-v1",aspect.isFinite,(0.05...20).contains(aspect),glyphs.count<=800,["recipe","scene"].contains(origin) else{throw PosterError.invalid("Invalid physics type genome.")}
        guard time.isFinite,time>=0,floor?.isFinite ?? true,top?.isFinite ?? true,Set(glyphs.map(\.id)).count==glyphs.count else{throw PosterError.invalid("Invalid physics simulation record.")}
        var scenery:[Double]=[]
        for f in fixtures ?? [] {
            guard PhysicsFixture.roles.contains(f.role),(3...16).contains(f.points.count),f.points.allSatisfy({$0.count==2}) else{throw PosterError.invalid("Invalid physics fixture.")}
            for point in f.points{scenery+=point}
        }
        for n in nails ?? []{guard n.count==2 else{throw PosterError.invalid("Invalid physics nail.")};scenery+=n}
        guard (fixtures ?? []).count<=64,(nails ?? []).count<=1600,scenery.allSatisfy({$0.isFinite && abs($0)<1e6}) else{throw PosterError.invalid("Invalid physics scenery.")}
        for g in glyphs {
            var numbers:[Double]=g.rest+g.center+g.pose
            for pose in g.trail ?? []{numbers+=pose}
            for point in g.rivets ?? []{numbers+=point}
            numbers+=g.pin ?? []
            for shard in g.shards ?? [] {
                guard shard.center.count==2,shard.pose.count==3,(1...32).contains(shard.cells.count),shard.cells.allSatisfy({(3...48).contains($0.count) && $0.allSatisfy{$0.count==2}}) else{throw PosterError.invalid("Invalid glyph shard.")}
                numbers+=shard.center;numbers+=shard.pose
                for cell in shard.cells{for point in cell{numbers+=point}}
            }
            guard (g.shards ?? []).count<=32 else{throw PosterError.invalid("Too many glyph shards.")}
            guard g.rest.count==6,g.center.count==2,g.pose.count==3,(g.trail ?? []).allSatisfy({$0.count==3}),g.pin.map({$0.count==2}) ?? true,(g.rivets ?? []).allSatisfy({$0.count==2}),numbers.allSatisfy(\.isFinite),numbers.allSatisfy({abs($0)<1e6}) else{throw PosterError.invalid("Invalid physics glyph pose.")}
            guard PhysicsGlyph.states.contains(g.state),(0...65535).contains(g.glyph),!g.font.isEmpty,g.color.map(Self.isHex) ?? true else{throw PosterError.invalid("Invalid physics glyph.")}
        }
        if let titleOverride{try GravityTypeCustomization(title:titleOverride).validate()}
    }
    static func isHex(_ s:String)->Bool{s.count==7 && s.hasPrefix("#") && Int(s.dropFirst(),radix:16) != nil}
}

public extension PosterShapeLibrary {
    static let gravityTypeRecipes:[PosterShapeRecipe] = {
        guard let url=PosterResources.bundle.url(forResource:"GravityTypeRecipes",withExtension:"json",subdirectory:"Resources/ShapeLibrary"),let data=try? Data(contentsOf:url) else{return []}
        return (try? JSONDecoder().decode([PosterShapeRecipe].self,from:data)) ?? []
    }()
}

public struct GravityTypeCustomization:Codable,Sendable {
    public var version="gravity-type-customization-v1"
    public var title:String?
    public init(title:String?=nil){self.title=title}
    public func validate()throws {
        guard version=="gravity-type-customization-v1" else{throw PosterError.invalid("Unsupported fallen-letters customization.")}
        if let title{guard !title.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,title.count<=120 else{throw PosterError.invalid("Enter 1–120 visible characters for the falling title.")}}
    }
}
