import Foundation
import CoreGraphics
import CryptoKit
import PosterCore

extension PosterChecks {
    static func checkShapeLibrary()throws {
        let recipes=PosterShapeLibrary.recipes
        try require(recipes.count >= (PosterShapeLibrary.catalog?.recipes.count ?? 45) + 17 && Set(recipes.map(\.id)).count==recipes.count,"Shape catalog missing or duplicate IDs")
        try require(PosterShapeLibrary.surveyRecipes.count==17,"Visual survey recipes missing")
        try require(PosterShapeLibrary.contourRecipes.count==2,"Contour recipes missing")
        try checkContourSystems()
        try checkPaperRelief()
        var hashes:Set<String>=[],unresponsive:[String]=[]
        func pixels(_ preset:PosterShapePreset)throws->Data {let image=try LibrarySceneRenderer.render(PosterShapeLibrary.scene(preset),width:260);return Data(try rgba(image))}
        for recipe in recipes {
            let preset=PosterShapePreset(recipe:recipe,seed:817)
            let first=try pixels(preset),again=try pixels(JSONDecoder().decode(PosterShapePreset.self,from:JSONEncoder().encode(preset)))
            try require(first==again,"Preset replay differs: \(recipe.id)")
            let bytes=[UInt8](first)
            let different = stride(from: 0, to: bytes.count, by: 4).filter { offset in
                let red = abs(Int(bytes[offset]) - Int(bytes[0]))
                let green = abs(Int(bytes[offset + 1]) - Int(bytes[1]))
                let blue = abs(Int(bytes[offset + 2]) - Int(bytes[2]))
                return red + green + blue > 30
            }.count
            try require(different>200,"Empty shape render: \(recipe.id)")
            let hash=SHA256.hash(data:first).map{String(format:"%02x",$0)}.joined()
            try require(hashes.insert(hash).inserted,"Duplicate geometry: \(recipe.id)")
            // Compare every advertised parameter at its bounds, not just stored JSON.
            for p in recipe.parameters {
                var low=[p.id:p.min],high=[p.id:p.max]
                if recipe.id=="survey-sliced-orb",["slices","phase"].contains(p.id){low["displacement"]=0.08;high["displacement"]=0.08;low["gap"]=0.012;high["gap"]=0.012}
                if let conditions=p.activeWhen{low.merge(conditions){_,b in b};high.merge(conditions){_,b in b}}
                if let options=p.activeIn{for (key,list) in options{if let first=list.first{low[key]=first;high[key]=first}}}
                // Row depth needs several rows to move; screen and hatch styles need shading to draw.
                if recipe.id=="survey-sawtooth-spring",p.id=="depth"{low["copies"]=8;high["copies"]=8}
                // A lattice size field needs falloff to show.
                if recipe.id=="survey-circle-pack",p.id=="pattern"{low["falloff"]=0.8;high["falloff"]=0.8}
                if recipe.id=="survey-sawtooth-spring",p.id=="shadeStyle"{low["shade"]=1;high["shade"]=1}
                if recipe.id==ContourSystems.typeID,p.id=="preserveCounters"{low["expansion"]=0.10;high["expansion"]=0.10}
                let lo=try pixels(PosterShapePreset(recipe:recipe,seed:817,parameters:low))
                let hi=try pixels(PosterShapePreset(recipe:recipe,seed:817,parameters:high))
                if lo==hi{unresponsive.append(recipe.id+":"+p.id)}
            }
            try require(rejected{_ = try recipe.values(["missing":1])},"Unknown parameter accepted")
            if let p=recipe.parameters.first {try require(rejected{_ = try recipe.values([p.id:.nan])},"NaN accepted");try require(rejected{_ = try recipe.values([p.id:p.max+1])},"Out of bounds parameter accepted")}
        }
        try require(unresponsive.isEmpty,"Parameters do not affect pixels: \(unresponsive.joined(separator:", "))")
        for id in ["modular-arcs","voronoi-shards","survey-dendrite","survey-density-field","survey-gravity-drips"] {
            let r=PosterShapeLibrary.recipe(id)!
            let a=try pixels(PosterShapePreset(recipe:r,seed:817)),b=try pixels(PosterShapePreset(recipe:r,seed:818)),again=try pixels(PosterShapePreset(recipe:r,seed:817))
            try require(a != b && a==again,"Stochastic shape seed variation failed")
        }
        let field=UnitBox(x:0.1,y:0.2,width:0.8,height:0.6)
        var selected:Set<String>=[]
        for seed in UInt64(0)..<160 {
            let a=PosterShapeLibrary.choose(seed:seed,profile:nil,field:field,posterAspect:1.4,category:"abstract",textDensity:0.2)!
            let b=PosterShapeLibrary.choose(seed:seed,profile:nil,field:field,posterAspect:1.4,category:"abstract",textDensity:0.2)!
            try require(a.recipe.id==b.recipe.id && a.parameters==b.parameters,"Shape choice not deterministic")
            selected.insert(a.recipe.id)
        }
        try require(selected.count>=12,"Automatic matching lacks variety")
        for r in recipes {
            let scores=FontLibrary.shared.profiles.map{PosterShapeLibrary.fontCompatibility(r,profile:$0).score}
            try require((scores.max() ?? 0)-(scores.min() ?? 0)>0.12,"Font pairing ignores font properties")
            let matching=PosterShapeLibrary.compatibility(r,profile:nil,field:UnitBox(x:0,y:0,width:r.idealAspect,height:1),posterAspect:1,category:r.styles.first ?? "abstract",textDensity:0.1)
            let cramped=PosterShapeLibrary.compatibility(r,profile:nil,field:UnitBox(x:0,y:0,width:0.05,height:1),posterAspect:1,category:r.styles.first ?? "abstract",textDensity:0.9)
            try require(matching.score>cramped.score,"Shape compatibility ignores physical field or text density")
        }
        try checkReviewedShapes()
        try checkSurveySystems()
        print("PASS: \(recipes.count) unique shape renders, exact preset replay, every parameter changes pixels, \(selected.count) matched families across 160 seeds, font and field compatibility")
    }
}
