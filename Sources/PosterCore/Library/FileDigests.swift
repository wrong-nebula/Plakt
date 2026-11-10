import Foundation
import Darwin

struct FileDigest: Codable, Hashable, Sendable {
    let hash: String
    /// Identity of the file when `hash` was read; nil if the file changed while it was being read.
    let signature: String?
}

/// SHA-256 content hashes reused while a file's identity is unchanged. Any write, replacement,
/// rename over or metadata change alters the inode change time, so the file is read again.
final class FileDigests: @unchecked Sendable {
    static let shared = FileDigests()
    private let lock = NSLock()
    private var digests: [String: FileDigest] = [:]

    /// Device, inode, size and inode change time. Unlike modification time, touch and copy tools cannot set it.
    static func signature(_ url: URL) -> String? {
        var info = stat()
        guard stat(url.path, &info) == 0 else { return nil }
        return "\(info.st_dev)-\(info.st_ino)-\(info.st_size)-\(info.st_ctimespec.tv_sec).\(info.st_ctimespec.tv_nsec)"
    }

    /// `known` is a previously recorded digest; it stands in for reading only if its signature still matches.
    func digest(_ url: URL, known: FileDigest? = nil) throws -> FileDigest {
        let path = url.standardizedFileURL.path
        if let current = Self.signature(url) {
            if let known, known.signature == current { remember(path, known); return known }
            lock.lock(); let cached = digests[path]; lock.unlock()
            if let cached, cached.signature == current { return cached }
        }
        let before = Self.signature(url)
        let hash = LibraryRaster.hash(try Data(contentsOf: url))
        let result = FileDigest(hash: hash, signature: before != nil && before == Self.signature(url) ? before : nil)
        if result.signature != nil { remember(path, result) }
        return result
    }

    private func remember(_ path: String, _ digest: FileDigest) {
        lock.lock(); digests[path] = digest; lock.unlock()
    }
}

/// Decoded JSON reused until its file's identity changes. Owned by one actor.
struct DecodedFiles<Value> {
    private var values: [String: (signature: String, value: Value)] = [:]

    /// The saved value if the file is unchanged, and the current signature to store a reload under.
    /// Taking the signature before loading means a file replaced mid-read is loaded again next time.
    func lookup(_ url: URL) -> (value: Value?, signature: String?) {
        guard let signature = FileDigests.signature(url) else { return (nil, nil) }
        if let saved = values[url.standardizedFileURL.path], saved.signature == signature { return (saved.value, signature) }
        return (nil, signature)
    }

    mutating func store(_ value: Value, for url: URL, signature: String?) {
        values[url.standardizedFileURL.path] = signature.map { ($0, value) }
    }

    /// Records a value this owner just wrote, so it is not decoded again.
    mutating func store(_ value: Value, for url: URL) { store(value, for: url, signature: FileDigests.signature(url)) }

    /// Returns nil when the file is absent. Decoding errors propagate and are never cached.
    mutating func value(_ url: URL, decode: (Data) throws -> Value) throws -> Value? {
        let saved = lookup(url)
        if let value = saved.value { return value }
        guard saved.signature != nil else { return nil }
        let value = try decode(Data(contentsOf: url))
        store(value, for: url, signature: saved.signature)
        return value
    }
}
