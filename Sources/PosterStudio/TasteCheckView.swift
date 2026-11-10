import SwiftUI
import PosterCore

@MainActor @Observable final class TasteCheckModel {
    let store:TasteStore;let outputRoot:URL;let initialImageURL:URL?
    var archive=TasteArchive();var profileID="personal";var current:TasteAsset?;var image:NSImage?
    var skipped:Set<String>=[];var busy=false;var error:String?;var status="Opening your taste deck…"
    var newName="";var review=false;var rename=""
    private var weightTask:Task<Void,Never>?
    private var pendingWeight:(String,Double)?
    var profile:TasteProfile?{archive.profiles.first{$0.id==profileID}}
    var rated:[TasteAsset]{archive.assets.filter{profile?.votes[$0.id] != nil}.sorted{(profile?.votes[$0.id]?.date ?? .distantPast)>(profile?.votes[$1.id]?.date ?? .distantPast)}}
    init(directory:URL,outputRoot:URL,initialImageURL:URL?){store=TasteStore(directory:directory);self.outputRoot=outputRoot;self.initialImageURL=initialImageURL}
    func start(){run{let archive=try await self.store.prepare(outputRoot:self.outputRoot,seedFavourites:true,progress:{message in Task{@MainActor in self.status=message}});self.archive=archive;for p in archive.profiles where p.positive>=3 && p.negative>=3 && !p.ready{_ = try await self.store.train(profileID:p.id)};self.archive=try await self.store.load();if let initial=self.initialImageURL{_ = try await self.store.include(imageURL:initial);self.archive=try await self.store.load()};if !archive.profiles.contains(where:{$0.id==self.profileID}){self.profileID=archive.profiles.first?.id ?? "personal"};self.rename=self.profile?.name ?? "";await self.advance(preferred:self.initialImageURL)}}
    private func run(_ action:@escaping @MainActor ()async throws->Void){guard !busy else{return};busy=true;error=nil;Task{do{try await self.flushWeight();try await action()}catch{self.error=error.localizedDescription;if let latest=try? await self.store.load(){self.archive=latest}};busy=false}}
    func selectProfile(_ id:String){run{self.profileID=id;self.review=false;self.skipped=[];self.archive=try await self.store.load();self.rename=self.profile?.name ?? "";await self.advance()}}
    func create(){run{let profile=try await self.store.createProfile(name:self.newName);self.newName="";self.profileID=profile.id;self.skipped=[];self.review=false;self.archive=try await self.store.load();self.rename=profile.name;await self.advance()}}
    func setWeight(_ value:Double){
        guard let i=archive.profiles.firstIndex(where:{$0.id==profileID}) else{return}
        archive.profiles[i].weight=value;pendingWeight=(profileID,value);weightTask?.cancel()
        weightTask=Task{do{try await Task.sleep(for:.milliseconds(200));try Task.checkCancellation();try await self.flushWeight()}catch is CancellationError{}catch{self.error=error.localizedDescription}}
    }
    func flushWeight()async throws {
        guard let pending=pendingWeight else{return}
        try await store.configure(profileID:pending.0,weight:pending.1)
        if pendingWeight?.0==pending.0 && pendingWeight?.1==pending.1{pendingWeight=nil}
    }
    func configure(name:String?=nil,enabled:Bool?=nil,weight:Double?=nil){run{try await self.store.configure(profileID:self.profileID,name:name,enabled:enabled,weight:weight);self.archive=try await self.store.load();self.rename=self.profile?.name ?? ""}}
    func vote(_ yes:Bool?){guard let current else{return};run{try await self.store.vote(profileID:self.profileID,assetID:current.id,yes:yes);self.status="Learning from your vote…";_ = try await self.store.train(profileID:self.profileID);self.archive=try await self.store.load();self.review=false;await self.advance()}}
    func skip(){guard let current else{return};skipped.insert(current.id);review=false;run{await self.advance()}}
    func undo(){run{if let id=try await self.store.undo(profileID:self.profileID){_ = try await self.store.train(profileID:self.profileID);self.archive=try await self.store.load();self.show(self.archive.assets.first{$0.id==id});self.status="Vote undone"}}}
    func show(_ asset:TasteAsset?){current=asset;image=asset.flatMap{NSImage(contentsOf:$0.imageURL)}}
    func reviewAsset(_ asset:TasteAsset){guard !busy else{return};review=true;show(asset)}
    func resume(){review=false;run{await self.advance()}}
    private func advance(preferred:URL?=nil)async {
        do {
            if let preferred {show(try await store.include(imageURL:preferred))}
            else{show(try await store.next(profileID:profileID,skipped:skipped))}
            status=current==nil ? "All available posters seen · refresh the deck after generating more":"Choose by instinct. There is no committee score on this screen."
        }catch{self.error=error.localizedDescription}
    }
}

@MainActor struct TasteCheckView:View {
    @Environment(\.dismiss) private var dismiss
    @State private var model:TasteCheckModel
    @FocusState private var editing:Bool
    init(directory:URL,outputRoot:URL,initialImageURL:URL?=nil){_model=State(initialValue:TasteCheckModel(directory:directory,outputRoot:outputRoot,initialImageURL:initialImageURL))}
    var body:some View {
        VStack(spacing:0){header;Divider();HSplitView{poster;controls.frame(minWidth:300,idealWidth:330,maxWidth:400)};Divider();footer}
            .frame(minWidth:1000,minHeight:730).task{model.start()}.interactiveDismissDisabled(model.busy)
    }
    private var header:some View {
        HStack{VStack(alignment:.leading,spacing:4){Text("Taste check").font(.title2.bold());Text("Your yes and no votes become a personal jury. Each profile learns separately.").font(.caption).foregroundStyle(.secondary)};Spacer();Button("Done"){Task{do{try await model.flushWeight();dismiss()}catch{model.error=error.localizedDescription}}}.keyboardShortcut(.cancelAction).disabled(model.busy)}.padding(20)
    }
    private var poster:some View {
        VStack(spacing:12){
            if let image=model.image,let asset=model.current {
                Image(nsImage:image).resizable().aspectRatio(contentMode:.fit).frame(maxWidth:.infinity,maxHeight:.infinity).accessibilityLabel("Poster to rate: "+asset.title)
                HStack{Text(asset.title).font(.caption.weight(.medium));Spacer();Text(asset.category).font(.caption).foregroundStyle(.secondary)}
                if let vote=model.profile?.votes[asset.id]{Label(vote.yes ? "You voted yes":"You voted no",systemImage:vote.yes ? "heart.fill":"xmark.circle").font(.caption)}
                voteButtons
                Text("Y yes · N no · Space skip").font(.caption2).foregroundStyle(.secondary)
            }else{ContentUnavailableView(model.busy ? "Preparing your deck":"You’ve seen this deck",systemImage:"heart.text.square",description:Text(model.busy ? "Finding distinct generated posters and keeping your three favourites.":"Generate more posters or revisit a previous vote."))}
        }.padding(22).frame(minWidth:540,maxWidth:.infinity)
    }
    private var voteButtons:some View {
        HStack(spacing:14){Button{model.vote(false)}label:{Label("No",systemImage:"xmark").frame(minWidth:80)}.keyboardShortcut("n",modifiers:editing ? [.command]:[]);Button("Skip for now"){model.skip()}.keyboardShortcut(.space,modifiers:editing ? [.command]:[]);Button{model.vote(true)}label:{Label("Yes",systemImage:"heart.fill").frame(minWidth:80)}.keyboardShortcut("y",modifiers:editing ? [.command]:[]).buttonStyle(.borderedProminent)}.controlSize(.large).disabled(model.busy)
    }
    private var controls:some View {
        ScrollView{VStack(alignment:.leading,spacing:16){profileControls;Divider();learningStatus;Divider();history;Divider();newProfile}.padding(20)}
    }
    private var profileControls:some View {
        VStack(alignment:.leading,spacing:10){
            Text("Your jury").font(.headline)
            Picker("Profile",selection:Binding(get:{model.profileID},set:{model.selectProfile($0)})){ForEach(model.archive.profiles){p in Text(p.name).tag(p.id)}}
            HStack{TextField("Profile name",text:$model.rename).textFieldStyle(.roundedBorder).focused($editing);Button("Rename"){model.configure(name:model.rename)}.disabled(model.rename==model.profile?.name)}
            Toggle("Include in the jury",isOn:Binding(get:{model.profile?.enabled ?? false},set:{model.configure(enabled:$0)}))
            HStack{Text("Voting weight");Spacer();Text(model.profile?.weight ?? 1,format:.number.precision(.fractionLength(1))).monospacedDigit()}.font(.caption)
            Slider(value:Binding(get:{model.profile?.weight ?? 1},set:{model.setWeight($0)}),in:0...3,step:0.1).accessibilityLabel("Personal jury voting weight")
            Text("Combine several taste profiles with the existing craft and style judges. Zero weight excludes this profile.").font(.caption2).foregroundStyle(.secondary)
        }.disabled(model.busy)
    }
    private var learningStatus:some View {
        VStack(alignment:.leading,spacing:9){
            if let p=model.profile {
                HStack{Label("\(p.positive) yes",systemImage:"heart.fill");Spacer();Label("\(p.negative) no",systemImage:"xmark.circle")}.font(.callout.monospacedDigit())
                Label(p.ready ? "Learning from your votes":"Building a first impression",systemImage:p.ready ? "brain":"circle.dotted").font(.headline)
                if !p.ready{Text("At least 3 yes and 3 no votes start this juror. Your three shared favourites are already marked yes in Personal taste.").font(.caption).foregroundStyle(.secondary)}
                else if let training=p.training {
                    Text("\(training.trainingRows) explicit votes · Core ML · trained locally").font(.caption).foregroundStyle(.secondary)
                    if let agreement=training.balancedAccuracy{Text("Held-out agreement \(agreement.formatted(.percent.precision(.fractionLength(0)))) · \(training.holdoutRows) posters in separate source-layout groups").font(.caption2).foregroundStyle(.secondary)}
                    else{Text("Early model: no held-out estimate yet. More votes and more visual variety help.").font(.caption2).foregroundStyle(.secondary)}
                }
                Text("Only yes/no votes are labels. Skipped and unseen posters stay undecided. Votes save locally; you can change them below.").font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
    private var history:some View {
        DisclosureGroup("Review your votes (\(model.profile?.votes.count ?? 0))"){
            VStack(spacing:8){ForEach(model.rated){asset in
                Button{model.reviewAsset(asset)}label:{HStack{if let image=NSImage(contentsOf:asset.imageURL){Image(nsImage:image).resizable().aspectRatio(contentMode:.fit).frame(width:42,height:58)};VStack(alignment:.leading){Text(asset.title).lineLimit(2);Text(model.profile?.votes[asset.id]?.yes==true ? "Yes":"No").foregroundStyle(.secondary)}.font(.caption);Spacer()}}.buttonStyle(.plain).accessibilityLabel("Review vote: "+asset.title)
            }}.padding(.top,8)
            if let id=model.current?.id,model.profile?.votes[id] != nil{Button("Clear this vote"){model.vote(nil)}.font(.caption).padding(.top,8)}
            if model.review{Button("Continue taste check"){model.resume()}.font(.caption).padding(.top,8)}
        }.disabled(model.busy)
    }
    private var newProfile:some View {
        VStack(alignment:.leading,spacing:8){Text("Add a jury member").font(.headline);TextField("e.g. Experimental print",text:$model.newName).textFieldStyle(.roundedBorder).focused($editing);Button("Create taste profile"){model.create()}.disabled(model.newName.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty);Text("Each member has its own votes and weight. A new profile starts without assumed preferences.").font(.caption2).foregroundStyle(.secondary)}.disabled(model.busy)
    }
    private var footer:some View {
        HStack{Button("Undo last vote",systemImage:"arrow.uturn.backward"){model.undo()}.keyboardShortcut("z",modifiers:.command).disabled(model.busy || editing || model.profile?.events.isEmpty != false);if model.busy{ProgressView().controlSize(.small)};Text(model.error ?? model.status).font(.caption).foregroundStyle(model.error==nil ? Color.secondary:Color.red).lineLimit(2);Spacer();Text("\(model.archive.assets.count) distinct posters").font(.caption).foregroundStyle(.secondary)}.padding(16)
    }
}
