import SwiftUI
import PosterCore

/// Runs one studio job at a time. The lifecycle and the task handle change together here and
/// nowhere else, so a model can't be busy without a task or keep a task after it ends.
@MainActor @Observable
final class JobRunner {
    private(set) var lifecycle = JobLifecycle()
    @ObservationIgnored private var task: Task<Void, Never>?

    var busy: Bool { lifecycle.isBusy }

    /// Starts `body` as `job` unless another job runs. The job ends when `body` returns.
    @discardableResult
    func run(_ job: JobLifecycle.Job, _ body: @escaping @MainActor () async -> Void) -> Bool {
        guard lifecycle.begin(job) else { return false }
        task = Task {
            await body()
            lifecycle.finish(); task = nil
        }
        return true
    }

    /// Cancels a stoppable running job. Returns false when there is nothing to stop.
    @discardableResult
    func stop() -> Bool {
        guard lifecycle.stop() else { return false }
        task?.cancel(); return true
    }
}

extension JobLifecycle.Job {
    static let rounds = Self("rounds", stoppable: true)
    static let sourceStudy = Self("source-study", stoppable: true)
    static let styleTraining = Self("style-training", stoppable: true)
    static let imageAnalysis = Self("image-analysis", stoppable: true)
    static let imageStudy = Self("image-study", stoppable: true)
    /// Renders run to the end; Stop is not offered.
    static let export = Self("export", stoppable: false)
}

/// The Stop control for a job bar: shown only for stoppable jobs, disabled once stopping.
struct JobStopButton: View {
    let lifecycle: JobLifecycle
    let stop: () -> Void
    var body: some View {
        if lifecycle.job?.stoppable == true {
            Button(lifecycle.isStopping ? "Stopping…" : "Stop", action: stop).disabled(!lifecycle.canStop)
        }
    }
}
