import Foundation
import Darwin

/// A separate writer lock allows existing catalog review to continue during semantic indexing.
final class SemanticIndexLock {
    private var descriptor: Int32
    init(url: URL) throws {
        descriptor = Darwin.open(url.path,O_CREAT|O_RDWR,0o600)
        guard descriptor >= 0 else { throw PosterError.invalid("Cannot open semantic index lock.") }
        guard flock(descriptor,LOCK_EX|LOCK_NB) == 0 else {
            Darwin.close(descriptor); descriptor = -1
            throw PosterError.invalid("Another semantic index build is running. Wait for it to finish.")
        }
    }
    func release() { if descriptor >= 0 { flock(descriptor,LOCK_UN); Darwin.close(descriptor); descriptor = -1 } }
    deinit { release() }
}
