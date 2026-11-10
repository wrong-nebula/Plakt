import Foundation

/// Upright image coordinates, normalized from its top-left corner.
public struct SAMPoint: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double
    public var label: Int

    public init(x: Double, y: Double, foreground: Bool = true) {
        self.x = x; self.y = y; label = foreground ? 1 : 0
    }

    public static func box(_ bounds: UnitBox) -> [SAMPoint] {
        var first = SAMPoint(x: bounds.x, y: bounds.y)
        var second = SAMPoint(x: bounds.x + bounds.width, y: bounds.y + bounds.height)
        first.label = 2; second.label = 3
        return [first, second]
    }

    public var valid: Bool {
        x.isFinite && y.isFinite && (0...1).contains(x) && (0...1).contains(y) && (0...3).contains(label)
    }
}
