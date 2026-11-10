import SwiftUI
import PosterCore

struct StudioControls: View {
    @Bindable var model: StudioModel
    private func copyBinding(_ key:WritableKeyPath<PosterCopy,String>)->Binding<String> {Binding(get:{model.copy[keyPath:key]},set:{model.editCopy(key,$0)})}
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("FORM / LAB").font(.title2.weight(.black))
                    Text("Procedural poster studio").font(.caption).foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 10) {
                    Button("Start from image…",systemImage:"photo.badge.plus"){model.sheet = .imageStart}
                    Text("Use a photo or artwork inside the poster and let it influence the composition.").font(.caption).foregroundStyle(.secondary)
                    Label("Judging reference", systemImage: "photo").font(.headline)
                    HStack(alignment: .top, spacing: 12) {
                        if let image = model.referenceImage {
                            Image(nsImage: image).resizable().aspectRatio(contentMode: .fit).frame(width: 68, height: 92)
                                .accessibilityLabel("Current poster reference")
                        }
                        VStack(alignment: .leading, spacing: 8) {
                            Text(model.referenceURL.lastPathComponent).font(.caption).lineLimit(2)
                            Button("Replace…") { model.importReference() }
                            Toggle("Crop photo", isOn: $model.cropReference).font(.caption)
                                .help("Uses the crop proportions of the supplied reference photograph.")
                        }
                    }
                }
                Divider()
                VStack(alignment: .leading, spacing: 10) {
                    Text("Event brief").font(.headline)
                    Picker("Content",selection:Binding(get:{model.contentSelection},set:{model.chooseContent($0)})) {
                        Text("Mix inspired briefs").tag("auto")
                        Text("Custom copy").tag("custom")
                        ForEach(Array(Set(ContentBriefLibrary.briefs.map(\.kind))).sorted(),id:\.self){kind in
                            Section(kind){ForEach(ContentBriefLibrary.briefs.filter{$0.kind==kind}){brief in Text(brief.name).tag(brief.id)}}
                        }
                    }.pickerStyle(.menu)
                    if let brief=model.previewBrief {
                        Text(brief.kind+" · "+brief.dateLabel+" · "+brief.status()).font(.caption).foregroundStyle(.secondary)
                        HStack {
                            if let source=brief.sources.first {Link("Inspiration source",destination:source.url).font(.caption)}
                        }
                    }
                    if model.contentSelection=="auto" {Text("New concepts, real locations. A different brief in each direction.").font(.caption2).foregroundStyle(.secondary)}
                    TextEditor(text: copyBinding(\.title))
                        .font(.body).frame(height: 62).padding(5)
                        .background(Color(nsColor: .textBackgroundColor))
                        .clipShape(.rect(cornerRadius: 5))
                        .overlay { RoundedRectangle(cornerRadius: 5).strokeBorder(.quaternary) }
                        .accessibilityLabel("Poster title")
                    TextField("Programme / subtitle", text: copyBinding(\.subtitle))
                    TextField("Venue / organizer", text: copyBinding(\.institution))
                    TextField("Dates / practical information", text: copyBinding(\.footer))
                }.textFieldStyle(.roundedBorder)
                Divider()
                VStack(alignment: .leading, spacing: 12) {
                    Text("Evolution").font(.headline)
                    LabeledContent("Seed") { TextField("Seed", text: $model.seedText).frame(width: 100).textFieldStyle(.roundedBorder).multilineTextAlignment(.trailing) }
                    Stepper("\(model.batchSize) candidates", value: $model.batchSize, in: 4...(model.useLibraryCompositions && model.reviewLibraryURL != nil ? 16:24), step: 4)
                    if model.useLibraryCompositions && model.reviewLibraryURL != nil {Text("5 rounds per source direction").font(.caption).foregroundStyle(.secondary)}else{Stepper("\(model.rounds) rounds", value: $model.rounds, in: 1...10)}
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text("Mutation"); Spacer(); Text(model.mutation, format: .percent.precision(.fractionLength(0))).monospacedDigit() }
                        Slider(value: $model.mutation, in: 0.05...0.8, step: 0.05)
                    }
                    Toggle("Apple Intelligence critic", isOn: $model.appleIntelligence)
                        .disabled(!AppleCritic.availability.contains("available") || AppleCritic.availability.contains("unavailable"))
                    Text(AppleCritic.availability).font(.caption2).foregroundStyle(.secondary)
                }
                Divider()
                VStack(alignment:.leading,spacing:9) {
                    Label("Source genomes",systemImage:"square.stack.3d.up").font(.headline)
                    Toggle("Use library compositions",isOn:$model.useLibraryCompositions).disabled(model.reviewLibraryURL==nil)
                    Toggle("Use modifiers",isOn:$model.useModifiers).disabled(model.reviewLibraryURL==nil || !model.useLibraryCompositions)
                        .help("Half the candidates run their display type through one or two effector modifiers (weight, outline, shadow, slice, screen…); the jury chooses between modified and plain type. Event details stay untouched.")
                    Text("Inherit real type blocks, rotations and negative space. Transfer compatible donor clusters, then judge five rounds in each direction.").font(.caption).foregroundStyle(.secondary)
                    Button("Explore shapes…",systemImage:"circle.hexagongrid"){model.sheet = .shapeLibrary}
                    Text(model.shapePreset.map{$0.recipe.name+($0.dominant != nil ? " · whole-poster system":" · pinned for image areas")} ?? "Shapes matched to the layout and font").font(.caption2).foregroundStyle(.secondary)
                    Button("Explore type systems…",systemImage:"character.cursor.ibeam"){model.sheet = .typeSystems}
                    Text(model.typeSystem.map{$0.system.name+" · saved controls"} ?? "Type rules inherited from source posters").font(.caption2).foregroundStyle(.secondary)
                    Button("Browse Google Fonts…",systemImage:"textformat"){model.sheet = .fontLibrary}
                    Text(model.fontProfileID.flatMap{FontLibrary.shared.profile($0)?.label} ?? "Type chosen from font similarity neighborhoods").font(.caption2).foregroundStyle(.secondary)
                    Stepper(model.proposalsPerSlot==1 ? "Pre-render filter off":"Pre-render filter · best of \(model.proposalsPerSlot)",value:$model.proposalsPerSlot,in:1...8)
                    Text("Builds several genomes per candidate and renders only the one a model of the jury ranks highest. Judging is unchanged.").font(.caption2).foregroundStyle(.secondary)
                    Button("Generate from library",systemImage:"arrow.triangle.merge"){model.startSourceStudy()}
                    if model.sourceStudyURL != nil {Button("View source study"){model.openSourceStudy()}}
                }
                Divider()
                JudgeMixView(model:model)
                Divider()
                VStack(alignment: .leading, spacing: 9) {
                    Label("Local on Apple silicon", systemImage: "cpu").font(.caption.weight(.semibold))
                    Text("Core Graphics draws. Vision measures. Core ML scores. Committee ballots choose the next parents.")
                        .font(.caption).foregroundStyle(.secondary)
                    Text("A seeded coin toss starts half the candidates with shapes, then adds type in four passes.").font(.caption2).foregroundStyle(.secondary)
                    Text("No image-generation service or API key required.").font(.caption2).foregroundStyle(.secondary)
                }
            }.padding(20)
        }
        .onChange(of:model.seedText){model.refreshContentPreview()}
        .disabled(model.busy)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 10) {
                if model.current != nil {
                    Button(model.picks.isEmpty ? "Evolve top three" : "Evolve \(model.picks.count) picked", systemImage: "arrow.triangle.branch") { model.start(newSession: false) }
                        .buttonStyle(.borderedProminent).frame(maxWidth: .infinity)
                        .disabled(model.busy || model.current?.copy != model.copy || model.current?.cropReference != model.cropReference)
                }
                Button(model.current == nil ? "Generate study" : "New study", systemImage: "sparkles") { model.start(newSession: true) }
                    .frame(maxWidth: .infinity).disabled(model.busy)
                if model.current != nil && model.current?.copy != model.copy {
                    Text("Copy changed. Generate a new study to use it.").font(.caption2).foregroundStyle(.secondary)
                }
            }.padding(16).background(.bar)
        }
    }
}
