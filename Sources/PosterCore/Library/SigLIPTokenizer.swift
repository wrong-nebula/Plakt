import Foundation

/// The original SentencePiece Unigram vocabulary and compiled normalization map.
/// No longest-match approximation: segmentation maximizes the original piece scores.
public struct SigLIPTokenizer: Sendable {
    private struct Piece: Decodable, Sendable { let text: String; let score: Float; let type: Int }
    private struct Vocabulary: Decodable {
        let pieces: [Piece]; let charsmap: Data
        let unknownID: Int; let eosID: Int; let padID: Int; let maxTokens: Int
        let byteFallback: Bool; let unknownPrefixCount: Int
    }
    private struct Node: Sendable { var children: [UInt8:Int] = [:]; var id: Int? }
    private let vocabulary: VocabularyData
    private struct VocabularyData: Sendable {
        let pieces: [Piece]; let units: [UInt32]; let replacements: [UInt8]
        let unknownID: Int; let eosID: Int; let padID: Int; let maxTokens: Int
        let byteFallback: Bool; let unknownPrefixCount: Int; let byteIDs: [UInt8:Int]
    }
    private var trie: [Node] = [Node()]
    private let unknownScore: Float
    private static let punctuation = Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".unicodeScalars)

    public init(url: URL) throws {
        let source = try JSONDecoder().decode(Vocabulary.self, from: Data(contentsOf: url))
        let bytes = [UInt8](source.charsmap)
        func uint32(_ offset: Int) -> UInt32 {
            (0..<4).reduce(UInt32(0)) { $0 | UInt32(bytes[offset+$1]) << ($1*8) }
        }
        guard bytes.count >= 4, source.maxTokens == 64, source.pieces.count == 32000,
              source.unknownID == 2, source.eosID == 1, source.padID == 1 else {
            throw PosterError.invalid("Unsupported SigLIP tokenizer configuration. Rebuild the model pack.")
        }
        let size = Int(uint32(0))
        guard size > 0, size % 4 == 0, size+4 < bytes.count else {
            throw PosterError.invalid("Invalid SentencePiece normalization map.")
        }
        vocabulary = VocabularyData(pieces:source.pieces, units:stride(from:4,to:size+4,by:4).map(uint32),
            replacements:Array(bytes[(size+4)...]), unknownID:source.unknownID, eosID:source.eosID,
            padID:source.padID, maxTokens:source.maxTokens, byteFallback:source.byteFallback,
            unknownPrefixCount:source.unknownPrefixCount, byteIDs:Dictionary(uniqueKeysWithValues:source.pieces.enumerated().compactMap { id,piece in
                guard piece.type == 6, piece.text.hasPrefix("<0x"), let byte = UInt8(piece.text.dropFirst(3).dropLast(),radix:16) else { return nil }
                return (byte,id)
            }))
        unknownScore = (source.pieces.filter{$0.type == 1}.map(\.score).min() ?? -100)-10
        for (id,piece) in source.pieces.enumerated() where piece.type == 1 {
            var node = 0
            for byte in piece.text.utf8 {
                if let next = trie[node].children[byte] { node = next }
                else { let next = trie.count; trie.append(Node()); trie[node].children[byte] = next; node = next }
            }
            trie[node].id = id
        }
    }

    private func normalized(_ input: String) throws -> [UInt8] {
        let bytes = [UInt8](input.utf8)
        var result: [UInt8] = [], position = 0
        func offset(_ unit: UInt32) -> Int { Int((unit >> 10) << ((unit & 512) >> 6)) }
        while position < bytes.count {
            var node = 0, cursor = position, matchedLength = 0, replacement = 0
            while cursor < bytes.count {
                guard node < vocabulary.units.count else { throw PosterError.invalid("Invalid tokenizer trie.") }
                node ^= offset(vocabulary.units[node]) ^ Int(bytes[cursor])
                guard node < vocabulary.units.count else { break }
                let unit = vocabulary.units[node]
                guard unit & 0x800000ff == UInt32(bytes[cursor]) else { break }
                cursor += 1
                if unit & 256 != 0 {
                    let leaf = node ^ offset(unit)
                    guard leaf < vocabulary.units.count else { throw PosterError.invalid("Invalid tokenizer leaf.") }
                    matchedLength = cursor-position; replacement = Int(vocabulary.units[leaf] & 0x7fffffff)
                }
            }
            if matchedLength > 0 {
                guard replacement < vocabulary.replacements.count else { throw PosterError.invalid("Invalid normalization replacement.") }
                while replacement < vocabulary.replacements.count, vocabulary.replacements[replacement] != 0 {
                    result.append(vocabulary.replacements[replacement]); replacement += 1
                }
                position += matchedLength
            } else {
                let length = Self.scalarLength(bytes[position])
                result.append(contentsOf:bytes[position..<min(position+length,bytes.count)]); position += length
            }
        }
        // SentencePiece removes duplicate/leading/trailing ASCII spaces, then escapes them.
        var escaped: [UInt8] = [], previousSpace = true
        for byte in result {
            if byte == 32 {
                if !previousSpace { escaped.append(contentsOf:[0xe2,0x96,0x81]) }
                previousSpace = true
            } else { escaped.append(byte); previousSpace = false }
        }
        if previousSpace, escaped.suffix(3) == [0xe2,0x96,0x81] { escaped.removeLast(3) }
        return escaped
    }

    private static func scalarLength(_ byte: UInt8) -> Int {
        byte < 0x80 ? 1 : byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : 4
    }

    private func segment(_ text: String) throws -> [Int] {
        let bytes = try normalized(text), count = bytes.count
        if count == 0 { return [] }
        var scores = [Float](repeating:-.infinity,count:count+1)
        var previous = [Int](repeating:0,count:count+1), ids = [Int](repeating:vocabulary.unknownID,count:count+1)
        scores[0] = 0
        var start = 0
        while start < count {
            let scalarLength = Self.scalarLength(bytes[start])
            var node = 0, end = start, hasSingle = false
            while end < count, let next = trie[node].children[bytes[end]] {
                node = next; end += 1
                if let id = trie[node].id {
                    if end-start == scalarLength { hasSingle = true }
                    let score = scores[start]+vocabulary.pieces[id].score
                    if score > scores[end] { scores[end] = score; previous[end] = start; ids[end] = id }
                }
            }
            if !hasSingle {
                let end = min(count,start+scalarLength), score = scores[start]+unknownScore
                if score > scores[end] { scores[end] = score; previous[end] = start; ids[end] = vocabulary.unknownID }
            }
            start += scalarLength
        }
        var reversed: [(Int,Int,Int)] = [], end = count
        while end > 0 {
            guard scores[end].isFinite, previous[end] < end else { throw PosterError.invalid("SentencePiece segmentation failed.") }
            reversed.append((ids[end],previous[end],end)); end = previous[end]
        }
        var tokens: [Int] = []
        for (id,start,end) in reversed.reversed() {
            if id == vocabulary.unknownID, vocabulary.byteFallback {
                for byte in bytes[start..<end] {
                    guard let byteID = vocabulary.byteIDs[byte] else { throw PosterError.invalid("Missing SentencePiece byte fallback.") }
                    tokens.append(byteID)
                }
            } else if id != vocabulary.unknownID || tokens.last != vocabulary.unknownID { tokens.append(id) }
        }
        return tokens
    }

    public func tokens(for text: String) throws -> [Int32] {
        guard text.utf8.count <= 8192 else { throw PosterError.invalid("Use a search description under 8 KB.") }
        // SiglipTokenizer lowercases, removes ASCII punctuation, and preserves explicit special tokens.
        let input = "▁"+text.replacingOccurrences(of:"▁",with:" ").lowercased()
        let regex = try NSRegularExpression(pattern:"(</s>|<unk>)")
        let ns = input as NSString
        var tokens: [Int] = [], cursor = 0
        let prefixCount = vocabulary.unknownPrefixCount
        func append(_ part: String) throws {
            let stripped = String(String.UnicodeScalarView(part.unicodeScalars.filter{!Self.punctuation.contains($0)}))
            let canonical = stripped.split(whereSeparator:{$0.isWhitespace}).joined(separator:" ")
            guard !canonical.isEmpty else { return }
            tokens.append(contentsOf:try segment("<unk>"+canonical).dropFirst(prefixCount))
        }
        for match in regex.matches(in:input,range:NSRange(location:0,length:ns.length)) {
            try append(ns.substring(with:NSRange(location:cursor,length:match.range.location-cursor)))
            tokens.append(ns.substring(with:match.range) == "</s>" ? vocabulary.eosID : vocabulary.unknownID)
            cursor = NSMaxRange(match.range)
        }
        try append(ns.substring(from:cursor))
        // HF truncation reserves the final position for EOS; padding also uses EOS.
        tokens = Array(tokens.prefix(vocabulary.maxTokens-1))
        if tokens.last != vocabulary.eosID { tokens.append(vocabulary.eosID) }
        tokens.append(contentsOf:repeatElement(vocabulary.padID,count:vocabulary.maxTokens-tokens.count))
        return tokens.map(Int32.init)
    }
}
