import Foundation
import PosterCore

struct LibraryCommand {
    static func run(_ args:[String]) async throws {
        if args.isEmpty || args.contains("--help") {
            print("""
            poster library index --source output/instagram --library library [--limit 8] [--no-words]
            poster library inspect --library library
            poster library search --library library [--image image.jpg] [--query words] [--tag text-duplication] [--posters-only] [--limit 20] [--out hits.json]
            poster library semantic-index --library library [--models models/siglip] [--include-elements] [--limit 100] [--force]
            poster library semantic-search --library library --query 'dense experimental typography' [--models models/siglip] [--include-elements] [--tag typography] [--limit 20] [--out hits.json]
            poster library semantic-check [--models models/siglip] [--out verification.json]
            poster library discover-systems --library library --scope type|shape --out directory [--models models/siglip]
            poster library segment --library library --poster ID --points '0.5,0.5,1' --out directory [--sam-models models/sam2]
            poster library analyze-regions --library library [--limit 10] [--max-regions 6] [--sam-models models/sam2] [--models models/siglip]
            poster library region-search --library library --query 'repeated circular shapes' [--region ID] [--limit 20]
            poster library refresh-region-links --library library
            poster library fit --library library [--poster ID] [--rounds 2] [--count 4] [--unfitted]
            poster library render --library library --poster ID --out variant.png [--seed 7] [--variation 0.15] [--title 'NEW WORDS']
            poster library layout --library library --poster ID --donor ID --style kinetic --seed 7 --out output/layout-proof
            poster library compositions --library library
            poster library colors --library library [--poster ID] [--force]
            poster library breed --library library --out output/source-crossovers [--rounds 5] [--count 8] [--seed 20261108] [--title 'NEW WORDS'] [--directions editorial,optical] [--prefilter 4] [--mix 'Designer / Paul Rand=2'] [--font-profile PROFILE-ID] [--brief mixed|BRIEF-ID] [--reference IMAGE [--crop-reference true]] [--modifiers true]
            poster library train --library library [--bootstrap]
            poster library predict --library library --image poster.jpg [--scope poster|element]
            poster library report --library library
            poster library apply --library library --input review-edits.json
            """);return
        }
        let flags:Set<String>=["--no-words","--posters-only","--bootstrap","--force","--unfitted","--include-elements","--cpu-only"]
        let keys:Set<String>=["--source","--library","--limit","--image","--query","--tag","--out","--poster","--rounds","--count","--seed","--variation","--title","--input","--scope","--directions","--prefilter","--reference","--crop-reference","--modifiers","--mix","--donor","--style","--font-profile","--type-system","--taste","--brief","--subtitle","--institution","--footer","--models","--sam-models","--points","--box","--max-regions","--grid","--ink-points","--region"]
        var options:[String:String]=[:],enabled:Set<String>=[];var i=1
        while i<args.count {
            let key=args[i]
            if flags.contains(key){enabled.insert(key);i+=1}
            else if keys.contains(key),i+1<args.count,!args[i+1].hasPrefix("--"){options[key]=args[i+1];i+=2}
            else{throw PosterError.invalid("Unknown library option or missing value: \(key)")}
        }
        func integer(_ key:String,_ fallback:Int)throws->Int {guard let text=options[key] else{return fallback};guard let n=Int(text) else{throw PosterError.invalid("\(key) must be an integer.")};return n}
        let directory=URL(fileURLWithPath:options["--library"] ?? "library",isDirectory:true).standardizedFileURL
        let engine=PosterLibraryEngine(directory:directory)
        func selectedCopy(seed:UInt64)throws->PosterCopy {
            if let id=options["--brief"],id != "mixed" {
                guard let brief=ContentBriefLibrary.brief(id) else{throw PosterError.invalid("Unknown content brief. Use poster briefs list.")}
                return try brief.posterCopy.validated()
            }
            if let title=options["--title"] {
                return try PosterCopy(title:title,subtitle:options["--subtitle"] ?? PosterCopy().subtitle,institution:options["--institution"] ?? PosterCopy().institution,footer:options["--footer"] ?? PosterCopy().footer).validated()
            }
            return try ContentBriefLibrary.copy(seed:seed).validated()
        }

        switch args[0] {
        case "segment", "analyze-regions", "region-search", "refresh-region-links":
            try await RegionCommand.run(args[0], options: options, flags: enabled, directory: directory)
        case "discover-systems":try await SystemDiscoveryCommand.run(options:options,directory:directory)
        case "semantic-index", "semantic-search", "semantic-check":
            let semantic=SemanticLibrarySearch(directory:directory,models:options["--models"].map{URL(fileURLWithPath:$0)})
            switch args[0] {
            case "semantic-index":
                let result=try await semantic.index(includeElements:enabled.contains("--include-elements"),limit:options["--limit"] == nil ? nil:try integer("--limit",100),force:enabled.contains("--force"),progress:{print($0)})
                print("Semantic index: \(result.indexed)/\(result.eligible) images · \(result.computed) embedded · \(result.cached) cached")
            case "semantic-search":
                guard let query=options["--query"] else{throw PosterError.invalid("semantic-search requires --query.")}
                guard options["--image"] == nil else{throw PosterError.invalid("Use --query for semantic-search; use search --image for Vision similarity.")}
                let result=try await semantic.search(query:query,includeElements:enabled.contains("--include-elements"),tag:options["--tag"],limit:integer("--limit",20))
                if let out=options["--out"]{try LibraryRaster.write(result,to:URL(fileURLWithPath:out))}
                print("SigLIP cosine affinity · \(result.indexed)/\(result.eligible) images · \(result.missingOrStale) missing or stale")
                for hit in result.hits{print("\(hit.elementID ?? hit.posterID) · \(String(format:"%.5f",hit.similarity)) · \(hit.imageURL.path)")}
            default:
                let result=try await semantic.verifyModelPack()
                if let out=options["--out"]{try LibraryRaster.write(result,to:URL(fileURLWithPath:out))}
                print("PASS: \(result.tokenizerFixtures) exact tokenizer fixtures; \(result.textFixtures) text and \(result.imageFixtures) image parity checks; minimum cosine \(result.minimumTextCosine) / \(result.minimumImageCosine)")
            }
        case "index":
            guard let source=options["--source"] else{throw PosterError.invalid("index requires --source.")}
            let result=try await engine.index(source:URL(fileURLWithPath:source,isDirectory:true).standardizedFileURL,
                limit:options["--limit"]==nil ? nil:try integer("--limit",8),words:!enabled.contains("--no-words"),progress:{print($0)})
            try LibraryReport.write(index:result,records:await engine.records())
            print("Indexed \(result.sources.count) source files, \(result.posters.count) poster surfaces, \(result.posters.reduce(0){$0+$1.elementCount}) elements. Failures/duplicate notices: \(result.failures.count)")
        case "compositions":try await engine.compositions(progress:{print($0)})
        case "colors":
            try await engine.colors(posterID:options["--poster"],force:enabled.contains("--force"),progress:{print($0)})
            try LibraryReport.write(index:await engine.load(),records:await engine.records())
        case "inspect":
            let index=try await engine.load()
            print("\(index.posters.count) poster surfaces · \(index.posters.reduce(0){$0+$1.elementCount}) elements · \(index.sources.count) source files")
            for item in index.posters.prefix(20){print("\(item.id) · \(item.elementCount) elements · \(item.title)")}
        case "search":
            let hits=try await engine.search(imageURL:options["--image"].map{URL(fileURLWithPath:$0)},query:options["--query"],tag:options["--tag"],includeElements:!enabled.contains("--posters-only"),limit:try integer("--limit",20))
            if let out=options["--out"]{try LibraryRaster.write(hits,to:URL(fileURLWithPath:out))}
            for hit in hits{print("\(hit.elementID ?? hit.posterID) · \(hit.distance.map{String($0)} ?? "lexical/tag match") · \(hit.imageURL.path) · \(hit.text.prefix(100))")}
        case "layout":
            guard let id=options["--poster"],let donor=options["--donor"],let out=options["--out"],let seed=UInt64(options["--seed"] ?? "7") else{throw PosterError.invalid("layout requires --poster, --donor, --out, optional --style/--seed.")}
            let records=try await engine.records()
            guard let a=records.first(where:{$0.id==id}),let b=records.first(where:{$0.id==donor}) else{throw PosterError.invalid("Unknown layout donor.")}
            let folder=URL(fileURLWithPath:out)
            guard !FileManager.default.fileExists(atPath:folder.appending(path:"poster.png").path) else{throw PosterError.invalid("Layout proof exists; choose a new output.")}
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            let copy=try selectedCopy(seed:seed)
            let genome=SourceLayoutDNA.make(a,b,category:options["--style"] ?? "swiss",seed:seed,copy:copy,id:"layout-proof-\(seed)",fontProfileID:options["--font-profile"])
            try LibraryRaster.write(genome,to:folder.appending(path:"genome.json"))
            try genome.composition?.write(to:folder)
            for stage in ConstructionStage.allCases {try PosterRenderer.png(LibrarySceneRenderer.render(genome,width:700,seed:seed,stage:stage),to:folder.appending(path:stage == .finished ? "poster.png":"poster-\(stage.rawValue).png"))}
            try LibrarySceneRenderer.pdf(genome,to:folder.appending(path:"poster.pdf"),seed:seed)
            print("Source layout: \(id) + \(donor); preflight: \(CompositionJudges.preflight(genome,copy:copy))")
        case "breed":
            guard let out=options["--out"],let seed=UInt64(options["--seed"] ?? "20261108") else{throw PosterError.invalid("breed requires --out and a valid seed.")}
            let breeder=try LibraryBreeder(records:await engine.records(),output:URL(fileURLWithPath:out))
            var mix:[String:Double]?
            if let value=options["--mix"] {
                var weights:[String:Double]=[:]
                for part in value.split(separator:","){let pair=part.split(separator:"=");guard pair.count==2,let weight=Double(pair[1]),weight.isFinite,(0...10).contains(weight),(StyleCatalog.allJudges.contains(String(pair[0])) || TasteTrainer.isJudge(String(pair[0]))) else{throw PosterError.invalid("Invalid source-study judging mix.")};weights[String(pair[0])]=weight}
                mix=weights
            }
            try await breeder.run(rounds:integer("--rounds",5),count:integer("--count",8),seed:seed,copy:try selectedCopy(seed:seed),useBriefLibrary:options["--title"]==nil && (options["--brief"]==nil || options["--brief"]=="mixed"),overrideWeights:mix,fontProfileID:options["--font-profile"],typeSystem:try options["--type-system"].map{try JSONDecoder().decode(TypeSystemVariant.self,from:Data(contentsOf:URL(fileURLWithPath:$0)))},tasteDirectory:options["--taste"].map{URL(fileURLWithPath:$0)},directions:options["--directions"].map{$0.split(separator:",").map(String.init)},reference:try options["--reference"].map{try SourceStudyReference(url:URL(fileURLWithPath:$0),crop:options["--crop-reference"]=="true")},useModifiers:options["--modifiers"]=="true",proposalsPerSlot:integer("--prefilter",1),progress:{print($0)})
        case "surrogate-score":
            // Parity check against scripts/jury-surrogate/parity.py: one JSON line per stored candidate genome.
            guard let input=options["--input"] else{throw PosterError.invalid("surrogate-score requires --input round.json.")}
            guard let surrogate=JurySurrogate.shared else{throw PosterError.invalid("The pre-render filter model could not be loaded.")}
            let round=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:input))) as? [String:Any] ?? [:]
            for candidate in round["candidates"] as? [[String:Any]] ?? [] {
                guard let id=candidate["id"] as? String,let raw=candidate["genome"] as? [String:Any],raw["elements"] != nil else{continue}
                let genome=try JSONDecoder().decode(StyleGenome.self,from:JSONSerialization.data(withJSONObject:raw))
                print("{\"id\":\"\(id)\",\"score\":\(try surrogate.score(genome,direction:round["direction"] as? String ?? ""))}")
            }
        case "fit":try await engine.fit(posterID:options["--poster"],rounds:try integer("--rounds",2),count:try integer("--count",4),unfittedOnly:enabled.contains("--unfitted"),progress:{print($0)})
        case "render":
            guard let id=options["--poster"],let out=options["--out"] else{throw PosterError.invalid("render requires --poster and --out.")}
            guard let seed=UInt64(options["--seed"] ?? "0"),let variation=Double(options["--variation"] ?? "0") else{throw PosterError.invalid("Invalid seed or variation.")}
            try await engine.render(posterID:id,to:URL(fileURLWithPath:out),seed:seed,variation:variation,title:options["--title"])
        case "apply":
            guard let input=options["--input"] else{throw PosterError.invalid("apply requires --input.")}
            let edits=try JSONDecoder().decode([ReviewEdit].self,from:Data(contentsOf:URL(fileURLWithPath:input)))
            try await engine.apply(edits:edits);print("Applied \(edits.count) review edits.")
        case "report":try LibraryReport.write(index:await engine.load(),records:await engine.records());print(directory.appending(path:"review.html").path)
        case "train":
            let result=try TechniqueTrainer.train(records:await engine.records(),directory:directory,bootstrap:enabled.contains("--bootstrap"),progress:{print($0)})
            print("Trained \(result.results.filter{$0.modelURL != nil}.count) technique heads. Label mode: \(result.labelMode)")
        case "predict":
            guard let image=options["--image"] else{throw PosterError.invalid("predict requires --image.")}
            let run=try JSONDecoder().decode(TechniqueTrainingRun.self,from:Data(contentsOf:directory.appending(path:"training.json")))
            let tags=try TechniqueTrainer.predict(imageURL:URL(fileURLWithPath:image),training:run,scope:options["--scope"] ?? "poster")
            if let out=options["--out"]{try LibraryRaster.write(tags,to:URL(fileURLWithPath:out))}
            for tag in tags {print("\(tag.name): \(tag.confidence)")}
        default:throw PosterError.invalid("Unknown library command. Use poster library --help.")
        }
    }
}
