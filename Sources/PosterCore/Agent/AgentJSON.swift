import Foundation

/// A loose JSON value, for tool arguments, tool results and the MCP wire format.
public enum JSONValue: Codable, Sendable, Equatable {
    case null, bool(Bool), number(Double), string(String), array([JSONValue]), object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSONValue].self) { self = .array(a) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n):
            if n.isFinite, n == n.rounded(), abs(n) < 9e15 { try c.encode(Int64(n)) } else if n.isFinite { try c.encode(n) } else { try c.encodeNil() }
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    public subscript(key: String) -> JSONValue? { if case .object(let o) = self { return o[key] }; return nil }
    public var string: String? { if case .string(let s) = self { return s }; return nil }
    public var double: Double? {
        switch self { case .number(let n): return n; case .string(let s): return Double(s); default: return nil }
    }
    public var int: Int? { double.flatMap { $0.isFinite && $0 == $0.rounded() ? Int($0) : nil } }
    public var bool: Bool? {
        switch self { case .bool(let b): return b; case .string(let s): return s == "true" ? true : s == "false" ? false : nil; default: return nil }
    }
    public var array: [JSONValue]? { if case .array(let a) = self { return a }; return nil }
    public var object: [String: JSONValue]? { if case .object(let o) = self { return o }; return nil }
    public var isNull: Bool { if case .null = self { return true }; return false }

    /// Any Encodable value as JSON (through JSONEncoder, so Codable keys are kept).
    public static func from<T: Encodable>(_ value: T) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
    }
    public func decode<T: Decodable>(_ type: T.Type) throws -> T { try JSONDecoder().decode(type, from: JSONEncoder().encode(self)) }
    public func data(pretty: Bool = false) throws -> Data {
        let e = JSONEncoder(); e.outputFormatting = pretty ? [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes] : [.sortedKeys, .withoutEscapingSlashes]
        return try e.encode(self)
    }
    public func text(pretty: Bool = false) -> String { (try? data(pretty: pretty)).flatMap { String(data: $0, encoding: .utf8) } ?? "null" }
}

extension JSONValue: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral, ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral {
    public init(stringLiteral value: String) { self = .string(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, JSONValue)...) { self = .object(Dictionary(elements, uniquingKeysWith: { $1 })) }
}

public extension JSONValue {
    static func num(_ v: Double, _ digits: Int = 4) -> JSONValue {
        let p = pow(10, Double(digits)); return .number((v * p).rounded() / p)
    }
    static func str(_ v: String?) -> JSONValue { v.map { .string($0) } ?? .null }
}

/// A tool failure the caller can act on: what went wrong and what to do instead.
public struct AgentError: Error, LocalizedError, Sendable {
    public var message: String; public var hint: String?
    public init(_ message: String, hint: String? = nil) { self.message = message; self.hint = hint }
    public var errorDescription: String? { hint.map { "\(message) Hint: \($0)" } ?? message }
}

/// Typed access to a tool's argument object, with errors that name the argument.
public struct AgentArguments: Sendable {
    public let values: [String: JSONValue]
    public init(_ value: JSONValue?) { values = value?.object ?? [:] }
    public func has(_ key: String) -> Bool { if let v = values[key] { return !v.isNull }; return false }
    public func string(_ key: String) throws -> String? {
        guard let v = values[key], !v.isNull else { return nil }
        if let s = v.string { return s }
        if let n = v.double { return n == n.rounded() ? String(Int64(n)) : String(n) }
        throw AgentError("'\(key)' must be a string.")
    }
    public func required(_ key: String, hint: String? = nil) throws -> String {
        guard let s = try string(key), !s.isEmpty else { throw AgentError("Missing required argument '\(key)'.", hint: hint) }
        return s
    }
    public func double(_ key: String, range: ClosedRange<Double>? = nil) throws -> Double? {
        guard let v = values[key], !v.isNull else { return nil }
        guard let n = v.double, n.isFinite else { throw AgentError("'\(key)' must be a number.") }
        if let range, !range.contains(n) { throw AgentError("'\(key)' must be between \(range.lowerBound) and \(range.upperBound); got \(n).") }
        return n
    }
    public func int(_ key: String, range: ClosedRange<Int>? = nil) throws -> Int? {
        guard let n = try double(key) else { return nil }
        guard n == n.rounded() else { throw AgentError("'\(key)' must be a whole number.") }
        let i = Int(n)
        if let range, !range.contains(i) { throw AgentError("'\(key)' must be \(range.lowerBound)–\(range.upperBound); got \(i).") }
        return i
    }
    public func seed(_ key: String = "seed") throws -> UInt64? {
        guard let v = values[key], !v.isNull else { return nil }
        if let s = v.string, let u = UInt64(s) { return u }
        guard let n = v.double, n >= 0, n == n.rounded(), n < 1.8e19 else { throw AgentError("'\(key)' must be a non-negative whole number.") }
        return UInt64(n)
    }
    public func bool(_ key: String) throws -> Bool? {
        guard let v = values[key], !v.isNull else { return nil }
        guard let b = v.bool else { throw AgentError("'\(key)' must be true or false.") }
        return b
    }
    public func strings(_ key: String) throws -> [String]? {
        guard let v = values[key], !v.isNull else { return nil }
        if let s = v.string { return s.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }
        guard let a = v.array else { throw AgentError("'\(key)' must be an array of strings.") }
        return try a.map { guard let s = $0.string else { throw AgentError("'\(key)' must contain only strings.") }; return s }
    }
    public func numbers(_ key: String) throws -> [String: Double]? {
        guard let v = values[key], !v.isNull else { return nil }
        guard let o = v.object else { throw AgentError("'\(key)' must be an object of name → number.") }
        return try o.mapValues { guard let n = $0.double, n.isFinite else { throw AgentError("'\(key)' values must be numbers.") }; return n }
    }
}

/// Small helpers for writing JSON Schemas by hand.
enum Schema {
    static func object(_ properties: [String: JSONValue], required: [String] = [], additional: Bool = false) -> JSONValue {
        var o: [String: JSONValue] = ["type": "object", "properties": .object(properties), "additionalProperties": .bool(additional)]
        if !required.isEmpty { o["required"] = .array(required.map { .string($0) }) }
        return .object(o)
    }
    static func string(_ description: String, options: [String]? = nil) -> JSONValue {
        var o: [String: JSONValue] = ["type": "string", "description": .string(description)]
        if let options { o["enum"] = .array(options.map { .string($0) }) }
        return .object(o)
    }
    static func integer(_ description: String, min: Int? = nil, max: Int? = nil) -> JSONValue {
        var o: [String: JSONValue] = ["type": "integer", "description": .string(description)]
        if let min { o["minimum"] = .number(Double(min)) }; if let max { o["maximum"] = .number(Double(max)) }
        return .object(o)
    }
    static func number(_ description: String, min: Double? = nil, max: Double? = nil) -> JSONValue {
        var o: [String: JSONValue] = ["type": "number", "description": .string(description)]
        if let min { o["minimum"] = .number(min) }; if let max { o["maximum"] = .number(max) }
        return .object(o)
    }
    static func boolean(_ description: String) -> JSONValue { ["type": "boolean", "description": .string(description)] }
    static func strings(_ description: String) -> JSONValue { ["type": "array", "items": ["type": "string"], "description": .string(description)] }
    static func numberMap(_ description: String) -> JSONValue { ["type": "object", "additionalProperties": ["type": "number"], "description": .string(description)] }
    static func any(_ description: String) -> JSONValue { ["description": .string(description)] }
}
