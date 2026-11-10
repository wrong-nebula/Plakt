import CoreGraphics
import Foundation

/// Palette quantization, then shared-border tracing: each border between two color regions is traced,
/// smoothed and curve-fitted once, and both regions use that same curve, so the SVG has no cracks or
/// overlaps between colors. SVG contains paths only. This is an explicitly lossy trace of the rendered
/// pixels, not a refracting vector material. Given the poster as a vector PDF, the SVG keeps the poster's
/// own artwork and traces only the pixels the glass changes, laid over it.
public enum GlassVectorTrace {
    /// The poster as vectors: its PDF, and the renderer's coverage image, which is 0 wherever the render
    /// shows the plain poster.
    public struct Poster: Sendable {
        public let pdf: Data
        public let coverage: CGImage
        public init(pdf: Data, coverage: CGImage) {
            self.pdf = pdf
            self.coverage = coverage
        }
    }

    public struct Result: Sendable {
        public let svg: String
        public let pathCount: Int
        public let colorCount: Int
        public let preview: CGImage
        /// Pixels that traced color regions should cover but do not (before the background or the vector poster
        /// is added): the whole poster, or with a vector poster the area the glass changes. 0 means no gaps.
        public let gapPixels: Int
        /// True when the SVG keeps the poster's own vector artwork and traces only what the glass changes.
        public let posterVectors: Bool
        /// Share of the poster that was traced: 1 without a vector poster.
        public let tracedShare: Double
        /// Why a vector poster was traced as pixels after all.
        public let note: String?
    }

    public static func trace(_ image: CGImage, width: Int = 600, colors: Int = 12, poster: Poster? = nil) throws -> Result {
        guard (160...1200).contains(width), (2...32).contains(colors) else {
            throw PosterError.invalid("Trace width must be 160–1200 and palette size 2–32.")
        }
        let height = max(1, Int((Double(width) * Double(image.height) / Double(image.width)).rounded()))
        guard width * height <= 3_000_000 else { throw PosterError.invalid("Reduce the trace detail for this tall poster.") }
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.interpolationQuality = .high
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { throw PosterError.render }
        var footprint: Footprint?, note: String?
        if let poster {
            do {
                footprint = try Self.footprint(poster, width: width, height: height)
            } catch let unsupported as GlassPosterVectors.Unsupported {
                note = "The poster PDF uses \(unsupported.feature), so the whole poster was traced."
            } catch {
                note = "The poster PDF could not be read, so the whole poster was traced."
            }
        }
        let mask = footprint?.mask
        var histogram: [Int: Int] = [:]
        for pixel in 0..<(width * height) where mask?[pixel] ?? true {
            let i = pixel * 4
            let key = Int(bytes[i] >> 3) << 10 | Int(bytes[i + 1] >> 3) << 5 | Int(bytes[i + 2] >> 3)
            histogram[key, default: 0] += 1
        }
        let bins = histogram.keys.sorted().map { key in
            (key: key, color: SIMD3<Double>(Double((key >> 10) * 8 + 4), Double(((key >> 5) & 31) * 8 + 4), Double((key & 31) * 8 + 4)), count: histogram[key]!)
        }
        func distance(_ a: SIMD3<Double>, _ b: SIMD3<Double>) -> Double {
            let d = a - b
            return d.x * d.x * 0.3 + d.y * d.y * 0.59 + d.z * d.z * 0.11
        }
        // With a vector poster and no glass in view, nothing is traced and the palette stays empty.
        var palette = bins.max { $0.count < $1.count }.map { [$0.color] } ?? []
        while palette.count < min(colors, bins.count) {
            let next = bins.max { a, b in
                let da = palette.map { distance(a.color, $0) }.min()! * sqrt(Double(a.count))
                let db = palette.map { distance(b.color, $0) }.min()! * sqrt(Double(b.count))
                return da < db
            }!
            palette.append(next.color)
        }
        func closest(_ color: SIMD3<Double>) -> Int {
            var best = 0, bestDistance = Double.infinity
            for i in palette.indices {
                let d = distance(color, palette[i])
                if d < bestDistance { bestDistance = d; best = i }
            }
            return best
        }
        for _ in 0..<8 {
            var sums = Array(repeating: SIMD3<Double>(repeating: 0), count: palette.count)
            var counts = [Int](repeating: 0, count: palette.count)
            for bin in bins {
                let index = closest(bin.color)
                sums[index] += bin.color * Double(bin.count)
                counts[index] += bin.count
            }
            for i in palette.indices where counts[i] > 0 { palette[i] = sums[i] / Double(counts[i]) }
        }
        if let footprint {
            // Flat poster colors pass through the render unchanged. Snapping close palette colors to them
            // keeps the edge of the traced area invisible against the vector poster around it.
            let inks = footprint.vectors.inks + [SIMD3(255, 255, 255)]
            for i in palette.indices {
                if let ink = inks.min(by: { distance($0, palette[i]) < distance($1, palette[i]) }), distance(ink, palette[i]) < 36 {
                    palette[i] = ink
                }
            }
            palette = palette.reduce(into: []) { unique, color in if !unique.contains(color) { unique.append(color) } }
        }
        let lookup = Dictionary(uniqueKeysWithValues: bins.map { ($0.key, closest($0.color)) })
        // -1 marks pixels left to the vector poster; borders treat it like the area outside the poster.
        var labels = [Int](repeating: -1, count: width * height)
        for i in labels.indices where mask?[i] ?? true {
            let j = i * 4
            let key = Int(bytes[j] >> 3) << 10 | Int(bytes[j + 1] >> 3) << 5 | Int(bytes[j + 2] >> 3)
            labels[i] = lookup[key]!
        }
        mergeSpecks(&labels, width: width, height: height, palette: palette, distance: distance)

        let columns = width + 1
        let chains = borders(labels, width: width, height: height)
        let curves = chains.map { chain in
            fit(smooth(chain.vertices.map { SIMD2(Double(Int($0) % columns), Double(Int($0) / columns)) }, cycle: chain.cycle),
                cycle: chain.cycle)
        }
        var area = [Int](repeating: 0, count: palette.count)
        for label in labels where label >= 0 { area[label] += 1 }

        guard let regionContext = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        // SVG coordinates run downward; Core Graphics drawing coordinates run upward.
        regionContext.translateBy(x: 0, y: CGFloat(height))
        regionContext.scaleBy(x: 1, y: -1)
        var paths: [String] = [], pathCount = 0
        for color in palette.indices where area[color] > 0 {
            let loops = outlines(of: color, chains: chains)
            guard !loops.isEmpty else { continue }
            var commands = ""
            let colorPath = CGMutablePath()
            for loop in loops {
                var first = true
                for (index, reversed) in loop {
                    let curve = curves[index]
                    let start = reversed ? curve.end : curve.start
                    if first {
                        commands += "M\(number(start.x)) \(number(start.y))"
                        colorPath.move(to: CGPoint(x: start.x, y: start.y))
                        first = false
                    }
                    for segment in reversed ? curve.reversed : curve.segments {
                        let end = CGPoint(x: segment.end.x, y: segment.end.y)
                        if segment.straight {
                            commands += "L\(number(segment.end.x)) \(number(segment.end.y))"
                            colorPath.addLine(to: end)
                        } else {
                            commands += "C\(number(segment.c1.x)) \(number(segment.c1.y)) \(number(segment.c2.x)) \(number(segment.c2.y)) \(number(segment.end.x)) \(number(segment.end.y))"
                            colorPath.addCurve(to: end, control1: CGPoint(x: segment.c1.x, y: segment.c1.y),
                                               control2: CGPoint(x: segment.c2.x, y: segment.c2.y))
                        }
                    }
                }
                commands += "Z"
                colorPath.closeSubpath()
                pathCount += 1
            }
            regionContext.setFillColor(cgColor(palette[color]))
            regionContext.addPath(colorPath)
            regionContext.drawPath(using: .eoFill)
            paths.append("<path fill=\"\(hex(palette[color]))\" fill-rule=\"evenodd\" d=\"\(commands)\"/>")
        }
        guard let regions = regionContext.makeImage(), let coverage = regionContext.data?.assumingMemoryBound(to: UInt8.self),
              let previewContext = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PosterError.render }
        var gapPixels = 0
        for i in 0..<(width * height) where coverage[i * 4 + 3] < 128 && footprint?.touched[i] ?? true { gapPixels += 1 }
        let svg: String
        if let footprint {
            // The preview draws the same converted shapes the SVG holds, then the traced glass over them.
            previewContext.setFillColor(CGColor(gray: 1, alpha: 1))
            previewContext.fill(CGRect(x: 0, y: 0, width: width, height: height))
            previewContext.saveGState()
            previewContext.translateBy(x: 0, y: CGFloat(height))
            previewContext.scaleBy(x: 1, y: -1)
            footprint.vectors.draw(in: previewContext)
            previewContext.restoreGState()
            let poster = footprint.vectors.svg()
            svg = """
            <svg xmlns="http://www.w3.org/2000/svg" width="\(image.width)" height="\(image.height)" viewBox="0 0 \(width) \(height)">
            <title>PosterLab Glass — vector poster</title>
            <desc>The poster's own vector artwork, with a \(paths.count)-color trace of the area the glass changes laid over it. Closed vector paths; no embedded bitmap.</desc>
            <defs>\(poster.defs)</defs>
            <g id="poster">
            <rect width="\(width)" height="\(height)" fill="#ffffff"/>
            \(poster.body)</g>
            <g id="glass">
            \(paths.joined(separator: "\n"))
            </g>
            </svg>
            """
        } else {
            let background = area.indices.max { area[$0] < area[$1] || (area[$0] == area[$1] && $0 > $1) }!
            // The background color sits under every region, so anti-aliased seams never show through.
            previewContext.setFillColor(cgColor(palette[background]))
            previewContext.fill(CGRect(x: 0, y: 0, width: width, height: height))
            svg = """
            <svg xmlns="http://www.w3.org/2000/svg" width="\(image.width)" height="\(image.height)" viewBox="0 0 \(width) \(height)">
            <title>PosterLab Glass — vector trace</title>
            <desc>Approximate \(paths.count)-color trace of the refracted poster. Neighbouring colors share each curved border; closed vector paths; no embedded bitmap.</desc>
            <rect width="\(width)" height="\(height)" fill="\(hex(palette[background]))"/>
            \(paths.joined(separator: "\n"))
            </svg>
            """
        }
        previewContext.draw(regions, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let preview = previewContext.makeImage() else { throw PosterError.render }
        let traced = mask.map { Double($0.lazy.filter { $0 }.count) / Double(width * height) } ?? 1
        return Result(svg: svg, pathCount: pathCount, colorCount: paths.count, preview: preview, gapPixels: gapPixels,
                      posterVectors: footprint != nil, tracedShare: traced, note: note)
    }

    // MARK: Glass footprint

    private struct Footprint {
        let vectors: GlassPosterVectors
        /// Pixels the glass changes: they show something other than the plain poster.
        let touched: [Bool]
        /// Pixels to trace: the changed area grown by a pixel, so smoothed outer edges fall on unchanged poster.
        let mask: [Bool]
    }

    private static func footprint(_ poster: Poster, width: Int, height: Int) throws -> Footprint {
        let vectors = try GlassPosterVectors(pdf: poster.pdf, width: Double(width), height: Double(height))
        var shares = [UInt8](repeating: 0, count: width * height)
        let drawn = shares.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
            context.interpolationQuality = .high
            context.draw(poster.coverage, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { throw PosterError.render }
        // Below about 1 % of samples the change cannot be seen.
        var touched = shares.map { $0 >= 3 }
        // A lone speck (a sample grazing a corner) is left to the poster; a small hole inside the glass is traced.
        flipSmallAreas(&touched, width: width, height: height, value: true, limit: 6, keepEdge: false)
        flipSmallAreas(&touched, width: width, height: height, value: false, limit: 24, keepEdge: true)
        var mask = touched
        for y in 0..<height {
            for x in 0..<width where touched[y * width + x] {
                for ny in max(0, y - 1)...min(height - 1, y + 1) {
                    for nx in max(0, x - 1)...min(width - 1, x + 1) { mask[ny * width + nx] = true }
                }
            }
        }
        return Footprint(vectors: vectors, touched: touched, mask: mask)
    }

    /// Flips 4-connected areas of `value` smaller than `limit` pixels. With `keepEdge`, areas that touch the
    /// image edge stay, so the open paper around the glass is never mistaken for a hole.
    private static func flipSmallAreas(_ cells: inout [Bool], width: Int, height: Int, value: Bool, limit: Int, keepEdge: Bool) {
        var seen = [Bool](repeating: false, count: cells.count), queue: [Int] = []
        for start in cells.indices where cells[start] == value && !seen[start] {
            queue.removeAll(keepingCapacity: true)
            queue.append(start)
            seen[start] = true
            var head = 0, edge = false
            while head < queue.count {
                let i = queue[head], x = i % width, y = i / width
                head += 1
                if x == 0 || y == 0 || x == width - 1 || y == height - 1 { edge = true }
                func visit(_ n: Int) { if !seen[n] && cells[n] == value { seen[n] = true; queue.append(n) } }
                if x > 0 { visit(i - 1) }
                if x < width - 1 { visit(i + 1) }
                if y > 0 { visit(i - width) }
                if y < height - 1 { visit(i + width) }
            }
            if queue.count < limit && !(keepEdge && edge) { for i in queue { cells[i] = !value } }
        }
    }

    // MARK: Specks

    /// Folds isolated single pixels (no 8-connected neighbour of the same color) into the most similar
    /// neighbouring color when the two are within about 45 levels, so render noise doesn't become thousands
    /// of tiny paths. Anything larger keeps its color: merging bigger areas erased strokes of small type.
    private static func mergeSpecks(_ labels: inout [Int], width: Int, height: Int, palette: [SIMD3<Double>],
                                    distance: (SIMD3<Double>, SIMD3<Double>) -> Double) {
        // Merging can leave a neighbour isolated in turn, so repeat a few times.
        for _ in 0..<3 {
            let source = labels
            var merged = false
            for y in 0..<height {
                for x in 0..<width {
                    let color = source[y * width + x]
                    guard color >= 0 else { continue }
                    var target = -1, closest = 45.0 * 45.0, isolated = true
                    for dy in -1...1 {
                        for dx in -1...1 where (dx != 0 || dy != 0) && isolated {
                            let nx = x + dx, ny = y + dy
                            guard nx >= 0, ny >= 0, nx < width, ny < height else { continue }
                            let neighbour = source[ny * width + nx]
                            if neighbour == color { isolated = false; continue }
                            if neighbour < 0 { continue }  // never hand a pixel to the vector poster
                            let d = distance(palette[color], palette[neighbour])
                            if d < closest || (d == closest && neighbour < target) { closest = d; target = neighbour }
                        }
                    }
                    if isolated && target >= 0 { labels[y * width + x] = target; merged = true }
                }
            }
            if !merged { break }
        }
    }

    // MARK: Shared borders

    /// A border along pixel edges between two labels (-1 is outside the poster). `left` is the label on the
    /// left when travelling from the first vertex to the last, with y running downward. Lattice vertices are
    /// `y * (width + 1) + x`. A cycle meets no other border; other chains end where three or more labels meet.
    private struct Chain {
        var vertices: [Int32]
        var left: Int
        var right: Int
        var cycle: Bool
    }

    private static func borders(_ labels: [Int], width: Int, height: Int) -> [Chain] {
        let columns = width + 1
        func label(_ x: Int, _ y: Int) -> Int { x >= 0 && y >= 0 && x < width && y < height ? labels[y * width + x] : -1 }
        func floorHalf(_ value: Int) -> Int { value >= 0 ? value / 2 : (value - 1) / 2 }
        // Horizontal edge (x, y)→(x + 1, y) divides the pixels above and below; vertical (x, y)→(x, y + 1) left and right.
        var horizontal = [Bool](repeating: false, count: width * (height + 1))
        var vertical = [Bool](repeating: false, count: columns * height)
        var degree = [UInt8](repeating: 0, count: columns * (height + 1))
        for y in 0...height {
            for x in 0..<width where label(x, y - 1) != label(x, y) {
                horizontal[y * width + x] = true
                degree[y * columns + x] += 1; degree[y * columns + x + 1] += 1
            }
        }
        for y in 0..<height {
            for x in 0...width where label(x - 1, y) != label(x, y) {
                vertical[y * columns + x] = true
                degree[y * columns + x] += 1; degree[(y + 1) * columns + x] += 1
            }
        }
        let verticalBase = horizontal.count
        var visited = [Bool](repeating: false, count: horizontal.count + vertical.count)
        // Edges at a vertex in a fixed order (east, south, west, north) so tracing is deterministic.
        func edges(at vertex: Int) -> [(edge: Int, to: Int)] {
            let x = vertex % columns, y = vertex / columns
            var result: [(edge: Int, to: Int)] = []
            if x < width, horizontal[y * width + x] { result.append((y * width + x, vertex + 1)) }
            if y < height, vertical[y * columns + x] { result.append((verticalBase + y * columns + x, vertex + columns)) }
            if x > 0, horizontal[y * width + x - 1] { result.append((y * width + x - 1, vertex - 1)) }
            if y > 0, vertical[(y - 1) * columns + x] { result.append((verticalBase + (y - 1) * columns + x, vertex - columns)) }
            return result
        }
        var chains: [Chain] = []
        func walk(from start: Int, along first: (edge: Int, to: Int), cycle: Bool) {
            visited[first.edge] = true
            var vertices: [Int32] = [Int32(start), Int32(first.to)]
            var current = first.to
            while current != start && degree[current] == 2,
                  let step = edges(at: current).first(where: { !visited[$0.edge] }) {
                visited[step.edge] = true
                current = step.to
                vertices.append(Int32(current))
            }
            // The pixels half a unit to the left and right of the first edge's midpoint (doubled coordinates).
            let ax = start % columns, ay = start / columns, dx = first.to % columns - ax, dy = first.to / columns - ay
            let mx = 2 * ax + dx, my = 2 * ay + dy
            chains.append(Chain(vertices: vertices, left: label(floorHalf(mx + dy), floorHalf(my - dx)),
                                right: label(floorHalf(mx - dy), floorHalf(my + dx)), cycle: cycle))
        }
        for vertex in degree.indices where degree[vertex] > 2 {
            for step in edges(at: vertex) where !visited[step.edge] { walk(from: vertex, along: step, cycle: false) }
        }
        // What remains are closed borders that touch no other border, such as an island inside one color.
        for vertex in degree.indices where degree[vertex] == 2 {
            if let step = edges(at: vertex).first(where: { !visited[$0.edge] }) { walk(from: vertex, along: step, cycle: true) }
        }
        return chains
    }

    /// Closed outlines of one color, as chains oriented with that color on their left. At a vertex where the
    /// color continues along several chains, the sharpest turn toward the color keeps 4-connected areas apart.
    private static func outlines(of color: Int, chains: [Chain]) -> [[(Int, Bool)]] {
        var oriented: [(chain: Int, reversed: Bool)] = []
        for (index, chain) in chains.enumerated() {
            if chain.left == color { oriented.append((index, false)) } else if chain.right == color { oriented.append((index, true)) }
        }
        func vertices(_ item: (chain: Int, reversed: Bool)) -> (first: Int32, second: Int32, beforeLast: Int32, last: Int32) {
            let v = chains[item.chain].vertices
            return item.reversed ? (v[v.count - 1], v[v.count - 2], v[1], v[0]) : (v[0], v[1], v[v.count - 2], v[v.count - 1])
        }
        var starting: [Int32: [Int]] = [:]
        for (index, item) in oriented.enumerated() { starting[vertices(item).first, default: []].append(index) }
        var used = [Bool](repeating: false, count: oriented.count)
        var loops: [[(Int, Bool)]] = []
        for origin in oriented.indices where !used[origin] {
            used[origin] = true
            var loop = [origin]
            if !chains[oriented[origin].chain].cycle {
                let start = vertices(oriented[origin]).first
                while true {
                    let end = vertices(oriented[loop.last!])
                    let incoming = end.last - end.beforeLast
                    var candidates = (starting[end.last] ?? []).filter { !used[$0] }
                    if end.last == start { candidates.append(origin) }
                    guard let next = candidates.max(by: { turn(incoming, vertices(oriented[$0]))  < turn(incoming, vertices(oriented[$1])) }),
                          next != origin else { break }
                    used[next] = true
                    loop.append(next)
                }
            }
            loops.append(loop.map { (oriented[$0].chain, oriented[$0].reversed) })
        }
        return loops
    }

    /// Preference for leaving a vertex along `outgoing` after arriving with lattice step `incoming`:
    /// left turn (toward the color) 3, straight 2, right 1, back 0.
    private static func turn(_ incoming: Int32, _ outgoing: (first: Int32, second: Int32, beforeLast: Int32, last: Int32)) -> Int {
        let step = outgoing.second - outgoing.first
        if step == incoming { return 2 }
        if step == -incoming { return 0 }
        // A left turn from east (+1) is north (-columns): incoming and outgoing differ in axis, so compare signs.
        let horizontalIn = abs(incoming) == 1
        let left = horizontalIn ? (incoming > 0) == (step < 0) : (incoming > 0) == (step > 0)
        return left ? 3 : 1
    }

    // MARK: Curves

    private struct Segment: Sendable {
        var c1: SIMD2<Double>
        var c2: SIMD2<Double>
        var end: SIMD2<Double>
        /// Both ends are corners, so the segment is written as a line.
        var straight = false
    }

    private struct Curve {
        var start: SIMD2<Double>
        var segments: [Segment]
        var end: SIMD2<Double> { segments.last?.end ?? start }
        /// The same curve traced from its end back to its start.
        var reversed: [Segment] {
            var result: [Segment] = []
            for index in segments.indices.reversed() {
                let from = index > 0 ? segments[index - 1].end : start
                result.append(Segment(c1: segments[index].c2, c2: segments[index].c1, end: from, straight: segments[index].straight))
            }
            return result
        }
    }

    /// Replaces pixel staircases with the midpoints of their unit edges, keeps square corners (a turn with
    /// two straight edges on each side) and the chain's end vertices, then drops points within half a pixel
    /// of the line.
    private static func smooth(_ points: [SIMD2<Double>], cycle: Bool) -> [SIMD2<Double>] {
        let steps = (0..<(points.count - 1)).map { points[$0 + 1] - points[$0] }
        let n = steps.count
        func step(_ i: Int) -> SIMD2<Double>? { cycle ? steps[(i % n + n) % n] : (steps.indices.contains(i) ? steps[i] : nil) }
        var result: [SIMD2<Double>] = cycle ? [] : [points[0]]
        for i in 0..<n {
            if i > 0 || cycle, let before = step(i - 1), before != steps[i] {
                let square = (step(i - 2).map { $0 == before } ?? true) && (step(i + 1).map { $0 == steps[i] } ?? true)
                if square { result.append(points[i]) }
            }
            result.append(points[i] + steps[i] / 2)
        }
        if !cycle { result.append(points[n]); return simplify(result, tolerance: 0.5) }
        guard result.count > 4 else { return result }
        let middle = result.count / 2
        return Array(simplify(Array(result[0...middle]), tolerance: 0.5).dropLast())
            + simplify(Array(result[middle...] + [result[0]]), tolerance: 0.5).dropLast()
    }

    /// Cubic segments through the points: Catmull-Rom tangents where the outline bends gently, sharp corners
    /// where it turns by more than about 55° and at chain ends, where three or more colors meet.
    private static func fit(_ points: [SIMD2<Double>], cycle: Bool) -> Curve {
        let n = points.count
        func point(_ i: Int) -> SIMD2<Double> { points[(i % n + n) % n] }
        let tangents = (0..<n).map { i -> SIMD2<Double> in
            if !cycle && (i == 0 || i == n - 1) { return .zero }
            let before = point(i) - point(i - 1), after = point(i + 1) - point(i)
            let lengths = (before * before).sum().squareRoot() * (after * after).sum().squareRoot()
            guard lengths > 0, (before * after).sum() / lengths > 0.57 else { return .zero }
            return (point(i + 1) - point(i - 1)) / 2
        }
        let count = cycle ? n : n - 1
        let segments = (0..<count).map { i in
            Segment(c1: point(i) + tangents[i] / 3, c2: point(i + 1) - tangents[(i + 1) % n] / 3, end: point(i + 1),
                    straight: tangents[i] == .zero && tangents[(i + 1) % n] == .zero)
        }
        return Curve(start: points[0], segments: segments)
    }

    private static func simplify(_ points: [SIMD2<Double>], tolerance: Double) -> [SIMD2<Double>] {
        guard points.count > 2 else { return points }
        // Iterative RDP avoids stack overflow on large or noisy contours.
        var keep = Set([0, points.count - 1]), stack = [(0, points.count - 1)]
        while let (first, last) = stack.popLast() {
            guard last > first + 1 else { continue }
            let a = points[first], b = points[last], d = b - a
            let length2 = (d * d).sum()
            var furthest = first, maximum = tolerance * tolerance
            for i in (first + 1)..<last {
                let p = points[i] - a
                let t = length2 == 0 ? 0 : max(0, min(1, (p * d).sum() / length2))
                let e = p - t * d
                let distance = (e * e).sum()
                if distance > maximum { maximum = distance; furthest = i }
            }
            if furthest > first {
                keep.insert(furthest); stack.append((first, furthest)); stack.append((furthest, last))
            }
        }
        return keep.sorted().map { points[$0] }
    }

    // MARK: Output

    /// Tenths of a trace pixel. Both colors along a border write identical numbers, so rounding never opens a crack.
    private static func number(_ value: Double) -> String {
        let tenths = Int((value * 10).rounded())
        let sign = tenths < 0 ? "-" : "", magnitude = abs(tenths)
        return sign + String(magnitude / 10) + (magnitude % 10 == 0 ? "" : "." + String(magnitude % 10))
    }

    private static func hex(_ rgb: SIMD3<Double>) -> String {
        String(format: "#%02x%02x%02x", min(255, Int(rgb.x.rounded())), min(255, Int(rgb.y.rounded())), min(255, Int(rgb.z.rounded())))
    }

    private static func cgColor(_ rgb: SIMD3<Double>) -> CGColor {
        CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [rgb.x / 255, rgb.y / 255, rgb.z / 255, 1])!
    }
}
