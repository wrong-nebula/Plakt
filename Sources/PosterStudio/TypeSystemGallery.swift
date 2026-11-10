import SwiftUI
import PosterCore
import UniformTypeIdentifiers

struct TypeSystemGallery:View {
    let initialFontProfileID:String?
    let initialVariant:TypeSystemVariant?
    let choose:(TypeSystemVariant?)->Void
    @Environment(\.dismiss) private var dismiss
    @State private var selection=""
    @State private var search=""
    @State private var allSources=false
    @State private var text="horizons"
    @State private var fontID=""
    @State private var moving=0.0
    @State private var direction=1.0
    @State private var rowCount=9.0
    @State private var pitch=1.0
    @State private var laneGap=0.035
    @State private var tracking=0.0
    @State private var angle=0.0
    @State private var fontScale=1.0
    @State private var heartScale=1.5
    @State private var gridColumns=3.0
    @State private var gridShear=0.0
    @State private var gridScaleY=1.0
    @State private var gridTurn=0.0
    @State private var arcRadius=0.34
    @State private var arcSweep=330.0
    @State private var arcStart = -110.0
    @State private var wordsPerLine=0.0
    @State private var step=0.0
    @State private var ink=Color(red:0.08,green:0.10,blue:0.14)
    @State private var accent=Color(red:0.26,green:0.35,blue:0.80)
    @State private var paper=Color(red:0.95,green:0.94,blue:0.90)
    @State private var scene:StyleGenome?
    @State private var preview:NSImage?
    @State private var error:String?
    private let bank=TypeSystemLibrary.shared
    private var system:TypeSystemGenome?{bank.system(selection)}
    private var followsTextLength:Bool{system?.operation=="glyph-grid" && system?.parameters["diagonalCycle"]==1}
    private var systems:[TypeSystemGenome] {
        let filtered=bank.distinctSystems.filter{s in search.isEmpty || (s.name+" "+s.operation+" "+(s.textParameters["sourceInput"] ?? "")+" "+s.tags.joined(separator:" ")).localizedCaseInsensitiveContains(search)}
        if allSources{return filtered.sorted{$0.name==$1.name ? $0.id<$1.id:$0.name<$1.name}}
        return Dictionary(grouping:filtered,by:\.operation).keys.sorted().compactMap{operation in
            filtered.filter{$0.operation==operation}.sorted{a,b in
                return a.representativeScore==b.representativeScore ? a.id<b.id:a.representativeScore>b.representativeScore
            }.first
        }
    }
    private var application:TypeSystemApplication?{scene?.appliedTypeSystems?.first}
    private var selectedStep:TypeSystemStep?{guard let steps=application?.steps,!steps.isEmpty else{return nil};return steps[min(steps.count-1,max(0,Int(step)))]}
    private func hex(_ color:Color)->String {let c=NSColor(color).usingColorSpace(.sRGB) ?? .black;return String(format:"#%02x%02x%02x",Int((c.redComponent*255).rounded()),Int((c.greenComponent*255).rounded()),Int((c.blueComponent*255).rounded()))}
    private var overrides:[String:Double] {
        var values=["pitch":pitch,"angle":angle,"fontScale":fontScale]
        if !["glyph-grid","glyph-arc"].contains(system?.operation ?? ""){values["tracking"]=tracking}
        if system?.operation=="rotation-field"{values["laneGap"]=laneGap}
        if system?.operation=="grapheme-migration"{values["movingIndex"]=moving;values["direction"]=direction;values["maxRows"]=rowCount}
        else if !["paired-columns","reflection","tittle-substitution","word-reflow","suffix-cycle","glyph-arc","glyph-grid"].contains(system?.operation ?? "") {values["count"]=rowCount}
        if system?.operation=="tittle-substitution"{values["heartScale"]=heartScale}
        if system?.operation=="word-reflow",wordsPerLine>0{values["wordsPerLine"]=wordsPerLine}
        if system?.operation=="glyph-grid"{values["columns"]=gridColumns;values["shear"]=gridShear;values["scaleY"]=gridScaleY;values["quarterTurn"]=gridTurn;if !followsTextLength{values["rows"]=rowCount}}
        if system?.operation=="glyph-arc"{values["radius"]=arcRadius;values["sweep"]=arcSweep;values["startAngle"]=arcStart}
        return values
    }
    private var renderKey:String {let controls=overrides.sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined();return [selection,text,fontID,controls,hex(ink),hex(accent),hex(paper)].joined(separator:"|")}
    var body:some View {
        VStack(spacing:0) {
            header
            Divider()
            HSplitView {
                sidebar
                previewPane
                editor

            }
            Divider()
            footer

        }.frame(minWidth:1120,minHeight:760)
        .onAppear{fontID=initialFontProfileID ?? "";selection=initialVariant.flatMap{bank.system($0.system.id)?.id} ?? bank.systems.first{$0.operation=="grapheme-migration"}?.id ?? systems.first?.id ?? "";reset(system);if let initialVariant{load(initialVariant)}}
        
        .onChange(of:text){moving=min(moving,Double(max(0,text.count-1)))}
        .task(id:renderKey) {
            do {
                try await Task.sleep(for:.milliseconds(100));try Task.checkCancellation()
                guard let system else{return}
                let rendered=try TypeSystemEngine.scene(system,input:text,profileID:fontID.isEmpty ? nil:fontID,overrides:overrides,foreground:hex(ink),accent:hex(accent),background:hex(paper))
                let image=try LibrarySceneRenderer.render(rendered,width:800)
                try Task.checkCancellation();scene=rendered;preview=NSImage(cgImage:image,size:.zero);error=nil;step=min(step,Double(max(0,(rendered.appliedTypeSystems?.first?.steps.count ?? 1)-1)))
            }catch is CancellationError{}catch{self.error=error.localizedDescription;preview=nil;scene=nil}
        }
    }
    private var header:some View {
            HStack {
                VStack(alignment:.leading,spacing:4){Text("Type systems").font(.title2.bold());Text("Reusable rules from the poster library. Change the text and follow the transformation.").font(.caption).foregroundStyle(.secondary)}
                Spacer();Button("Done"){dismiss()}.keyboardShortcut(.cancelAction)
            }.padding(20)

    }

    private var sidebar:some View {
                VStack(spacing:10) {
                    TextField("Search methods, words or tags",text:$search).textFieldStyle(.roundedBorder).padding([.horizontal,.top],12)
                    Toggle("Show distinct source variants",isOn:$allSources).font(.caption).padding(.horizontal,12)
                    List(selection:Binding<String?>(get:{selection},set:{selection=$0 ?? selection;reset(system)})) {
                        ForEach(systems){s in systemRow(s).tag(s.id)}
                    }
                    if let summary=bank.catalog?.summary {Text("\(summary.scannedPosters) posters scanned · \(bank.distinctSystems.count) distinct variants · \(summary.systems) source records").font(.caption2).foregroundStyle(.secondary).padding(12)}
                }.frame(minWidth:240,idealWidth:275,maxWidth:330)

    }

    private func systemRow(_ s:TypeSystemGenome)->some View {
        let count=bank.distinctSystems.filter{$0.operation==s.operation}.count
        let detail=allSources ? "\(s.status) · \(s.observations.count) elements":"\(count) source variants"
        return VStack(alignment:.leading,spacing:4){Text(s.name).font(.body.weight(.medium));Text(detail).font(.caption).foregroundStyle(.secondary)}.padding(.vertical,5)
    }
    private var previewPane:some View {
                VStack(spacing:12) {
                    if let preview,let scene {
                        TypeSystemLivePreview(image:preview,scene:scene,selectedStep:selectedStep?.index).frame(minHeight:280,maxHeight:.infinity)
                        if let selectedStep {
                            HStack {Text("Step \(min(Int(step)+1,application?.steps.count ?? 1)) / \(application?.steps.count ?? 1)").font(.caption.monospaced());Slider(value:$step,in:0...Double(max(1,(application?.steps.count ?? 1)-1)),step:1).accessibilityLabel("Transformation step")}
                            Text(selectedStep.text).font(.system(.title3,design:.monospaced)).textSelection(.enabled)
                            if !selectedStep.variables.isEmpty {Text(selectedStep.variables.sorted{$0.key<$1.key}.map{"\($0.key) \($0.value.formatted(.number.precision(.fractionLength(0...2))))"}.joined(separator:" · ")).font(.caption2.monospaced()).foregroundStyle(.secondary)}
                        }
                    }else{ContentUnavailableView(error==nil ? "Choose a type system":"Adjust the input",systemImage:"textformat",description:Text(error ?? "Source-fitted methods and their editable variations appear here."))}
                }.padding(18).frame(minWidth:350,idealWidth:500)

    }

    private var editor:some View {
                ScrollView {
                    VStack(alignment:.leading,spacing:16) {
                        if let system {
                            Text(system.name).font(.title3.bold())
                            TextField("Text to transform",text:$text,axis:.vertical).textFieldStyle(.roundedBorder).accessibilityLabel("Text to transform")
                            if system.operation=="suffix-cycle"{Text("Use prefix|suffix|suffix, for example in|put|side|finite.").font(.caption).foregroundStyle(.secondary)}
                            Picker("Font",selection:$fontID){Text("Automatic").tag("");ForEach(FontLibrary.shared.profiles){profile in Text(profile.label).tag(profile.id)}}.pickerStyle(.menu)
                            if system.operation=="grapheme-migration" {
                                control("Moving grapheme",value:$moving,range:0...Double(max(1,text.count-1)),step:1)
                                Picker("Direction",selection:$direction){Text("Right").tag(1.0);Text("Left").tag(-1.0)}.pickerStyle(.segmented)
                            }
                            if !followsTextLength && !["paired-columns","reflection","tittle-substitution","word-reflow","suffix-cycle","glyph-arc"].contains(system.operation){control(system.operation=="grapheme-migration" ? "Maximum steps":"Rows",value:$rowCount,range:1...24,step:1)}
                            control(system.operation=="rotation-field" ? "Lane pitch":"Row pitch",value:$pitch,range:0.6...1.5,step:0.05)
                            if system.operation=="rotation-field" {control("Lane gap",value:$laneGap,range:0.01...0.12,step:0.005)}
                            methodControls(system)
                            if !["glyph-grid","glyph-arc"].contains(system.operation){control("Tracking",value:$tracking,range:-3...14,step:0.5)}
                            control("Type scale",value:$fontScale,range:0.6...1.4,step:0.05)
                            control("Angle",value:$angle,range:-25...25,step:1)
                            HStack {ColorPicker("Ink",selection:$ink,supportsOpacity:false);ColorPicker("Accent",selection:$accent,supportsOpacity:false);ColorPicker("Paper",selection:$paper,supportsOpacity:false)}.font(.caption)
                            Divider()
                            Text("New posters adapt the rule to their own brief and source palette.").font(.caption2).foregroundStyle(.secondary)
                            Text("System logic").font(.headline)
                            Text(system.explanation).font(.caption).foregroundStyle(.secondary)
                            if system.operation=="rotation-field" {Text("Photo angle noise is snapped to 90° baselines. Separate lanes and a shared type size keep the field readable.").font(.caption).foregroundStyle(.secondary)}
                            ForEach(application?.invariants ?? system.invariants,id:\.self){rule in Text("• "+rule).font(.caption)}
                            Text(system.tags.joined(separator:" · ")).font(.caption2).foregroundStyle(.secondary).textSelection(.enabled)
                            DisclosureGroup("Trace and provenance") {
                                VStack(alignment:.leading,spacing:8) {
                                    if system.status=="visual-annotated"{Text("Visual annotation · image fitting not evaluated").font(.caption)}
                                    else{Text("\(system.status) · confidence \(system.confidence.formatted(.percent.precision(.fractionLength(0)))) · fit error \(system.fitError.formatted(.number.precision(.fractionLength(3))))").font(.caption)}
                                    Text(system.sourcePosterID).font(.caption2.monospaced()).textSelection(.enabled)
                                    Text("Observed input: "+(system.textParameters["sourceInput"] ?? "")).font(.caption)
                                    Text("\(system.semanticEmbedding.count) operator dimensions · \(system.sourceEmbedding?.dimensions ?? 0) Vision dimensions · 768 SigLIP specimen dimensions").font(.caption2).foregroundStyle(.secondary)
                                    if bank.groupedSources(system.id).count>1{Text("\(bank.groupedSources(system.id).count) near-identical source variants grouped; original IDs remain replayable.").font(.caption2).foregroundStyle(.secondary)}
                                    ForEach(Array((application?.steps ?? []).enumerated()),id:\.offset){_,s in Text("\(s.index): \(s.text) → \(s.indexMap.map(String.init).joined(separator:","))").font(.caption2.monospaced()).textSelection(.enabled)}
                                }.padding(.top,8)
                            }
                            DisclosureGroup("Related variants") {
                                Text("Similar structure from other sources.").font(.caption).foregroundStyle(.secondary)
                                ForEach(bank.nearest(system,limit:4).map(\.0)){related in
                                    Button {selection=related.id;reset(related)} label:{
                                        VStack(alignment:.leading,spacing:3){Text(related.name);Text(related.operation).font(.caption).foregroundStyle(.secondary)}
                                    }.buttonStyle(.plain).padding(.vertical,4)
                                }
                            }
                            if let error{Text(error).font(.caption).foregroundStyle(.red)}
                        }
                    }.padding(20)
                }.frame(minWidth:310,idealWidth:350,maxWidth:400)
    }

    private var footer:some View {
            HStack {Button("Reset controls"){reset(system)};Button("Open variation…"){open()};Spacer();Button("Automatic inheritance"){choose(nil);dismiss()};Button("Save variation…"){save()}.disabled(scene==nil);Button("Use rule in posters"){if let variant{choose(variant);dismiss()}}.buttonStyle(.borderedProminent).disabled(system==nil)}.padding(16)
    }
    @ViewBuilder private func methodControls(_ system:TypeSystemGenome)->some View {
        if system.operation=="tittle-substitution"{control("Heart size",value:$heartScale,range:0.8...2.5,step:0.1)}
        if system.operation=="word-reflow"{Picker("Words per line",selection:$wordsPerLine){Text("Source rhythm").tag(0.0);ForEach(1...6,id:\.self){n in Text(String(n)).tag(Double(n))}}}
        if system.operation=="glyph-grid"{control("Columns",value:$gridColumns,range:1...12,step:1);control("Shear",value:$gridShear,range:-0.8...0.8,step:0.05);control("Vertical scale",value:$gridScaleY,range:0.35...1.5,step:0.05);control("Turn per cell",value:$gridTurn,range:0...180,step:15)}
        if system.operation=="glyph-arc"{control("Radius",value:$arcRadius,range:0.12...0.42,step:0.01);control("Arc span",value:$arcSweep,range:30...360,step:5);control("Start angle",value:$arcStart,range:-180...180,step:5)}
    }
    private func control(_ title:String,value:Binding<Double>,range:ClosedRange<Double>,step:Double)->some View {
        VStack(spacing:5){HStack{Text(title);Spacer();Text(value.wrappedValue.formatted(.number.precision(.fractionLength(0...2)))).monospacedDigit().foregroundStyle(.secondary)}.font(.caption);Slider(value:value,in:range,step:step).accessibilityLabel(title)}
    }
    private func reset(_ system:TypeSystemGenome?) {
        let defaults=["grapheme-migration":"horizons","compensated-erosion":"around|the|sound","paired-columns":"COMMON | GROUND","reflection":"COMMON | GROUND","tittle-substitution":"Infinite","word-reflow":"A FIELD OF POSSIBILITIES","scale-ramp":"VOICE","suffix-cycle":"re|mix|frame|write","glyph-grid":"OPENFORMS","glyph-arc":"SPACES & FORMS"]
        text=defaults[system?.operation ?? ""] ?? "COMMON GROUND";moving=0;direction=1;rowCount=system?.parameters[system?.operation=="glyph-grid" ? "rows":"count"] ?? 9;heartScale=system?.parameters["heartScale"] ?? 1.5;gridColumns=system?.parameters["columns"] ?? 3;gridShear=system?.parameters["shear"] ?? 0;gridScaleY=system?.parameters["scaleY"] ?? 1;gridTurn=system?.parameters["quarterTurn"] ?? 0;arcRadius=system?.parameters["radius"] ?? 0.34;arcSweep=system?.parameters["sweep"] ?? 330;arcStart=system?.parameters["startAngle"] ?? -110;wordsPerLine=0;pitch=1;laneGap=0.035;tracking=0;angle=0;fontScale=1;step=0
    }
    private var variant:TypeSystemVariant? {
        guard let scene,let system else{return nil}
        return TypeSystemVariant(system:system,input:text,overrides:overrides,fontProfileID:fontID.isEmpty ? nil:fontID,foreground:hex(ink),accent:hex(accent),background:hex(paper),scene:scene)
    }
    private func load(_ variant:TypeSystemVariant){
        selection=variant.system.id;text=variant.input;fontID=variant.fontProfileID ?? ""
        moving=variant.overrides["movingIndex"] ?? 0;direction=variant.overrides["direction"] ?? 1;rowCount=variant.overrides["maxRows"] ?? variant.overrides["count"] ?? 9
        pitch=variant.overrides["pitch"] ?? 1;laneGap=variant.overrides["laneGap"] ?? 0.035;tracking=variant.overrides["tracking"] ?? 0;angle=variant.overrides["angle"] ?? 0;fontScale=variant.overrides["fontScale"] ?? 1
        heartScale=variant.overrides["heartScale"] ?? variant.system.parameters["heartScale"] ?? 1.5
        gridColumns=variant.overrides["columns"] ?? variant.system.parameters["columns"] ?? 3;gridShear=variant.overrides["shear"] ?? variant.system.parameters["shear"] ?? 0;gridScaleY=variant.overrides["scaleY"] ?? variant.system.parameters["scaleY"] ?? 1;gridTurn=variant.overrides["quarterTurn"] ?? variant.system.parameters["quarterTurn"] ?? 0
        if variant.system.operation=="glyph-grid"{rowCount=variant.overrides["rows"] ?? variant.system.parameters["rows"] ?? 4}
        arcRadius=variant.overrides["radius"] ?? variant.system.parameters["radius"] ?? 0.34;arcSweep=variant.overrides["sweep"] ?? variant.system.parameters["sweep"] ?? 330;arcStart=variant.overrides["startAngle"] ?? variant.system.parameters["startAngle"] ?? -110;wordsPerLine=variant.overrides["wordsPerLine"] ?? 0
        ink=color(variant.foreground);accent=color(variant.accent);paper=color(variant.background)
    }
    private func color(_ hex:String)->Color{let v=UInt32(hex.replacingOccurrences(of:"#",with:""),radix:16) ?? 0;return Color(red:Double((v>>16)&255)/255,green:Double((v>>8)&255)/255,blue:Double(v&255)/255)}
    private func open(){let panel=NSOpenPanel();panel.allowedContentTypes=[.json];guard panel.runModal() == .OK,let url=panel.url else{return};do{load(try JSONDecoder().decode(TypeSystemVariant.self,from:Data(contentsOf:url)))}catch{self.error=error.localizedDescription}}
    private func save() {
        guard variant != nil else{return}
        let panel=NSSavePanel();panel.allowedContentTypes=[.json];panel.nameFieldStringValue="type-system-variation.json"
        guard panel.runModal() == .OK,let url=panel.url else{return}
        do {if let variant{try LibraryRaster.write(variant,to:url)}}catch{self.error=error.localizedDescription}
    }
}

private struct TypeSystemLivePreview:View {
    let image:NSImage;let scene:StyleGenome;let selectedStep:Int?
    var body:some View {
        GeometryReader {proxy in
            let w=min(proxy.size.width,proxy.size.height/scene.aspect),h=w*scene.aspect
            ZStack(alignment:.topLeading) {
                Image(nsImage:image).resizable().frame(width:w,height:h)
                ForEach(Array(scene.elements.enumerated()),id:\.offset){_,element in
                    if element.typeSystemStep==selectedStep {
                        let b=CompositionJudges.inkBounds(element,genome:scene)
                        Rectangle().stroke(Color.accentColor.opacity(0.7),lineWidth:1.5).frame(width:b.width*w,height:b.height*h).offset(x:b.x*w,y:b.y*h).allowsHitTesting(false)
                    }
                }
            }.frame(width:w,height:h).clipped().position(x:proxy.size.width/2,y:proxy.size.height/2)
        }.accessibilityLabel("Live procedural type-system preview")
    }
}
