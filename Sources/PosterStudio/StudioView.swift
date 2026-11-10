import SwiftUI
import PosterCore

struct StudioView: View {
    @Bindable var model: StudioModel
    var reviewAction:()->Void
    @State private var showInspector = true
    var body: some View {
        NavigationSplitView {
            StudioControls(model: model)
                .navigationSplitViewColumnWidth(min: 240, ideal: 270, max: 310)
        } detail: {
            VStack(spacing: 0) {
                if let live = model.live {
                    LiveStudyStage(live: live, openResults: { model.openLiveResults() }, close: { model.closeLive() })
                        .transition(.opacity)
                } else {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("TYPE AS A SYSTEM").font(.caption.monospaced()).foregroundStyle(.secondary)
                        Text(model.current.map { "Study / \($0.number.formatted(.number.precision(.integerLength(2))))" } ?? "Your next type study")
                            .font(.largeTitle.bold())
                    }
                    Spacer()
                    if let current = model.current {
                        Text("\(current.candidates.count) candidates\n\(current.candidates.first?.votes.count ?? 0) judges")
                            .font(.caption.monospaced()).multilineTextAlignment(.trailing).foregroundStyle(.secondary)
                    }
                }.padding(24)
                Divider()
                if let current = model.current {
                    ScrollView {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 190, maximum: 300), spacing: 20)], spacing: 24) {
                            ForEach(current.candidates) { candidate in
                                CandidateCard(candidate: candidate, image: model.images[candidate.id],
                                              selected: model.selectedID == candidate.id, picked: model.picks.contains(candidate.id),
                                              inspect: { model.selectedID = candidate.id }, pick: { model.togglePick(candidate.id) })
                            }
                        }.padding(24)
                    }
                } else {
                    ContentUnavailableView {
                        Label("Make a field of possibilities", systemImage: "square.grid.3x3")
                    } description: {
                        Text("Generate a batch of procedural posters. Your selected judges vote, the strongest compositions become parents, and each round makes a new study.")
                            .frame(maxWidth: 430)
                    } actions: {
                        Button("Generate study", systemImage: "sparkles") { model.start(newSession: true) }
                            .buttonStyle(.borderedProminent).disabled(model.busy)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                }
                Divider()
                HStack(spacing: 10) {
                    if model.busy { ProgressView().controlSize(.small) }
                    Text(model.status).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    Spacer()
                    JobStopButton(lifecycle: model.jobs.lifecycle) { model.stop() }
                }.padding(.horizontal, 20).padding(.vertical, 12)
            }
            .background(Color(nsColor: .underPageBackgroundColor))
            .toolbar {
                Button("Poster library", systemImage: "books.vertical") { reviewAction() }.disabled(model.busy)
                Button("Open study", systemImage: "folder") { model.loadGeneration() }.disabled(model.busy)
                Button("Show files", systemImage: "folder.badge.gearshape") { model.reveal() }.disabled(model.output == nil)
                Button("Inspector", systemImage: "sidebar.right") { showInspector.toggle() }
            }
            .inspector(isPresented: $showInspector) { CandidateInspector(model: model).inspectorColumnWidth(min: 250, ideal: 295, max: 370) }
        }
        .tint(Color(red: 0.82, green: 0.22, blue: 0.12))
        .alert("PosterLab", isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button("OK") { model.error = nil }
        } message: { Text(model.error ?? "") }
    }
}

private struct CandidateCard: View {
    let candidate: Candidate
    let image: NSImage?
    let selected: Bool
    let picked: Bool
    let inspect: () -> Void
    let pick: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: inspect) {
                Group {
                    if let image { Image(nsImage: image).resizable().aspectRatio(contentMode: .fit) }
                    else { Rectangle().fill(.quaternary).aspectRatio(1 / 1.414, contentMode: .fit) }
                }
                .overlay { Rectangle().strokeBorder(selected ? Color.accentColor : .clear, lineWidth: 3) }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Inspect poster ranked \(candidate.rank), seed \(candidate.genome.seed)")
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(candidate.rank == 1 ? "01 / WINNER" : String(format: "%02d / STUDY", candidate.rank))")
                        .font(.caption.monospaced().bold())
                    Text(candidate.genome.usesStagedConstruction ? "STAGED / 4 PASSES" : "DIRECT").font(.caption2.monospaced()).foregroundStyle(.secondary)
                    Text("\(candidate.consensus.formatted(.number.precision(.fractionLength(1)))) consensus")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button(picked ? "Picked" : "Pick", systemImage: picked ? "checkmark.circle.fill" : "plus.circle", action: pick)
                    .labelStyle(.iconOnly).buttonStyle(.plain).font(.title3)
                    .accessibilityLabel(picked ? "Remove poster \(candidate.rank) from parents" : "Use poster \(candidate.rank) as parent")
                    .help("Choose parents for the next round")
            }
        }
    }
}
