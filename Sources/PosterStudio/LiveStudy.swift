import SwiftUI
import PosterCore

/// Replays a running source study's events at a watchable pace: candidates draw in one by one,
/// the jury's scores fill, the ranking settles and the winner carries into the next round.
@MainActor @Observable
final class LiveStudy {
    enum Phase { case drawing, judging, verdict, complete, stopped }
    struct Card: Identifiable {
        let id: String
        let image: NSImage?
        let modifiers: [String]
        let retained: Bool
        var rank: Int?
        var consensus = 0.0
        var votes: [(String, Double)] = []
    }
    struct Direction: Identifiable {
        let id: String
        var winner: NSImage?
        var done = false
    }

    var directions: [Direction] = StyleCatalog.categories.map { Direction(id: $0.name) }
    var direction = ""
    var directionIndex = 0
    var round = 0
    var rounds = 5
    var count = 8
    var graphic: NSImage?
    var cards: [Card] = []
    var phase = Phase.drawing
    var champion: Card?
    var lineage: [NSImage] = []
    var drawn = 0
    var judged = 0
    /// Every event of the finished study has been shown.
    var caughtUp = false
    let resultURL: URL

    private var playback: Task<Void, Never>?

    init(resultURL: URL, events: AsyncStream<SourceStudyEvent>, directions names: [String]? = nil) {
        self.resultURL = resultURL
        if let names { directions = names.map { Direction(id: $0) } }
        playback = Task { [weak self] in
            for await event in events {
                guard let self else { return }
                await self.play(event)
            }
            self?.caughtUp = true
        }
    }

    /// The events of a saved source study, in order, so a finished study can be watched again.
    static func replay(_ folder: URL) -> (events: AsyncStream<SourceStudyEvent>, directions: [String]) {
        let (stream, feed) = AsyncStream.makeStream(of: SourceStudyEvent.self)
        // A saved image study: one direction, the image as its graphic.
        if let study = try? JSONDecoder().decode(ImagePosterStudyResult.self, from: Data(contentsOf: folder.appending(path: "image-study.json"))) {
            let name = "Image study"
            feed.yield(.direction(index: 0, total: 1, name: name, rounds: study.rounds.count, count: study.rounds.first?.candidates.count ?? 15, graphic: study.profile.asset.url))
            for round in study.rounds {
                for (i, c) in round.candidates.enumerated() {
                    feed.yield(.candidate(direction: name, round: round.number, index: i, id: c.id, image: c.imageURL, modifiers: [], retained: c.role == "retained"))
                }
                feed.yield(.judged(direction: name, round: round.number, ranking: round.judging.results.map {
                    SourceStudyVerdict(id: $0.id, rank: $0.rank, consensus: $0.consensus, votes: $0.votes.sorted { $0.value > $1.value }.prefix(4).map { ($0.key, $0.value) })
                }, winnerID: round.winnerID))
            }
            feed.yield(.directionDone(name: name, winnerID: study.winner.id))
            feed.finish()
            return (stream, [name])
        }
        let manifest = (try? JSONDecoder().decode([[String: String]].self, from: Data(contentsOf: folder.appending(path: "manifest.json")))) ?? []
        for (index, study) in manifest.enumerated() {
            guard let category = study["category"], let name = study["direction"] else { continue }
            let rounds = (0..<10).compactMap { round in
                try? JSONDecoder().decode(HybridRound.self, from: Data(contentsOf: folder.appending(path: "\(category)/round-\(round)/round.json")))
            }
            feed.yield(.direction(index: index, total: manifest.count, name: name, rounds: rounds.count, count: rounds.first?.candidates.count ?? 8,
                                  graphic: folder.appending(path: "\(category)/graphic.png")))
            for round in rounds {
                for (i, scene) in round.candidates.enumerated() {
                    let modifiers = (scene.genome.layoutInheritance?.operations ?? []).last { $0.hasPrefix("Modifiers on display type: ") }
                        .map { String($0.dropFirst("Modifiers on display type: ".count).prefix { $0 != "(" }).trimmingCharacters(in: .whitespaces).components(separatedBy: " + ") } ?? []
                    feed.yield(.candidate(direction: name, round: round.round, index: i, id: scene.id, image: scene.imageURL, modifiers: modifiers, retained: i == 0 && round.round > 0))
                }
                feed.yield(.judged(direction: name, round: round.round, ranking: round.judging.results.map {
                    SourceStudyVerdict(id: $0.id, rank: $0.rank, consensus: $0.consensus, votes: $0.votes.sorted { $0.value > $1.value }.prefix(4).map { ($0.key, $0.value) })
                }, winnerID: round.winnerID))
            }
            feed.yield(.directionDone(name: name, winnerID: rounds.last?.winnerID ?? ""))
        }
        feed.finish()
        return (stream, manifest.compactMap { $0["direction"] })
    }

    /// Height over width of the posters in the field; image studies follow their image.
    var aspect: Double {
        guard let size = cards.first?.image?.size, size.width > 0 else { return 1.414 }
        return size.height / size.width
    }

    var totalRounds: Int { directions.count * rounds }
    var completedRounds: Int { directionIndex * rounds + round + (phase == .verdict ? 1 : 0) }
    var ranked: [Card] { phase == .verdict || phase == .complete ? cards.sorted { ($0.rank ?? 99) < ($1.rank ?? 99) } : cards }

    func finish(stopped: Bool) {
        withAnimation(StageMotion.enter) { phase = stopped ? .stopped : .complete }
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(for: .seconds(seconds))
    }

    private func play(_ event: SourceStudyEvent) async {
        switch event {
        case let .direction(index, _, name, rounds, count, graphic):
            withAnimation(StageMotion.move) {
                directionIndex = index; direction = name; round = 0
                self.rounds = rounds; self.count = count
                self.graphic = NSImage(contentsOf: graphic)
                cards = []; lineage = []; champion = nil; phase = .drawing
            }
            await pause(0.6)
        case let .candidate(_, round, _, id, image, modifiers, retained):
            if round != self.round || phase != .drawing {
                // A new round: the field clears, the champion stays on the right.
                withAnimation(StageMotion.fade) { cards = []; self.round = round; phase = .drawing }
                await pause(0.3)
            }
            let card = Card(id: id, image: NSImage(contentsOf: image), modifiers: modifiers, retained: retained)
            withAnimation(StageMotion.enter) { cards.append(card); drawn += 1 }
            await pause(0.16)
        case let .judged(_, _, ranking, winnerID):
            withAnimation(StageMotion.fade) { phase = .judging }
            let byID = Dictionary(uniqueKeysWithValues: ranking.map { ($0.id, $0) })
            for index in cards.indices {
                guard let verdict = byID[cards[index].id] else { continue }
                withAnimation(StageMotion.fill.delay(StageMotion.stagger(index))) {
                    cards[index].consensus = verdict.consensus; cards[index].votes = verdict.votes
                }
            }
            judged += cards.count
            await pause(1.0)
            withAnimation(StageMotion.move) {
                for index in cards.indices { cards[index].rank = byID[cards[index].id]?.rank }
                phase = .verdict
            }
            if let winner = cards.first(where: { $0.id == winnerID }) {
                withAnimation(StageMotion.reveal) {
                    champion = winner
                    if let image = winner.image { lineage.append(image) }
                }
            }
            await pause(1.6)
        case let .directionDone(name, _):
            withAnimation(StageMotion.enter) {
                if let index = directions.firstIndex(where: { $0.id == name }) {
                    directions[index].done = true; directions[index].winner = champion?.image
                }
            }
            await pause(0.6)
        }
    }
}
