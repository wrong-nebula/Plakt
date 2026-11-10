import SwiftUI
import PosterCore

struct RegionSelectionView: View {
    @State private var model: RegionSelectionModel
    @Environment(\.dismiss) private var dismiss
    let onSaved: (String) -> Void

    init(record: PosterRecord, directory: URL, initialBounds: UnitBox?, onSaved: @escaping (String) -> Void) {
        _model = State(initialValue: RegionSelectionModel(record: record, directory: directory, initialBounds: initialBounds))
        self.onSaved = onSaved
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Select a source element").font(.title2.bold())
                    Text("Foreground marks include ink. Background marks exclude nearby areas.").font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction).disabled(model.saving)
            }.padding(20)
            Divider()
            HSplitView {
                VStack(spacing: 12) {
                    HStack {
                        Picker("Mark", selection: $model.foreground) {
                            Text("Foreground").tag(true); Text("Background").tag(false)
                        }.pickerStyle(.segmented).frame(maxWidth: 280)
                        Spacer()
                        Button("Undo mark", systemImage: "arrow.uturn.backward") { model.undo() }.disabled(model.points.isEmpty || model.saving)
                        Button("Clear") { model.clear() }.disabled(model.points.isEmpty || model.saving)
                    }
                    canvas
                    HStack {
                        Text("Coordinates (0–1)").font(.caption).foregroundStyle(.secondary)
                        TextField("Horizontal", text: $model.markX).frame(width: 65).accessibilityLabel("Mark horizontal coordinate")
                        TextField("Vertical", text: $model.markY).frame(width: 65).accessibilityLabel("Mark vertical coordinate")
                        Button("Add mark") { model.addEnteredMark() }.disabled(model.saving)
                        Spacer()
                        if model.initialBounds != nil { Button("Use element bounds") { model.useBounds() }.disabled(model.saving) }
                    }.textFieldStyle(.roundedBorder)
                }.padding(18).frame(minWidth: 540, maxWidth: .infinity)
                inspector
            }
            Divider()
            HStack {
                if model.busy { ProgressView().controlSize(.small) }
                Text(model.status).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                Spacer()
                Button("Use region") {
                    Task { if let region = model.region, await model.save() { onSaved(region.id); dismiss() } }
                }.buttonStyle(.borderedProminent).disabled(model.busy || model.saving || model.region == nil)
            }.padding(16)
        }.frame(minWidth: 1040, minHeight: 700)
            .interactiveDismissDisabled(model.saving)
            .onAppear { if model.initialBounds != nil { model.useBounds() } }
            .onDisappear { model.cancel() }
    }

    private var canvas: some View {
        GeometryReader { geometry in
            if let source = model.source {
                let ratio = source.size.width / max(1, source.size.height)
                let width = min(geometry.size.width - 24, (geometry.size.height - 24) * ratio)
                let height = width / ratio
                ZStack(alignment: .topLeading) {
                    Image(nsImage: source).resizable().frame(width: width, height: height)
                    if let overlay = model.overlay {
                        Image(nsImage: overlay).resizable().renderingMode(.template).foregroundStyle(Color.accentColor)
                            .opacity(0.38).frame(width: width, height: height).allowsHitTesting(false)
                    }
                    ForEach(Array(model.points.enumerated()), id: \.offset) { index, point in
                        if point.label < 2 {
                            Text(point.label == 1 ? "+" : "−").font(.caption.bold()).foregroundStyle(.white)
                                .frame(width: 22, height: 22).background(point.label == 1 ? Color.accentColor : .orange, in: Circle())
                                .position(x: point.x * width, y: point.y * height)
                                .accessibilityLabel("\(point.label == 1 ? "Foreground" : "Background") mark \(index + 1)")
                        }
                    }
                }.frame(width: width, height: height).contentShape(Rectangle())
                    .gesture(SpatialTapGesture().onEnded { mark in model.addMark(x: mark.location.x / width, y: mark.location.y / height) })
                    .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
            } else { ContentUnavailableView("Source image unavailable", systemImage: "photo") }
        }.background(Color(nsColor: .underPageBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }

    private var inspector: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let error = model.error { Text(error).foregroundStyle(.red).textSelection(.enabled) }
                if let selection = model.selection {
                    Text("Mask alternatives").font(.headline)
                    ForEach(selection.masks) { mask in
                        Button { model.chooseMask(mask.id) } label: {
                            HStack {
                                Image(systemName: model.maskID == mask.id ? "largecircle.fill.circle" : "circle")
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Option \(mask.id + 1)")
                                    Text("IoU estimate \(mask.predictedIoU.formatted(.number.precision(.fractionLength(3)))) · stability \(mask.stability.formatted(.number.precision(.fractionLength(3))))")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }.contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(model.saving).accessibilityLabel("Choose mask option \(mask.id + 1)")
                            .accessibilityValue(model.maskID == mask.id ? "Selected" : "Not selected")
                    }
                    Text("These are model estimates. Inspect the edge and holes before using a region.").font(.caption).foregroundStyle(.secondary)
                } else {
                    Text("Isolate type or geometry").font(.headline)
                    Text("Click inside a letter, motif or shape. Add a background mark where the mask includes unwanted areas. You can also enter coordinates below the image.").font(.callout)
                }
                if let region = model.region {
                    LibraryThumbnail(url: region.cutoutURL).frame(maxWidth: .infinity, maxHeight: 200)
                    Text("Region evidence").font(.headline)
                    Text("\(region.geometry.components.count) components · \(region.geometry.holes) enclosed gaps").font(.caption)
                    Text(region.inkRefinement.applied ? "Printed ink measured inside the object mask." : "Object mask measured; paper could not be separated reliably.")
                        .font(.caption2).foregroundStyle(.secondary).help(region.inkRefinement.note)
                    Text("OCR overlap \(region.geometry.ocrCoverage.formatted(.percent.precision(.fractionLength(0))))").font(.caption)
                    if !region.tags.isEmpty {
                        Text("Suggested tags").font(.subheadline.bold())
                        ForEach(region.tags, id: \.tag) { tag in
                            Text(tag.tag).font(.caption)
                                .help(tag.explanation + " " + tag.geometrySupport.joined(separator: " "))
                        }
                    }
                    DisclosureGroup("Related saved systems") {
                        ForEach(region.relatedSystems) { related in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(related.name).font(.caption)
                                Text("\(related.scope) · \(related.operation)").font(.caption2).foregroundStyle(.secondary)
                            }.padding(.vertical, 3)
                        }
                        Text("Vision appearance and SigLIP meaning are ranked separately, then combined. Similarity is a review lead.").font(.caption2).foregroundStyle(.secondary)
                    }
                    Button("Find related regions", systemImage: "square.on.square") { model.findRelatedRegions() }
                        .disabled(model.busy || model.saving)
                    if model.searchedRegions {
                        Text("Related regions").font(.headline)
                        Text("Appearance, meaning and ink geometry contribute separate rankings. These are review leads.")
                            .font(.caption2).foregroundStyle(.secondary)
                        if model.relatedRegions.isEmpty { Text("No other current region analyses are available in this library.").font(.caption) }
                        ForEach(model.relatedRegions) { hit in
                            HStack(alignment: .top, spacing: 10) {
                                LibraryThumbnail(url: hit.imageURL).frame(width: 64, height: 72)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(hit.text.isEmpty ? String(hit.posterID.prefix(12)) : hit.text).font(.caption).lineLimit(2)
                                    Text("Vision #\(hit.ranks["Vision"] ?? 0) · SigLIP #\(hit.ranks["SigLIP"] ?? 0) · geometry #\(hit.ranks["Mask geometry"] ?? 0)")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                            }.help(hit.id)
                        }
                    }
                    Text("Using the region saves its mask, source coordinates and features. Technique suggestions remain unconfirmed.").font(.caption).foregroundStyle(.secondary)
                }
            }.padding(20)
        }.frame(minWidth: 280, idealWidth: 310, maxWidth: 340)
    }
}
