import Foundation

/// How one line of scene type is kerned, on top of its tracking. Values are thousandths of an em.
public struct TextKerning: Codable, Hashable, Sendable {
    public enum Mode: String, Codable, CaseIterable, Sendable {
        /// The font's own kerning pairs.
        case metrics
        /// Pairs measured from the outlines, so the white between letters evens out.
        case optical
        /// Plain advances, no pairs.
        case none
        public var label:String {switch self {case .metrics:"Metrics";case .optical:"Optical";case .none:"None"}}
    }
    public var mode:Mode
    /// Optical: how much of the measured correction is applied. 0 keeps the plain advances.
    public var strength:Double
    /// Optical: added to every measured pair. Negative closes the line up.
    public var tightness:Double
    /// Optical never sets two letters closer than this; nil lets them touch. Your own pairs and gaps may still close them.
    public var minimumGap:Double?
    /// Added to every word space.
    public var wordSpace:Double
    /// Your pairs, e.g. "AV": -30, added wherever those two characters meet.
    public var pairs:[String:Double]
    /// Your kerning at single gaps of `gapsText`. Key "3" is the gap after the fourth character. Ignored once the text changes.
    public var gaps:[String:Double]
    public var gapsText:String?
    public init(mode:Mode = .metrics,strength:Double=1,tightness:Double=0,minimumGap:Double?=12,wordSpace:Double=0,pairs:[String:Double]=[:],gaps:[String:Double]=[:],gapsText:String?=nil) {
        self.mode=mode;self.strength=strength;self.tightness=tightness;self.minimumGap=minimumGap;self.wordSpace=wordSpace;self.pairs=pairs;self.gaps=gaps;self.gapsText=gapsText
    }
    private enum CodingKeys:String,CodingKey {case mode,strength,tightness,minimumGap,wordSpace,pairs,gaps,gapsText}
    /// Missing fields take their defaults, so hand-written settings like {"mode":"optical"} work.
    public init(from decoder:Decoder)throws {
        let c=try decoder.container(keyedBy:CodingKeys.self),d=TextKerning()
        mode=try c.decodeIfPresent(Mode.self,forKey:.mode) ?? d.mode
        strength=try c.decodeIfPresent(Double.self,forKey:.strength) ?? d.strength
        tightness=try c.decodeIfPresent(Double.self,forKey:.tightness) ?? d.tightness
        minimumGap=c.contains(.minimumGap) ? try c.decodeIfPresent(Double.self,forKey:.minimumGap):d.minimumGap
        wordSpace=try c.decodeIfPresent(Double.self,forKey:.wordSpace) ?? d.wordSpace
        pairs=try c.decodeIfPresent([String:Double].self,forKey:.pairs) ?? [:]
        gaps=try c.decodeIfPresent([String:Double].self,forKey:.gaps) ?? [:]
        gapsText=try c.decodeIfPresent(String.self,forKey:.gapsText)
    }
    public func encode(to encoder:Encoder)throws {
        var c=encoder.container(keyedBy:CodingKeys.self)
        try c.encode(mode,forKey:.mode);try c.encode(strength,forKey:.strength);try c.encode(tightness,forKey:.tightness)
        try c.encode(minimumGap,forKey:.minimumGap);try c.encode(wordSpace,forKey:.wordSpace);try c.encode(pairs,forKey:.pairs)
        if !gaps.isEmpty {try c.encode(gaps,forKey:.gaps);try c.encodeIfPresent(gapsText,forKey:.gapsText)}
    }
    /// What newly made posters use.
    public static let newPosters=TextKerning(mode:.optical)
    /// Sets a line exactly as scenes without kerning settings always have been: a tracking of exactly 0
    /// switched the font's pairs off (Core Text reads a zero kern as "no kerning"), any other tracking kept them.
    public static func legacy(tracking:Double)->TextKerning {TextKerning(mode:tracking==0 ? .none:.metrics)}
    public static func pairKey(_ left:String,_ right:String)->String {(left.last.map{String($0)} ?? "")+(right.first.map{String($0)} ?? "")}
    /// Your kerning at the gap after character `index`, while the text is still the one it was set for.
    public func gap(_ index:Int,in text:String)->Double {gapsText==text ? gaps[String(index)] ?? 0:0}
    public mutating func setGap(_ index:Int,in text:String,to value:Double) {
        if gapsText != text {gaps=[:];gapsText=text}
        gaps[String(index)]=value==0 ? nil:value
        if gaps.isEmpty {gapsText=nil}
    }
    public mutating func setPair(_ pair:String,to value:Double) {pairs[pair]=value==0 ? nil:value}
    public func validated()throws->TextKerning {
        func finite(_ v:Double,_ range:ClosedRange<Double>,_ name:String)throws {guard v.isFinite,range.contains(v) else{throw PosterError.invalid("Kerning \(name) must be within \(Int(range.lowerBound))…\(Int(range.upperBound)).")}}
        try finite(strength,0...2,"strength");try finite(tightness,-250...250,"tightness");try finite(wordSpace,-500...1000,"word space")
        if let m=minimumGap {try finite(m,-50...250,"minimum gap")}
        guard pairs.count<=4000 else{throw PosterError.invalid("Keep kerning pairs to 4,000 or fewer.")}
        for (pair,value) in pairs {guard pair.count==2 else{throw PosterError.invalid("A kerning pair is two characters, not “\(pair)”.")};try finite(value,-1000...1000,"pair \(pair)")}
        for (key,value) in gaps {guard let i=Int(key),i>=0 else{throw PosterError.invalid("A kerning gap is a character position, not “\(key)”.")};try finite(value,-1000...1000,"gap \(key)")}
        guard gaps.isEmpty || gapsText != nil else{throw PosterError.invalid("Kerning gaps need the text they were set for.")}
        return self
    }
}
