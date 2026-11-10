import SwiftUI
import PosterCore

struct RegionAnalysisInspector: View {
    let analysis: PosterRegionAnalysis
    let refine: (UnitBox) -> Void

    var body: some View {
        DisclosureGroup("Region analysis") {
            VStack(alignment: .leading, spacing: 14) {
                Text("\(analysis.regions.count) isolated regions · \(analysis.systems.count) system candidates").font(.caption)
                Text("SAM proposes the region; SigLIP suggests descriptions. Vision and mask geometry help compare it with other sources.")
                    .font(.caption2).foregroundStyle(.secondary)
                ForEach(analysis.regions) { region in
                    HStack(alignment: .top, spacing: 10) {
                        LibraryThumbnail(url: region.cutoutURL).frame(width: 58, height: 72)
                        VStack(alignment: .leading, spacing: 5) {
                            Text("\(region.geometry.components.count) components · \(region.geometry.holes) gaps").font(.caption)
                            if !region.tags.isEmpty { Text(region.tags.map(\.tag).joined(separator: ", ")).font(.caption2).foregroundStyle(.secondary) }
                            Button("Refine region…") { refine(region.bounds) }.font(.caption)
                        }
                    }
                }
                if !analysis.systems.isEmpty {
                    Text("Systems to inspect").font(.caption.bold())
                    ForEach(analysis.systems.prefix(8)) { candidate in
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(candidate.scope.capitalized) · \(candidate.relationship)").font(.caption)
                            Text(candidate.evidence.joined(separator: " ")).font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    Text("Candidates need review before becoming reusable rules.").font(.caption2).foregroundStyle(.secondary)
                }
            }.padding(.top, 8)
        }
    }
}
