import Foundation
import CoreGraphics

/// SAM point prompts on printed ink. A blind grid often lands on bare paper; these land on marks.
/// Paper is the poster's dominant color, printed stock or a full-bleed ground, when it covers at least
/// 35% of the surface. A photographed poster's border is rarely one clean color, so the border alone
/// identified paper on only a tenth of the collection; the dominant color does on over a third.
public enum InkSeeds {
    /// Up to `limit` foreground points, largest ink components first. Each point is the component's ink cell
    /// nearest its center, so rings and outlines are prompted on ink rather than their empty middle.
    /// Returns nil when no color dominates (photographs, collage); callers keep the grid.
    public static func points(_ image: CGImage, limit: Int, skipping covered: [UnitBox] = []) -> [SAMPoint]? {
        guard limit > 0, image.width > 0, image.height > 0 else { return [] }
        let long = 96, landscape = image.width >= image.height
        let w = landscape ? long : max(8, Int((Double(long) * Double(image.width) / Double(image.height)).rounded()))
        let h = landscape ? max(8, Int((Double(long) * Double(image.height) / Double(image.width)).rounded())) : long
        var bytes = [UInt8](repeating: 0, count: w * h * 4)
        let drawn = bytes.withUnsafeMutableBytes { memory -> Bool in
            guard let context = CGContext(data: memory.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.interpolationQuality = .high; context.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard drawn else { return nil }
        let colors = (0..<(w * h)).map { PerceptualColor.fromRGB(Double(bytes[$0 * 4]) / 255, Double(bytes[$0 * 4 + 1]) / 255, Double(bytes[$0 * 4 + 2]) / 255) }
        // Densest OKLab bin, refined to the median of nearby colors.
        func bin(_ color: PerceptualColor.Lab) -> [Int] { [Int((color.l / 0.05).rounded(.down)), Int((color.a / 0.04).rounded(.down)), Int((color.b / 0.04).rounded(.down))] }
        let bins = colors.map(bin)
        let densest = Dictionary(grouping: bins.indices, by: { bins[$0] }).max { $0.value.count == $1.value.count ? $0.key.lexicographicallyPrecedes($1.key) : $0.value.count < $1.value.count }!.value
        let center = PerceptualColor.Lab(l: densest.reduce(0) { $0 + colors[$1].l } / Double(densest.count),
            a: densest.reduce(0) { $0 + colors[$1].a } / Double(densest.count), b: densest.reduce(0) { $0 + colors[$1].b } / Double(densest.count))
        let near = colors.indices.filter { PerceptualColor.squared(colors[$0], center) < 0.06 * 0.06 }
        func median(_ values: [Double]) -> Double { values.sorted()[values.count / 2] }
        let paper = PerceptualColor.Lab(l: median(near.map { colors[$0].l }), a: median(near.map { colors[$0].a }), b: median(near.map { colors[$0].b }))
        let distances = colors.map { sqrt(PerceptualColor.squared($0, paper)) }
        guard Double(distances.filter { $0 < 0.06 }.count) / Double(colors.count) >= 0.35 else { return nil }
        let ink = distances.map { $0 > 0.1 }
        let coverage = Double(ink.filter { $0 }.count) / Double(ink.count)
        guard (0.005...0.75).contains(coverage) else { return nil }
        var seen = [Bool](repeating: false, count: ink.count), components: [[Int]] = []
        for start in ink.indices where ink[start] && !seen[start] {
            var queue = [start], cursor = 0; seen[start] = true
            while cursor < queue.count {
                let position = queue[cursor], x = position % w, y = position / w; cursor += 1
                for dy in -1...1 { for dx in -1...1 where dx != 0 || dy != 0 {
                    let nx = x + dx, ny = y + dy
                    guard nx >= 0, nx < w, ny >= 0, ny < h else { continue }
                    let next = ny * w + nx
                    if ink[next] && !seen[next] { seen[next] = true; queue.append(next) }
                }}
            }
            if queue.count >= max(3, w * h / 2000) { components.append(queue) }
        }
        var points: [SAMPoint] = []
        for component in components.sorted(by: { $0.count == $1.count ? $0[0] < $1[0] : $0.count > $1.count }) {
            let cx = component.reduce(0.0) { $0 + Double($1 % w) } / Double(component.count)
            let cy = component.reduce(0.0) { $0 + Double($1 / w) } / Double(component.count)
            let cell = component.min { hypot(Double($0 % w) - cx, Double($0 / w) - cy) < hypot(Double($1 % w) - cx, Double($1 / w) - cy) }!
            let point = SAMPoint(x: (Double(cell % w) + 0.5) / Double(w), y: (Double(cell / w) + 0.5) / Double(h))
            // Text lines already prompted as boxes would mostly reproduce the same masks.
            if covered.contains(where: { point.x >= $0.x && point.x <= $0.x + $0.width && point.y >= $0.y && point.y <= $0.y + $0.height }) { continue }
            points.append(point)
            if points.count == limit { break }
        }
        return points
    }
}
