import Foundation

enum RegionRelationships {
    static func variation(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 1 }
        let mean = values.reduce(0, +) / Double(values.count)
        return sqrt(values.reduce(0) { $0 + pow($1 - mean, 2) } / Double(values.count)) / max(0.00001, mean)
    }

    static func evidence(_ tag: String, geometry g: RegionGeometry) -> [String]? {
        let count = g.components.count
        switch tag {
        case "geometric-shapes":
            return g.fillFraction > 0.3 && g.ocrCoverage < 0.4 ? ["Mask fill \(g.fillFraction); OCR overlap \(g.ocrCoverage)."] : nil
        case "shape-replication", "text-duplication":
            guard count >= 3, variation(g.components.map { Double($0.pixels) }) < 0.45 else { return nil }
            if tag == "text-duplication" && g.ocrCoverage < 0.45 { return nil }
            if tag == "shape-replication" && g.ocrCoverage > 0.55 { return nil }
            return ["\(count) disconnected components with similar predicted ink areas."]
        case "bilateral-symmetry", "reflection":
            guard max(g.horizontalSymmetry, g.verticalSymmetry) > 0.86 else { return nil }
            return ["Cropped-mask reflection IoU: horizontal \(g.horizontalSymmetry), vertical \(g.verticalSymmetry)."]
        case "radial-symmetry", "radial-type", "circular-text":
            if tag == "radial-symmetry", g.quarterTurnSymmetry > 0.78 {
                return ["Cropped-mask quarter-turn IoU \(g.quarterTurnSymmetry). This measures the isolated region."]
            }
            guard let circle = g.circularLayout, circle.relativeResidual < 0.16, circle.angularSpan > 240,
                  tag == "radial-symmetry" || g.ocrCoverage >= 0.45 else { return nil }
            return ["\(circle.componentCount) ink-component centers fit a circle: relative radial residual \(circle.relativeResidual), angular span \(circle.angularSpan) degrees."]
        case "text-on-path":
            guard g.ocrCoverage >= 0.45, let circle = g.circularLayout, circle.relativeResidual < 0.15, circle.angularSpan > 65 else { return nil }
            return ["Component centers fit an arc: residual \(circle.relativeResidual), span \(circle.angularSpan) degrees."]
        case "perforated-shapes":
            guard g.holes >= 2 && g.ocrCoverage < 0.45 else { return nil }
            let xs = g.gaps.map(\.centerX), ys = g.gaps.map(\.centerY)
            guard (xs.max()! - xs.min()!) > g.bounds.width * 0.15 || (ys.max()! - ys.min()!) > g.bounds.height * 0.15 else { return nil }
            return ["\(g.holes) enclosed, spatially separated negative-ink regions; this describes printed counterforms, not physical cutting."]
        case "halftone":
            return count >= 12 && g.ocrCoverage < 0.4 ? ["\(count) disconnected ink components; inspect their dot structure."] : nil
        case "curved-line-field":
            let lines = g.components.filter { component in
                let ratio = component.bounds.width / max(0.001, component.bounds.height)
                return ratio > 3 || ratio < 0.333
            }
            return lines.count >= 3 && g.ocrCoverage < 0.4 ? ["\(lines.count) elongated, disconnected ink components."] : nil
        case "concentric-shapes":
            let contours = g.components + g.gaps
            guard contours.count >= 3 && contours.count <= 64 else { return nil }
            let xs = contours.map(\.centerX), ys = contours.map(\.centerY)
            guard (xs.max()! - xs.min()!) < g.bounds.width * 0.08, (ys.max()! - ys.min()!) < g.bounds.height * 0.08 else { return nil }
            return ["\(contours.count) positive/negative contours with near-coincident centers."]
        case "grid", "modular-tiles":
            guard count >= 4 else { return nil }
            func clusters(_ values: [Double]) -> Int {
                var centers: [Double] = []
                for value in values.sorted() where !centers.contains(where: { abs($0 - value) < 0.025 }) { centers.append(value) }
                return centers.count
            }
            let columns = clusters(g.components.map(\.centerX)), rows = clusters(g.components.map(\.centerY))
            guard columns >= 2 && rows >= 2 && columns * rows <= Int(Double(count) * 1.5) else { return nil }
            return ["Component centers occupy approximately \(columns) columns × \(rows) rows; tolerance 0.025 poster units."]
        default: return []
        }
    }

    static func candidates(_ regions: [RegionAnalysis], posterID: String) -> [RegionSystemCandidate] {
        var results: [RegionSystemCandidate] = []
        for region in regions {
            let scope = region.geometry.ocrCoverage >= 0.45 ? "type" : "shape"
            if scope == "type" && !region.inkRefinement.applied { continue }
            // Similar glyph areas do not establish repeated copy. Duplication requires
            // matching OCR copy across separate regions in CrossRegionRelationships.
            let relationships = scope == "type" ? ["circular-text", "text-on-path", "grid", "reflection"] :
                ["shape-replication", "grid", "radial-symmetry", "reflection", "concentric-shapes", "perforated-shapes"]
            for tag in relationships {
                if tag == "reflection" && region.geometry.components.count < 2 { continue }
                guard let measured = evidence(tag, geometry: region.geometry), !measured.isEmpty,
                      region.tags.contains(where: { $0.tag == tag || (tag == "reflection" && $0.tag == "bilateral-symmetry") }) else { continue }
                results.append(RegionSystemCandidate(id: region.id + "-" + tag, scope: scope, relationship: tag,
                    regionIDs: [region.id], evidence: measured + ["SAM mask, OCR overlap and SigLIP description agree; source \(posterID)."],
                    sourceText: region.text, status: "candidate; not a fitted procedural rule"))
            }
        }
        return Array(results.prefix(24))
    }
}
