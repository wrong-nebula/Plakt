import SwiftUI
import PosterCore

@MainActor @Observable
final class RegionSelectionModel {
    let record: PosterRecord
    let source: NSImage?
    let initialBounds: UnitBox?
    var foreground = true
    var markX = "0.5"
    var markY = "0.5"
    var points: [SAMPoint] = []
    var selection: SAMSelection?
    var maskID: Int?
    var overlay: NSImage?
    var region: RegionAnalysis?
    var relatedRegions: [RegionSearchHit] = []
    var searchedRegions = false
    var busy = false
    var saving = false
    var error: String?
    var status = "Mark the element you want to isolate."
    private let assistant: MultimodalLibraryAnalysis
    private let engine: PosterLibraryEngine
    private var task: Task<Void, Never>?
    private var request = UUID()

    init(record: PosterRecord, directory: URL, initialBounds: UnitBox?) {
        self.record = record; self.initialBounds = initialBounds
        source = NSImage(contentsOf: record.imageURL)
        assistant = MultimodalLibraryAnalysis(directory: directory)
        engine = PosterLibraryEngine(directory: directory)
    }

    var mask: SegmentationMask? { selection?.masks.first { $0.id == maskID } }

    func addEnteredMark() {
        guard let x = Double(markX), let y = Double(markY) else {
            error = "Enter both coordinates as numbers between 0 and 1."; return
        }
        addMark(x: x, y: y)
    }

    func addMark(x: Double, y: Double) {
        guard !saving else { return }
        guard x.isFinite, y.isFinite, (0...1).contains(x), (0...1).contains(y) else { error = "Use coordinates between 0 and 1."; return }
        guard points.count < 14 else { error = "This model accepts up to 14 marks. Undo a mark to refine the selection."; return }
        guard foreground || !points.isEmpty else { error = "Start with a foreground mark or the current element bounds."; return }
        markX = String(x); markY = String(y); points.append(SAMPoint(x: x, y: y, foreground: foreground)); predict()
    }

    func useBounds() {
        guard let bounds = initialBounds, bounds.valid else { return }
        points = SAMPoint.box(bounds); predict()
    }

    func undo() {
        guard !points.isEmpty else { return }
        if points.last?.label == 3 { points.removeLast(min(2, points.count)) } else { points.removeLast() }
        if points.isEmpty { clear() } else { predict() }
    }

    func clear() {
        task?.cancel(); request = UUID(); points = []; selection = nil; maskID = nil
        region = nil; relatedRegions = []; searchedRegions = false
        overlay = nil; busy = false; error = nil; status = "Mark the element you want to isolate."
    }

    func cancel() { task?.cancel(); request = UUID() }

    private func predict() {
        task?.cancel(); let token = UUID(); request = token
        let marks = points
        busy = true; error = nil; region = nil; relatedRegions = []; searchedRegions = false; status = "Finding mask alternatives…"
        task = Task {
            do {
                let result = try await assistant.select(imageURL: record.imageURL, points: marks)
                guard !Task.isCancelled, request == token else { return }
                selection = result
                maskID = result.masks.filter { $0.bounds != nil }.max {
                    let a = $0.areaFraction < 0.85 ? $0.predictedIoU * $0.stability : 0
                    let b = $1.areaFraction < 0.85 ? $1.predictedIoU * $1.stability : 0
                    return a < b
                }?.id
                updateOverlay()
                guard let maskID else { throw PosterError.invalid("No mask was found. Try a foreground mark nearer the element’s center.") }
                status = "Comparing the isolated region…"
                let measured = try await assistant.describe(record: record, selection: result, maskID: maskID)
                guard !Task.isCancelled, request == token else { return }
                region = measured; status = "Mask ready. Refine with more marks, or use this region."
            } catch is CancellationError { }
            catch { guard request == token else { return }; self.error = error.localizedDescription; status = "Selection needs attention." }
            if request == token { busy = false }
        }
    }

    func chooseMask(_ id: Int) {
        guard let selection else { return }
        task?.cancel(); let token = UUID(); request = token; maskID = id; region = nil
        relatedRegions = []; searchedRegions = false; updateOverlay()
        busy = true; status = "Comparing this mask alternative…"
        task = Task {
            do {
                let measured = try await assistant.describe(record: record, selection: selection, maskID: id)
                guard !Task.isCancelled, request == token else { return }
                region = measured; status = "Mask ready."
            } catch is CancellationError { }
            catch { guard request == token else { return }; self.error = error.localizedDescription }
            if request == token { busy = false }
        }
    }

    private func updateOverlay() {
        guard let mask else { overlay = nil; return }
        var rgba = Data(capacity: mask.bytes.count * 4)
        for value in mask.bytes { rgba.append(contentsOf: [value, value, value, value]) }
        guard let provider = CGDataProvider(data: rgba as CFData), let image = CGImage(width: mask.width, height: mask.height,
            bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: mask.width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider,
            decode: nil, shouldInterpolate: false, intent: .defaultIntent) else { overlay = nil; return }
        overlay = NSImage(cgImage: image, size: .zero)
    }

    func findRelatedRegions() {
        guard !busy, !saving, let region else { return }
        let token = UUID(); request = token; busy = true; error = nil
        status = "Comparing appearance, meaning and ink geometry…"
        task = Task {
            do {
                let hits = try await assistant.search(query: nil, regionID: region.id, limit: 8)
                guard !Task.isCancelled, request == token else { return }
                relatedRegions = hits; searchedRegions = true
                status = "Found \(hits.count) related regions for review."
            } catch is CancellationError { }
            catch { guard request == token else { return }; self.error = error.localizedDescription }
            if request == token { busy = false }
        }
    }

    func save() async -> Bool {
        guard !busy, let region else { return false }
        saving = true; defer { saving = false }
        do { try await engine.acceptSegmentedRegion(region); return true }
        catch { self.error = error.localizedDescription; return false }
    }
}
