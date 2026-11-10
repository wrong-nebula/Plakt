import SwiftUI
import PosterCore

struct StudioRootView:View {
    let model:StudioModel
    @State private var review=LibraryReviewModel()
    @State private var workspace=StudioLaunch.workspace ?? .generate
    @State private var editor=EditorPresenter()
    @Environment(\.openWindow) private var openWindow
    var body:some View {
        ZStack {
        VStack(spacing:0) {
            HStack {
                HStack(spacing:8){Image(systemName:"square.stack.3d.up.fill").foregroundStyle(Color.accentColor);Text("FORM / LAB").font(.caption.monospaced().bold()).tracking(1.5)}
                Spacer()
                Picker("Workspace",selection:$workspace) {
                    Text("Generate").tag(StudioWorkspace.generate)
                    Text("Review library").tag(StudioWorkspace.review)
                }.pickerStyle(.segmented).labelsHidden().frame(width:280)
                Spacer()
                Button("Start from image",systemImage:"photo.badge.plus"){model.sheet = .imageStart}.disabled(model.busy)
                Button("Rule field",systemImage:"textformat"){model.sheet = .ruleField}.help("Set the selected poster's copy as rule-field letters")
                Button("Effectors",systemImage:"wand.and.rays"){model.sheet = .effectors}.help("Bend, cut, mirror and repeat the selected poster or library scene")
                Button("Kerning",systemImage:"textformat.abc"){model.sheet = .kerning}.help("Kern a poster's lines or proof any line in any font")
                Button("Glass objects",systemImage:"drop"){if workspace == .review{model.editInGlass(review.selected?.imageURL)}else{model.editSelectedInGlass()};openWindow(id:"glass")}.help("Put glass solids over the selected poster")
                Button("Shape library",systemImage:"circle.hexagongrid"){model.sheet = .shapeLibrary}
                Button("Taste check",systemImage:"heart"){model.sheet = .tasteCheck}
                Label("Local workspace",systemImage:"internaldrive").font(.caption).foregroundStyle(.secondary)
            }.padding(.horizontal,20).padding(.vertical,10)
            Divider()
            if workspace == .review {LibraryReviewView(model:review)}
            else {StudioView(model:model,reviewAction:{workspace = .review})}
        }
            // The editor takes the whole window; Done returns to where you were.
            if let winner=editor.winner {
                ScenePosterEditor(winner:winner,done:{editor.close()}).id(winner.id)
                    .transition(.opacity.combined(with:.scale(scale:0.99)).animation(StageMotion.enter))
            }
        }
        .environment(\.editorPresenter,editor)
        // Votes can be cast in Taste check or in the Rate sheets inside Image start and Source studies,
        // so the jury refreshes whenever any sheet closes.
        .sheet(item:Binding(get:{model.sheet},set:{model.sheet=$0}),onDismiss:{model.refreshTasteJury()}) {sheet in
            switch sheet {
            case .imageStart: ImageStartView(studio:model)
            case .sourceStudy(let url): SourceStudyView(directory:url,tasteDirectory:model.tasteDirectory,editGlass:{scene in model.editSceneInGlass(scene.imageURL,genome:scene.genome,seed:scene.seed);openWindow(id:"glass")})
            case .fontLibrary:
                FontLibraryView(currentProfileID:model.fontProfileID){model.fontProfileID=$0;UserDefaults.standard.set($0,forKey:"posterlab-font-profile")}
            case .typeSystems:
                TypeSystemGallery(initialFontProfileID:model.fontProfileID,initialVariant:model.typeSystem){model.chooseTypeSystem($0)}
            case .tasteCheck:
                TasteCheckView(directory:model.tasteDirectory,outputRoot:model.tasteDirectory.deletingLastPathComponent().appending(path:"output"))
            case .shapeLibrary:
                PosterShapeLibraryView(initialPreset:model.shapePreset,initialFontID:model.fontProfileID){model.chooseShape($0)}
            case .ruleField: RuleFieldView(source:workspace == .review ? libraryRuleFieldSource : ruleFieldSource)
            case .kerning: KerningView(source:StudioLaunch.kerningScene.flatMap{try? KerningSource.load($0)})
            case .effectors: EffectorsView(source:workspace == .review ? libraryEffectorSource : effectorSource)
            }
        }
        .task {
            // The unattended Effectors check opens its saved study and the sheet on its first poster.
            if let test=EffectorsSelfTest.current {model.restoreGeneration(test.study);model.sheet = .effectors}
            else if let name=StudioLaunch.sheet {model.openLaunchSheet(name)}
        }
        .task {
            guard let folder=StudioLaunch.winners else{return}
            let (events,feed)=AsyncStream.makeStream(of:SourceStudyEvent.self);feed.finish()
            let live=LiveStudy(resultURL:folder,events:events);model.live=live;live.finish(stopped:false)
        }
        .task {
            guard let snap=StudioLaunch.editorSnapshot,let winner=StudyWinner.load(snap.study).first else{return}
            let editor=ScenePosterEditorModel(winner)
            while editor.preview==nil {try? await Task.sleep(for:.milliseconds(200))}
            // Time every library shape: building its element and drawing it on the poster.
            if ProcessInfo.processInfo.environment["POSTERLAB_TIME_SHAPES"] != nil {
                // Open the Shapes tab the way a click does, right after the background prewarm starts.
                SystemPreviews.prewarm();let open=Date();let choices=ShapeChoices.recipes.count
                print("shapes tab ready",choices,String(format:"%.3f s",Date().timeIntervalSince(open)))
                let all=PosterShapeLibrary.recipes;print("recipes",all.count)
                for recipe in all {
                    let t0=Date();let e=ShapeChoices.element(recipe,field:UnitBox(x:0.2,y:0.3,width:0.6,height:0.4),colour:"#ffffff",background:"#1060b0",seed:3);let t1=Date()
                    var scene=editor.plain;if let e{scene.elements.append(e)};_ = try? LibrarySceneRenderer.render(scene,width:700,seed:3);let t2=Date()
                    if t2.timeIntervalSince(t0)>0.15 {print("slow",recipe.id,recipe.renderer,String(format:"element %.2f render %.2f",t1.timeIntervalSince(t0),t2.timeIntervalSince(t1)),e?.kind ?? "nil")}
                }
                print("timed");NSApp.terminate(nil);return
            }
            // Exercise tweak: select two headline lines and let the jury pick from variations.
            editor.stack=[]
            let lines=editor.plain.elements.indices.filter{editor.isDisplay(editor.plain.elements[$0])}
            editor.group=Set(lines.prefix(1));editor.selected=lines.first
            let start=Date()
            // Watch the main thread while the tweak runs: the longest gap between 16 ms ticks.
            var longest=0.0,last=Date(),watching=true
            let watcher=Task{@MainActor in while watching {try? await Task.sleep(for:.milliseconds(16));let now=Date();longest=max(longest,now.timeIntervalSince(last));last=now}}
            await editor.tweak()
            while editor.busy {try? await Task.sleep(for:.milliseconds(50))}
            watching=false;_ = await watcher.value
            print("longest main-thread stall ms",Int(longest*1000))
            print("tweak seconds",String(format:"%.1f",Date().timeIntervalSince(start)),"variations",editor.variations.map{"\($0.rank)\($0.aware ? "L":"")\($0.isCurrent ? "*":"")"},"message",editor.message ?? "-")
            let t0=Date()
            let previews=TypeSystemsTab.ranked.prefix(12).compactMap{TypeSystemsTab.preview($0,input:"FRAME BY FRAME",font:nil,ink:"#ffffff",accent:"#ff4422",paper:"#1060b0")}
            print("12 type previews seconds",String(format:"%.2f",Date().timeIntervalSince(t0)),previews.count)
            editor.preview=nil;editor.refresh()
            while editor.preview==nil {try? await Task.sleep(for:.milliseconds(200))}
            let renderer=ImageRenderer(content:ScenePosterEditor(model:editor).frame(width:1400,height:880))
            if let image=renderer.cgImage {try? PosterRenderer.png(image,to:snap.out)}
            NSApp.terminate(nil)
        }
        .task {
            guard let out=StudioLaunch.imageStartSnapshot else{return}
            try? await Task.sleep(for:.seconds(4))
            let renderer=ImageRenderer(content:ImageStartView(studio:model).frame(width:1400,height:880))
            try? await Task.sleep(for:.seconds(3))
            if let image=renderer.cgImage {try? PosterRenderer.png(image,to:out)}
            NSApp.terminate(nil)
        }
        .task {
            if let library=StudioLaunch.library {review.load(library)}
            guard StudioLaunch.startSourceStudy else{return}
            while model.reviewLibraryURL==nil {try? await Task.sleep(for:.milliseconds(250))}
            if let reference=StudioLaunch.reference {model.referenceURL=reference;model.cropReference=false;model.referenceImage=NSImage(contentsOf:reference)}
            if let brief=StudioLaunch.brief {model.chooseContent(brief)}
            model.useModifiers=StudioLaunch.modifiers
            model.useLibraryCompositions=true
            model.startSourceStudy()
        }
        .task {
            guard let folder=StudioLaunch.liveReplay else{return}
            let replay=LiveStudy.replay(folder)
            let live=LiveStudy(resultURL:folder,events:replay.events,directions:replay.directions)
            model.live=live
            guard let out=StudioLaunch.liveSnapshots else{
                while !live.caughtUp {try? await Task.sleep(for:.milliseconds(300))}
                live.finish(stopped:false);return
            }
            try? FileManager.default.createDirectory(at:out,withIntermediateDirectories:true)
            for frame in 0..<36 {
                try? await Task.sleep(for:.seconds(frame==0 ? 2:1.4))
                if live.caughtUp && frame>0 {live.finish(stopped:false);try? await Task.sleep(for:.seconds(1))}
                let renderer=ImageRenderer(content:LiveStudyStage(live:live,openResults:{},close:{}).frame(width:1440,height:900))
                renderer.scale=1
                if let image=renderer.cgImage {try? PosterRenderer.png(image,to:out.appending(path:String(format:"frame-%02d.png",frame)))}
                if live.phase == .complete {break}
            }
            NSApp.terminate(nil)
        }
        .task {if StudioLaunch.openGlass {openWindow(id:"glass")}}
        .onChange(of:review.directory){model.reviewLibraryURL=review.directory;model.findSavedSourceStudy();model.refreshTasteJury()}
        .modifier(StudioAgentHook(model:model,review:review,workspace:$workspace))
        .tint(Color(red:0.82,green:0.22,blue:0.12))
    }
    /// The generation's copy: the title becomes the letters, the subtitle the band title, institution and footer the information lines.
    /// Slashes inside a field become middle dots, because a slash starts a new information line.
    private var ruleFieldSource:RuleFieldSource? {
        guard let copy=model.current?.copy else {return nil}
        let dots={(s:String) in s.replacingOccurrences(of:#"\s*/\s*"#,with:" · ",options:.regularExpression).trimmingCharacters(in:.whitespacesAndNewlines)}
        let info=[copy.institution,copy.footer].map(dots).filter{!$0.isEmpty}.joined(separator:" / ")
        return RuleFieldSource(name:model.selected.map{"poster \($0.genome.seed)"} ?? "the current copy",text:copy.title,title:dots(copy.subtitle),info:info,imageURL:model.selected?.imageURL)
    }
    /// The selected generated poster, redrawn as a vector PDF in memory and read back as outlines.
    private var effectorSource:EffectorsSource? {
        guard let candidate=model.selected,let copy=model.current?.copy else {return nil}
        let genome=candidate.genome
        return EffectorsSource(name:"poster \(genome.seed)"){try PosterVectors.svg(pdf:PosterRenderer.pdfData(genome,copy:copy))}
    }
    /// A library poster's fitted scene (its measured layout redrawn as vectors), not the photograph.
    private var libraryEffectorSource:EffectorsSource? {
        guard let record=review.selected else {return nil}
        let genome=record.genome
        return EffectorsSource(name:"library scene \(record.id.prefix(8))"){
            let url=FileManager.default.temporaryDirectory.appending(path:"posterlab-effectors-\(UUID().uuidString).pdf")
            defer{try? FileManager.default.removeItem(at:url)}
            try LibrarySceneRenderer.pdf(genome,to:url)
            return try PosterVectors.svg(pdfAt:url)
        }
    }
    /// A library poster's read text, largest line first: letters, then band title, then up to two information lines.
    private var libraryRuleFieldSource:RuleFieldSource? {
        guard let record=review.selected else {return nil}
        let lines=record.elements.filter{$0.kind=="text-line" && $0.confidence>=0.5}
            .compactMap{e in e.text.map{($0.trimmingCharacters(in:.whitespacesAndNewlines),e.bounds.area)}}
            .filter{!$0.0.isEmpty}.sorted{$0.1>$1.1}.map(\.0)
        return RuleFieldSource(name:"library poster \(record.id.prefix(8))",text:lines.first ?? "",title:lines.dropFirst().first ?? "",
                               info:lines.dropFirst(2).prefix(2).joined(separator:" / "),imageURL:record.imageURL)
    }
}
