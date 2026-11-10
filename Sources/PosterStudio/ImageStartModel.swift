import SwiftUI
import UniformTypeIdentifiers
import PosterCore

@MainActor @Observable
final class ImageStartModel {
    var imageURL:URL?
    var profile:ImageInfluenceProfile?
    var settings=ImageInfluenceSettings()
    var seed="20261108"
    var rounds=10
    var count=15
    /// What the sheet is doing; see `JobLifecycle`. `busy` is true for any job.
    let jobs=JobRunner()
    var busy:Bool{jobs.busy}
    var status="Choose an image to shape the next study"
    var error:String?
    var result:ImagePosterStudyResult?
    var live:LiveStudy?
    var selectedRound=0
    var selectedID:String?
    var selectedHypothesis="all"
    var selectedMatch:String?
    private let worker=ImagePosterStudy()
    private let exporter=ImageExportWorker()
    var selected:ImagePosterCandidate? {
        guard let result,result.rounds.indices.contains(selectedRound) else{return nil}
        let round=result.rounds[selectedRound],pool=round.candidates.filter{(selectedHypothesis=="all" || $0.hypothesis==selectedHypothesis) && (selectedMatch==nil || $0.matchedGroup==selectedMatch)}
        if let selectedID,let chosen=pool.first(where:{$0.id==selectedID}){return chosen}
        return pool.first{$0.id==(round.directionWinners?[selectedHypothesis] ?? round.winnerID)} ?? pool.first
    }
    func chooseImage(){let panel=NSOpenPanel();panel.allowedContentTypes=[.image];panel.allowsMultipleSelection=false;guard panel.runModal() == .OK,let url=panel.url else{return};loadImage(url)}
    func loadImage(_ url:URL){
        guard !busy,url.isFileURL else{return}
        error=nil;status="Measuring palette, texture and focal regions…"
        jobs.run(.imageAnalysis){[self] in
            do {
                let assets=URL.applicationSupportDirectory.appending(path:"PosterLab/ImageStartingPoints")
                let profile=try await worker.analyze(url,assets:assets)
                try Task.checkCancellation()
                self.profile=profile;imageURL=profile.asset.url;result=nil;selectedID=nil
                status="Image ready · \(profile.attention.count) focal regions · \(profile.statistics.palette.count) palette colors"
            }catch is CancellationError{status="Image analysis stopped"}catch{self.error=error.localizedDescription;status="Could not open this image"}
        }
    }
    func generate(studio:StudioModel){
        guard !busy,let imageURL else{return}
        guard let seed=UInt64(seed) else{error="Seed must be an unsigned integer.";return}
        let library=studio.reviewLibraryURL,copy=studio.copy,settings=settings,count=count,rounds=rounds,font=studio.fontProfileID,type=studio.typeSystem,shape=studio.shapePreset,taste=studio.tasteDirectory
        let root=library?.deletingLastPathComponent() ?? URL.documentsDirectory.appending(path:"PosterLab")
        let output=root.appending(path:"output/image-study-\(UUID().uuidString.prefix(8))")
        let defaultMix=StyleCatalog.balancedWeights.allSatisfy{studio.judgeWeights[$0.key]==$0.value}
        let weights=defaultMix ? nil:studio.judgeWeights
        error=nil;status="Starting image study…"
        let (stream,feed)=AsyncStream.makeStream(of:SourceStudyEvent.self)
        live=LiveStudy(resultURL:output,events:stream,directions:["Image study"])
        jobs.run(.imageStudy){[self] in
            defer{feed.finish()}
            do {
                let result=try await worker.run(image:imageURL,library:library,output:output,settings:settings,copy:copy,seed:seed,rounds:rounds,count:count,fontProfileID:font,typeSystem:type,shapePreset:shape,judgeWeights:weights,tasteDirectory:taste,events:{feed.yield($0)},progress:{message in Task{@MainActor in self.report(message)}})
                self.result=result;finishLive(stopped:false);profile=result.profile;selectedRound=result.rounds.count-1;selectedID=result.winner.id
                UserDefaults.standard.set(result.directory.appending(path:"image-study.json").path,forKey:"posterlab-last-image-study")
                status="\(rounds*count) candidates judged · winner \(result.winner.id)"
            }catch is CancellationError{status="Stopped · completed rounds remain saved in \(output.lastPathComponent)";finishLive(stopped:true)}catch{self.error=error.localizedDescription;status="Image study did not finish";live=nil}
        }
    }
    /// The stage replays events with pauses, so it ends once it has shown them all.
    private func finishLive(stopped:Bool){
        guard let live else{return}
        Task{@MainActor in
            while !live.caughtUp && !stopped {try? await Task.sleep(for:.milliseconds(300))}
            try? await Task.sleep(for:.seconds(stopped ? 0:1.2))
            live.finish(stopped:stopped)
        }
    }
    func stop(){if jobs.stop(){status="Stopping after the current image pass…"}}
    /// Shows a job's progress unless it has been asked to stop or has already ended.
    private func report(_ message:String){if jobs.lifecycle.acceptsProgress{status=message}}
    func openStudy(){let panel=NSOpenPanel();panel.allowedContentTypes=[.json];guard panel.runModal() == .OK,let url=panel.url else{return};restore(url)}
    func restore(_ url:URL){
        guard !busy else{return}
        do{let loaded=try JSONDecoder().decode(ImagePosterStudyResult.self,from:Data(contentsOf:url));guard !loaded.rounds.isEmpty,loaded.rounds.allSatisfy({!$0.candidates.isEmpty}),FileManager.default.fileExists(atPath:loaded.profile.asset.url.path) else{throw PosterError.invalid("The saved image study is incomplete or its image asset is missing.")};result=loaded;rounds=loaded.rounds.count;count=max(12,min(24,loaded.rounds.first?.candidates.count ?? 15));if count%3 != 0{count=15};UserDefaults.standard.set(url.path,forKey:"posterlab-last-image-study");profile=loaded.profile;imageURL=loaded.profile.asset.url;settings=loaded.settings;seed=String(loaded.seed);selectedRound=loaded.rounds.count-1;selectedID=loaded.winner.id;status="Opened \(loaded.rounds.count)-round image study"}catch{self.error=error.localizedDescription}
    }
    func export(pdf:Bool){
        guard !busy,let selected else{return}
        let panel=NSSavePanel();panel.allowedContentTypes=pdf ? [.pdf]:[.png];panel.nameFieldStringValue=selected.id+(pdf ? ".pdf":".png");guard panel.runModal() == .OK,let url=panel.url else{return}
        status="Exporting \(pdf ? "PDF":"3508 px PNG")…"
        jobs.run(.export){[self] in do{try await exporter.export(selected,pdf:pdf,to:url);status="Exported \(url.lastPathComponent)"}catch{self.error=error.localizedDescription}}
    }
}
private actor ImageExportWorker {
    func export(_ candidate:ImagePosterCandidate,pdf:Bool,to url:URL)throws {
        if pdf{try LibrarySceneRenderer.pdf(candidate.genome,to:url,seed:candidate.seed)}else{try PosterRenderer.png(LibrarySceneRenderer.render(candidate.genome,width:3508,seed:candidate.seed),to:url)}
    }
}
