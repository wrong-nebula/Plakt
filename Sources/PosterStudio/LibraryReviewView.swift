import SwiftUI
import PosterCore

struct LibraryReviewView:View {
    @Bindable var model:LibraryReviewModel
    @State private var segmentationRecord: PosterRecord?
    @State private var segmentationBounds: UnitBox?
    var body:some View {
        VStack(spacing:0) {
            HStack(spacing:14) {
                VStack(alignment:.leading,spacing:4) {
                    Text("Source library").font(.title2.weight(.semibold))
                    Text("\(model.records.count) surfaces · \(model.pendingCount) to review").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                }
                Spacer()
                Picker("Review section",selection:$model.borderMode) {
                    Text("Poster detection to review").tag(true)
                    Text("Elements & styles").tag(false)
                }.pickerStyle(.segmented).labelsHidden().frame(width:380)
                Divider().frame(height:24)
                Button("Refresh",systemImage:"arrow.clockwise") {if let url=model.directory{model.load(url)}}.labelStyle(.iconOnly).help("Refresh newly indexed posters").disabled(model.busy||model.directory==nil)
                Button("Choose library…",systemImage:"folder") {model.chooseFolder()}.disabled(model.busy)
            }.padding(.horizontal,20).padding(.vertical,16)
            Divider()
            if model.records.isEmpty {
                ContentUnavailableView("Review poster sources",systemImage:"viewfinder",description:Text("Choose your indexed source library to correct borders, review elements and inspect measured colors."))
                Button("Choose library…"){model.chooseFolder()}.buttonStyle(.borderedProminent).padding()
                Spacer()
            }else{
                HSplitView {
                    VStack {
                        LibrarySearchControls(model:model)
                        ScrollView {
                            LazyVStack(spacing:8) {
                                ForEach(model.filtered) { record in
                                    Button {model.select(record.id)} label: {
                                        HStack(spacing:10) {
                                            LibraryThumbnail(url:record.imageURL).frame(width:72,height:96)
                                            VStack(alignment:.leading,spacing:5) {
                                                Text(record.id.prefix(12)).font(.caption.monospaced())
                                                Text(record.source.account).font(.caption)
                                                Text("\(record.elements.count) elements").font(.caption).foregroundStyle(.secondary)
                                            }
                                            Spacer(minLength:0)
                                        }.padding(9).background(model.selectedID==record.id ? Color.accentColor.opacity(0.13):.clear,in:RoundedRectangle(cornerRadius:8))
                                    }.buttonStyle(.plain).accessibilityLabel("Review poster \(record.id)")
                                }
                            }.padding(.horizontal,8)
                        }
                    }.frame(minWidth:190,idealWidth:220,maxWidth:250)
                    VStack(spacing:0) {
                        if let selected=model.selected {
                            HStack {
                                Text(model.borderMode ? "Original photograph":"Rectified poster").font(.callout.weight(.medium)).lineLimit(1)
                                Spacer()
                                Text("Zoom").font(.caption)
                                Slider(value:$model.zoom,in:1...3).frame(width:100).accessibilityLabel("Poster zoom")
                                if !model.borderMode {
                                    Toggle("Words",isOn:$model.showWords).toggleStyle(.button)
                                    Button("Whole poster"){model.selectedElementID=nil}
                                    Button("Select region…", systemImage: "lasso") {
                                        segmentationBounds = model.element?.bounds; segmentationRecord = selected
                                    }.disabled(model.busy).accessibilityLabel("Select source element with SAM")
                                }
                                if model.borderMode {
                                    Button("Reset"){model.corners=selected.sourceQuad}
                                    Button("Confirm & next",systemImage:"checkmark") {model.saveBorder()}
                                        .buttonStyle(.borderedProminent).disabled(model.busy)
                                }
                            }.padding(12)
                            if let image=model.borderMode ? model.original:model.rectified {
                                if model.borderMode {
                                    BorderCanvas(image:image,corners:$model.corners,zoom:model.zoom,editable:true,onEditingEnded:{model.rememberCorners()}).disabled(model.busy)
                                }else{
                                    ElementCanvas(image:image,elements:selected.elements,selection:$model.selectedElementID,zoom:model.zoom,showWords:model.showWords).disabled(model.busy)
                                }
                            }else{ContentUnavailableView("Source image unavailable",systemImage:"photo")}
                        }else{ContentUnavailableView("Queue complete",systemImage:"checkmark.circle",description:Text("Refresh to load newly indexed sources, or switch to Poster elements."))}
                    }.frame(minWidth:400,maxWidth:.infinity,maxHeight:.infinity)
                    ScrollView {
                        if let selected=model.selected {
                            VStack(alignment:.leading,spacing:16) {
                                Text(model.borderMode ? "Poster border":model.element.map{$0.kind} ?? "Whole poster").font(.title3.bold())
                                Text(selected.id).font(.caption2.monospaced()).foregroundStyle(.secondary).textSelection(.enabled)
                                if model.borderMode {
                                    Text("1 ↖   2 ↗   3 ↘   4 ↙").font(.caption.monospaced().bold())
                                    Text("Drag each corner to the poster edge. Use arrow keys for fine adjustments. Confirm to rectify and extract new elements.").font(.caption).foregroundStyle(.secondary)
                                    DisclosureGroup("Corner coordinates") {
                                    if model.corners.count==4 {
                                        ForEach(0..<4,id:\.self) { i in
                                            HStack {
                                                Text("\(i+1)").frame(width:18)
                                                TextField("X",value:$model.corners[i][0],format:.number.precision(.fractionLength(4))).accessibilityLabel("Corner \(i+1) horizontal coordinate")
                                                TextField("Y",value:$model.corners[i][1],format:.number.precision(.fractionLength(4))).accessibilityLabel("Corner \(i+1) vertical coordinate")
                                            }.textFieldStyle(.roundedBorder).onSubmit{model.rememberCorners()}
                                        }
                                    }
                                    }
                                }else{
                                    Picker("Element",selection:$model.selectedElementID) {
                                        Text("Whole poster").tag(String?.none)
                                        ForEach(selected.elements.filter{$0.reviewStatus != "rejected"}) { element in
                                            Text(element.kind+" · "+String((element.text ?? element.id).prefix(40))).tag(Optional(element.id))
                                        }
                                    }.onChange(of:model.selectedElementID){model.readLabels()}
                                    if let element=model.element {
                                        LibraryThumbnail(url:element.imageURL).frame(maxWidth:.infinity,maxHeight:150)
                                        Text(element.text ?? element.id).font(.caption).textSelection(.enabled)
                                    }
                                    Button("Save technique review"){model.saveLabels()}.disabled(model.busy)
                                    if model.element != nil {Button("Reject element",role:.destructive){model.saveLabels(reject:true)}.disabled(model.busy)}
                                }
                                if !model.borderMode && model.element==nil {
                                    Text("Style training labels").font(.headline)
                                    ForEach(StyleCatalog.categories) { category in
                                        Picker(category.displayName,selection:Binding(get:{model.styleLabels[category.id] ?? "unknown"},set:{model.styleLabels[category.id]=$0})) {
                                            Text("Unknown").tag("unknown");Text("Present").tag("present");Text("Absent").tag("absent")
                                        }.help(category.definition)
                                    }
                                    Button("Save style labels"){model.saveStyles()}.disabled(model.busy)
                                }
                                if !model.borderMode, let analysis = model.regionAnalysis {
                                    RegionAnalysisInspector(analysis: analysis) { bounds in
                                        segmentationBounds = bounds; segmentationRecord = selected
                                    }
                                }
                                CompositionInspector(plan:selected.genome.composition)
                                LibraryColorView(profile:model.element?.colors ?? selected.colors)
                                if !model.borderMode {
                                    Divider();Text("Technique labels").font(.headline)
                                    Text("Unknown labels are excluded from training. Measured suggestions are shown as evidence.").font(.caption).foregroundStyle(.secondary)
                                    ForEach(TechniqueTaxonomy.names,id:\.self) { tag in
                                        VStack(alignment:.leading,spacing:3) {
                                            Picker(tag,selection:Binding(get:{model.presentTags.contains(tag) ? "present":model.absentTags.contains(tag) ? "absent":"unknown"},set:{model.label(tag,$0)})) {
                                                Text("Unknown").tag("unknown");Text("Present").tag("present");Text("Absent").tag("absent")
                                            }
                                            if let evidence=(model.element?.tags ?? selected.tags).first(where:{$0.name==tag}) {
                                                Text(evidence.evidence.joined(separator:" ")).font(.caption2).foregroundStyle(.secondary)
                                            }
                                        }
                                    }
                                }
                                Divider()
                                ForEach(selected.warnings,id:\.self){Text($0).font(.caption).foregroundStyle(.secondary)}
                                Text(selected.source.caption).font(.caption).textSelection(.enabled)
                                Button("Reveal original photo"){NSWorkspace.shared.activateFileViewerSelecting([selected.source.sourceURL])}
                            }.padding(20)
                        }
                    }.frame(minWidth:275,idealWidth:310,maxWidth:370)
                }
            }
            Divider()
            HStack(spacing:8) {
                Group {if model.busy{ProgressView().controlSize(.small)}else{Image(systemName:"circle.fill").font(.system(size:6)).foregroundStyle(.secondary)}}.frame(width:16)
                Text(model.status).font(.caption).foregroundStyle(.secondary).lineLimit(1).help(model.status)
                Spacer()
                if let directory=model.directory {Text(directory.lastPathComponent).font(.caption.monospaced()).foregroundStyle(.tertiary)}
            }.padding(.horizontal,16).frame(height:36)
        }.task {model.restore()}.onDisappear{model.rememberCorners()}
            .sheet(item: $segmentationRecord) { record in
                if let directory = model.directory {
                    RegionSelectionView(record: record, directory: directory, initialBounds: segmentationBounds) { id in
                        model.load(directory, selectElementID: id)
                    }
                }
            }
            .onChange(of:model.borderMode){model.selectedElementID=nil;model.readLabels();if model.selectedID==nil{model.select(model.filtered.first?.id)}}
            .alert("Source library",isPresented:Binding(get:{model.error != nil},set:{if !$0{model.error=nil}})) {Button("OK"){model.error=nil}} message:{Text(model.error ?? "")}
    }
}
