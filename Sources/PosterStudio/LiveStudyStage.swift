import SwiftUI

/// Motion for the live stage. Strong ease-out for things arriving, strong ease-in-out for things
/// moving on screen, nothing from scale 0, short staggers, no bounce.
enum StageMotion {
    static let enter = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.32)
    static let reveal = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.5)
    static let move = Animation.timingCurve(0.77, 0, 0.175, 1, duration: 0.48)
    static let fade = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.2)
    static let fill = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.6)
    static func stagger(_ index: Int) -> Double { Double(index) * 0.045 }
}

/// A running source study, reduced to the posters: one line of type, the round's field,
/// and a hairline of progress along the top edge.
struct LiveStudyStage: View {
    let live: LiveStudy
    var openResults: () -> Void
    var close: () -> Void

    static let paper = Color(red: 0.055, green: 0.055, blue: 0.06)
    static let ink = Color(red: 0.93, green: 0.92, blue: 0.89)
    static let accent = Color(red: 0.95, green: 0.33, blue: 0.2)
    private var ink: Color { Self.ink }

    var body: some View {
        ZStack(alignment: .top) {
            Self.paper
            VStack(alignment: .leading, spacing: 0) {
                header.padding(.horizontal, 32).padding(.top, 26)
                field.padding(.horizontal, 32).padding(.vertical, 24)
            }
            progress
            // A finished study ends on its winners; a stopped one keeps the small notice.
            if live.phase == .complete {
                WinnersView(folder: live.resultURL, allRounds: openResults, close: close)
                    .transition(.opacity.animation(StageMotion.reveal))
            } else if live.phase == .stopped {
                finished.frame(maxHeight: .infinity)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)).animation(StageMotion.enter))
            }
        }
        .foregroundStyle(ink)
        .environment(\.colorScheme, .dark)
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.system(size: 10.5, weight: .semibold, design: .monospaced)).tracking(1.4)
    }

    private var header: some View {
        HStack {
            label("\(live.direction.uppercased())   \(live.round + 1) / \(live.rounds)")
                .contentTransition(.numericText())
            Spacer()
            label(live.phase == .judging || live.phase == .verdict ? "JUDGING" : "")
                .foregroundStyle(Self.accent).contentTransition(.opacity)
        }
        .animation(StageMotion.fade, value: live.phase)
        .animation(StageMotion.fade, value: live.round)
    }

    // Posters sized so the whole round fits the window: two rows, as wide as the height allows.
    private var field: some View {
        GeometryReader { space in
            let columns = max(2, min(6, (live.count + 1) / 2)), rows = Int(ceil(Double(live.count) / Double(columns)))
            let gap = 20.0, under = 9.0
            let byHeight = ((space.size.height - Double(rows - 1) * gap) / Double(rows) - under) / live.aspect
            let width = max(40, min((space.size.width - Double(columns - 1) * gap) / Double(columns), byHeight))
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(width), spacing: gap, alignment: .top), count: columns), spacing: gap) {
                ForEach(Array(live.ranked.enumerated()), id: \.element.id) { position, card in
                    LiveCard(card: card, phase: live.phase, isWinner: card.rank == 1, order: position)
                        .transition(.asymmetric(insertion: .modifier(active: Arrival(progress: 0), identity: Arrival(progress: 1)),
                                                removal: .opacity.animation(StageMotion.fade)))
                }
            }
            .frame(width: space.size.width, alignment: .center)
            .animation(StageMotion.move, value: live.phase)
        }
    }

    // Progress through every round of every direction, as one hairline along the top edge.
    private var progress: some View {
        GeometryReader { bar in
            Rectangle().fill(Self.accent)
                .frame(width: bar.size.width * Double(live.completedRounds) / Double(max(1, live.totalRounds)), height: 1)
        }
        .frame(height: 1)
        .animation(StageMotion.fill, value: live.completedRounds)
    }

    private var finished: some View {
        VStack(spacing: 16) {
            label(live.phase == .complete ? "STUDY COMPLETE" : "STUDY STOPPED")
            HStack(spacing: 8) {
                Button("Back", action: close)
                Button("Results", action: openResults).keyboardShortcut(.defaultAction)
            }
            .buttonStyle(StageButton())
        }
        .padding(28)
        .background(Self.paper)
    }
}

/// Arriving content: from slightly small, slightly low and a touch soft, never from nothing.
/// With Reduce Motion it only fades.
private struct Arrival: ViewModifier {
    var progress: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func body(content: Content) -> some View {
        let motion = reduceMotion ? 0 : 1 - progress
        return content.opacity(progress).blur(radius: motion * 4).scaleEffect(1 - 0.04 * motion, anchor: .bottom).offset(y: motion * 8)
    }
}

/// Press feedback: scales down slightly while held, quick ease-out on release.
private struct StageButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 10.5, weight: .semibold, design: .monospaced)).tracking(1.2)
            .textCase(.uppercase)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .overlay { Rectangle().strokeBorder(LiveStudyStage.ink.opacity(0.35), lineWidth: 1) }
            .contentShape(.rect)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}

private struct LiveCard: View {
    let card: LiveStudy.Card
    let phase: LiveStudy.Phase
    let isWinner: Bool
    let order: Int
    @State private var revealed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var settled: Bool { phase == .verdict || phase == .complete }
    private var ink: Color { LiveStudyStage.ink }
    private var accent: Color { LiveStudyStage.accent }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // The poster prints in from the top, like a sheet leaving the press.
            Group {
                if let image = card.image { Image(nsImage: image).resizable().aspectRatio(contentMode: .fit) }
                else { Rectangle().fill(ink.opacity(0.06)).aspectRatio(1 / 1.414, contentMode: .fit) }
            }
            .mask(alignment: .top) {
                GeometryReader { proxy in Rectangle().frame(height: revealed ? proxy.size.height : 0) }
            }
            .overlay { Rectangle().strokeBorder(accent, lineWidth: 1.5).opacity(isWinner && settled ? 1 : 0) }
            // Consensus: a hairline that fills as the jury's votes come back.
            GeometryReader { bar in
                Rectangle().fill(ink.opacity(0.1)).overlay(alignment: .leading) {
                    Rectangle().fill(isWinner && settled ? accent : ink.opacity(0.8)).frame(width: bar.size.width * min(1, card.consensus / 100))
                }
            }
            .frame(height: 1)
            .opacity(phase == .drawing ? 0 : 1)
        }
        .opacity(settled && !isWinner ? 0.32 : 1)
        .animation(StageMotion.move.delay(settled ? StageMotion.stagger(order) : 0), value: settled)
        .onAppear { if reduceMotion { revealed = true } else { withAnimation(StageMotion.reveal) { revealed = true } } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(card.rank.map { "Rank \($0)" } ?? "Candidate")
    }
}
