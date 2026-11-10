import Foundation
import PosterCore

/// The posters a finished study offers: each direction's winner for a source study, the winner
/// and finalists for an image study.
struct StudyWinner: Identifiable {
    let id: String
    let label: String
    let genome: StyleGenome
    let seed: UInt64
    let imageURL: URL
    let folder: URL

    static func load(_ folder: URL) -> [StudyWinner] {
        let decoder = JSONDecoder()
        if let study = try? decoder.decode(ImagePosterStudyResult.self, from: Data(contentsOf: folder.appending(path: "image-study.json"))) {
            let final = study.rounds.last
            var winners = [StudyWinner(id: study.winner.id, label: "Winner", genome: study.winner.genome, seed: study.winner.seed, imageURL: study.winner.imageURL, folder: folder)]
            for (n, id) in (study.finalistIDs ?? []).enumerated() where id != study.winner.id {
                guard let c = final?.candidates.first(where: { $0.id == id }) else { continue }
                winners.append(StudyWinner(id: c.id, label: "Finalist \(n + 1)", genome: c.genome, seed: c.seed, imageURL: c.imageURL, folder: folder))
            }
            return winners
        }
        let manifest = (try? decoder.decode([[String: String]].self, from: Data(contentsOf: folder.appending(path: "manifest.json")))) ?? []
        return manifest.compactMap { study in
            guard let category = study["category"], let name = study["direction"],
                  let scene = try? decoder.decode(HybridScene.self, from: Data(contentsOf: folder.appending(path: "\(category)/winner.json"))) else { return nil }
            let large = folder.appending(path: "\(category)/winner.png")
            return StudyWinner(id: scene.id, label: name, genome: scene.genome, seed: scene.seed,
                               imageURL: FileManager.default.fileExists(atPath: large.path) ? large : scene.imageURL, folder: folder.appending(path: category))
        }
    }
}
