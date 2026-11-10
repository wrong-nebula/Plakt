import SwiftUI
import PosterCore

struct SourceStudyView:View {
    let directory:URL
    var tasteDirectory:URL?=nil
    var editGlass: ((HybridScene) -> Void)? = nil
    @State private var showTaste=false
    @State private var kerning:KerningRequest?
    @State private var tasteImageURL:URL?
    @Environment(\.dismiss) private var dismiss
    @State private var rounds:[HybridRound]=[]
    @State private var direction="Bauhaus"
    @State private var round=4
    @State private var selectedID:String?
    @State private var error:String?
    @State private var curatedPick:CuratedPick?
    @State private var curatedChoices:[CuratedPick]=[]
    @State private var categories:[String:String]=[:]
    @State private var finals:[String:SourceFinal]=[:]
    @State private var finalistID:String?
    @State private var showCommittee=false
    @State private var tasteVotes:[String:Bool]=[:]
    @State private var tasteProfile:String?
    @State private var finalsBusy=false
    @State private var finalsError:String?
    @State private var openedStudy:URL?
    @State private var studyChoices:[URL]=[]
    private var studyURL:URL {openedStudy ?? directory}
    /// Round picker tag for the finalists sheet.
    private let finalistsTag = -1
    private struct CuratedPick:Decodable {var direction:String;var round:Int;var selectedCandidate:String;var note:String?}
    private struct CuratedCollection:Decodable {var picks:[CuratedPick]}
    private var availableDirections:[String] {Array(Set(rounds.map(\.direction))).sorted()}
    private var current:HybridRound? {rounds.first{$0.direction==direction && $0.round==round}}
    var body:some View {
        VStack(spacing:0) {
            HStack {
                VStack(alignment:.leading,spacing:4) {Text("Source studies").font(.title2.bold());Text("Composed like an image study · new donors per candidate · five rounds per direction").font(.caption).foregroundStyle(.secondary)}
                Spacer()
                if studyChoices.count>1 {
                    Menu {ForEach(studyChoices,id:\.self){url in Button(url.lastPathComponent){openedStudy=url}}} label:{Label(studyURL.lastPathComponent,systemImage:"square.stack")}.fixedSize(horizontal:true,vertical:false)
                }
                if curatedChoices.count>1 {
                    Menu {ForEach(Array(curatedChoices.enumerated()),id:\.offset){_,pick in Button(pick.direction){selectCurator(pick)}}} label:{Label("Curator picks",systemImage:"star")}.fixedSize(horizontal:true,vertical:false)
                }else if let pick=curatedPick {Button("Curator pick",systemImage:"star"){selectCurator(pick)}}
                Button("Show files",systemImage:"folder"){NSWorkspace.shared.open(studyURL)}
                Button("Done"){dismiss()}.keyboardShortcut(.cancelAction)
            }.padding(20)
            Divider()
            HStack {
                if availableDirections.count>5 {
                    Picker("Direction",selection:$direction){ForEach(availableDirections,id:\.self){Text($0).tag($0)}}.pickerStyle(.menu).frame(width:310)
                }else{
                    Picker("Direction",selection:$direction){ForEach(availableDirections,id:\.self){Text($0).tag($0)}}.pickerStyle(.segmented).labelsHidden().frame(width:480)
                }
                Spacer()
                Picker("Round",selection:$round){ForEach(0..<5){Text("\($0+1)").tag($0)};Text("Finalists").tag(finalistsTag)}.pickerStyle(.segmented).frame(width:360)
            }.padding(16)
            if round==finalistsTag {finalistsSheet}
            else if let current {
                HSplitView {
                    ScrollView {
                        LazyVGrid(columns:[GridItem(.adaptive(minimum:170,maximum:240))],spacing:18) {
                            ForEach(current.judging.results) { candidate in
                                Button {selectedID=candidate.id} label: {
                                    VStack(alignment:.leading,spacing:8) {
                                        LibraryThumbnail(url:candidate.imageURL).aspectRatio(1/1.414,contentMode:.fit)
                                        Text(candidate.id==current.winnerID ? "#1 · Winner":"#\(candidate.rank)").font(.caption.bold())
                                        Text("\(candidate.consensus.formatted(.number.precision(.fractionLength(1)))) weighted consensus").font(.caption2).foregroundStyle(.secondary)
                                    }.padding(8).background(selectedID==candidate.id ? Color.accentColor.opacity(0.12):.clear,in:RoundedRectangle(cornerRadius:8))
                                }.buttonStyle(.plain)
                            }
                        }.padding(16)
                    }.frame(minWidth:580)
                    ScrollView {
                        VStack(alignment:.leading,spacing:14) {
                            Text("Round \(round+1) donors").font(.headline)
                            ForEach(current.donorIDs,id:\.self){Text($0).font(.caption.monospaced()).textSelection(.enabled)}
                            Text("Donor compatibility \(current.donorCompatibility.formatted(.number.precision(.fractionLength(3))))").font(.caption).foregroundStyle(.secondary)
                            if let rejected=current.rejectedVisualClones {Text("\(rejected) near-duplicate proposals resampled").font(.caption).foregroundStyle(.secondary)}
                            if let scene=current.candidates.first(where:{$0.id==(selectedID ?? current.winnerID)}) {
                                if tasteDirectory != nil{Button("Rate for my taste…",systemImage:"heart"){tasteImageURL=scene.imageURL;showTaste=true}}
                                if let editGlass { Button("Glass objects", systemImage:"drop") { editGlass(scene) } }
                                Button("Kern this poster…",systemImage:"textformat.abc"){kerning=KerningRequest(source:KerningSource(name:"\(current.direction) · round \(round+1) · \(scene.id==current.winnerID ? "winner":"#\(current.judging.results.first{$0.id==scene.id}?.rank ?? 0)")",genome:scene.genome,seed:scene.seed,hybrid:scene))}
                                if scene.id==curatedPick?.selectedCandidate {Label("Curator pick",systemImage:"star.fill").font(.headline);if let note=curatedPick?.note {Text(note).font(.caption).foregroundStyle(.secondary)}}
                                if let brief=scene.genome.contentBrief {
                                    Text("Event brief").font(.headline)
                                    Text(brief.name).font(.subheadline.weight(.medium))
                                    Text(brief.dateLabel+" · "+brief.status()).font(.caption).foregroundStyle(.secondary)
                                    Text(brief.institution).font(.caption)
                                    if let source=brief.sources.first {Link("Inspiration source",destination:source.url).font(.caption)}
                                    if let id=brief.sourcePosterID {Text("Inspired by poster "+id).font(.caption2.monospaced()).textSelection(.enabled)}
                                }
                                if let id=scene.genome.elements.compactMap(\.fontProfileID).first,let profile=FontLibrary.shared.profile(id) {
                                    Text("Typeface").font(.headline)
                                    Text(profile.label).font(.caption)
                                }
                                Text("Selected candidate ancestry").font(.headline)
                                ForEach(scene.donorIDs,id:\.self){Text($0).font(.caption.monospaced()).textSelection(.enabled)}
                                if let dna=scene.genome.layoutInheritance {
                                    Text("Inherited composition").font(.headline)
                                    HStack(alignment:.top,spacing:10) {
                                        ForEach(Array(dna.sourceImages.enumerated()),id:\.offset){index,url in
                                            VStack(alignment:.leading,spacing:5){LibraryThumbnail(url:url).aspectRatio(contentMode:.fit).frame(maxHeight:180);Text(index==0 ? "Layout skeleton":"Cluster donor").font(.caption2).foregroundStyle(.secondary)}
                                        }
                                    }
                                    Text("\(dna.retainedAnchorCount) retained · \(dna.transferredAnchorCount) transferred anchors").font(.caption)
                                    ForEach(Array(dna.operations.enumerated()),id:\.offset){_,operation in Text(operation).font(.caption).foregroundStyle(.secondary)}
                                }
                                CompositionInspector(plan:scene.genome.composition)
                                Text(scene.parentID.map{"Parent: "+$0} ?? "First donor crossover").font(.caption)
                                LibraryThumbnail(url:scene.imageURL).frame(maxHeight:340)
                            }
                            Text("Winner construction").font(.headline)
                            ForEach(Array(current.constructionImages.enumerated()),id:\.offset){i,url in
                                Text(ConstructionStage.allCases[i].label).font(.caption)
                                LibraryThumbnail(url:url).frame(maxHeight:200)
                            }
                            Text(current.note).font(.caption2).foregroundStyle(.secondary)
                        }.padding(20)
                    }.frame(minWidth:280,idealWidth:320,maxWidth:370)
                }
            }else{ContentUnavailableView("Loading source study",systemImage:"square.stack.3d.up",description:Text(error ?? "Opening saved rounds…"))}
        }.frame(minWidth:1000,minHeight:700)
        .sheet(item:$kerning) {KerningView(source:$0.source)}
        .sheet(isPresented:$showTaste){if let tasteDirectory{TasteCheckView(directory:tasteDirectory,outputRoot:tasteDirectory.deletingLastPathComponent().appending(path:"output"),initialImageURL:tasteImageURL)}}
        .task(id:studyURL) {
            let root=studyURL
            rounds=[];finals=[:];categories=[:];curatedChoices=[];curatedPick=nil;error=nil;finalsError=nil
            studyChoices=((try? FileManager.default.contentsOfDirectory(at:directory.deletingLastPathComponent(),includingPropertiesForKeys:nil)) ?? []).filter{$0.lastPathComponent.hasPrefix("source-") && FileManager.default.fileExists(atPath:$0.appending(path:"manifest.json").path)}.sorted{$0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedDescending}
            do {
                var loaded:[HybridRound]=[]
                let manifest=try JSONDecoder().decode([[String:String]].self,from:Data(contentsOf:root.appending(path:"manifest.json")))
                categories=Dictionary(manifest.compactMap{study in study["direction"].flatMap{d in study["category"].map{(d,$0)}}},uniquingKeysWith:{first,_ in first})
                for study in manifest {for i in 0..<5 {
                    let url=root.appending(path:"\(study["category"]!)/round-\(i)/round.json")
                    loaded.append(try JSONDecoder().decode(HybridRound.self,from:Data(contentsOf:url)))
                }}
                rounds=loaded
                if !loaded.contains(where:{$0.direction==direction}){direction=loaded.first?.direction ?? "Bauhaus"}
                if let data=try? Data(contentsOf:root.appending(path:"curation.json")) {
                    let decoder=JSONDecoder()
                    let choices=(try? decoder.decode(CuratedCollection.self,from:data).picks) ?? (try? decoder.decode(CuratedPick.self,from:data)).map{[$0]} ?? []
                    curatedChoices=choices.filter{pick in loaded.contains{$0.direction==pick.direction && $0.round==pick.round && $0.candidates.contains{$0.id==pick.selectedCandidate}}}
                    if round != finalistsTag,let pick=curatedChoices.first {selectCurator(pick)}
                }
                loadFinal()
            }catch{self.error=error.localizedDescription;finalsError=error.localizedDescription}
        }.onChange(of:direction){showCommittee=false;restoreCuratorSelection();loadFinal()}.onChange(of:round){restoreCuratorSelection();loadFinal()}
    }
    @ViewBuilder private var finalistsSheet:some View {
        if let final=finals[direction] {
            let reveal=showCommittee || final.pickedID != nil
            HSplitView {
                ScrollView {
                    VStack(alignment:.leading,spacing:14) {
                        HStack(alignment:.firstTextBaseline) {
                            Text(final.pickedID==nil ? "Pick the \(final.direction) poster you would print. The committee's order stays hidden until you choose.":"Your \(final.direction) pick is saved. The committee's order is shown for comparison.").font(.callout)
                            Spacer()
                            Toggle("Show committee order",isOn:$showCommittee).toggleStyle(.switch).controlSize(.small).disabled(final.pickedID != nil)
                        }
                        LazyVGrid(columns:[GridItem(.adaptive(minimum:200,maximum:280))],spacing:18) {
                            ForEach(final.finalists) { finalist in
                                Button {finalistID=finalist.id} label: {
                                    VStack(alignment:.leading,spacing:6) {
                                        LibraryThumbnail(url:finalist.imageURL).aspectRatio(1/1.414,contentMode:.fit)
                                        HStack {
                                            Text(roundsLabel(finalist)).font(.caption.bold())
                                            Spacer()
                                            if finalist.id==final.pickedID {Label("Your pick",systemImage:"star.fill").font(.caption.bold()).foregroundStyle(.tint)}
                                        }
                                        if reveal {Text("Committee #\(finalist.committeeRank) of \(final.finalists.count)"+(finalist.id==final.lastRoundWinnerID ? " · last-round winner":"")).font(.caption2).foregroundStyle(.secondary)}
                                        if let vote=tasteVotes[finalist.imageDigest] {Label(vote ? "You voted yes":"You voted no",systemImage:vote ? "heart.fill":"xmark.circle").font(.caption2).foregroundStyle(.secondary)}
                                    }.padding(8).background((finalistID ?? final.pickedID)==finalist.id ? Color.accentColor.opacity(0.12):.clear,in:RoundedRectangle(cornerRadius:8))
                                }.buttonStyle(.plain).accessibilityLabel(roundsLabel(finalist)+(finalist.id==final.pickedID ? ", your pick":""))
                            }
                        }
                    }.padding(16)
                }.frame(minWidth:580)
                ScrollView {finalistDetail(final).padding(20)}.frame(minWidth:280,idealWidth:320,maxWidth:370)
            }
        }else{ContentUnavailableView("Gathering finalists",systemImage:"trophy",description:Text(finalsError ?? "Collecting each round's winner…"))}
    }
    @ViewBuilder private func finalistDetail(_ final:SourceFinal)->some View {
        VStack(alignment:.leading,spacing:12) {
            if let finalist=final.finalists.first(where:{$0.id==(finalistID ?? final.pickedID ?? final.finalists.first?.id)}) {
                Text(roundsLabel(finalist)).font(.headline)
                LibraryThumbnail(url:finalist.imageURL).frame(maxHeight:380)
                if finalist.id==final.pickedID {
                    Label("Your \(final.direction) pick",systemImage:"star.fill").font(.headline)
                    Button("Clear pick"){pickFinalist(nil)}.disabled(finalsBusy)
                }else{
                    Button("Pick as winner",systemImage:"star"){pickFinalist(finalist)}.buttonStyle(.borderedProminent).disabled(finalsBusy)
                }
                if tasteDirectory != nil {
                    Text("Taste votes go to \(tasteProfile ?? "your taste profile"). Picking adds a yes; finalists you pass over get no vote.").font(.caption).foregroundStyle(.secondary)
                    HStack {
                        Button("Yes",systemImage:"heart"){voteFinalist(finalist,yes:true)}
                        Button("No",systemImage:"xmark"){voteFinalist(finalist,yes:false)}
                    }.disabled(finalsBusy)
                }
                if let error=finalsError {Text(error).font(.caption).foregroundStyle(.red)}
                if let picked=final.pickedFinalist {
                    Divider()
                    Text("Committee comparison").font(.headline)
                    Text(picked.committeeRank==1 ? "The committee also ranked your pick first.":"The committee ranked your pick #\(picked.committeeRank) of \(final.finalists.count).").font(.caption)
                    if let automatic=final.finalists.first(where:{$0.id==final.lastRoundWinnerID}) {
                        Text(automatic.id==picked.id ? "It is also the study's automatic winner.":"The study's automatic winner is the \(roundsLabel(automatic).lowercased()); its winner files are unchanged.").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Text(final.note).font(.caption2).foregroundStyle(.secondary)
        }
    }
    private func roundsLabel(_ finalist:SourceFinalist)->String {
        finalist.rounds.count==1 ? "Round \(finalist.rounds[0]+1) winner":"Won rounds "+finalist.rounds.map{String($0+1)}.joined(separator:", ")
    }
    private func loadFinal() {
        guard round==finalistsTag,let category=categories[direction] else{return}
        let root=studyURL,folder=root.appending(path:category),name=direction
        finalistID=nil;finalsError=nil
        Task {
            do {
                let result=try await Task.detached{try SourceFinals.make(directionFolder:folder)}.value
                // A slow load must not land in a study opened since.
                if studyURL==root {finals[name]=result}
            }catch{finalsError=error.localizedDescription}
            await refreshTaste()
        }
    }
    private func pickFinalist(_ finalist:SourceFinalist?) {
        guard let category=categories[direction] else{return}
        let root=studyURL,folder=root.appending(path:category),id=finalist?.id
        finalsBusy=true;finalsError=nil
        Task {
            do {
                let result=try await Task.detached{try SourceFinals.pick(id,directionFolder:folder)}.value
                if studyURL==root {finals[result.direction]=result}
                if let finalist {try await castTaste(finalist,yes:true)}
            }catch{finalsError=error.localizedDescription}
            finalsBusy=false
        }
    }
    private func voteFinalist(_ finalist:SourceFinalist,yes:Bool) {
        finalsBusy=true;finalsError=nil
        Task {
            do {try await castTaste(finalist,yes:yes)}catch{finalsError=error.localizedDescription}
            finalsBusy=false
        }
    }
    private func castTaste(_ finalist:SourceFinalist,yes:Bool)async throws {
        guard let tasteDirectory else{return}
        let store=TasteStore(directory:tasteDirectory)
        let asset=try await store.include(imageURL:finalist.imageURL),archive=try await store.load()
        guard let profile=archive.profiles.first(where:{$0.id=="personal"}) ?? archive.profiles.first else{throw PosterError.invalid("Open Taste check once to create a taste profile.")}
        try await store.vote(profileID:profile.id,assetID:asset.id,yes:yes)
        _ = try await store.train(profileID:profile.id)
        await refreshTaste()
    }
    private func refreshTaste()async {
        guard let tasteDirectory,let archive=try? await TasteStore(directory:tasteDirectory).load(),let profile=archive.profiles.first(where:{$0.id=="personal"}) ?? archive.profiles.first else{return}
        tasteProfile=profile.name;tasteVotes=profile.votes.mapValues(\.yes)
    }
    private func selectCurator(_ pick:CuratedPick) {curatedPick=pick;direction=pick.direction;round=pick.round;selectedID=pick.selectedCandidate}
    private func restoreCuratorSelection() {
        if let pick=curatedChoices.first(where:{$0.direction==direction && $0.round==round}) {curatedPick=pick;selectedID=pick.selectedCandidate}else{selectedID=nil}
    }
}
