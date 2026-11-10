import SwiftUI
import PosterCore

/// Kerning for a poster's lines, or for a free proof line: modes, your pairs and gaps, font tables, before/after.
struct KerningView:View {
    @State private var model:KerningModel
    @Environment(\.dismiss) private var dismiss
    init(source:KerningSource?) {_model=State(initialValue:KerningModel(source:source))}
    var body:some View {
        VStack(spacing:0) {
            HStack {
                VStack(alignment:.leading,spacing:4) {
                    Text("Kerning").font(.title2.bold())
                    Text(model.scene==nil ? "Proof any line in any font · open a scene to kern a poster":model.name).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                Button("Open scene…",systemImage:"folder"){model.open()}
                Button("Done"){dismiss()}.keyboardShortcut(.cancelAction)
            }.padding(20)
            Divider()
            HSplitView {
                if model.scene != nil {KerningPosterColumn(model:model).frame(minWidth:250,idealWidth:320,maxWidth:420)}
                KerningProofColumn(model:model).frame(minWidth:520,maxWidth:.infinity)
                KerningSettingsColumn(model:model).frame(minWidth:270,idealWidth:300,maxWidth:360)
            }
            Divider()
            HStack(spacing:10) {
                Text(model.status).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                Spacer()
                Button("Proof PNG…"){model.exportProof()}
                if model.scene != nil {
                    Button("Save scene…"){model.saveScene()}
                    Button("PNG…"){model.exportPNG()}
                    Button("Vector PDF…"){model.exportPDF()}.buttonStyle(.borderedProminent)
                }
            }.padding(16)
        }.frame(minWidth:1180,minHeight:760)
        .task {await KerningSnapshot.run(model)}
        .alert("Kerning",isPresented:Binding(get:{model.error != nil},set:{if !$0 {model.error=nil}})) {Button("OK"){model.error=nil}} message:{Text(model.error ?? "")}
    }
}

private struct KerningPosterColumn:View {
    @Bindable var model:KerningModel
    var body:some View {
        VStack(alignment:.leading,spacing:12) {
            Picker("Show",selection:$model.showBefore){Text("Kerned").tag(false);Text("Before").tag(true)}.pickerStyle(.segmented).labelsHidden()
            Group {
                if let image=model.showBefore ? model.beforeImage:model.preview {
                    Image(nsImage:image).resizable().aspectRatio(contentMode:.fit)
                        .overlay {GeometryReader {geo in if let box=highlight {
                            Rectangle().strokeBorder(kernRed,lineWidth:1.5)
                                .frame(width:box.width*geo.size.width+6,height:box.height*geo.size.height+6)
                                .position(x:box.midX*geo.size.width,y:box.midY*geo.size.height)
                        }}}
                        .accessibilityLabel(model.showBefore ? "Poster before kerning":"Kerned poster")
                }else {Rectangle().fill(.quaternary).aspectRatio(1/(model.scene?.aspect ?? 1.414),contentMode:.fit).overlay{ProgressView()}}
            }
            Text("LINES").font(.caption2.monospaced().bold()).foregroundStyle(.secondary)
            ScrollView {
                VStack(alignment:.leading,spacing:2) {
                    ForEach(model.lines,id:\.sourceElementID) {line in
                        Button {model.select(line.sourceElementID)} label:{
                            HStack {
                                Text(line.text ?? "").lineLimit(1)
                                Spacer()
                                Text(model.label(line)).font(.caption2).foregroundStyle(.secondary)
                            }.padding(.horizontal,8).padding(.vertical,5).contentShape(Rectangle())
                            .background(model.lineID==line.sourceElementID ? kernRed.opacity(0.12):.clear,in:RoundedRectangle(cornerRadius:6))
                        }.buttonStyle(.plain)
                    }
                }
            }
        }.padding(16)
    }
    /// The selected line's ink, in the poster's unit square.
    private var highlight:CGRect? {
        guard let e=model.element,let scene=model.scene else{return nil}
        let b=CompositionJudges.inkBounds(e,genome:scene);return CGRect(x:b.x,y:b.y,width:b.width,height:b.height)
    }
}

private struct KerningProofColumn:View {
    @Bindable var model:KerningModel
    @FocusState private var focused:Bool
    var body:some View {
        VStack(alignment:.leading,spacing:14) {
            if model.scene==nil {
                HStack {
                    TextField("Text",text:$model.proofText).textFieldStyle(.roundedBorder).onChange(of:model.proofText){model.gap=nil;model.refresh()}
                    Picker("Font",selection:$model.proofFont) {
                        ForEach(fonts,id:\.self){Text($0).tag($0)}
                    }.frame(width:250).onChange(of:model.proofFont){model.refresh()}
                }
            }else {
                HStack(alignment:.firstTextBaseline) {
                    Text(model.text).font(.headline).lineLimit(1)
                    Spacer()
                    Text(model.fontName).font(.caption.monospaced()).foregroundStyle(.secondary)
                }
            }
            KerningCanvas(model:model)
                .frame(minHeight:210,maxHeight:290)
                .background(Color(nsColor:.textBackgroundColor),in:RoundedRectangle(cornerRadius:8))
                .overlay(RoundedRectangle(cornerRadius:8).strokeBorder(focused ? kernRed.opacity(0.6):Color.secondary.opacity(0.2)))
                .focusable().focused($focused).focusEffectDisabled()
                .onKeyPress(keys:[.leftArrow,.rightArrow],phases:[.down,.repeat]) {press in
                    let direction=press.key == .leftArrow ? -1:1
                    if press.modifiers.contains(.option) {model.nudge(Double(direction)*(press.modifiers.contains(.shift) ? 50:10))}else{model.step(direction)}
                    return .handled
                }
                .onAppear{focused=true}
                .accessibilityLabel("Proof of \(model.text). Arrow keys move between gaps; Option-arrow kerns.")
            KerningGapInspector(model:model)
            KerningPairTable(model:model)
        }.padding(16)
    }
    private var fonts:[String] {
        let library=FontLibrary.shared.manifest.families.flatMap(\.faces).map(\.postscriptName)
        return Array(Set(["HelveticaNeue-Bold","HelveticaNeue-Medium","Futura-Bold","AvenirNext-DemiBold","GillSans-SemiBold","Didot",model.proofFont]+library)).sorted()
    }
}

private let kernRed=Color(red:0.82,green:0.22,blue:0.12),kernBlue=Color(red:0.16,green:0.44,blue:0.86),kernHighlighter=Color(red:1,green:0.83,blue:0)

/// The line drawn large: measured white, each gap's value under it and the selected gap marked. Click a gap to select it.
private struct KerningCanvas:View {
    let model:KerningModel
    var body:some View {
        GeometryReader {geo in
            let fit=self.fit(geo.size)
            Canvas {ctx,size in
                guard let layout=model.layout,let fit else{return}
                let transform=CGAffineTransform(a:fit.scale,b:0,c:0,d:-fit.scale,tx:fit.x,ty:fit.baseline)
                if model.showWhite {for g in layout.gaps {for r in g.white {ctx.fill(Path(r.applying(transform)),with:.color(kernHighlighter.opacity(0.4)))}}}
                ctx.fill(Path(layout.path).applying(transform),with:.color(.primary))
                let ink=layout.path.boundingBoxOfPath,top=fit.baseline-ink.maxY*fit.scale-8,bottom=fit.baseline-ink.minY*fit.scale+8
                for g in model.editableGaps {
                    let x=fit.x+g.x*fit.scale,selected=g.index==model.gap,value=Int(g.applied.rounded())
                    if selected {ctx.fill(Path(CGRect(x:x-1,y:top,width:2,height:bottom-top)),with:.color(kernRed))}
                    let color:Color=value<0 ? kernRed:value>0 ? kernBlue:.secondary
                    ctx.draw(Text(String(value)).font(.system(size:11,weight:selected ? .bold:.regular).monospacedDigit()).foregroundStyle(color),at:CGPoint(x:x,y:bottom+10))
                }
            }
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded {tap in
                guard let fit else{return}
                model.gap=model.editableGaps.min{abs(fit.x+$0.x*fit.scale-tap.location.x)<abs(fit.x+$1.x*fit.scale-tap.location.x)}?.index
            })
        }
    }
    /// A scale from the line's plain width, so the proof holds still while you kern; the ink sits a little above centre.
    private func fit(_ size:CGSize)->(scale:Double,x:Double,baseline:Double)? {
        guard let layout=model.layout else{return nil}
        let ink=layout.path.boundingBoxOfPath;guard ink.width>0,ink.height>0 else{return nil}
        let margin=28.0,scale=min((size.width-2*margin)/max(model.referenceWidth*1.12,ink.width),size.height*0.5/ink.height)
        return (scale,margin+(size.width-2*margin-model.referenceWidth*scale)/2-ink.minX*scale,size.height*0.44+ink.midY*scale)
    }
}

private struct KerningGapInspector:View {
    @Bindable var model:KerningModel
    var body:some View {
        Group {
            if let g=model.selectedGap {
                HStack(alignment:.center,spacing:14) {
                    Text(g.pair.map{String($0)}.joined(separator:" | ")).font(.title2.monospaced().bold()).frame(minWidth:70)
                    VStack(alignment:.leading,spacing:3) {
                        Text("Uses \(Int(g.applied.rounded()))").font(.callout.monospacedDigit().bold())
                        Text("Font \(Int(g.font.rounded())) · Optical \(g.optical.map{String(Int($0.rounded()))} ?? "–") · Yours \(Int((g.pairValue+g.gapValue).rounded()))").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    Spacer()
                    HStack(spacing:6) {ForEach([-50.0,-10,10,50],id:\.self) {d in Button(d>0 ? "+\(Int(d))":"\(Int(d))"){model.nudge(d)}.monospacedDigit()}}.fixedSize()
                    VStack(alignment:.leading,spacing:4) {
                        Toggle("Every \(g.pair)",isOn:$model.everyPair).toggleStyle(.checkbox).help("Kern every occurrence of this pair instead of this one gap")
                        Button("Clear"){model.clearGap()}.disabled(g.pairValue==0 && g.gapValue==0).controlSize(.small)
                    }.fixedSize()
                }
            }else {
                Text("Click a gap, or press → to start. ⌥← ⌥→ kern by 10, ⇧⌥ by 50. Values are thousandths of an em.").font(.caption).foregroundStyle(.secondary).frame(maxWidth:.infinity,alignment:.leading)
            }
        }.frame(minHeight:44)
    }
}

private struct KerningPairTable:View {
    @Bindable var model:KerningModel
    private struct Row:Identifiable {var id:Int;var pair:String;var font:String;var optical:String;var yours:String;var uses:String}
    var body:some View {
        let rows=model.editableGaps.map{g in Row(id:g.index,pair:g.pair,font:String(Int(g.font.rounded())),optical:g.optical.map{String(Int($0.rounded()))} ?? "–",yours:String(Int((g.pairValue+g.gapValue).rounded())),uses:String(Int(g.applied.rounded())))}
        Table(rows,selection:Binding(get:{model.gap},set:{model.gap=$0})) {
            TableColumn("Pair"){Text($0.pair.map{String($0)}.joined(separator:" ")).monospaced()}
            TableColumn("Font"){Text($0.font).monospacedDigit()}
            TableColumn("Optical"){Text($0.optical).monospacedDigit()}
            TableColumn("Yours"){Text($0.yours).monospacedDigit()}
            TableColumn("Uses"){Text($0.uses).monospacedDigit().bold()}
        }.frame(minHeight:140)
    }
}

private struct KerningSettingsColumn:View {
    @Bindable var model:KerningModel
    private func value<T>(_ key:WritableKeyPath<TextKerning,T>)->Binding<T> {Binding(get:{model.kerning[keyPath:key]},set:{var k=model.kerning;k[keyPath:key]=$0;model.kerning=k})}
    private var mode:TextKerning.Mode {model.kerning.mode}
    var body:some View {
        ScrollView {
            VStack(alignment:.leading,spacing:14) {
                heading("KERNING")
                Picker("Kerning",selection:value(\.mode)){ForEach(TextKerning.Mode.allCases,id:\.self){Text($0.label).tag($0)}}.pickerStyle(.segmented).labelsHidden()
                Text(note).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
                if !model.adopted {
                    Text("This line still has its original setting (\(mode == .none ? "a tracking of 0 switched the font's pairs off":"the font's pairs, with tracking")). Change anything to kern it.").font(.caption).padding(8).background(.quaternary,in:RoundedRectangle(cornerRadius:6)).fixedSize(horizontal:false,vertical:true)
                }
                slider("Strength",value(\.strength),0...2,0.05,format:"×%.2f").disabled(mode != .optical)
                slider("Tightness",value(\.tightness),-100...100,1).disabled(mode != .optical)
                Toggle("Keep letters apart",isOn:Binding(get:{model.kerning.minimumGap != nil},set:{var k=model.kerning;k.minimumGap=$0 ? 12:nil;model.kerning=k})).disabled(mode != .optical)
                if let gap=model.kerning.minimumGap {slider("Minimum gap",Binding(get:{gap},set:{var k=model.kerning;k.minimumGap=$0;model.kerning=k}),0...80,1).disabled(mode != .optical)}
                Divider()
                heading("SPACING")
                if model.scene != nil {slider("Tracking",Binding(get:{model.tracking},set:{model.tracking=$0}),-100...300,5)}
                slider("Word space",value(\.wordSpace),-300...600,5)
                Toggle("Show measured white",isOn:$model.showWhite)
                Divider()
                heading("YOUR PAIRS · \(model.kerning.pairs.count)")
                if model.kerning.pairs.isEmpty {Text("Turn on “Every pair” beside a gap to kern a pair everywhere it meets.").font(.caption).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)}
                ForEach(model.kerning.pairs.sorted{$0.key<$1.key},id:\.key) {pair,v in
                    HStack {Text(pair.map{String($0)}.joined(separator:" ")).monospaced();Spacer();Text(String(Int(v.rounded()))).monospacedDigit();Button("Remove \(pair)",systemImage:"xmark.circle.fill"){model.removePair(pair)}.labelStyle(.iconOnly).buttonStyle(.plain).foregroundStyle(.secondary)}.font(.callout)
                }
                Divider()
                heading("FONT TABLE")
                Text(model.table.map{"\(model.fontName): \($0.pairs.count) pairs, saved \($0.updated.prefix(10))."} ?? "\(model.fontName) has no table yet. Save this line's pairs to reuse them on every poster in this font.").font(.caption).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
                Button("Save pairs as \(model.fontName) table"){model.saveTable()}.disabled(model.kerning.pairs.isEmpty)
                HStack {
                    Button("Use on this line"){model.useTable(everyLine:false)}
                    if model.scene != nil {Button("Every line in this font"){model.useTable(everyLine:true)}}
                }.disabled(model.table==nil)
                if model.scene != nil {
                    Divider()
                    heading("POSTER")
                    Button("Use these settings on every line"){model.applyToAll()}
                    HStack {Button("Reset line"){model.resetLine()};Button("Reset all lines"){model.resetAll()}}
                }
            }.padding(16)
        }
    }
    private var note:String {
        switch mode {
        case .metrics:"The font's own pairs, as its designer kerned it."
        case .optical:"Pairs measured from the outlines, so the white between letters evens out. Strength 1 closes about as much as type designers do."
        case .none:"Plain advances, no pairs."
        }
    }
    private func heading(_ s:String)->some View {Text(s).font(.caption2.monospaced().bold()).foregroundStyle(.secondary)}
    private func slider(_ name:String,_ value:Binding<Double>,_ range:ClosedRange<Double>,_ step:Double,format:String="%.0f")->some View {
        VStack(alignment:.leading,spacing:3) {
            HStack {Text(name);Spacer();Text(String(format:format,value.wrappedValue)).monospacedDigit().foregroundStyle(.secondary)}.font(.caption)
            // Continuous, so macOS draws no tick marks; the value still lands on the step.
            Slider(value:Binding(get:{value.wrappedValue},set:{value.wrappedValue=($0/step).rounded()*step}),in:range).accessibilityLabel(name)
        }
    }
}
