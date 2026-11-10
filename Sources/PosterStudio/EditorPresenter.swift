import SwiftUI

/// Opens the poster editor over the whole window, from wherever a winner is chosen.
@MainActor @Observable
final class EditorPresenter {
    var winner: StudyWinner?
    func open(_ winner: StudyWinner) { self.winner = winner }
    func close() { winner = nil }
}

private struct EditorPresenterKey: EnvironmentKey { nonisolated(unsafe) static let defaultValue: EditorPresenter? = nil }
extension EnvironmentValues {
    var editorPresenter: EditorPresenter? {
        get { self[EditorPresenterKey.self] }
        set { self[EditorPresenterKey.self] = newValue }
    }
}
