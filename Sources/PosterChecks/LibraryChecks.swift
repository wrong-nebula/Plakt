import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkLibrary() async throws {
        let root=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"poster-library-checks-\(UUID().uuidString)")
        let source=root.appending(path:"sources"),destination=root.appending(path:"catalog")
        try FileManager.default.createDirectory(at:source,withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:root)}
        let url=source.appending(path:"2026-11-07_00-00-00_UTC.png")
        try PosterRenderer.png(PosterRenderer.render(.random(seed:2035),copy:PosterCopy(),width:900),to:url)
        try "</script><img src=x onerror=alert(1)>".write(to:source.appending(path:"2026-11-07_00-00-00_UTC.txt"),atomically:true,encoding:.utf8)
        let engine=PosterLibraryEngine(directory:destination)
        let first=try await engine.index(source:source)
        var records=try await engine.records()
        try require(first.sources.count==1 && !records.isEmpty,"Library failed to index fixture")
        try require(records.allSatisfy{$0.colors != nil && $0.elements.allSatisfy{$0.colors != nil}},"Poster or element color profiles missing")
        try require(records.allSatisfy{$0.genome.composition?.regions.count==$0.genome.elements.count},"Source genome layout description is incomplete")
        let embeddings=records.flatMap{[$0.embedding]+$0.elements.map(\.embedding)}
        try require(embeddings.allSatisfy{$0.dimensions>0 && $0.data.count==$0.dimensions*4},"Missing or malformed element embeddings")
        for embedding in embeddings {let distance=try embedding.distance(to:embedding);try require(distance<0.000001,"Self embedding distance is nonzero")}
        print("PASS: source/element indexing, hierarchy and typed embeddings")
        guard let record=records.first(where:{$0.elements.contains{$0.kind=="text-line"}}),let line=record.elements.first(where:{$0.kind=="text-line"}) else{throw CheckFailure("Synthetic poster OCR failed")}
        try require(record.elements.filter{$0.kind=="word"}.allSatisfy{word in record.elements.contains{$0.id==word.parentID}},"Word parent is missing")
        let hits=try await engine.search(imageURL:record.imageURL,includeElements:false,limit:20)
        try require(hits.first?.posterID==record.id && (hits.first?.distance ?? 100)<0.02,"Image retrieval failed to recover its own poster")
        let projection=try TechniqueTrainer.project(record.embedding)
        try require(projection.count==64 && projection.allSatisfy(\.isFinite),"Model projection invalid")
        print("PASS: visual search, word parents and model feature projection")
        try checkSourceLayout(record)
        let editJSON="""
        [{"posterID":"\(record.id)","elementID":"\(line.id)","tags":["drop-shadow"],"rejectedTags":["outline-text"]},
        {"posterID":"\(record.id)","bounds":{"x":0.1,"y":0.1,"width":0.3,"height":0.3},"tags":["shape-replication"]}]
        """
        let edits=try JSONDecoder().decode([ReviewEdit].self,from:Data(editJSON.utf8))
        try await engine.apply(edits:edits)
        records=try await engine.records()
        let reviewed=records.first{$0.id==record.id}!
        try require(reviewed.elements.count==record.elements.count+1,"Manual element was not embedded")
        try require(reviewed.genome.elements.first{$0.sourceElementID==line.id}?.shadow==true,"Reviewed shadow did not map to a scene operator")
        try require(reviewed.elements.first{$0.id==line.id}?.tags.contains{$0.name=="outline-text" && $0.state=="rejected"}==true,"Explicit negative label missing")
        _ = try await engine.index(source:source)
        let cached=try await engine.records().first{$0.id==record.id}
        try require(cached?.elements.count==reviewed.elements.count,"Incremental index destroyed a manual element")
        print("PASS: reviewed labels, manual-region embeddings, operators and cache preservation")
        let bad="[{\"posterID\":\"\(record.id)\",\"bounds\":{\"x\":-1,\"y\":0,\"width\":1,\"height\":1},\"tags\":[]}]"
        let badEdits=try JSONDecoder().decode([ReviewEdit].self,from:Data(bad.utf8))
        do {try await engine.apply(edits:badEdits);throw CheckFailure("Invalid review bounds accepted")}catch is PosterError{}
        let bowTie="[{\"posterID\":\"\(record.id)\",\"sourceQuad\":[[0,0],[1,1],[1,0],[0,1]],\"tags\":[]}]"
        let invalidQuad=try JSONDecoder().decode([ReviewEdit].self,from:Data(bowTie.utf8))
        do{try await engine.apply(edits:invalidQuad);throw CheckFailure("Crossed poster border accepted")}catch is PosterError{}
        let border="[{\"posterID\":\"\(record.id)\",\"sourceQuad\":[[0.01,0.01],[0.99,0.01],[0.99,0.99],[0.01,0.99]],\"tags\":[]}]"
        try await engine.apply(edits:JSONDecoder().decode([ReviewEdit].self,from:Data(border.utf8)))
        let corrected=try await engine.records().first{$0.id==record.id}
        try require(corrected?.reviewStatus.hasPrefix("surface-confirmed")==true,"Manual border was not confirmed")
        try require(corrected?.sourceQuad.first?.first==0.01,"Manual border was not persisted")
        _ = try await engine.index(source:source)
        let styleEdit="[{\"posterID\":\"\(record.id)\",\"styleLabels\":{\"minimal\":\"present\",\"bauhaus\":\"unknown\"},\"tags\":[]}]"
        try await engine.apply(edits:JSONDecoder().decode([ReviewEdit].self,from:Data(styleEdit.utf8)))
        let preserved=try await engine.records().first{$0.id==record.id}
        try require(preserved?.sourceQuad==corrected?.sourceQuad,"Reindex overwrote a manual poster border")
        try require(preserved?.styleLabels?["minimal"]=="present" && preserved?.styleLabels?["bauhaus"]==nil && preserved?.reviewStatus.hasPrefix("surface-confirmed")==true,"Style labels changed border status or turned unknown into a training label")
        let trained=try TechniqueTrainer.train(records:records,directory:destination,bootstrap:false)
        try require(trained.results.allSatisfy{$0.modelURL==nil},"Insufficient reviewed data silently trained a model")
        print("PASS: invalid annotations rejected; unknown labels never become negatives")
        try await engine.fit(posterID:record.id,rounds:2,count:4)
        let fit=try await engine.records().first{$0.id==record.id}
        try require(fit?.genome.score?.isFinite==true,"Genome inverse fit failed")
        let historyURL=destination.appending(path:"posters/\(record.id)/fit-history.json")
        let history=try JSONDecoder().decode([[String:String]].self,from:Data(contentsOf:historyURL))
        let distances=history.compactMap{$0["featureDistance"].flatMap(Double.init)}
        try require(distances.count==2 && distances[1]<=distances[0]+0.00001,"Elitist fitting regressed raw loss")
        print("PASS: per-poster fitting and monotonic retained fit loss")
        let index=try await engine.load()
        try LibraryReport.write(index:index,records:await engine.records())
        let html=try String(contentsOf:destination.appending(path:"review.html"),encoding:.utf8)
        try require(!html.contains("</script><img src=x"),"Caption escaped out of report data")
        try require(html.contains("\\u003c\\/script"),"Source caption was not safely serialized")
        print("PASS: review report escapes source content")
    }
}
