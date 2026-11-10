import SwiftUI
import PosterCore

/// One judged variation of the selection.
struct TweakVariation: Identifiable {
    let id: Int
    let genome: StyleGenome
    let image: NSImage?
    let rank: Int
    /// The rest of the poster answered the change too.
    let aware: Bool
    var isCurrent: Bool { id == 0 }
}

/// What one version changed, as outlines in page units: the selection, and the elements around it that responded.
struct TweakGhost {
    var targets: [[CGPoint]]
    var context: [[CGPoint]]
}

// Tweak: the selected elements are varied a dozen ways behind the scenes (position, size,
// rotation, colour from the poster's own palette), every version is drawn and put to the
// same jury as the studies, and the winner replaces the selection. Half the versions are aware of
// the whole poster: neighbours make room, the composition rebalances, other type follows the new
// angle or steps back in scale. The runners-up stay one click away.
extension ScenePosterEditorModel {
    static let tweakCount = 11

    var targets: [Int] {
        let chosen = group.isEmpty ? (selected.map { [$0] } ?? []) : Array(group)
        return chosen.isEmpty ? plain.elements.indices.filter { isDisplay(plain.elements[$0]) && (plain.elements[$0].minimumStage ?? 0) < 99 } : chosen.sorted()
    }

    func tweak() async {
        guard !tweaking else { return }
        let targets = targets
        guard !targets.isEmpty else { return }
        tweaking = true; tweakDone = 0; tweakTotal = Self.tweakCount + 1; variations = []; ghosts = []
        tweakOutline = targets.map { unitQuad(plain.elements[$0], in: plain) }
        defer { tweaking = false }
        var palette = Array(Set([plain.background] + plain.elements.filter { $0.kind != "image" && $0.kind != "vector" }.map(\.color))).prefix(6).map { $0 }
        if palette.isEmpty { palette = ["#111111"] }
        var rng = SeededRandom(seed: seed &+ UInt64(Date().timeIntervalSince1970 * 10))
        var scenes = [plain], awareness = [false]
        for _ in 0..<Self.tweakCount {
            var v = plain
            // A group moves and scales together half the time, so its internal layout survives.
            let together = targets.count > 1 && rng.unit() < 0.5
            let shared = (dx: rng.value(-0.04, 0.04), dy: rng.value(-0.04, 0.04), s: rng.value(0.86, 1.18), r: rng.unit() < 0.3 ? rng.value(-6, 6) : 0)
            let boxes = targets.map { v.elements[$0].bounds }
            let gx = ((boxes.map(\.x).min() ?? 0) + (boxes.map { $0.x + $0.width }.max() ?? 1)) / 2
            let gy = ((boxes.map(\.y).min() ?? 0) + (boxes.map { $0.y + $0.height }.max() ?? 1)) / 2
            for i in targets {
                var e = v.elements[i]
                let t = together ? shared : (dx: rng.value(-0.035, 0.035), dy: rng.value(-0.035, 0.035), s: rng.value(0.86, 1.18), r: rng.unit() < 0.3 ? rng.value(-6, 6) : 0)
                var b = e.bounds
                let cx = together ? gx + (b.x + b.width / 2 - gx) * t.s : b.x + b.width / 2
                let cy = together ? gy + (b.y + b.height / 2 - gy) * t.s : b.y + b.height / 2
                b = .init(x: cx - b.width * t.s / 2 + t.dx, y: cy - b.height * t.s / 2 + t.dy, width: b.width * t.s, height: b.height * t.s)
                // Keep each element's centre on the page.
                b.x = min(0.95 - b.width / 2, max(0.05 - b.width / 2, b.x)); b.y = min(0.95 - b.height / 2, max(0.05 - b.height / 2, b.y))
                e.bounds = b
                if let em = e.typeEmSize { e.typeEmSize = em * t.s }
                e.rotation += t.r
                let swaps = palette.filter { $0.lowercased() != e.color.lowercased() && $0.lowercased() != v.background.lowercased() }
                if rng.unit() < 0.2, !swaps.isEmpty { e.color = swaps[rng.int(swaps.count)] }
                v.elements[i] = e
            }
            let aware = rng.unit() < 0.5
            let moved = aware ? respond(&v, to: Set(targets), rng: &rng) : []
            scenes.append(v); awareness.append(aware)
            let outline = TweakGhost(targets: targets.map { unitQuad(v.elements[$0], in: v) }, context: moved.map { unitQuad(v.elements[$0], in: v) })
            withAnimation(StageMotion.enter) { ghosts.append(outline) }
            // Let the frame draw between versions, so the outlines appear one by one.
            await Task.yield()
        }
        // Draw and judge in the background at low priority, one version at a time, so the rest of
        // the Mac stays responsive; the jury is loaded once per launch and shared.
        let folder = FileManager.default.temporaryDirectory.appending(path: "posterlab-tweak-\(UUID().uuidString.prefix(6))", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        var images: [Int: (URL, NSImage)] = [:]
        let seed = seed
        for (n, scene) in scenes.enumerated() {
            let url = folder.appending(path: "v\(n).png")
            let image = await Task.detached(priority: .utility) { () -> CGImage? in
                guard let image = try? LibrarySceneRenderer.render(scene, width: 520, seed: seed) else { return nil }
                try? PosterRenderer.png(image, to: url)
                return image
            }.value
            if let image { images[n] = (url, NSImage(cgImage: image, size: NSSize(width: image.width, height: image.height))) }
            withAnimation(StageMotion.fade) { tweakDone += 1 }
        }
        let judged = scenes.indices.compactMap { n in images[n].map { (n, $0.0) } }
        let inputs = judged.map { (image: $0.1, scene: scenes[$0.0]) }
        do {
            let verdicts = try await Task.detached(priority: .utility) { try await TweakJury.engine().rankVariations(inputs) }.value
            let ranked = verdicts.compactMap { verdict -> TweakVariation? in
                let n = judged[verdict.index].0
                return TweakVariation(id: n, genome: scenes[n], image: images[n]?.1, rank: verdict.rank, aware: awareness[n])
            }
            withAnimation(StageMotion.fade) { ghosts = [] }
            // The jury's pick is shown at once but not kept: compare with the arrows, keep with Return.
            tweakBase = plain
            withAnimation(StageMotion.enter) { variations = Array(ranked.prefix(6)); previewing = 0 }
            if let best = variations.first { plain = best.genome; previewVersion += 1; refresh() }
            message = "Jury pick of \(scenes.count) · ← → compare · Return keeps · Esc reverts"
        } catch {
            withAnimation(StageMotion.fade) { ghosts = [] }
            message = error.localizedDescription
        }
    }

    /// Shows one of the judged versions without keeping it.
    func preview(_ index: Int) {
        guard variations.indices.contains(index), index != previewing else { return }
        previewing = index; plain = variations[index].genome; previewVersion += 1; refresh()
    }
    func choose(_ variation: TweakVariation) { if let i = variations.firstIndex(where: { $0.id == variation.id }) { preview(i) } }
    /// Keeps the version on screen; one Undo returns to the poster before the tweak.
    func acceptTweak() {
        guard let base = tweakBase else { return }
        history.append((base, stack)); future = []; tweakBase = nil
        withAnimation(StageMotion.fade) { variations = [] }
        message = "Kept"
    }
    /// Puts the poster back as it was before the tweak.
    func cancelTweak() {
        guard let base = tweakBase else { return }
        plain = base; tweakBase = nil; previewVersion += 1; refresh()
        withAnimation(StageMotion.fade) { variations = [] }
        message = nil
    }
}

/// The tweak jury, loaded once per launch (its Core ML models take a moment) and shared by every editor.
enum TweakJury {
    private static let loading = Task(priority: .utility) { try await EvolutionEngine.make() }
    static func engine() async throws -> EvolutionEngine { try await loading.value }
    /// Starts loading in the background, so the first tweak doesn't wait for it.
    static func prewarm() { Task.detached(priority: .background) { _ = try? await engine() } }
}

/// The versions being tried, as faint dashed outlines over the poster: the jury's search made visible.
/// The selection is dashed in the accent; neighbours that responded are dashed in white.
/// Geometry arrives precomputed, so redrawing costs nothing while the jury works.
struct TweakGhosts: View {
    let ghosts: [TweakGhost]
    let size: CGSize
    private func path(_ quads: [[CGPoint]]) -> Path {
        Path { p in for q in quads { p.addLines(q.map { CGPoint(x: $0.x * size.width, y: $0.y * size.height) }); p.closeSubpath() } }
    }
    var body: some View {
        ZStack {
            ForEach(Array(ghosts.enumerated()), id: \.offset) { _, ghost in
                ZStack {
                    path(ghost.context).stroke(.white.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [2, 4]))
                    path(ghost.targets).stroke(LiveStudyStage.accent.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .allowsHitTesting(false)
        .drawingGroup()
    }
}

/// The selection while the jury works: a dashed outline that keeps moving (constant motion, so linear).
struct MarchingOutline: View {
    let quads: [[CGPoint]]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let phase = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate * 24
            Path { p in for q in quads { p.addLines(q); p.closeSubpath() } }
                .stroke(LiveStudyStage.accent, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4], dashPhase: -phase))
        }
        .allowsHitTesting(false)
    }
}

/// The jury's ranking of the last tweak, under the poster; click one to use it.
struct TweakStrip: View {
    let variations: [TweakVariation]
    let previewing: Int
    var choose: (TweakVariation) -> Void
    var accept: () -> Void
    var cancel: () -> Void
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ForEach(Array(variations.enumerated()), id: \.element.id) { n, v in
                Button { choose(v) } label: {
                    VStack(spacing: 4) {
                        Group {
                            if let image = v.image { Image(nsImage: image).resizable().scaledToFit() } else { Rectangle().fill(.quaternary) }
                        }
                        .frame(height: 86)
                        .overlay { Rectangle().strokeBorder(n == previewing ? LiveStudyStage.accent : Color.white.opacity(0.25), lineWidth: n == previewing ? 1.5 : 1) }
                        .scaleEffect(n == previewing ? 1.04 : 1, anchor: .bottom)
                        .animation(StageMotion.enter, value: previewing)
                        Text(v.isCurrent ? "BEFORE" : String(format: "%02d", v.rank) + (v.aware ? " · LAYOUT" : ""))
                            .font(.system(size: 9.5, weight: .semibold, design: .monospaced)).tracking(1)
                            .foregroundStyle(n == previewing ? LiveStudyStage.accent : .white.opacity(0.7))
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(TilePress())
                .opacity(shown ? 1 : 0)
                .offset(y: shown || reduceMotion ? 0 : 8)
                .animation(StageMotion.enter.delay(StageMotion.stagger(n)), value: shown)
                .help(v.isCurrent ? "The poster before this tweak" : "Rank \(v.rank) of the jury" + (v.aware ? "; the rest of the poster moved with it" : ""))
            }
            VStack(spacing: 6) {
                Button("OK", action: accept).buttonStyle(StripButton(prominent: true)).help("Keep this version (Return)")
                Button("Cancel", action: cancel).buttonStyle(StripButton(prominent: false)).help("Back to the poster before the tweak (Esc)")
                Text("← →").font(.system(size: 9.5, design: .monospaced)).foregroundStyle(.white.opacity(0.45))
            }
            .padding(.leading, 4)
        }
        .padding(10)
        .background(.black.opacity(0.72), in: .rect(cornerRadius: 6))
        .onAppear { shown = true }
    }
}

/// Crossfade between poster states; a touch of blur bridges the two so it reads as one change.
struct BlurFade: ViewModifier {
    var progress: Double
    func body(content: Content) -> some View { content.opacity(progress).blur(radius: (1 - progress) * 3) }
}

extension ScenePosterEditorModel {
    /// An element's outline in page units: the ink box rotated about the element's centre,
    /// with the page's proportions taken into account.
    func unitQuad(_ e: SceneElement, in scene: StyleGenome) -> [CGPoint] {
        var box = e.bounds
        if e.kind == "text" && e.preserveTypeProportions == true { var upright = e; upright.rotation = 0; box = CompositionJudges.inkBounds(upright, genome: scene) }
        let a = e.rotation * .pi / 180, k = scene.aspect
        let cx = e.bounds.x + e.bounds.width / 2, cy = (e.bounds.y + e.bounds.height / 2) * k
        return [(box.x, box.y), (box.x + box.width, box.y), (box.x + box.width, box.y + box.height), (box.x, box.y + box.height)].map { p in
            let dx = p.0 - cx, dy = p.1 * k - cy
            return CGPoint(x: cx + dx * cos(a) - dy * sin(a), y: (cy + dx * sin(a) + dy * cos(a)) / k)
        }
    }
}

/// Runs the effector engine on its own thread, one job at a time, so editing never waits on it.
actor ModifierWorker {
    private var pass: ModifierPass?
    func apply(_ scene: StyleGenome, stackJSON: String, displayIDs: Set<String>, seed: UInt64, to url: URL) -> Result<StyleGenome, Error> {
        do {
            if pass == nil { pass = try ModifierPass() }
            return .success(try pass!.applyStack(scene, stackJSON: stackJSON, displayIDs: displayIDs, seed: seed, to: url))
        } catch { return .failure(error) }
    }
}

extension ScenePosterEditorModel {
    /// Lets the rest of the poster answer a change to `targets`. Returns the indices it moved.
    /// The information block moves as one unit, so its lines never come apart.
    func respond(_ v: inout StyleGenome, to targets: Set<Int>, rng: inout SeededRandom) -> [Int] {
        func isInfo(_ e: SceneElement) -> Bool { e.sourceElementID.hasPrefix("meta:") || e.sourceElementID.hasPrefix("title:source-info") || e.sourceElementID.contains("information-paper") }
        let visible = v.elements.indices.filter { !targets.contains($0) && selectable(v.elements[$0]) }
        let info = visible.filter { isInfo(v.elements[$0]) }
        var units: [[Int]] = visible.filter { !isInfo(v.elements[$0]) }.map { [$0] }
        if !info.isEmpty { units.append(info) }
        func box(_ indices: [Int]) -> CGRect { indices.map { v.elements[$0].bounds.rect }.reduce(CGRect.null) { $0.union($1) } }
        func shift(_ unit: [Int], _ dx: Double, _ dy: Double) {
            let b = box(unit)
            // Keep the unit on the page.
            let x = min(0.97 - b.maxX, max(0.03 - b.minX, dx)), y = min(0.97 - b.maxY, max(0.03 - b.minY, dy))
            for i in unit { v.elements[i].bounds.x += x; v.elements[i].bounds.y += y }
        }
        var moved = Set<Int>()
        let target = targets.map { v.elements[$0].bounds.rect }.reduce(CGRect.null) { $0.union($1) }
        // 1. Make room: anything the selection now covers steps away from it.
        for unit in units {
            let b = box(unit), overlap = b.intersection(target)
            guard !overlap.isNull, overlap.width * overlap.height > 0.08 * b.width * b.height else { continue }
            let away = (x: b.midX - target.midX, y: b.midY - target.midY), length = max(0.0001, hypot(away.x, away.y))
            let step = min(0.14, max(overlap.width, overlap.height) * 0.9)
            shift(unit, away.x / length * step, away.y / length * step)
            moved.formUnion(unit)
        }
        // 2. Rebalance: if the ink leans to one side, one other element moves toward the empty side.
        if rng.unit() < 0.5 {
            let all = v.elements.indices.filter { selectable(v.elements[$0]) }
            let mass = all.reduce(0.0) { $0 + v.elements[$1].bounds.width * v.elements[$1].bounds.height }
            let cx = all.reduce(0.0) { $0 + (v.elements[$1].bounds.x + v.elements[$1].bounds.width / 2) * v.elements[$1].bounds.width * v.elements[$1].bounds.height } / max(0.0001, mass)
            let candidates = units.filter { $0.count == 1 }
            if abs(cx - 0.5) > 0.05, !candidates.isEmpty {
                let unit = candidates[rng.int(candidates.count)]
                shift(unit, (0.5 - cx) * rng.value(0.6, 1.4), 0); moved.formUnion(unit)
            }
        }
        // 3. Follow: other display type takes the selection's angle, or steps back so the selection leads.
        let others = units.filter { $0.count == 1 && isDisplay(v.elements[$0[0]]) }.map { $0[0] }
        if let lead = targets.first, !others.isEmpty {
            if rng.unit() < 0.3 {
                let i = others[rng.int(others.count)]; v.elements[i].rotation = v.elements[lead].rotation; moved.insert(i)
            } else if rng.unit() < 0.4 {
                for i in others {
                    var b = v.elements[i].bounds, f = 0.9
                    b = .init(x: b.x + b.width * (1 - f) / 2, y: b.y + b.height * (1 - f) / 2, width: b.width * f, height: b.height * f)
                    v.elements[i].bounds = b
                    if let em = v.elements[i].typeEmSize { v.elements[i].typeEmSize = em * f }
                }
                moved.formUnion(others)
            }
        }
        return moved.sorted()
    }
}

private struct StripButton: ButtonStyle {
    let prominent: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(1).textCase(.uppercase)
            .frame(width: 64).padding(.vertical, 5)
            .foregroundStyle(.white)
            .background(prominent ? LiveStudyStage.accent : Color.white.opacity(0.08))
            .overlay { Rectangle().strokeBorder(.white.opacity(prominent ? 0 : 0.3), lineWidth: 1) }
            .contentShape(.rect)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}
