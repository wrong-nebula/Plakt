import Foundation
import CoreGraphics

/// Multi-ink palettes for material systems. A recipe's canonical inks record the source's color relationships;
/// generated posters keep those relationships but turn them toward the poster's own shape color.
public enum ShapeMaterials {
    static func hsb(_ hex:String)->(h:Double,s:Double,b:Double) {
        let v=Int(hex.dropFirst(),radix:16) ?? 0,r=Double((v>>16)&255)/255,g=Double((v>>8)&255)/255,b=Double(v&255)/255
        let high=max(r,g,b),low=min(r,g,b),d=high-low
        var h=0.0
        if d>0 {h=high==r ? ((g-b)/d).truncatingRemainder(dividingBy:6):high==g ? (b-r)/d+2:(r-g)/d+4;h*=60;if h<0{h+=360}}
        return (h,high==0 ? 0:d/high,high)
    }
    static func hex(_ h:Double,_ s:Double,_ b:Double)->String {
        let hue:Double=(h.truncatingRemainder(dividingBy:360)+360).truncatingRemainder(dividingBy:360)/60
        let c:Double=b*s,m:Double=b-c,x:Double=c*(1-abs(hue.truncatingRemainder(dividingBy:2)-1))
        let rgb:[Double]
        switch Int(hue) {
        case 0:rgb=[c,x,0]
        case 1:rgb=[x,c,0]
        case 2:rgb=[0,c,x]
        case 3:rgb=[0,x,c]
        case 4:rgb=[x,0,c]
        default:rgb=[c,0,x]
        }
        let bytes=rgb.map{Int((($0+m)*255).rounded())}
        return String(format:"#%02x%02x%02x",bytes[0],bytes[1],bytes[2])
    }
    /// sRGB blend of a color toward another; used for sheen, glow and two-tone fills.
    static func mix(_ a:CGColor,_ b:CGColor,_ t:Double)->CGColor {
        let x=a.converted(to:CGColorSpace(name:CGColorSpace.sRGB)!,intent:.defaultIntent,options:nil)?.components ?? [0,0,0,1]
        let y=b.converted(to:CGColorSpace(name:CGColorSpace.sRGB)!,intent:.defaultIntent,options:nil)?.components ?? [0,0,0,1]
        let k:CGFloat=min(1,max(0,t))
        var c:[CGFloat]=[]
        for i in 0..<4 {
            let from:CGFloat=x.count>i ? x[i]:1,to:CGFloat=y.count>i ? y[i]:1
            c.append(from*(1-k)+to*k)
        }
        return CGColor(colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!,components:c)!
    }
    public static func validate(_ inks:[String]?)throws {
        guard let inks else{return}
        guard (1...6).contains(inks.count),inks.allSatisfy({$0.count==7 && $0.hasPrefix("#") && Int($0.dropFirst(),radix:16) != nil}) else{throw PosterError.invalid("Inks must be 1–6 colors written as #rrggbb.")}
    }
    /// The full ink list for a recipe (shape color first), or nil for single-ink recipes.
    public static func palette(_ recipe:PosterShapeRecipe,primary:String,background:String?,seed:UInt64)->[String]? {
        guard let canon=recipe.inks,canon.count>1 else{return nil}
        // Light on dark (or dark on light): the second ink is whatever reads best against the shape color.
        if recipe.id=="survey-sliced-orb" {
            if let background,ShapeTypePlacement.contrastRatio(background,primary)>=4.5{return [primary,background]}
            let options=[background ?? "#f4f1e8","#f4f1e8","#141618"]
            return [primary,options.max{ShapeTypePlacement.contrastRatio($0,primary)<ShapeTypePlacement.contrastRatio($1,primary)}!]
        }
        // A graphic line system lives on figure and ground: the layout's own shape color, pushed until it reads at 3:1
        // against the paper, and a quieter second tone halfway to the paper.
        if recipe.id=="survey-sawtooth-spring",let background {
            let c=hsb(primary),dark=LibrarySceneRenderer.luminance(background)<=128
            var b=c.b,s=c.s,first=primary
            for _ in 0..<14 where ShapeTypePlacement.contrastRatio(first,background)<3 {
                if dark{b=min(1,b+0.08);s=max(0,s-0.03)}else{b=max(0,b-0.08)}
                first=hex(c.h,s,b)
            }
            let p=hsb(first),q=hsb(background)
            return [first,hex(s>0.12 ? p.h:q.h,(p.s+q.s)/2,(p.b+q.b)/2)]
        }
        var rng=SeededRandom(seed:seed ^ 0x494e4b53)
        let base=hsb(canon[0]),own=hsb(primary)
        // Chromatic shape colors steer the whole palette; neutral ones keep the source hues with a small seeded turn.
        let turn=own.s>=0.18 ? own.h-base.h:rng.value(-40,40)
        return canon.map{ink in
            let c=hsb(ink);var b=c.b
            if let background {
                let darken=LibrarySceneRenderer.luminance(background)>128
                var candidate=hex(c.h+turn,c.s,b)
                // Only enough separation from the paper to stay visible: yellow on cream should stay yellow.
                for _ in 0..<8 where ShapeTypePlacement.contrastRatio(candidate,background)<1.3 {b=darken ? b*0.85:min(1,b*1.15+0.05);candidate=hex(c.h+turn,c.s,b)}
                return candidate
            }
            return hex(c.h+turn,c.s,b)
        }
    }
}
