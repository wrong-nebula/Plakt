import Foundation
import Darwin

public actor PosterLibraryEngine {
    public let directory:URL
    private let analyzer=LibraryAnalyzer()
    public init(directory:URL){self.directory=directory.standardizedFileURL}
    private func exclusive<T>(_ body:()throws->T)throws->T {
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        let descriptor=Darwin.open(directory.appending(path:".writer.lock").path,O_CREAT|O_RDWR,0o600)
        guard descriptor>=0 else{throw PosterError.invalid("Cannot open the library writer lock.")}
        defer{Darwin.close(descriptor)}
        guard flock(descriptor,LOCK_EX)==0 else{throw PosterError.invalid("Another catalog writer is active. Keep reviewing/exporting edits and apply them after indexing or fitting finishes.")}
        defer{flock(descriptor,LOCK_UN)}
        return try body()
    }
    public func load()throws->PosterLibrary {
        let result=try JSONDecoder().decode(PosterLibrary.self,from:Data(contentsOf:directory.appending(path:"library.json")))
        guard result.version==1,result.analyzer=="vision-library-v1" else{throw PosterError.invalid("Incompatible library version. Choose a new index directory.")}
        return result
    }
    public func records()throws->[PosterRecord] {try load().posters.map{try Self.readRecord($0.recordURL)}}
    public static func readRecord(_ url:URL)throws->PosterRecord {try JSONDecoder().decode(PosterRecord.self,from:Data(contentsOf:url))}
    private func save(_ index:PosterLibrary)throws {try LibraryRaster.write(index,to:directory.appending(path:"library.json"))}
    private func saveRecord(_ record:PosterRecord)throws {try LibraryRaster.write(record,to:directory.appending(path:"posters/\(record.id)/record.json"))}

    /// Enrichment never changes borders, style votes, source genomes or reviewed labels.
    public func attachRegionAnalysis(_ analysis: PosterRegionAnalysis, at url: URL) throws {
        try exclusive {
            var catalog = try load()
            guard let index = catalog.posters.firstIndex(where: { $0.id == analysis.posterID }) else { throw PosterError.invalid("Unknown analysis poster.") }
            var record = try Self.readRecord(catalog.posters[index].recordURL)
            guard try LibraryRaster.hash(Data(contentsOf: record.imageURL)) == analysis.imageHash else { throw PosterError.invalid("The poster changed during region analysis. Analyze its current crop again.") }
            let protected = Set(record.tags.filter { $0.origin == "review" || ["confirmed", "rejected"].contains($0.state) }.map(\.name))
            let retained = record.tags.filter { !($0.origin == "sam-siglip-vision-v1" && $0.state == "suggested") || protected.contains($0.name) }
            let known = Set(retained.map(\.name))
            let proposals = analysis.tags.filter { !known.contains($0.tag) && !protected.contains($0.tag) && TechniqueTaxonomy.names.contains($0.tag) }
            record.tags = retained + proposals.map {
                TechniqueTag($0.tag, state: "suggested", confidence: 0,
                    evidence: [$0.explanation] + $0.geometrySupport + ["Evidence: \(url.path). Zero confidence denotes an uncalibrated proposal; review before training."], origin: "sam-siglip-vision-v1")
            }
            record.regionAnalysis = RegionAnalysisReference(version: analysis.version, imageHash: analysis.imageHash,
                samFingerprint: analysis.samFingerprint, siglipFingerprint: analysis.siglipFingerprint, url: url,
                regionCount: analysis.regions.count, systemCandidateCount: analysis.systems.count)
            let audit = directory.appending(path: "reviews/region-enrichment/\(analysis.posterID)")
            if !FileManager.default.fileExists(atPath: audit.appending(path: "record-before.json").path) {
                try FileManager.default.createDirectory(at: audit, withIntermediateDirectories: true)
                try FileManager.default.copyItem(at: catalog.posters[index].recordURL, to: audit.appending(path: "record-before.json"))
            }
            try saveRecord(record)
            catalog.posters[index].tags = Array(Set(LibraryRaster.tagNames(record.tags))).sorted()
            catalog.taxonomy = TechniqueTaxonomy.version
            try save(catalog)
        }
    }

    public func acceptSegmentedRegion(_ region: RegionAnalysis) throws {
        try exclusive {
            var catalog = try load()
            guard let index = catalog.posters.firstIndex(where: { $0.id == region.posterID }) else { throw PosterError.invalid("Unknown segmentation poster.") }
            let entry = catalog.posters[index]
            var record = try Self.readRecord(entry.recordURL)
            guard region.bounds.valid, try LibraryRaster.hash(Data(contentsOf: record.imageURL)) == region.sourceImageHash,
                  try LibraryRaster.hash(Data(contentsOf: region.imageURL)) == region.imageHash,
                  FileManager.default.fileExists(atPath: region.maskURL.path), FileManager.default.fileExists(atPath: region.imageURL.path) else {
                throw PosterError.invalid("The mask no longer matches the current poster. Select the region again.")
            }
            let audit = directory.appending(path: "reviews/segment-\(UUID().uuidString)")
            try FileManager.default.createDirectory(at: audit, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: entry.recordURL, to: audit.appending(path: "record-before.json"))
            if let existing = record.elements.firstIndex(where: { $0.id == region.id }) {
                record.elements[existing].reviewStatus = "reviewed"
                record.elements[existing].segmentation = region
            } else {
                let image = try LibraryRaster.oriented(region.imageURL)
                var element = PosterElement(id: region.id, parentID: record.id, kind: "sam-region", bounds: region.bounds,
                    rotation: 0, text: region.text.isEmpty ? nil : region.text, confidence: 1, reviewStatus: "reviewed",
                    imageURL: region.imageURL, embedding: region.vision, statistics: try LibraryRaster.statistics(image),
                    tags: region.tags.map { TechniqueTag($0.tag, confidence: 0, evidence: [$0.explanation] + $0.geometrySupport, origin: "sam-siglip-vision-v1") },
                    relatedIDs: region.linkedElementIDs, colors: try PosterColorAnalyzer().analyze(image))
                element.segmentation = region
                record.elements.append(element)
                let measured = LibrarySceneRenderer.initialGenome(posterID: record.id, image: try LibraryRaster.oriented(record.imageURL),
                    elements: [element], statistics: record.statistics)
                record.genome.elements += measured.elements
                record.genome.composition = CompositionPlan.scene(record.genome)
            }
            try saveRecord(record)
            try LibraryRaster.write(record.genome, to: entry.recordURL.deletingLastPathComponent().appending(path: "genome.json"))
            try record.genome.composition?.write(to: entry.recordURL.deletingLastPathComponent())
            catalog.posters[index].elementCount = record.elements.count
            try save(catalog)
            let acceptedURL = directory.appending(path: "segmentation/accepted-regions.json")
            var accepted = (try? JSONDecoder().decode([RegionAnalysis].self, from: Data(contentsOf: acceptedURL))) ?? []
            accepted.removeAll { $0.id == region.id }; accepted.append(region)
            try LibraryRaster.write(accepted.sorted { $0.id < $1.id }, to: acceptedURL)
        }
    }
    private struct ScanSnapshot:Codable {var sourceRoot:URL;var words:Bool;var files:[URL];var completed:Bool}
    public func index(source:URL,limit:Int?=nil,words:Bool=true,progress:@Sendable(String)->Void={_ in})throws->PosterLibrary {
        guard (limit ?? 1)>0 else{throw PosterError.invalid("Index limit must be positive.")}
        try exclusive {
            if FileManager.default.fileExists(atPath:directory.appending(path:"library.json").path) {
                guard try load().sourceRoot.standardizedFileURL==source.standardizedFileURL else{throw PosterError.invalid("This library belongs to another source root.")}
            }else{try save(PosterLibrary(sourceRoot:source.standardizedFileURL,directory:directory))}
        }
        let scanURL=directory.appending(path:"scan.json")
        var snapshot:ScanSnapshot
        if limit==nil,let saved=try? JSONDecoder().decode(ScanSnapshot.self,from:Data(contentsOf:scanURL)),!saved.completed,saved.words==words,saved.sourceRoot.standardizedFileURL==source.standardizedFileURL {
            snapshot=saved
        }else{
            let extensions:Set<String>=["jpg","jpeg","png","heic","tif","tiff","webp"]
            guard let enumerator=FileManager.default.enumerator(at:source,includingPropertiesForKeys:[.isRegularFileKey],options:[.skipsHiddenFiles]) else{throw PosterError.invalid("Cannot enumerate the source folder.")}
            let files=enumerator.compactMap{$0 as? URL}.filter{extensions.contains($0.pathExtension.lowercased())}.sorted{$0.path<$1.path}
            guard !files.isEmpty else{throw PosterError.invalid("No supported images found.")}
            snapshot=ScanSnapshot(sourceRoot:source,words:words,files:Array(files.prefix(limit ?? files.count)),completed:false)
            try LibraryRaster.write(snapshot,to:scanURL)
        }
        for (position,url) in snapshot.files.enumerated() {
            try Task.checkCancellation()
            try exclusive {
                var catalog=try load()
                do {
                    let message=try autoreleasepool{try processSource(url,words:words,catalog:&catalog)}
                    progress("\(position+1)/\(snapshot.files.count) \(message)")
                }catch is CancellationError{throw CancellationError()}
                catch{catalog.failures[url.path]=error.localizedDescription;try save(catalog);progress("Failed \(url.lastPathComponent): \(error.localizedDescription)")}
            }
        }
        snapshot.completed=true;try LibraryRaster.write(snapshot,to:scanURL)
        return try load()
    }
    private func processSource(_ url:URL,words:Bool,catalog:inout PosterLibrary)throws->String {
        let data=try Data(contentsOf:url),hash=LibraryRaster.hash(data),signature=hash+"/vision-library-v1/words-\(words)"
        let attribution=Self.attribution(url,hash:hash)
        if let prior=catalog.sources.first(where:{$0.path==url.path && $0.signature==signature}) {
            for id in prior.posterIDs {if let entry=catalog.posters.first(where:{$0.id==id}) {var record=try Self.readRecord(entry.recordURL);record.source=attribution;try saveRecord(record)}}
            return "Cached \(url.lastPathComponent)"
        }
        if catalog.sources.contains(where:{$0.signature==signature}) {
            catalog.sources.append(IndexedSource(path:url.path,signature:signature,posterIDs:[]));catalog.failures[url.path]="Exact duplicate bytes; canonical source already indexed.";try save(catalog)
            return "Duplicate \(url.lastPathComponent)"
        }
        let sourceID=String(hash.prefix(24)),image=try LibraryRaster.oriented(url),surfaces=try analyzer.surfaces(image)
        var entries:[LibraryEntry]=[]
        for (surfaceIndex,surface) in surfaces.enumerated() {
            try Task.checkCancellation()
            let record=try analyzer.analyze(surface:surface,source:attribution,sourceID:sourceID,index:surfaceIndex,directory:directory,words:words)
            try saveRecord(record)
            try LibraryRaster.write(record.embedding,to:directory.appending(path:"posters/\(record.id)/prototype.json"))
            try LibraryRaster.write(record.genome,to:directory.appending(path:"posters/\(record.id)/genome.json"))
            try record.genome.composition?.write(to:directory.appending(path:"posters/\(record.id)"))
            entries.append(LibraryEntry(id:record.id,sourceID:sourceID,title:record.elements.first(where:{$0.kind=="text-line"})?.text ?? url.lastPathComponent,
                recordURL:directory.appending(path:"posters/\(record.id)/record.json"),imageURL:record.imageURL,elementCount:record.elements.count,tags:LibraryRaster.tagNames(record.tags),sourceGroup:attribution.postID))
        }
        let oldIDs=catalog.sources.first(where:{$0.path==url.path})?.posterIDs ?? []
        catalog.posters.removeAll{oldIDs.contains($0.id)};catalog.sources.removeAll{$0.path==url.path}
        catalog.sources.append(IndexedSource(path:url.path,signature:signature,posterIDs:entries.map(\.id)))
        catalog.posters.append(contentsOf:entries);catalog.posters.sort{$0.id<$1.id};catalog.failures.removeValue(forKey:url.path);try save(catalog)
        return "Indexed \(url.lastPathComponent) · \(entries.count) surfaces · \(entries.reduce(0){$0+$1.elementCount}) elements"
    }
    static func attribution(_ url:URL,hash:String)->SourceAttribution {
        let base=url.deletingPathExtension().lastPathComponent.replacingOccurrences(of:"_[0-9]+$",with:"",options:.regularExpression)
        let parent=url.deletingLastPathComponent()
        let metadata=[parent.appending(path:base+".json"),parent.appending(path:"metadata/"+base+".json")].first{FileManager.default.fileExists(atPath:$0.path)} ?? parent.appending(path:base+".json")
        let captionFile=[parent.appending(path:base+".txt"),parent.appending(path:"captions/"+base+".txt")].first{FileManager.default.fileExists(atPath:$0.path)} ?? parent.appending(path:base+".txt")
        let object=(try? JSONSerialization.jsonObject(with:Data(contentsOf:metadata))) as? [String:Any]
        let node=(object?["node"] as? [String:Any]) ?? object ?? [:]
        let code=(node["shortcode"] as? String) ?? (node["code"] as? String)
        let edges=(node["edge_media_to_caption"] as? [String:Any])?["edges"] as? [[String:Any]]
        let caption=(try? String(contentsOf:captionFile,encoding:.utf8)) ?? ((edges?.first?["node"] as? [String:Any])?["text"] as? String) ?? ""
        let owner=(node["owner"] as? [String:Any])?["username"] as? String ?? parent.lastPathComponent
        return SourceAttribution(sourceURL:url,account:owner,postID:code ?? owner+"/"+base,postURL:code.map{"https://www.instagram.com/p/\($0)/"},caption:caption,
            metadataURL:FileManager.default.fileExists(atPath:metadata.path) ? metadata:nil,contentHash:hash)
    }
    public func search(imageURL:URL?=nil,query:String?=nil,tag:String?=nil,includeElements:Bool=true,limit:Int=20)throws->[SearchHit] {
        guard (1...200).contains(limit) else{throw PosterError.invalid("Search limit must be 1–200.")}
        let target=try imageURL.map{try LibraryRaster.embedding(LibraryRaster.oriented($0))}
        let terms=(query ?? "").lowercased().split(whereSeparator:{$0.isWhitespace}).map(String.init)
        var hits:[SearchHit]=[]
        for record in try records() {
            func append(id:String?,url:URL,text:String,tags:[TechniqueTag],embedding:VisualEmbedding)throws {
                let names=LibraryRaster.tagNames(tags)
                if let tag,!names.contains(tag){return}
                if !terms.allSatisfy({text.lowercased().contains($0)||names.joined(separator:" ").contains($0)}){return}
                hits.append(SearchHit(posterID:record.id,elementID:id,imageURL:url,text:String(text.prefix(350)),distance:try target.map{try $0.distance(to:embedding)},tags:names))
            }
            try append(id:nil,url:record.imageURL,text:record.textIndex+" "+(record.colors?.searchText ?? ""),tags:record.tags,embedding:record.embedding)
            if includeElements {for element in record.elements where element.reviewStatus != "rejected" {try append(id:element.id,url:element.imageURL,text:(element.text ?? element.kind)+" "+(element.colors?.searchText ?? ""),tags:element.tags,embedding:element.embedding)}}
        }
        hits.sort {if let a=$0.distance,let b=$1.distance {return a==b ? ($0.elementID ?? $0.posterID)<($1.elementID ?? $1.posterID):a<b};return ($0.elementID ?? $0.posterID)<($1.elementID ?? $1.posterID)}
        return Array(hits.prefix(limit))
    }
    public func apply(edits:[ReviewEdit])throws {try exclusive{try applyUnlocked(edits:edits)}}
    private func applyUnlocked(edits:[ReviewEdit])throws {
        var index=try load()
        let known=Set(index.posters.map(\.id))
        // Validate the complete batch before mutating records and retain a before-image for every affected poster.
        for edit in edits {
            guard known.contains(edit.posterID),edit.tags.allSatisfy({TechniqueTaxonomy.names.contains($0)}),(edit.rejectedTags ?? []).allSatisfy({TechniqueTaxonomy.names.contains($0)}) else{throw PosterError.invalid("Invalid annotation poster ID or tag.")}
            if let labels=edit.styleLabels,!labels.allSatisfy({entry in StyleCatalog.categories.contains{$0.id==entry.key} && ["present","absent","unknown"].contains(entry.value)}){throw PosterError.invalid("Unknown style category or label state.")}
            if let box=edit.bounds,!box.valid{throw PosterError.invalid("Invalid annotation bounds.")}
            if let quad=edit.sourceQuad,!LibraryAnalyzer.validQuad(quad){throw PosterError.invalid("Invalid four-corner poster border.")}
            if let elementID=edit.elementID {
                let record=try Self.readRecord(index.posters.first{$0.id==edit.posterID}!.recordURL)
                guard record.elements.contains(where:{$0.id==elementID}) else{throw PosterError.invalid("Annotation element ID does not exist.")}
            }
        }
        let auditFolder=directory.appending(path:"reviews/\(UUID().uuidString)")
        try FileManager.default.createDirectory(at:auditFolder,withIntermediateDirectories:true)
        try LibraryRaster.write(edits,to:auditFolder.appending(path:"edits.json"))
        try LibraryRaster.write(index,to:auditFolder.appending(path:"library-before.json"))
        for posterID in Set(edits.map(\.posterID)) {
            let entry=index.posters.first{$0.id==posterID}!
            try FileManager.default.copyItem(at:entry.recordURL,to:auditFolder.appending(path:posterID+"-before.json"))
            for name in ["poster.png","poster.jpg","genome.json","prototype.json","fitted.png","composition.json","composition.md"] {
                let source=entry.recordURL.deletingLastPathComponent().appending(path:name)
                if FileManager.default.fileExists(atPath:source.path){try FileManager.default.copyItem(at:source,to:auditFolder.appending(path:posterID+"-"+name))}
            }
        }
        for edit in edits.filter({$0.sourceQuad==nil})+edits.filter({$0.sourceQuad != nil}) {
            guard known.contains(edit.posterID),edit.tags.allSatisfy({TechniqueTaxonomy.names.contains($0)}),(edit.rejectedTags ?? []).allSatisfy({TechniqueTaxonomy.names.contains($0)}) else{throw PosterError.invalid("Annotation contains an unknown poster ID or technique.")}
            if let box=edit.bounds,!box.valid {throw PosterError.invalid("Annotation crop bounds are invalid.")}
            guard let entry=index.posters.first(where:{$0.id==edit.posterID}) else{continue}
            var record=try Self.readRecord(entry.recordURL)
            func corrected(_ tags:[TechniqueTag])->[TechniqueTag] {
                let affected=Set(edit.tags+(edit.rejectedTags ?? []))
                var result=tags.filter{!affected.contains($0.name)}
                for tag in edit.tags {result.append(TechniqueTag(tag,state:"confirmed",confidence:1,evidence:["Confirmed in local review annotations."],origin:"review"))}
                for tag in edit.rejectedTags ?? [] {result.append(TechniqueTag(tag,state:"rejected",confidence:1,evidence:["Explicitly rejected in local review annotations."],origin:"review"))}
                return result.sorted{$0.name<$1.name}
            }
            if let quad=edit.sourceQuad {
                let sourceImage=try LibraryRaster.oriented(record.source.sourceURL)
                let surface=try analyzer.manualSurface(sourceImage,quad:quad)
                let reviewedTags=record.tags.filter{$0.origin=="review"}
                var replacement=try analyzer.analyze(surface:surface,source:record.source,sourceID:record.sourceID,index:record.surfaceIndex,directory:directory,words:true)
                replacement.styleLabels=record.styleLabels
                replacement.tags=LibraryAnalyzer.uniqueTags(replacement.tags+reviewedTags)
                replacement.reviewStatus="surface-confirmed; elements-need-review"
                replacement.warnings.append("Old element coordinates and labels were archived before this border correction. Review the new element proposals.")
                record=replacement
                try LibraryRaster.write(record.embedding,to:entry.recordURL.deletingLastPathComponent().appending(path:"prototype.json"))
            } else if let elementID=edit.elementID {
                guard let i=record.elements.firstIndex(where:{$0.id==elementID}) else{throw PosterError.invalid("Annotation element ID does not exist.")}
                record.elements[i].tags=corrected(record.elements[i].tags)
                record.elements[i].reviewStatus=(edit.rejectElement ?? false) ? "rejected":"reviewed"
            } else if let bounds=edit.bounds {
                let image=try LibraryRaster.crop(PosterRenderer.load(record.imageURL),bounds)
                let id=record.id+"-manual-"+String(LibraryRaster.hash(Data("\(bounds)".utf8)).prefix(12))
                let url=entry.recordURL.deletingLastPathComponent().appending(path:id+".jpg")
                try LibraryAnalyzer.jpeg(image,to:url)
                record.elements.removeAll{$0.id==id}
                record.elements.append(PosterElement(id:id,parentID:record.id,kind:"manual-region",bounds:bounds,rotation:0,text:nil,confidence:1,
                    reviewStatus:"reviewed",imageURL:url,embedding:try LibraryRaster.embedding(image),statistics:try LibraryRaster.statistics(image),tags:corrected([]),relatedIDs:[],colors:try PosterColorAnalyzer().analyze(image)))
            } else {record.tags=corrected(record.tags);if !record.reviewStatus.hasPrefix("surface-confirmed"){record.reviewStatus="tags-reviewed; surface proposal unchanged"}}
            if let labels=edit.styleLabels {var merged=record.styleLabels ?? [:];for (key,value) in labels {if value=="unknown"{merged.removeValue(forKey:key)}else{merged[key]=value}};record.styleLabels=merged}
            // Rebuild measured layout, preserving global fit parameters. Reviewed effects map to editable operators.
            let fresh=LibrarySceneRenderer.initialGenome(posterID:record.id,image:try PosterRenderer.load(record.imageURL),elements:record.elements.filter{$0.reviewStatus != "rejected"},statistics:record.statistics)
            record.genome.elements=fresh.elements
            record.genome.composition=CompositionPlan.scene(record.genome)
            try saveRecord(record)
            try LibraryRaster.write(record.genome,to:entry.recordURL.deletingLastPathComponent().appending(path:"genome.json"))
            try record.genome.composition?.write(to:entry.recordURL.deletingLastPathComponent())
            if let i=index.posters.firstIndex(where:{$0.id==record.id}) {index.posters[i].tags=LibraryRaster.tagNames(record.tags);index.posters[i].elementCount=record.elements.count;index.posters[i].imageURL=record.imageURL}
        }
        let audit=directory.appending(path:"reviews");try FileManager.default.createDirectory(at:audit,withIntermediateDirectories:true)
        try LibraryRaster.write(edits,to:audit.appending(path:UUID().uuidString+".json"));try save(index)
    }
    public func compositions(progress:@Sendable(String)->Void={_ in})throws {
        let ids=try load().posters.map(\.id)
        for (position,id) in ids.enumerated() {try exclusive {try autoreleasepool {
            guard let entry=try load().posters.first(where:{$0.id==id}) else{return}
            var record=try Self.readRecord(entry.recordURL)
            record.genome.composition=CompositionPlan.scene(record.genome)
            try saveRecord(record)
            try LibraryRaster.write(record.genome,to:entry.recordURL.deletingLastPathComponent().appending(path:"genome.json"))
            try record.genome.composition?.write(to:entry.recordURL.deletingLastPathComponent())
            progress("Composition \(position+1)/\(ids.count): \(id)")
        }}}
    }
    public func colors(posterID:String?=nil,force:Bool=false,progress:@Sendable(String)->Void={_ in})throws {
        let ids=try load().posters.filter{posterID==nil || $0.id==posterID}.map(\.id)
        guard !ids.isEmpty else{throw PosterError.invalid("No matching poster.")}
        let colorAnalyzer=PosterColorAnalyzer()
        for (position,id) in ids.enumerated() {
            try Task.checkCancellation()
            try exclusive {try autoreleasepool {
                let index=try load()
                guard let entry=index.posters.first(where:{$0.id==id}) else{return}
                var record=try Self.readRecord(entry.recordURL)
                if force || record.colors==nil {record.colors=try colorAnalyzer.analyze(LibraryRaster.oriented(record.imageURL))}
                else if record.colors?.version != "oklab-weighted-kmeans-v2" {record.colors=colorAnalyzer.renamed(record.colors!)}
                for i in record.elements.indices where record.elements[i].reviewStatus != "rejected" {
                    if force || record.elements[i].colors==nil {record.elements[i].colors=try colorAnalyzer.analyze(LibraryRaster.oriented(record.elements[i].imageURL))}
                    else if record.elements[i].colors?.version != "oklab-weighted-kmeans-v2" {record.elements[i].colors=colorAnalyzer.renamed(record.elements[i].colors!)}
                }
                try saveRecord(record)
                progress("Colors \(position+1)/\(ids.count): \(id)")
            }}
        }
    }
    public func fit(posterID:String?=nil,rounds:Int=2,count:Int=4,unfittedOnly:Bool=false,progress:@Sendable(String)->Void={_ in})throws {
        guard (1...8).contains(rounds),(4...16).contains(count) else{throw PosterError.invalid("Fit uses 1–8 rounds and 4–16 candidates.")}
        let selected=try records().filter{(posterID==nil || $0.id==posterID) && (!unfittedOnly || $0.genome.score==nil)}
        if selected.isEmpty && unfittedOnly {progress("No unfitted posters in this snapshot.");return}
        guard !selected.isEmpty else{throw PosterError.invalid("No matching poster.")}
        let fonts=["HelveticaNeue-Bold","HelveticaNeue-CondensedBlack","HelveticaNeue-Medium","TimesNewRomanPS-BoldMT","HelveticaNeue-BoldItalic"]
        for (position,selectedRecord) in selected.enumerated() {
            try Task.checkCancellation()
            try exclusive {try autoreleasepool {
            let current=try load()
            guard let entry=current.posters.first(where:{$0.id==selectedRecord.id}) else{return}
            var record=try Self.readRecord(entry.recordURL)
            guard record.genome.aspect.isFinite,(0.25...4).contains(record.genome.aspect) else {
                record.genome.fittingStatus="unsupported aspect ratio for procedural renderer; source and embeddings retained"
                try saveRecord(record);progress("Skipped unsupported aspect: \(record.id)");return
            }
            var best=record.genome
            var random=SeededRandom(seed:UInt64(String(record.source.contentHash.prefix(16)),radix:16) ?? 1)
            var history:[[String:String]]=[]
            for round in 0..<rounds {
                var evaluated:[(StyleGenome,Double)]=[]
                for i in 0..<count {
                    try Task.checkCancellation()
                    var trial=best
                    if i>0 {
                        trial.font=fonts[random.int(fonts.count)]
                        trial.textScale=min(1.15,max(0.82,best.textScale+random.value(-0.09,0.09)))
                        trial.tracking=min(3,max(-3,best.tracking+random.value(-1,1)))
                    }
                    let image=try LibrarySceneRenderer.render(trial,width:500)
                    let feature=try analyzer.embedding(image)
                    let distance=try record.embedding.distance(to:feature)
                    evaluated.append((trial,distance))
                }
                let winner=evaluated.min{$0.1<$1.1}!
                best=winner.0;best.score=winner.1
                history.append(["round":String(round),"featureDistance":String(winner.1),"font":best.font,"textScale":String(best.textScale),"tracking":String(best.tracking)])
            }
            best.fittingStatus="inverse fit of OCR layout, global font and spacing; unresolved image regions remain placeholders; not a diffusion model"
            best.composition=CompositionPlan.scene(best)
            record.genome=best;try saveRecord(record)
            let folder=directory.appending(path:"posters/\(record.id)")
            try LibraryRaster.write(best,to:folder.appending(path:"genome.json"))
            try best.composition?.write(to:folder)
            try LibraryRaster.write(history,to:folder.appending(path:"fit-history.json"))
            try PosterRenderer.png(LibrarySceneRenderer.render(best,width:700),to:folder.appending(path:"fitted.png"))
            progress("Fitted \(position+1)/\(selected.count): \(record.id) · distance \(best.score ?? 0)")
            }}
        }
    }
    public func render(posterID:String,to url:URL,seed:UInt64=0,variation:Double=0,title:String?=nil)throws {
        guard let record=try records().first(where:{$0.id==posterID}) else{throw PosterError.invalid("Poster not found.")}
        try PosterRenderer.png(LibrarySceneRenderer.render(record.genome,width:1400,seed:seed,variation:variation,title:title),to:url)
    }
    public func applyTypeSystems(_ catalog:TypeSystemCatalog,progress:(String)->Void={_ in})throws {
        try exclusive {
            var index=try load()
            let grouped=Dictionary(grouping:catalog.systems,by:\.sourcePosterID)
            var updated=0,linked=0
            func annotate(_ tags:inout [TechniqueTag],system:TypeSystemGenome) {
                for name in system.tags where TechniqueTaxonomy.names.contains(name) {
                    if tags.contains(where:{$0.name==name}){continue}
                    tags.append(TechniqueTag(name,state:system.status=="inferred" ? "suggested":"detected",confidence:system.confidence,evidence:[system.id,system.explanation,"Fit error \(system.fitError). Status: \(system.status)."],origin:"type-system-fit"))
                }
            }
            for i in index.posters.indices {
                var record=try Self.readRecord(index.posters[i].recordURL)
                let systems=grouped[index.posters[i].id] ?? []
                let oldIDs=Set(record.genome.typeSystemIDs ?? [])
                guard !systems.isEmpty || !oldIDs.isEmpty else{continue}
                // Replace only generated annotations. Explicit reviews, including negative labels, survive.
                record.tags.removeAll{$0.origin=="type-system-fit" && ["detected","suggested"].contains($0.state)}
                for j in record.elements.indices{record.elements[j].tags.removeAll{$0.origin=="type-system-fit" && ["detected","suggested"].contains($0.state)}}
                record.genome.typeSystemIDs=[]
                for j in record.genome.elements.indices{record.genome.elements[j].typeSystemIDs=[]}
                for system in systems {
                    annotate(&record.tags,system:system)
                    for j in record.elements.indices where system.sourceElementIDs.contains(record.elements[j].id) && record.elements[j].reviewStatus != "rejected" {annotate(&record.elements[j].tags,system:system);linked += 1}
                    for j in record.genome.elements.indices where system.sourceElementIDs.contains(record.genome.elements[j].sourceElementID) {
                        record.genome.elements[j].typeSystemIDs=Array(Set((record.genome.elements[j].typeSystemIDs ?? [])+[system.id])).sorted()
                    }
                }
                record.genome.typeSystemIDs=Array(Set((record.genome.typeSystemIDs ?? [])+systems.map(\.id))).sorted()
                try saveRecord(record)
                try LibraryRaster.write(record.genome,to:directory.appending(path:"posters/\(record.id)/genome.json"))
                index.posters[i].tags=Array(Set(LibraryRaster.tagNames(record.tags))).sorted();updated += 1
            }
            try save(index)
            try LibraryRaster.write(catalog,to:directory.appending(path:"type-systems.json"))
            progress("Linked \(catalog.systems.count) type systems to \(updated) poster genomes / \(linked) source-element memberships. Existing labels, borders and review states preserved.")
        }
    }

}
