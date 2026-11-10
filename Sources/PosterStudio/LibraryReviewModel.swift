import SwiftUI
import PosterCore

@MainActor @Observable
final class LibraryReviewModel {
    var directory:URL?
    var records:[PosterRecord]=[]
    var selectedID:String?
    var borderMode=true
    var showWords=false
    var query=""
    var semanticMode=false
    var semanticBusy=false
    var semanticMessage="Describe the design, then press Return to search."
    var semanticHits:[SemanticSearchHit]=[]
    var semanticHasResults=false
    private var semantic:SemanticLibrarySearch?
    private var semanticTask:Task<Void,Never>?
    private var semanticRequestID=UUID()
    var corners:[[Double]]=[]
    var zoom=1.0
    var original:NSImage?
    var rectified:NSImage?
    var selectedElementID:String?
    var regionAnalysis: PosterRegionAnalysis?
    private var regionAnalysisTask: Task<Void, Never>?
    var presentTags:Set<String>=[]
    var absentTags:Set<String>=[]
    var styleLabels:[String:String]=[:]
    var busy=false
    var cornerDrafts:[String:[[Double]]]=[:]
    var status="Choose a source library to review posters."
    var error:String?
    private var engine:PosterLibraryEngine?
    init() {
        if let data=UserDefaults.standard.data(forKey:"posterlab-border-drafts"),let saved=try? JSONDecoder().decode([String:[[Double]]].self,from:data){cornerDrafts=saved}
    }
    var selected:PosterRecord? {records.first{$0.id==selectedID}}
    var element:PosterElement? {selected?.elements.first{$0.id==selectedElementID}}
    var pendingCount:Int {records.filter{!$0.reviewStatus.hasPrefix("surface-confirmed")}.count}
    var filtered:[PosterRecord] {
        let visible=records.filter { record in
            (!borderMode || !record.reviewStatus.hasPrefix("surface-confirmed")) &&
            (semanticMode || query.isEmpty || (record.id+" "+record.textIndex+" "+(record.colors?.searchText ?? "")+" "+record.tags.map(\.name).joined(separator:" ")).localizedCaseInsensitiveContains(query))
        }
        guard semanticMode,!query.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else{return visible}
        let lookup=Dictionary(uniqueKeysWithValues:visible.map{($0.id,$0)})
        return semanticHits.compactMap{lookup[$0.posterID]}
    }
    func invalidateSemanticSearch() {
        semanticTask?.cancel();semanticTask=nil;semanticRequestID=UUID();semanticBusy=false
        semanticHits=[];semanticHasResults=false
        semanticMessage="Describe the design, then press Return to search."
    }
    func cancelSemanticWork() {
        invalidateSemanticSearch();semanticMessage="Search stopped. Completed index batches are saved."
    }
    func searchSemantically() {
        guard semanticMode,!query.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,let semantic,!semanticBusy else{return}
        let description=query,request=UUID();semanticRequestID=request
        let posterIDs=Set(records.filter{!borderMode || !$0.reviewStatus.hasPrefix("surface-confirmed")}.map(\.id))
        semanticBusy=true;semanticHasResults=false;semanticHits=[];semanticMessage="Finding matching posters…"
        semanticTask=Task {
            do {
                let results=try await semantic.search(query:description,posterIDs:posterIDs,limit:200)
                guard !Task.isCancelled,semanticRequestID==request else{return}
                semanticHits=results.hits;semanticHasResults=true
                semanticMessage="\(results.indexed) of \(results.eligible) posters searched.\(results.missingOrStale>0 ? " Refresh index for \(results.missingOrStale) changed or missing posters.":"")"
                if let first=filtered.first{select(first.id)}
            }catch is CancellationError{}
            catch{guard semanticRequestID==request else{return};semanticMessage=error.localizedDescription}
            if semanticRequestID==request{semanticBusy=false;semanticTask=nil}
        }
    }
    func buildSemanticIndex() {
        guard let semantic,!semanticBusy else{return}
        let request=UUID();semanticRequestID=request;semanticBusy=true;semanticMessage="Building search index…"
        semanticTask=Task {
            do {
                let summary=try await semantic.index(progress:{[weak self] message in
                    Task{@MainActor in guard let self,self.semanticRequestID==request else{return};self.semanticMessage=message}
                })
                guard !Task.isCancelled,semanticRequestID==request else{return}
                semanticMessage="Search index ready: \(summary.indexed) posters."
                semanticBusy=false;semanticTask=nil
                if !query.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty{searchSemantically()}
            }catch is CancellationError{}
            catch{guard semanticRequestID==request else{return};semanticMessage=error.localizedDescription;semanticBusy=false;semanticTask=nil}
        }
    }
    func chooseFolder() {
        let panel=NSOpenPanel();panel.canChooseDirectories=true;panel.canChooseFiles=false
        panel.message="Choose a PosterLab source library containing library.json."
        if let directory {panel.directoryURL=directory}
        guard panel.runModal() == .OK,let url=panel.url else{return}
        load(url)
    }
    func restore() {
        guard directory==nil else{return}
        let saved=UserDefaults.standard.string(forKey:"posterlab-library-directory").map{URL(fileURLWithPath:$0)}
        let bundled=Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent().appending(path:"library")
        let working=URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appending(path:"library")
        if let url=[saved,bundled,working].compactMap({$0}).first(where:{FileManager.default.fileExists(atPath:$0.appending(path:"library.json").path)}){load(url)}
    }
    func load(_ url:URL, selectElementID: String? = nil) {
        guard !busy else{return};rememberCorners();let priorID=selectedID
        invalidateSemanticSearch()
        busy=true;status="Loading source library…"
        let engine=PosterLibraryEngine(directory:url)
        Task {
            do {
                let loaded=try await engine.records()
                self.engine=engine;directory=url;records=loaded
                semantic=SemanticLibrarySearch(directory:url)
                UserDefaults.standard.set(url.path,forKey:"posterlab-library-directory")
                let id=priorID.flatMap{id in loaded.contains{$0.id==id} ? id:nil} ?? filtered.first?.id ?? loaded.first?.id
                selectedID=nil;corners=[];select(id)
                if let selectElementID, selected?.elements.contains(where: { $0.id == selectElementID }) == true { selectedElementID = selectElementID; readLabels() }
                status="Loaded \(records.count) poster surfaces. Drag corners on the original photograph."
            }catch{self.error=error.localizedDescription;status="Could not load this library."}
            busy=false
        }
    }
    func select(_ id:String?) {
        rememberCorners()
        regionAnalysisTask?.cancel(); regionAnalysis = nil
        selectedID=id;selectedElementID=nil
        guard let selected else{original=nil;rectified=nil;corners=[];return}
        corners=cornerDrafts[(directory?.path ?? "")+":"+selected.id] ?? selected.sourceQuad;zoom=1
        original=NSImage(contentsOf:selected.source.sourceURL);rectified=NSImage(contentsOf:selected.imageURL)
        styleLabels=selected.styleLabels ?? [:]
        readLabels()
        if let directory {
            let assistant = MultimodalLibraryAnalysis(directory: directory)
            regionAnalysisTask = Task {
                let analysis = try? await assistant.currentAnalysis(record: selected)
                guard !Task.isCancelled, selectedID == selected.id, self.directory == directory else { return }
                regionAnalysis = analysis
            }
        }
    }
    func rememberCorners() {
        guard let selected,corners.count==4,let directory else{return}
        let key=directory.path+":"+selected.id
        if corners==selected.sourceQuad{cornerDrafts.removeValue(forKey:key)}else{cornerDrafts[key]=corners}
        if let data=try? JSONEncoder().encode(cornerDrafts){UserDefaults.standard.set(data,forKey:"posterlab-border-drafts")}
    }
    var draftKey:String? {guard let directory,let selectedID else{return nil};return directory.path+":"+selectedID}
    func readLabels() {
        let tags=element?.tags ?? selected?.tags ?? []
        presentTags=Set(tags.filter{$0.state=="confirmed"}.map(\.name));absentTags=Set(tags.filter{$0.state=="rejected"}.map(\.name))
    }
    func label(_ tag:String,_ value:String) {
        presentTags.remove(tag);absentTags.remove(tag)
        if value=="present"{presentTags.insert(tag)}else if value=="absent"{absentTags.insert(tag)}
    }
    func saveStyles() {
        guard let selected else{return}
        apply(json:[["posterID":selected.id,"styleLabels":styleLabels,"tags":[]]],message:"Style labels saved for judge training.",advance:false)
    }
    func saveBorder() {
        guard let record=selected else{return}
        apply(json:[["posterID":record.id,"sourceQuad":corners,"tags":[]]],message:"Poster border saved; elements re-extracted.",advance:true)
    }
    func saveLabels(reject:Bool=false) {
        guard let record=selected else{return}
        var edit:[String:Any]=["posterID":record.id,"tags":presentTags.sorted(),"rejectedTags":absentTags.sorted()]
        if let element {edit["elementID"]=element.id;if reject{edit["rejectElement"]=true}}
        apply(json:[edit],message:reject ? "Element rejected.":"Technique review saved.",advance:false)
    }
    private func apply(json:[[String:Any]],message:String,advance:Bool) {
        guard !busy,let engine else{return}
        let edits:[ReviewEdit]
        do{edits=try JSONDecoder().decode([ReviewEdit].self,from:JSONSerialization.data(withJSONObject:json))}
        catch{self.error=error.localizedDescription;return}
        busy=true;status="Saving review and updating the poster…"
        Task {
            do {
                try await engine.apply(edits:edits)
                if advance,let draftKey{cornerDrafts.removeValue(forKey:draftKey);corners=[]}
                records=try await engine.records()
                invalidateSemanticSearch()
                select(advance ? filtered.first?.id:selectedID)
                status=message
            }catch{self.error=error.localizedDescription;status="Review was not saved."}
            busy=false
        }
    }
}
