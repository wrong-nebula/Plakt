import Foundation
import PosterCore

extension PosterChecks {
    /// Explicit integration checks because the optional real-model pack is about 400 MB.
    static func checkSemanticSearch() async throws {
        let root=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"poster-semantic-checks-\(UUID().uuidString)")
        let source=root.appending(path:"sources"),catalog=root.appending(path:"library")
        try FileManager.default.createDirectory(at:source,withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:root)}
        let image=source.appending(path:"poster.png")
        try PosterRenderer.png(PosterRenderer.render(.random(seed:2035),copy:PosterCopy(),width:600),to:image)
        let engine=PosterLibraryEngine(directory:catalog)
        _ = try await engine.index(source:source,words:false)
        let records=try await engine.records()
        guard let record=records.first else{throw CheckFailure("Missing semantic integration fixture")}
        let original=try Data(contentsOf:catalog.appending(path:"posters/\(record.id)/record.json"))
        let search=SemanticLibrarySearch(directory:catalog,cpuOnly:true)
        let verification=try await search.verifyModelPack()
        try require(verification.tokenizerFixtures>=15 && verification.minimumTextCosine>0.999 && verification.minimumImageCosine>0.999,"Original model parity failed")
        print("PASS: exact original tokenizer, Unicode/byte fallback, truncation and native image/text parity")
        do{_ = try await search.search(query:"typography");throw CheckFailure("Unindexed library silently searched")}catch is PosterError{}
        let first=try await search.index()
        try require(first.computed==records.count && first.indexed==records.count,"Semantic indexing missed posters")
        let second=try await search.index()
        try require(second.computed==0 && second.cached==records.count,"Unchanged image embeddings were recomputed")
        let hits=try await search.search(query:"black and white experimental typography")
        try require(hits.indexed==records.count && hits.hits.allSatisfy{$0.similarity.isFinite && (-1...1).contains($0.similarity)},"Semantic scores or coverage invalid")
        let repeatHits=try await search.search(query:"black and white experimental typography")
        try require(hits.hits.map(\.similarity)==repeatHits.hits.map(\.similarity),"Cached query ranking changed")
        // A fresh searcher loads the binary copy of the index; results must be identical to index.json's.
        let binaryHits=try await SemanticLibrarySearch(directory:catalog,cpuOnly:true).search(query:"black and white experimental typography")
        try require(FileManager.default.fileExists(atPath:catalog.appending(path:"semantic-siglip/index.bin").path) &&
                    binaryHits.hits.map(\.posterID)==hits.hits.map(\.posterID) && binaryHits.hits.map(\.similarity)==hits.hits.map(\.similarity),
                    "Binary index copy changed results or was not written")
        let unchanged=try Data(contentsOf:catalog.appending(path:"posters/\(record.id)/record.json"))
        try require(original==unchanged,"Semantic search modified existing records")
        let absent=try await search.search(query:"typography",tag:"not-a-tag")
        try require(absent.eligible==0 && absent.hits.isEmpty,"Semantic tag filter ignored")
        let emptyScope=try await search.search(query:"typography",posterIDs:[])
        try require(emptyScope.eligible==0 && emptyScope.hits.isEmpty,"Review-section scope ignored")
        _ = try await search.index(includeElements:true,limit:8)
        let elementHits=try await search.search(query:"typography",includeElements:true)
        try require(elementHits.hits.contains{$0.elementID != nil},"Element crops were not retrievable")
        let postersOnly=try await search.search(query:"typography")
        try require(postersOnly.hits.allSatisfy{$0.elementID == nil},"Default poster search leaked element crops")
        for query in ["", "  "] {
            do{_ = try await search.search(query:query);throw CheckFailure("Blank semantic query accepted")}catch is PosterError{}
        }
        print("PASS: real cosine retrieval, repeatability, missing-index errors, tag filters and resumable cache")
        try PosterRenderer.png(PosterRenderer.render(.random(seed:2040),copy:PosterCopy(),width:600),to:record.imageURL)
        if records.count==1 {
            do{_ = try await search.search(query:"typography");throw CheckFailure("Stale image was ranked")}catch is PosterError{}
        }else{
            let stale=try await search.search(query:"typography")
            try require(stale.missingOrStale==1 && !stale.hits.contains{$0.posterID==record.id},"Changed crop was not excluded")
        }
        let refreshed=try await search.index()
        try require(refreshed.computed==1,"Changed crop did not invalidate its cache")
        // Searches skip rehashing unchanged files. A same-size, in-place rewrite that restores the old
        // modification date must still be caught, and restoring the original bytes must count as current.
        func excluded() async throws -> Bool {
            do{let result=try await search.search(query:"typography");return result.missingOrStale==1 && !result.hits.contains{$0.posterID==record.id}}
            catch is PosterError{return records.count==1}
        }
        let refreshedExcluded=try await excluded()
        try require(!refreshedExcluded,"Refreshed image was excluded")
        let currentImage=try Data(contentsOf:record.imageURL)
        let modified=try FileManager.default.attributesOfItem(atPath:record.imageURL.path)[.modificationDate] as! Date
        var altered=currentImage;altered[altered.count/2] ^= 0xff
        try altered.write(to:record.imageURL)
        try FileManager.default.setAttributes([.modificationDate:modified],ofItemAtPath:record.imageURL.path)
        let rewriteExcluded=try await excluded()
        try require(rewriteExcluded,"Same-size rewrite with its old modification date was ranked")
        try currentImage.write(to:record.imageURL)
        let restoredExcluded=try await excluded()
        try require(!restoredExcluded,"Restored original image bytes were not recognized")
        let indexURL=catalog.appending(path:"semantic-siglip/index.json")
        var index=try JSONSerialization.jsonObject(with:Data(contentsOf:indexURL)) as! [String:Any]
        index["fingerprint"]="Apple-Vision-r2"
        try JSONSerialization.data(withJSONObject:index).write(to:indexURL)
        do{_ = try await search.search(query:"typography");throw CheckFailure("Incompatible feature space accepted")}catch is PosterError{}
        _ = try await search.index(force:true)
        print("PASS: stale-crop invalidation, same-size rewrite detection and model-schema rejection with explicit rebuild recovery")
    }
}
