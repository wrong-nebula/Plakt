import SwiftUI
import PosterCore

/// Start from an image, laid out like the live stage: one line of small type, a quiet column of
/// controls, and the posters as the content. Follows the app's light or dark appearance.
struct ImageStartView:View {
    let studio:StudioModel
    @State private var model=ImageStartModel()
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openWindow) private var openWindow
    @State private var showTaste=false
    @State private var showDetails=false
    @State private var dropTarget=false
    @Environment(\.editorPresenter) private var presenter

    private let accent=LiveStudyStage.accent

    var body:some View {
        VStack(spacing:0){
            topBar
            Rectangle().fill(.separator).frame(height:1)
            HStack(spacing:0){
                controls.frame(width:288)
                Rectangle().fill(.separator).frame(width:1)
                content.frame(maxWidth:.infinity,maxHeight:.infinity)
            }
        }
        .frame(minWidth:1100,minHeight:760)
        .background(Color(nsColor:.windowBackgroundColor))
        .dropDestination(for:URL.self){urls,_ in
            guard !model.busy,let url=urls.first else{return false}
            model.loadImage(url);return true
        }isTargeted:{dropTarget=$0}
        .interactiveDismissDisabled(model.busy)
        .onChange(of:presenter?.winner?.id){_,id in if id != nil {dismiss()}}
        .onChange(of:model.selectedRound){model.selectedID=nil;model.selectedMatch=nil}
        .onChange(of:model.selectedHypothesis){model.selectedID=nil;model.selectedMatch=nil}
        .alert("Image study",isPresented:Binding(get:{model.error != nil},set:{if !$0{model.error=nil}})){
            Button("OK"){model.error=nil}
        }message:{Text(model.error ?? "")}
        .sheet(isPresented:$showTaste){
            TasteCheckView(directory:studio.tasteDirectory,outputRoot:studio.tasteDirectory.deletingLastPathComponent().appending(path:"output"),initialImageURL:model.selected?.imageURL)
        }
        .task{if let path=UserDefaults.standard.string(forKey:"posterlab-last-image-study"){model.restore(URL(fileURLWithPath:path))}}
    }

    private func label(_ text:String)->some View {
        Text(text).font(.system(size:10.5,weight:.semibold,design:.monospaced)).tracking(1.4)
    }

    // One line: what this is, what it is doing, and the few actions.
    private var topBar:some View {
        HStack(spacing:18){
            label("START FROM IMAGE").foregroundStyle(.secondary)
            if model.busy {
                Text(model.status).font(.system(size:11)).foregroundStyle(.secondary).lineLimit(1)
                    .transition(.opacity.animation(StageMotion.fade))
            }
            Spacer()
            JobStopButton(lifecycle:model.jobs.lifecycle){model.stop()}
            Button("Open study"){model.openStudy()}.disabled(model.busy)
            Button("Done"){dismiss()}.keyboardShortcut(.cancelAction).disabled(model.busy)
        }
        .buttonStyle(QuietButton())
        .padding(.horizontal,20).frame(height:44)
    }

    // MARK: Controls

    private var controls:some View {
        VStack(alignment:.leading,spacing:0){
            ScrollView {
                VStack(alignment:.leading,spacing:22){
                    imageInput
                    if model.profile != nil {influenceControls}
                    brief
                    advanced
                }
                .padding(20)
            }
            .disabled(model.busy)
            Rectangle().fill(.separator).frame(height:1)
            Button{model.generate(studio:studio)}label:{
                Text(model.busy ? "Generating…":"Generate").frame(maxWidth:.infinity)
            }
            .buttonStyle(PrimaryButton(accent:accent))
            .disabled(model.imageURL==nil || model.busy)
            .keyboardShortcut(.defaultAction)
            .padding(20)
        }
    }

    @ViewBuilder private var imageInput:some View {
        if let profile=model.profile {
            VStack(alignment:.leading,spacing:8){
                Button{model.chooseImage()}label:{
                    LibraryThumbnail(url:profile.asset.url).aspectRatio(contentMode:.fit).frame(maxWidth:.infinity,maxHeight:300)
                }
                .buttonStyle(PressScale())
                .help("Replace the image, or drop another one anywhere")
                .accessibilityLabel("Starting image. Replace")
                // The measured palette as one continuous strip.
                HStack(spacing:0){ForEach(Array(profile.statistics.palette.enumerated()),id:\.offset){_,swatch in
                    Rectangle().fill(Color(hexImage:swatch.hex)).accessibilityLabel(swatch.hex)
                }}
                .frame(height:8)
                label("\(profile.width) × \(profile.height) · \(profile.attention.count) FOCAL").foregroundStyle(.tertiary)
            }
        }else{
            Button{model.chooseImage()}label:{
                VStack(spacing:8){
                    label("DROP AN IMAGE").foregroundStyle(dropTarget ? AnyShapeStyle(accent):AnyShapeStyle(.secondary))
                    Text("or click to choose").font(.system(size:11)).foregroundStyle(.tertiary)
                }
                .frame(maxWidth:.infinity).frame(height:260)
                .overlay{Rectangle().strokeBorder(dropTarget ? AnyShapeStyle(accent):AnyShapeStyle(.separator),style:StrokeStyle(lineWidth:1,dash:[4,4]))}
                .contentShape(.rect)
            }
            .buttonStyle(PressScale())
            .animation(StageMotion.fade,value:dropTarget)
        }
    }

    private var influenceControls:some View {
        VStack(alignment:.leading,spacing:14){
            label("INFLUENCE").foregroundStyle(.secondary)
            influence("Palette",value:$model.settings.palette,help:"Blend image colours into paper, type and shapes.")
            influence("Composition",value:$model.settings.layout,help:"Move the type toward quieter regions of the image.")
            influence("Shapes",value:$model.settings.shapes,help:"Let the image's texture and direction choose and place geometry. Zero adds none.")
            row("Placement"){
                Picker("Placement",selection:$model.settings.placement){
                    Text("Explore all").tag("mixed");Text("Full bleed").tag("full-bleed")
                    Text("Framed").tag("framed");Text("Split").tag("split")
                }
            }
            row("Added shapes"){
                Picker("Added shapes",selection:Binding(get:{model.settings.shapeFrequency ?? -1},set:{model.settings.shapeFrequency=$0<0 ? nil:$0})){
                    Text("Follow jury").tag(-1.0);Text("None").tag(0.0);Text("Sometimes").tag(0.25);Text("Often").tag(0.6)
                }
            }
        }
    }

    private var brief:some View {
        VStack(alignment:.leading,spacing:6){
            label("BRIEF").foregroundStyle(.secondary)
            Text(studio.copy.title.replacingOccurrences(of:"\n",with:" ")).font(.system(size:13,weight:.semibold))
            Text(studio.copy.institution).font(.system(size:11)).foregroundStyle(.secondary)
        }
        .help("The brief, font, type system and jury come from the studio.")
    }

    private var advanced:some View {
        DisclosureGroup(isExpanded:$showDetails){
            VStack(alignment:.leading,spacing:12){
                row("Candidates"){Stepper("\(model.count)",value:$model.count,in:12...24,step:3).monospacedDigit()}
                row("Rounds"){Stepper("\(model.rounds)",value:$model.rounds,in:1...10).monospacedDigit()}
                row("Seed"){TextField("Seed",text:$model.seed).textFieldStyle(.roundedBorder).frame(width:110).monospacedDigit()}
                Toggle("Three composition directions",isOn:Binding(get:{model.settings.useCompositionDirections},set:{model.settings.compositionDirections=$0}))
                    .help("Separate image-led, type-led and interaction pools. Off evolves freely.")
                Toggle("Judge generated type separately",isOn:Binding(get:{model.settings.useGeneratedTypeJudging},set:{model.settings.generatedTypeJudging=$0}))
                    .help("Score typography without the image's own lettering.")
                Toggle("Diverse finalists",isOn:Binding(get:{model.settings.useDiverseFinalists},set:{model.settings.diverseFinalists=$0}))
                    .help("Balance rank with visual difference when choosing finalists.")
            }
            .font(.system(size:12)).toggleStyle(.checkbox).padding(.top,12)
        }label:{label("ADVANCED").foregroundStyle(.secondary)}
    }

    private func row<Content:View>(_ title:String,@ViewBuilder content:()->Content)->some View {
        HStack{Text(title).font(.system(size:12));Spacer();content().labelsHidden().fixedSize()}
    }
    private func influence(_ title:String,value:Binding<Double>,help:String)->some View {
        VStack(alignment:.leading,spacing:2){
            HStack{Text(title).font(.system(size:12));Spacer();Text(value.wrappedValue,format:.percent.precision(.fractionLength(0))).font(.system(size:11,design:.monospaced)).foregroundStyle(.secondary)}
            Slider(value:value,in:0...1,step:0.05).controlSize(.small).accessibilityLabel(title).help(help)
        }
    }

    // MARK: Content

    @ViewBuilder private var content:some View {
        if let live=model.live {
            LiveStudyStage(live:live,openResults:{model.live=nil},close:{model.live=nil})
                .transition(.opacity.animation(StageMotion.fade))
        }else if let result=model.result,result.rounds.indices.contains(model.selectedRound){
            results(result)
        }else{
            VStack(spacing:8){
                label(model.profile==nil ? "CHOOSE AN IMAGE TO BEGIN":"READY").foregroundStyle(.secondary)
                Text("Each round the jury picks a winner; the next round grows from it.").font(.system(size:12)).foregroundStyle(.tertiary)
            }
        }
    }

    private func results(_ result:ImagePosterStudyResult)->some View {
        let round=result.rounds[model.selectedRound]
        return VStack(spacing:0){
            HStack(spacing:16){
                // Rounds as numerals; the current one carries the accent.
                HStack(spacing:4){
                    label("ROUND").foregroundStyle(.secondary).padding(.trailing,6)
                    ForEach(result.rounds.indices,id:\.self){index in
                        Button{model.selectedRound=index}label:{
                            Text("\(index+1)").font(.system(size:11,weight:.semibold,design:.monospaced))
                                .frame(width:22,height:22)
                                .foregroundStyle(index==model.selectedRound ? AnyShapeStyle(accent):AnyShapeStyle(.secondary))
                                .overlay(alignment:.bottom){Rectangle().fill(accent).frame(height:1).opacity(index==model.selectedRound ? 1:0)}
                                .contentShape(.rect)
                        }.buttonStyle(.plain)
                    }
                }
                if result.settings.useCompositionDirections {
                    Picker("Direction",selection:$model.selectedHypothesis){
                        Text("All directions").tag("all")
                        ForEach(ImageCompositionDirection.allCases,id:\.rawValue){Text($0.label).tag($0.rawValue)}
                    }.labelsHidden().fixedSize().controlSize(.small)
                }
                if model.selectedMatch != nil {
                    Button("Show all"){model.selectedMatch=nil}.buttonStyle(QuietButton())
                }
                Spacer()
                Button("Files"){NSWorkspace.shared.open(result.directory)}.buttonStyle(QuietButton())
            }
            .padding(.horizontal,20).frame(height:40)
            Rectangle().fill(.separator).frame(height:1)
            HStack(spacing:0){
                grid(round,aspect:result.winner.genome.aspect)
                if let selected=model.selected {
                    Rectangle().fill(.separator).frame(width:1)
                    detail(selected,round:round).frame(width:280)
                        .transition(.opacity.animation(StageMotion.fade))
                }
            }
        }
    }

    private func grid(_ round:ImagePosterRound,aspect:Double)->some View {
        let shown=round.judging.results.filter{ranked in round.candidates.contains{$0.id==ranked.id && (model.selectedHypothesis=="all" || $0.hypothesis==model.selectedHypothesis) && (model.selectedMatch==nil || $0.matchedGroup==model.selectedMatch)}}
        return ScrollView {
            LazyVGrid(columns:[GridItem(.adaptive(minimum:150,maximum:230),spacing:18,alignment:.top)],alignment:.leading,spacing:22){
                ForEach(shown){ranked in
                    let winner=ranked.id==round.winnerID,chosen=model.selected?.id==ranked.id
                    Button{model.selectedID=chosen ? nil:ranked.id}label:{
                        VStack(alignment:.leading,spacing:6){
                            label(String(format:"%02d",ranked.rank)).foregroundStyle(winner ? AnyShapeStyle(accent):AnyShapeStyle(.secondary))
                            LibraryThumbnail(url:ranked.imageURL).aspectRatio(1/aspect,contentMode:.fit)
                                .overlay{Rectangle().strokeBorder(winner ? accent:Color.primary,lineWidth:winner ? 1.5:1).opacity(winner || chosen ? 1:0)}
                            // Consensus as a hairline, like the live stage.
                            GeometryReader{bar in Rectangle().fill(.quaternary).overlay(alignment:.leading){Rectangle().fill(winner ? accent:Color.secondary).frame(width:bar.size.width*min(1,ranked.consensus/100))}}
                                .frame(height:1)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(PressScale())
                    .accessibilityLabel("Rank \(ranked.rank)\(winner ? ", round winner":"")")
                }
            }
            .padding(20)
            .id(model.selectedRound)
            .transition(.opacity.animation(StageMotion.fade))
        }
    }

    private func detail(_ selected:ImagePosterCandidate,round:ImagePosterRound)->some View {
        ScrollView {
            VStack(alignment:.leading,spacing:16){
                LibraryThumbnail(url:selected.imageURL).frame(maxHeight:380)
                HStack(spacing:8){
                    Button("PNG"){model.export(pdf:false)}
                    Button("PDF"){model.export(pdf:true)}
                    Button("Rate"){showTaste=true}
                    Button("Glass"){studio.editSceneInGlass(selected.imageURL,genome:selected.genome,seed:selected.seed);openWindow(id:"glass")}
                }
                .buttonStyle(QuietButton()).disabled(model.busy)
                if let influence=selected.genome.imageInfluence {
                    VStack(alignment:.leading,spacing:4){
                        label(influence.placement.replacingOccurrences(of:"-",with:" ").uppercased())
                        if let hypothesis=selected.hypothesis,let direction=ImageCompositionDirection(rawValue:hypothesis){Text(direction.label).font(.system(size:12))}
                        if let font=selected.genome.elements.compactMap(\.fontProfileID).first.flatMap({FontLibrary.shared.profile($0)}){Text(font.label).font(.system(size:12)).foregroundStyle(.secondary)}
                    }
                }
                if let group=selected.matchedGroup {
                    Button(model.selectedMatch==nil ? "Compare shape controls":"Show all candidates"){model.selectedMatch=model.selectedMatch==nil ? group:nil}
                        .buttonStyle(QuietButton())
                }
                if let result=round.judging.results.first(where:{$0.id==selected.id}) {
                    VStack(alignment:.leading,spacing:8){
                        label("JURY").foregroundStyle(.secondary)
                        let votes=result.votes.sorted{$0.value>$1.value}.prefix(5),strongest=votes.first?.value ?? 1
                        ForEach(Array(votes),id:\.key){name,points in
                            VStack(alignment:.leading,spacing:3){
                                Text(name).font(.system(size:11)).foregroundStyle(.secondary).lineLimit(1)
                                GeometryReader{bar in Rectangle().fill(.quaternary).overlay(alignment:.leading){Rectangle().fill(accent).frame(width:bar.size.width*points/max(0.0001,strongest))}}.frame(height:1)
                            }
                        }
                    }
                }
                if let influence=selected.genome.imageInfluence {
                    DisclosureGroup{
                        VStack(alignment:.leading,spacing:6){
                            ForEach(Array(influence.operations.enumerated()),id:\.offset){_,operation in
                                Text(operation).font(.system(size:11)).foregroundStyle(.secondary).textSelection(.enabled)
                            }
                        }.padding(.top,6)
                    }label:{label("HOW IT WAS MADE").foregroundStyle(.secondary)}
                }
            }
            .padding(20)
        }
    }
}

/// Small-caps text button with a hairline frame; presses down slightly.
private struct QuietButton:ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration:Configuration)->some View {
        configuration.label
            .font(.system(size:10.5,weight:.semibold,design:.monospaced)).tracking(1.2).textCase(.uppercase)
            .padding(.horizontal,10).padding(.vertical,6)
            .overlay{Rectangle().strokeBorder(.separator,lineWidth:1)}
            .contentShape(.rect)
            .opacity(enabled ? 1:0.4)
            .scaleEffect(configuration.isPressed ? 0.97:1)
            .animation(.timingCurve(0.23,1,0.32,1,duration:0.16),value:configuration.isPressed)
    }
}

/// The one filled button: the accent, full width at the foot of the controls.
private struct PrimaryButton:ButtonStyle {
    let accent:Color
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration:Configuration)->some View {
        configuration.label
            .font(.system(size:11,weight:.bold,design:.monospaced)).tracking(1.6).textCase(.uppercase)
            .foregroundStyle(.white)
            .padding(.vertical,11)
            .background(accent.opacity(enabled ? 1:0.35))
            .contentShape(.rect)
            .scaleEffect(configuration.isPressed ? 0.97:1)
            .animation(.timingCurve(0.23,1,0.32,1,duration:0.16),value:configuration.isPressed)
    }
}

/// Press feedback for posters and the image well.
private struct PressScale:ButtonStyle {
    func makeBody(configuration:Configuration)->some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98:1)
            .animation(.timingCurve(0.23,1,0.32,1,duration:0.16),value:configuration.isPressed)
    }
}

private extension Color {
    init(hexImage:String){let n=Int(hexImage.dropFirst(),radix:16) ?? 0;self.init(red:Double((n>>16)&255)/255,green:Double((n>>8)&255)/255,blue:Double(n&255)/255)}
}
