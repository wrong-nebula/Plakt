import Foundation

/// The lifecycle shared by the studio's long-running jobs: evolution rounds, source and image
/// studies, judge training, image analysis and exports. One value replaces a `busy` flag, a task
/// handle and a status string that each model used to keep in step by hand.
///
///     idle ──begin──▶ running ──stop──▶ stopping
///       ▲                │                  │
///       └──── finish ────┴───── finish ─────┘
///
/// Only a stoppable job can be stopped, so the app never offers Stop for work that runs to the
/// end anyway. Only a running job reports progress, so a late progress message can't hide
/// "Stopping…" or overwrite a finished job's result. It lives in PosterCore so `poster-checks
/// --jobs-only` can verify this table; see STATE-MACHINES.md for every machine in the app.
public struct JobLifecycle: Equatable, Sendable {
    public struct Job: Equatable, Sendable {
        /// A short name for logs and agents, such as "rounds" or "export".
        public var name: String
        /// Whether the job checks for cancellation between steps.
        public var stoppable: Bool
        public init(_ name: String, stoppable: Bool) { self.name = name; self.stoppable = stoppable }
    }

    public enum Phase: Equatable, Sendable {
        case idle
        case running(Job)
        case stopping(Job)
    }

    public private(set) var phase: Phase = .idle
    public init() {}

    public var job: Job? {
        switch phase {
        case .idle: nil
        case .running(let job), .stopping(let job): job
        }
    }
    public var isBusy: Bool { phase != .idle }
    public var isStopping: Bool { if case .stopping = phase { true } else { false } }
    /// True only while a stoppable job runs and hasn't been asked to stop.
    public var canStop: Bool { if case .running(let job) = phase { job.stoppable } else { false } }
    /// Progress messages count only while a job runs: not after Stop, not after it ends.
    public var acceptsProgress: Bool { if case .running = phase { true } else { false } }

    /// Starts `job` if nothing runs. Returns false, changing nothing, while another job is busy.
    public mutating func begin(_ job: Job) -> Bool {
        guard phase == .idle else { return false }
        phase = .running(job); return true
    }
    /// Asks the running job to stop. Returns false, changing nothing, when there is no running
    /// job, it is already stopping, or it can't stop.
    public mutating func stop() -> Bool {
        guard canStop, let job else { return false }
        phase = .stopping(job); return true
    }
    /// Ends the current job, from running or stopping.
    public mutating func finish() { phase = .idle }
}
