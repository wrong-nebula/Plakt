import Foundation

/// Rules that pick an ink from a set instead of storing one, so a poster's colors stay right when its palette changes.
/// Ported from the selectors of meodai's design-book (https://meodai.github.io/design-book/tour/): distance in OKLab,
/// chroma and lightness in OKLCH, contrast as the WCAG 2 ratio. Every rule takes the same filter: members in `excluding`
/// are skipped, and with `readableOn` only members reaching `ratio` against every listed ink are considered.
/// Inks are #rrggbb strings; ties go to the earlier member, so results never depend on hashing.
public enum InkRules {
    public static func distance(_ a:String,_ b:String)->Double {sqrt(PerceptualColor.squared(PerceptualColor.fromHex(a),PerceptualColor.fromHex(b)))}
    public static func chroma(_ ink:String)->Double {let c=PerceptualColor.fromHex(ink);return hypot(c.a,c.b)}
    public static func lightness(_ ink:String)->Double {PerceptualColor.fromHex(ink).l}
    public static func ratio(_ a:String,_ b:String)->Double {ShapeTypePlacement.contrastRatio(a,b)}
    /// The lowest ratio an ink reaches over several inks it may sit on.
    public static func worstRatio(_ ink:String,on inks:[String])->Double {inks.map{ratio(ink,$0)}.min() ?? .infinity}

    static func members(_ inks:[String],readableOn:[String],ratio minimum:Double,excluding:[String])->[String] {
        let skip=Set(excluding.map{$0.lowercased()});var seen=Set<String>()
        return inks.filter{ink in
            let key=ink.lowercased()
            guard !skip.contains(key),seen.insert(key).inserted else{return false}
            return readableOn.isEmpty || worstRatio(ink,on:readableOn)>=minimum
        }
    }
    static func best(_ inks:[String],_ better:(String,String)->Bool)->String? {inks.reduce(nil){found,ink in found.map{better(ink,$0) ? ink:$0} ?? ink}}

    /// The member that looks most like `target`: snaps a picked, sampled or mutated color onto the palette.
    /// `minDistance` skips members closer than that, so the result is a different ink.
    public static func closest(_ target:String,in inks:[String],minDistance:Double=0,readableOn:[String]=[],ratio minimum:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:readableOn,ratio:minimum,excluding:excluding).filter{distance($0,target)>=minDistance}){distance($0,target)<distance($1,target)}
    }
    /// The member that looks least like `target`, no further away than `maxDistance`.
    public static func furthestFrom(_ target:String,in inks:[String],maxDistance:Double = .infinity,readableOn:[String]=[],ratio minimum:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:readableOn,ratio:minimum,excluding:excluding).filter{distance($0,target)<=maxDistance}){distance($0,target)>distance($1,target)}
    }
    /// The member with the highest contrast against every target at once (its worst ratio is highest).
    /// With `atLeast`, nil when even the best member stays under that ratio.
    public static func bestContrastWith(_ targets:[String],in inks:[String],atLeast:Double=1,excluding:[String]=[])->String? {
        best(members(inks,readableOn:[],ratio:1,excluding:excluding).filter{worstRatio($0,on:targets)>=atLeast}){worstRatio($0,on:targets)>worstRatio($1,on:targets)}
    }
    /// The quietest member that still reaches `minContrast` against every target: captions just past AA, or a hairline
    /// at about 1.2 that stays faint on any paper but never disappears.
    public static func minContrastWith(_ targets:[String],in inks:[String],minContrast:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:targets,ratio:minContrast,excluding:excluding)){worstRatio($0,on:targets)<worstRatio($1,on:targets)}
    }
    /// The loudest member, usually the accent. `lightness` compares only members in that OKLCH band,
    /// since near black and white no ink carries much chroma.
    public static func mostVivid(in inks:[String],lightness band:ClosedRange<Double>=0...1,minChroma:Double=0,readableOn:[String]=[],ratio minimum:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:readableOn,ratio:minimum,excluding:excluding).filter{band.contains(lightness($0)) && chroma($0)>=minChroma}){chroma($0)>chroma($1)}
    }
    /// The most neutral member.
    public static func leastVivid(in inks:[String],lightness band:ClosedRange<Double>=0...1,readableOn:[String]=[],ratio minimum:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:readableOn,ratio:minimum,excluding:excluding).filter{band.contains(lightness($0))}){chroma($0)<chroma($1)}
    }
    public static func lightest(in inks:[String],readableOn:[String]=[],ratio minimum:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:readableOn,ratio:minimum,excluding:excluding)){lightness($0)>lightness($1)}
    }
    public static func darkest(in inks:[String],readableOn:[String]=[],ratio minimum:Double=4.5,excluding:[String]=[])->String? {
        best(members(inks,readableOn:readableOn,ratio:minimum,excluding:excluding)){lightness($0)<lightness($1)}
    }
    /// Picks by position in an ordered ramp. Whole numbers work like Array.at (-1 is the last member);
    /// fractions between 0 and 1 pick a relative position, so 0.5 is the midtone however many stops there are.
    public static func nth(_ inks:[String],_ index:Double)->String? {
        guard !inks.isEmpty else{return nil}
        let n=inks.count
        if index.rounded()==index {let i=Int(index);let at=i<0 ? n+i:i;return inks.indices.contains(at) ? inks[at]:nil}
        guard (0...1).contains(index) else{return nil}
        return inks[Int((index*Double(n-1)).rounded())]
    }
    /// Steps along the ramp `ink` belongs to: +1 is the next member. Steps stop at the ends unless `wrap`.
    /// With `toward`, a positive step moves in the direction of that member instead of up the list.
    public static func sibling(_ ink:String,in ramp:[String],steps:Int,toward:String?=nil,wrap:Bool=false)->String? {
        let keys=ramp.map{$0.lowercased()}
        guard let i=keys.firstIndex(of:ink.lowercased()) else{return nil}
        var step=steps
        if let toward,let j=keys.firstIndex(of:toward.lowercased()),j<i{step = -steps}
        let n=ramp.count,target=i+step
        return ramp[wrap ? ((target%n)+n)%n:min(n-1,max(0,target))]
    }
}
