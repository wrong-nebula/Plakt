import Foundation

public enum LibraryReport {
    public static func write(index:PosterLibrary,records:[PosterRecord])throws {
        guard let template=PosterResources.bundle.url(forResource:"library-review",withExtension:"html",subdirectory:"Resources") else{throw PosterError.invalid("Library review template is missing.")}
        func relative(_ url:URL)->String {url.path.replacingOccurrences(of:index.directory.path+"/",with:"")}
        func colors(_ profile:PosterColorProfile?)->Any {
            guard let profile,let data=try? JSONEncoder().encode(profile),var object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] else{return NSNull()}
            object.removeValue(forKey:"colorEmbedding");return object
        }
        let posters:[[String:Any]]=records.map { r in
            let items:[[String:Any]]=r.elements.map { e in ["colors":colors(e.colors),"id":e.id,"parentID":e.parentID,"kind":e.kind,"text":e.text ?? "","bounds":["x":e.bounds.x,"y":e.bounds.y,"width":e.bounds.width,"height":e.bounds.height],"rotation":e.rotation,"status":e.reviewStatus,"image":relative(e.imageURL),"tags":e.tags.map{["name":$0.name,"state":$0.state,"confidence":$0.confidence,"origin":$0.origin,"evidence":$0.evidence] as [String:Any]}] }
            return ["colors":colors(r.colors),"id":r.id,"image":relative(r.imageURL),"fitted":relative(index.directory.appending(path:"posters/\(r.id)/fitted.png")),"hasFit":r.genome.score != nil && FileManager.default.fileExists(atPath:index.directory.appending(path:"posters/\(r.id)/fitted.png").path),"source":r.source.sourceURL.absoluteString,"sourceQuad":r.sourceQuad,"status":r.reviewStatus,"surfaceConfidence":r.surfaceConfidence,"account":r.source.account,"post":r.source.postURL ?? "","caption":r.source.caption,"warnings":r.warnings,"text":r.textIndex,"elements":items,"tags":r.tags.map{["name":$0.name,"state":$0.state,"confidence":$0.confidence,"origin":$0.origin,"evidence":$0.evidence] as [String:Any]}]
        }
        let data:[String:Any]=["posters":posters,"taxonomy":TechniqueTaxonomy.names,"note":index.note]
        let json=try JSONSerialization.data(withJSONObject:data,options:[.sortedKeys])
        let safe=String(decoding:json,as:UTF8.self).replacingOccurrences(of:"<",with:"\\u003c")
        let html=try String(contentsOf:template,encoding:.utf8).replacingOccurrences(of:"__POSTER_LIBRARY_DATA__",with:safe)
        try html.write(to:index.directory.appending(path:"review.html"),atomically:true,encoding:.utf8)
        let taxonomy:[String:Any]=["taxonomy":TechniqueTaxonomy.names,"schema":"Technique absence is unknown unless explicitly rejected in review.","coordinates":"top-left normalized bounds on rectified poster image"]
        try JSONSerialization.data(withJSONObject:taxonomy,options:[.prettyPrinted,.sortedKeys]).write(to:index.directory.appending(path:"taxonomy.json"),options:.atomic)
    }
}
