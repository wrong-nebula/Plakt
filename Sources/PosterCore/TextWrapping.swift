public enum TextWrapping {
    /// The uncached route is the original production function, without a cache lookup.
    public static func lines(_ text: String, width: Double, height: Double, aspect: Double,
                             font: String, method: TextWrappingMethod = TextWrappingPreferences.method()) -> [String] {
        switch method {
        case .pretext:
            CoreTextWrappingCache.shared.lines(text, width: width, height: height, aspect: aspect, font: font)
        case .previous:
            PreviousTextWrapping.lines(text, width: width, height: height, aspect: aspect, font: font)
        }
    }
}
