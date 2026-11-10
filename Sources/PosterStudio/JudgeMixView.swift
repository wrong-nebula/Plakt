import SwiftUI
import PosterCore

struct JudgeMixView:View {
    @Bindable var model:StudioModel
    @State private var preset="Balanced"
    @State private var selectedDesigner:DesignerJudgeProfile?
    var body:some View {
        VStack(alignment:.leading,spacing:12) {
            Label("Judging mix",systemImage:"slider.horizontal.3").font(.headline)
            Picker("Starting mix",selection:$preset) {
                Text("Balanced craft").tag("Balanced")
                ForEach(StyleCatalog.categories){Text($0.displayName).tag($0.name)}
                ForEach(DesignerCatalog.profiles){Text("Designer affinity · "+$0.name).tag($0.judgeName)}
            }.onChange(of:preset){model.judgeWeights=preset=="Balanced" ? StyleCatalog.balancedWeights:StyleCatalog.weights(favoring:preset)}
            VStack(alignment:.leading,spacing:7){
                Button("Taste check…",systemImage:"heart.text.square"){model.sheet = .tasteCheck}
                Text("Build your own jury with yes/no votes on generated posters.").font(.caption).foregroundStyle(.secondary)
                ForEach(model.tasteProfiles){profile in
                    Text(profile.name+" · \(profile.positive) yes / \(profile.negative) no · "+(profile.ready ? "ready":"learning")).font(.caption2).foregroundStyle(.secondary)
                    if profile.ready{Text(profile.enabled ? "Jury weight \(profile.weight.formatted(.number.precision(.fractionLength(1))))":"Excluded from jury").font(.caption2).foregroundStyle(.secondary)}
                }
                Button("Use only my taste jury"){model.useOnlyTasteJury()}.disabled(!model.tasteProfiles.contains{$0.ready && $0.enabled && $0.weight>0})
            }
            Divider()
            Text("Trained style families").font(.caption.bold()).foregroundStyle(.secondary)
            ForEach(StyleCatalog.groups,id:\.self) { group in
                DisclosureGroup(group) {
                    ForEach(StyleCatalog.categories.filter{$0.group==group}) { category in
                        weightControl(category.name,label:category.displayName).help(category.definition+" Trained on authored recipe examples and explicit source reviews; not historical ground truth.")
                    }
                }
            }
            if !DesignerCatalog.profiles.isEmpty {
                DisclosureGroup("Designer affinities · real works") {
                    ForEach(DesignerCatalog.profiles) { profile in
                        VStack(alignment:.leading,spacing:3) {
                            weightControl(profile.judgeName,label:profile.name)
                            Text("\(profile.works) credited works · \(profile.usableForVoting ? "validated learned head":"reference similarity")").font(.caption2).foregroundStyle(.secondary)
                            if let auc=profile.holdoutAUC {Text("Holdout ranking AUC \(auc.formatted(.number.precision(.fractionLength(2)))) · \(profile.holdoutPositive) positive works").font(.caption2).foregroundStyle(.secondary)}
                            Button("Reference works",systemImage:"books.vertical"){selectedDesigner=profile}.font(.caption).buttonStyle(.link).accessibilityLabel("Reference works for "+profile.name)
                        }.help(profile.note)
                    }
                }
            }
            Divider()
            Text("Craft & composition checks").font(.caption.bold()).foregroundStyle(.secondary)
            ForEach(JudgeCatalog.groups) { group in
                DisclosureGroup(group.title) {
                    ForEach(group.judges,id:\.self){name in weightControl(name,label:name).help(JudgeCatalog.explanation(name))}
                }
            }
            Text("Zero excludes a judge. Style families use learned models. Craft checks use declared layout, glyph geometry, OCR or image measurements; hover a judge for its basis.").font(.caption2).foregroundStyle(.secondary)
            Button("Train style judges",systemImage:"brain"){model.trainStyleJudges()}.disabled(model.busy)
            Text(model.styleModelsURL==nil ? "\(StyleCatalog.categories.count) recipe heads · \(DesignerCatalog.profiles.filter(\.usableForVoting).count) learned designer heads":"Using trained local style models + bundled designer heads").font(.caption2).foregroundStyle(.secondary)
        }.onChange(of:model.judgeWeights){model.applyJudgingMix()}
        .sheet(item:$selectedDesigner){profile in DesignerReferenceView(profile:profile)}
    }
    private func weightControl(_ name:String,label:String)->some View {
        VStack(spacing:3) {
            HStack {Text(label).font(.caption);Spacer();Text(model.judgeWeights[name] ?? 0,format:.number.precision(.fractionLength(1))).font(.caption.monospacedDigit())}
            Slider(value:Binding(get:{model.judgeWeights[name] ?? 0},set:{model.judgeWeights[name]=$0}),in:0...3,step:0.1).accessibilityLabel(label+" judge weight")
        }.padding(.vertical,4)
    }
}


private struct DesignerReferenceView:View {
    let profile:DesignerJudgeProfile
    @Environment(\.dismiss) private var dismiss
    var body:some View {
        VStack(alignment:.leading,spacing:16) {
            HStack(alignment:.top) {
                VStack(alignment:.leading,spacing:5) {
                    Text(profile.name).font(.title2.bold())
                    Text("\(profile.works) credited works · \(profile.uniqueGroups) independent groups").foregroundStyle(.secondary)
                }
                Spacer()
                Button("Done"){dismiss()}.keyboardShortcut(.cancelAction)
            }
            Text(profile.usableForVoting ? "Learned visual affinity":"Reference similarity").font(.headline)
            Text("Affinity describes resemblance to this sample of works. Craft judges assess legibility and layout separately. The generator starts from authored layout neighborhoods and uses the selected affinity to rank results.").font(.callout).foregroundStyle(.secondary)
            if let auc=profile.holdoutAUC {
                Text("Holdout ranking AUC: \(auc.formatted(.number.precision(.fractionLength(2)))) · \(profile.holdoutPositive) positive / \(profile.holdoutNegative) negative examples. Small samples limit certainty.").font(.caption)
            }
            Divider()
            ScrollView {
                LazyVStack(alignment:.leading,spacing:14) {
                    ForEach(Array(profile.references.enumerated()),id:\.offset) {_,work in
                        VStack(alignment:.leading,spacing:3) {
                            if let url=URL(string:work.recordURL){Link(work.title,destination:url).font(.headline)}
                            Text(work.creator+" · "+work.date).font(.caption)
                            Text(work.museum).font(.caption).foregroundStyle(.secondary)
                        }.frame(maxWidth:.infinity,alignment:.leading)
                    }
                }
            }
            Text(profile.note).font(.caption2).foregroundStyle(.secondary)
            Link("Collection metadata: The Museum of Modern Art",destination:URL(string:"https://github.com/MuseumofModernArt/collection")!).font(.caption)
        }.padding(24).frame(width:620,height:650)
    }
}
