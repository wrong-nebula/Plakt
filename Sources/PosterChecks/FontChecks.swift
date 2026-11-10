import Foundation
import CoreText
import PosterCore

extension PosterChecks {
    static func checkFonts()throws {
        let library=FontLibrary.shared
        try require(library.manifest.families.count>=20 && library.profiles.count>=100,"Google Fonts catalog or embedded axis profiles missing")
        let files=library.manifest.families.flatMap(\.faces)
        try require(library.verifiedAssets.count==files.count,"A bundled font does not match its pinned SHA-256")
        let dimensions=library.profiles.first!.embedding.count
        for p in library.profiles {
            try require(p.embedding.count==dimensions && p.featureValues.count==dimensions && p.embedding.allSatisfy(\.isFinite),"Font style descriptor dimensions invalid")
            let norm=p.embedding.reduce(0){$0+$1*$1}
            try require(abs(norm-1)<1e-8,"Font style embedding is not normalized")
            try require(p.specimenEmbedding?.dimensions==768,"Standardized font Vision embedding missing")
        }
        guard let regular=library.profiles.first(where:{$0.familyID=="archivo" && $0.weight==400 && $0.width==100 && !$0.italic}),let heavy=library.profiles.first(where:{$0.familyID=="archivo" && $0.weight==800 && $0.width==100 && !$0.italic}),let narrow=library.profiles.first(where:{$0.familyID=="archivo" && $0.weight==800 && $0.width==75 && !$0.italic}) else{throw CheckFailure("Variable font weight/width profiles missing")}
        let a=try rgba(FontLibrary.specimen(regular)),b=try rgba(FontLibrary.specimen(heavy)),c=try rgba(FontLibrary.specimen(narrow))
        for band in 0..<3 {
            let start=band*512/3,end=(band+1)*512/3
            var ink=0
            for y in start..<end {for x in 0..<1024 where a[(y*1024+x)*4]<180{ink += 1}}
            try require(ink>100,"Font specimen lost a row or drew text outside its frame")
        }
        if var optical=library.profiles.first(where:{$0.familyID=="bodonimoda" && !$0.italic && $0.weight==400}) {
            let small=try rgba(FontLibrary.specimen(optical));optical.variations["opsz"]=96
            let large=try rgba(FontLibrary.specimen(optical))
            try require(small != large,"Core Text auto optical sizing overrode the explicit specimen axis")
        }
        try require(a != b && b != c,"Core Text ignored the requested font weight or width")
        let inkA=stride(from:0,to:a.count,by:4).reduce(0){$0+255-Int(a[$1])},inkB=stride(from:0,to:b.count,by:4).reduce(0){$0+255-Int(b[$1])}
        try require(inkB>inkA,"Heavier variable font does not increase actual specimen ink mass")
        try require(regular.embedding != heavy.embedding && heavy.embedding != narrow.embedding,"Axis changes did not reach font-style descriptors")
        var scene=try StylePosterRenderer.genome(style:"swiss",seed:51)
        for i in scene.elements.indices where scene.elements[i].sourceElementID.hasPrefix("title:"){scene.elements[i].sourceAnchor=scene.elements[i].bounds}
        for profile in library.profiles {
            var candidate=scene;FontLibrary.apply(profile,to:&candidate)
            try FontLibrary.validate(candidate)
        }
        FontLibrary.apply(heavy,to:&scene)
        let data=try JSONEncoder().encode(scene),restored=try JSONDecoder().decode(StyleGenome.self,from:data)
        try FontLibrary.validate(restored)
        try require(restored.elements.contains{$0.fontProfileID==heavy.id && $0.fontVariations?["wght"]==800},"Font profile/axis provenance was not saved in a scene")
        let index=scene.elements.firstIndex{$0.fontAssetID != nil}!
        scene.elements[index].fontAssetSHA256="changed"
        try require(rejected{try FontLibrary.validate(scene)},"Changed font asset checksum silently passed reproduction")
        let neighbors=library.nearest(to:regular,otherFamilies:true)
        try require(!neighbors.isEmpty && neighbors.allSatisfy{$0.0.familyID != regular.familyID && $0.1.isFinite},"Font similarity retrieval is invalid")
        print("PASS: \(library.manifest.families.count) licensed Google Fonts, \(library.profiles.count) normalized font embeddings, real weight/width pixels, axis application and checksum-bound reproduction")
    }
}
