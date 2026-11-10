import SwiftUI
import PosterCore

struct CandidateInspector: View {
    @Bindable var model: StudioModel
    @State private var processStep = 3
    var body: some View {
        ScrollView {
            if let c = model.selected {
                VStack(alignment: .leading, spacing: 18) {
                    HStack { Text("JUDGES’ TABLE").font(.caption.monospaced().bold()); Spacer(); Text("#\(c.rank)").font(.title3.bold()) }
                    if let previews = model.processImages[c.id], previews.count == 4 {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("COIN TOSS / STAGED").font(.caption2.monospaced().bold())
                            Picker("Construction pass", selection: $processStep) {
                                Text("01").tag(0); Text("02").tag(1); Text("03").tag(2); Text("04").tag(3)
                            }.pickerStyle(.segmented)
                            Text(ConstructionStage.allCases[processStep].label).font(.caption)
                            Image(nsImage: processStep == 3 ? (model.images[c.id] ?? previews[3]) : previews[processStep])
                                .resizable().aspectRatio(contentMode: .fit)
                                .accessibilityLabel("\(ConstructionStage.allCases[processStep].label) for seed \(c.genome.seed)")
                        }
                    } else if let image = model.images[c.id] {
                        Image(nsImage: image).resizable().aspectRatio(contentMode: .fit).accessibilityLabel("Selected poster, seed \(c.genome.seed)")
                    }
                    LabeledContent("Consensus") { Text(c.consensus, format: .number.precision(.fractionLength(1))).font(.title2.monospacedDigit().bold()) }
                    Text("Relative Borda score within this batch.").font(.caption).foregroundStyle(.secondary)
                    Divider()
                    ForEach(c.scores.keys.sorted(), id: \.self) { judge in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(judge).font(.caption.weight(.semibold)); Spacer()
                                Text(c.scores[judge] ?? 0, format: .number.precision(.fractionLength(3))).font(.caption.monospacedDigit())
                            }
                            if let vote = c.votes[judge] { ProgressView(value: vote).accessibilityLabel("\(judge) ballot") }
                            else { Text("No ballot: zero weight, missing, or the same for every poster").font(.caption2).foregroundStyle(.secondary) }
                        }
                    }
                    Divider()
                    CompositionInspector(plan:c.genome.composition)
                    LabeledContent("Seed", value: String(c.genome.seed)).font(.caption.monospaced())
                    LabeledContent("Recognized words", value: String(c.measurements.recognizedWords)).font(.caption)
                    Text(c.genome.usesStagedConstruction ? "Construction: staged, four passes" : "Construction: direct (seed coin toss)").font(.caption).foregroundStyle(.secondary)
                    Text(c.parentID.map { "Parent: \($0)" } ?? "Origin: fresh seed").font(.caption).foregroundStyle(.secondary)
                    Button(model.picks.contains(c.id) ? "Remove from parents" : "Choose as parent", systemImage: "checkmark.circle") { model.togglePick(c.id) }.disabled(model.busy)
                    HStack {
                        Button("PNG…") { model.exportSelected(pdf: false) }
                        Button("Vector PDF…") { model.exportSelected(pdf: true) }
                    }.disabled(model.busy)
                    if let current = model.current {
                        Text(current.compute).font(.caption2).foregroundStyle(.secondary)
                        ForEach(current.notes, id: \.self) { Text($0).font(.caption2).foregroundStyle(.secondary) }
                        if let critique = current.appleCritique { Text(critique).font(.caption) }
                    }
                }.padding(20)
            } else {
                ContentUnavailableView("Inspect a poster", systemImage: "slider.horizontal.3", description: Text("Judge scores, ancestry, and exports appear here."))
                    .padding(.top, 70)
            }
        }
        .onChange(of: model.selectedID) { processStep = 3 }
    }
}
