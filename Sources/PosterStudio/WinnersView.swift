import SwiftUI

/// What a finished study ends on: its winners, large, on the stage's dark paper. Click one to
/// edit it; the round-by-round results stay one step away.
struct WinnersView: View {
    let folder: URL
    var allRounds: () -> Void
    var close: () -> Void
    @State private var winners: [StudyWinner] = []
    @State private var editing: StudyWinner?
    @Environment(\.editorPresenter) private var presenter
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let ink = LiveStudyStage.ink
    private let accent = LiveStudyStage.accent

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 18) {
                label(winners.count == 1 ? "WINNER" : "\(winners.count) WINNERS")
                Text("Click a poster to edit it").font(.system(size: 11)).foregroundStyle(ink.opacity(0.45))
                Spacer()
                Button("All rounds", action: allRounds)
                Button("Close", action: close)
            }
            .buttonStyle(WinnerButton()).padding(.horizontal, 32).frame(height: 56)
            GeometryReader { space in
                layout(in: space.size)
            }
            .padding(.horizontal, 32).padding(.bottom, 28)
        }
        .foregroundStyle(ink)
        .background(LiveStudyStage.paper)
        .environment(\.colorScheme, .dark)
        .task {
            winners = StudyWinner.load(folder)
            withAnimation(StageMotion.reveal) { shown = true }
        }
        .sheet(item: $editing) { winner in ScenePosterEditor(winner: winner, done: { editing = nil }).frame(minWidth: 1100, minHeight: 760) }
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.system(size: 10.5, weight: .semibold, design: .monospaced)).tracking(1.4)
    }

    // One winner fills the height beside its finalists; many winners share an even grid.
    @ViewBuilder private func layout(in size: CGSize) -> some View {
        if winners.count <= 4, let first = winners.first { heroLayout(first, size: size) } else { gridLayout(size: size) }
    }
    private func heroLayout(_ first: StudyWinner, size: CGSize) -> some View {
        let aspect = first.genome.aspect
        let heroWidth: Double = min(size.width * 0.5, (size.height - 30) / aspect)
        let sideWidth: Double = min(size.width * 0.18, size.height * 0.55 / aspect)
        let rest = Array(winners.dropFirst().enumerated())
        return HStack(alignment: .bottom, spacing: 24) {
            card(first, index: 0, width: heroWidth, hero: true)
            ForEach(rest, id: \.element.id) { item in card(item.element, index: item.offset + 1, width: sideWidth, hero: false) }
            Spacer(minLength: 0)
        }
    }
    private func gridLayout(size: CGSize) -> some View {
        let aspect = winners.first?.genome.aspect ?? 1.414
        let columns = max(1, Int(ceil(Double(winners.count) / 2)))
        let byWidth: Double = (size.width - Double(columns - 1) * 16) / Double(columns)
        let byHeight: Double = ((size.height - 16) / 2 - 24) / aspect
        let width = min(byWidth, byHeight)
        let items = Array(winners.enumerated())
        return LazyVGrid(columns: Array(repeating: GridItem(.fixed(width), spacing: 16, alignment: .top), count: columns), alignment: .leading, spacing: 16) {
            ForEach(items, id: \.element.id) { item in card(item.element, index: item.offset, width: width, hero: false) }
        }
    }

    private func card(_ winner: StudyWinner, index: Int, width: Double, hero: Bool) -> some View {
        Button { if let presenter { presenter.open(winner) } else { editing = winner } } label: {
            VStack(alignment: .leading, spacing: 8) {
                LibraryThumbnail(url: winner.imageURL).frame(width: width, height: width * winner.genome.aspect)
                    .overlay { Rectangle().strokeBorder(accent, lineWidth: 1.5).opacity(hero ? 1 : 0) }
                label(winner.label.uppercased()).foregroundStyle(hero ? accent : ink.opacity(0.6))
            }
            .contentShape(.rect)
        }
        .buttonStyle(Lift())
        .opacity(shown ? 1 : 0)
        .offset(y: shown || reduceMotion ? 0 : 10)
        .animation(StageMotion.reveal.delay(StageMotion.stagger(index)), value: shown)
        .accessibilityLabel("Edit \(winner.label)")
    }
}

/// Posters press in slightly, like the stage's buttons.
private struct Lift: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}

private struct WinnerButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 10.5, weight: .semibold, design: .monospaced)).tracking(1.2).textCase(.uppercase)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .overlay { Rectangle().strokeBorder(LiveStudyStage.ink.opacity(0.3), lineWidth: 1) }
            .contentShape(.rect)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.16), value: configuration.isPressed)
    }
}
