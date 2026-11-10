import SwiftUI
import PosterCore

struct CompositionInspector:View {
    let plan:CompositionPlan?
    var body:some View {
        if let plan {
            DisclosureGroup("Composition & layout") {
                VStack(alignment:.leading,spacing:12) {
                    Text(plan.description).font(.caption).textSelection(.enabled)
                    LabeledContent("Origin",value:plan.origin).font(.caption2)
                    LabeledContent("Grid",value:plan.grid.type).font(.caption2)
                    if let columns=plan.grid.columns{LabeledContent("Columns",value:String(columns)).font(.caption2)}
                    Text("Hierarchy: "+plan.hierarchy.joined(separator:" → ")).font(.caption2).textSelection(.enabled)
                    ForEach(Array(plan.constraints.enumerated()),id:\.offset) { _,rule in
                        VStack(alignment:.leading,spacing:3) {
                            Text(rule.type.replacingOccurrences(of:"-",with:" ").capitalized).font(.caption2.bold())
                            Text(rule.reason).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    DisclosureGroup("Codified regions (\(plan.regions.count))") {
                        ForEach(plan.regions) { region in
                            VStack(alignment:.leading,spacing:3) {
                                Text(region.role).font(.caption2.bold())
                                Text(region.id).font(.caption2.monospaced()).textSelection(.enabled)
                                Text("x \(region.bounds.x.formatted(.number.precision(.fractionLength(3)))) · y \(region.bounds.y.formatted(.number.precision(.fractionLength(3)))) · w \(region.bounds.width.formatted(.number.precision(.fractionLength(3)))) · h \(region.bounds.height.formatted(.number.precision(.fractionLength(3))))").font(.caption2.monospaced()).foregroundStyle(.secondary)
                                if let shape=region.shape {Text("Shape: "+shape).font(.caption2)}
                                if let geometry=region.geometry {ForEach(geometry.keys.sorted(),id:\.self){key in Text(key+": "+geometry[key]!.formatted(.number.precision(.fractionLength(3)))).font(.caption2.monospaced()).foregroundStyle(.secondary)}}
                                if let blend=region.blendMode {Text("Overprint: "+blend).font(.caption2)}
                                if let clip=region.clipBounds {Text("Clip: x \(clip.x.formatted(.number.precision(.fractionLength(3)))) · y \(clip.y.formatted(.number.precision(.fractionLength(3)))) · w \(clip.width.formatted(.number.precision(.fractionLength(3)))) · h \(clip.height.formatted(.number.precision(.fractionLength(3))))").font(.caption2.monospaced()).foregroundStyle(.secondary)}
                            }.padding(.vertical,4)
                        }
                    }
                    Text(plan.note).font(.caption2).foregroundStyle(.secondary)
                }.padding(.top,8)
            }
        }
    }
}
