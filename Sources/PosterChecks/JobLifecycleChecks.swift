import Foundation
import PosterCore

extension PosterChecks {
    /// Walks every transition of the studio job lifecycle (STATE-MACHINES.md).
    static func checkJobLifecycle()throws {
        let rounds=JobLifecycle.Job("rounds",stoppable:true),export=JobLifecycle.Job("export",stoppable:false)
        var life=JobLifecycle()
        try require(life.phase == .idle && !life.isBusy && !life.canStop && !life.acceptsProgress && life.job==nil,"A new lifecycle is not idle")
        try require(!life.stop() && life.phase == .idle,"Stop changed an idle lifecycle")

        try require(life.begin(rounds) && life.phase == .running(rounds),"Begin did not start a job")
        try require(life.isBusy && life.canStop && life.acceptsProgress && life.job==rounds,"A running stoppable job is not busy, stoppable and reporting")
        try require(!life.begin(export) && life.phase == .running(rounds),"A second job started while one was running")

        try require(life.stop() && life.phase == .stopping(rounds),"Stop did not move a running job to stopping")
        try require(life.isBusy && life.isStopping && !life.canStop && !life.acceptsProgress,"A stopping job still offers Stop or accepts progress")
        try require(!life.stop() && !life.begin(export) && life.phase == .stopping(rounds),"A stopping job was stopped again or replaced")
        life.finish()
        try require(life.phase == .idle && !life.isBusy,"Finish did not end a stopping job")

        try require(life.begin(export) && !life.canStop,"An unstoppable job offers Stop")
        try require(!life.stop() && life.phase == .running(export) && life.acceptsProgress,"Stop changed an unstoppable job")
        life.finish()
        try require(life.phase == .idle && !life.acceptsProgress,"A finished job still accepts progress")
        print("PASS: job lifecycle transitions (idle, running, stopping, unstoppable)")
    }
}
