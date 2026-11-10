import Foundation
import CoreGraphics

public struct NamedSwatch:Codable,Sendable {
    public var hex:String;public var name:String;public var namedHex:String;public var basicFamily:String
    public var proportion:Double;public var lightness:Double;public var chroma:Double;public var hue:Double?
    public var nameDistanceOKLab:Double;public var gamutMapped:Bool
    public init(hex:String,name:String,namedHex:String,basicFamily:String,proportion:Double,lightness:Double,chroma:Double,hue:Double?,nameDistanceOKLab:Double,gamutMapped:Bool) {
        self.hex=hex;self.name=name;self.namedHex=namedHex;self.basicFamily=basicFamily;self.proportion=proportion;self.lightness=lightness;self.chroma=chroma;self.hue=hue;self.nameDistanceOKLab=nameDistanceOKLab;self.gamutMapped=gamutMapped
    }
}
public struct ColorHarmony:Codable,Sendable {
    public var type:String;public var score:Double;public var residualDegrees:Double
    public var note:String
}
public struct PosterColorProfile:Codable,Sendable {
    public var version="oklab-weighted-kmeans-v2"
    public var nameSource:String
    public var swatches:[NamedSwatch]
    public var paletteTypes:[String]
    public var harmonies:[ColorHarmony]
    public var neutralProportion:Double
    public var meanLightness:Double
    public var meanChroma:Double
    public var colorEmbedding:[Double]
    public var colorEmbeddingSchema="oklch-4-lightness-x-12-hue-plus-4-neutral-v1"
    public var note="Measured from photographed/rectified sRGB pixels, not original printing inks. Names are nearest catalog matches; harmony scores are geometric suggestions, not calibrated probabilities or evidence of designer intent."
    public var searchText:String {(swatches.flatMap{[$0.name,$0.basicFamily,$0.hex]}+paletteTypes+harmonies.filter{$0.score>=0.65}.map(\.type)).joined(separator:" ").lowercased()}
}

public enum PerceptualColor {
    public struct Lab:Sendable {
        public var l:Double;public var a:Double;public var b:Double
        public init(l:Double,a:Double,b:Double){self.l=l;self.a=a;self.b=b}
    }
    public static func fromRGB(_ r:Double,_ g:Double,_ b:Double)->Lab {
        func linear(_ x:Double)->Double {x<=0.04045 ? x/12.92:pow((x+0.055)/1.055,2.4)}
        let r=linear(r),g=linear(g),b=linear(b)
        let l=cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b)
        let m=cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b)
        let s=cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b)
        return Lab(l:0.2104542553*l+0.7936177850*m-0.0040720468*s,a:1.9779984951*l-2.4285922050*m+0.4505937099*s,b:0.0259040371*l+0.7827717662*m-0.8086757660*s)
    }
    public static func fromHex(_ hex:String)->Lab {let n=Int(hex.dropFirst(),radix:16) ?? 0;return fromRGB(Double((n>>16)&255)/255,Double((n>>8)&255)/255,Double(n&255)/255)}
    public static func rawRGB(_ c:Lab)->[Double] {
        let l=pow(c.l+0.3963377774*c.a+0.2158037573*c.b,3),m=pow(c.l-0.1055613458*c.a-0.0638541728*c.b,3),s=pow(c.l-0.0894841775*c.a-1.2914855480*c.b,3)
        func gamma(_ x:Double)->Double {x<=0.0031308 ? 12.92*x:1.055*pow(x,1/2.4)-0.055}
        return [gamma(4.0767416621*l-3.3077115913*m+0.2309699292*s),gamma(-1.2684380046*l+2.6097574011*m-0.3413193965*s),gamma(-0.0041960863*l-0.7034186147*m+1.7076147010*s)]
    }
    public static func hex(_ value:Lab)->(String,Bool) {
        var value=value;let original=rawRGB(value);let mapped=original.contains{$0 < -0.00001 || $0>1.00001}
        if mapped {let a=value.a,b=value.b;var low=0.0,high=1.0;for _ in 0..<24 {let t=(low+high)/2;let rgb=rawRGB(Lab(l:value.l,a:a*t,b:b*t));if rgb.allSatisfy({$0>=0&&$0<=1}){low=t}else{high=t}};value.a=a*low;value.b=b*low}
        let rgb=rawRGB(value).map{Int((min(1,max(0,$0))*255).rounded())}
        return (String(format:"#%02x%02x%02x",rgb[0],rgb[1],rgb[2]),mapped)
    }
    public static func squared(_ a:Lab,_ b:Lab)->Double {pow(a.l-b.l,2)+pow(a.a-b.a,2)+pow(a.b-b.b,2)}
    public static func hue(_ lab:Lab)->Double {let h=atan2(lab.b,lab.a)*180 / .pi;return h<0 ? h+360:h}
    public static func angle(_ a:Double,_ b:Double)->Double {let d=abs(a-b).truncatingRemainder(dividingBy:360);return min(d,360-d)}
    public static func family(_ c:Lab)->String {
        let chroma=hypot(c.a,c.b),h=hue(c)
        if chroma<0.035 {return c.l<0.22 ? "black":c.l>0.93 ? "white":"gray"}
        if h>=25&&h<90&&c.l<0.62 {return "brown"}
        switch h {case 0..<40:return c.l>0.77 ? "pink":"red";case 40..<75:return "orange";case 75..<115:return "yellow";case 115..<165:return "green";case 165..<225:return "cyan";case 225..<285:return "blue";case 285..<330:return "purple";default:return "pink"}
    }
}

private struct ColorNameTree:Sendable {
    struct Entry:Decodable,Sendable {var name:String;var hex:String}
    struct Node:Sendable {var entry:Entry;var point:PerceptualColor.Lab;var axis:Int;var left:Int;var right:Int}
    let nodes:[Node];let root:Int;let source:String
    init(){
        let url=PosterResources.bundle.url(forResource:"meodai-colornames",withExtension:"json",subdirectory:"Resources")
        let data=url.flatMap{try? Data(contentsOf:$0)}
        let decoded=data.flatMap{try? JSONDecoder().decode([Entry].self,from:$0)}
        let entries=decoded ?? [Entry(name:"Black",hex:"#000000"),Entry(name:"White",hex:"#ffffff")]
        source=decoded==nil ? "fallback-basic-colors":"meodai/color-name-list@14.86.0 (MIT)"
        var storage:[Node]=[]
        func component(_ c:PerceptualColor.Lab,_ axis:Int)->Double {axis==0 ? c.l:axis==1 ? c.a:c.b}
        func build(_ values:[(Entry,PerceptualColor.Lab)],_ depth:Int)->Int {
            guard !values.isEmpty else{return -1};let axis=depth%3
            let sorted=values.sorted{let a=component($0.1,axis),b=component($1.1,axis);return a==b ? $0.0.name<$1.0.name:a<b}
            let middle=sorted.count/2,index=storage.count
            storage.append(Node(entry:sorted[middle].0,point:sorted[middle].1,axis:axis,left:-1,right:-1))
            let left=build(Array(sorted[..<middle]),depth+1),right=build(Array(sorted.dropFirst(middle+1)),depth+1)
            storage[index].left=left;storage[index].right=right;return index
        }
        root=build(entries.map{($0,PerceptualColor.fromHex($0.hex))},0);nodes=storage
    }
    func nearest(_ point:PerceptualColor.Lab)->(Entry,Double) {
        var best=root,distance=Double.infinity
        func visit(_ index:Int){guard index>=0 else{return};let node=nodes[index],d=PerceptualColor.squared(point,node.point)
            if d<distance {distance=d;best=index}
            let delta=node.axis==0 ? point.l-node.point.l:node.axis==1 ? point.a-node.point.a:point.b-node.point.b
            visit(delta<0 ? node.left:node.right);if delta*delta<distance {visit(delta<0 ? node.right:node.left)}
        };visit(root);return(nodes[best].entry,sqrt(distance))
    }
}

public final class PosterColorAnalyzer:Sendable {
    private static let names=ColorNameTree()
    public init(){}
    public func renamed(_ profile:PosterColorProfile)->PosterColorProfile {
        var profile=profile
        profile.version="oklab-weighted-kmeans-v2";profile.nameSource=Self.names.source
        for i in profile.swatches.indices {
            let s=profile.swatches[i],h=(s.hue ?? 0)*Double.pi/180
            let lab=PerceptualColor.Lab(l:s.lightness,a:s.chroma*cos(h),b:s.chroma*sin(h))
            // Near-neutral hue is omitted in the profile; the measured hex retains its actual chroma direction.
            let match=Self.names.nearest(s.hue==nil ? PerceptualColor.fromHex(s.hex):lab)
            profile.swatches[i].name=match.0.name;profile.swatches[i].namedHex=match.0.hex;profile.swatches[i].nameDistanceOKLab=match.1
        }
        return profile
    }
    public func analyze(_ image:CGImage)throws->PosterColorProfile {
        let size=64;var pixels=[UInt8](repeating:0,count:size*size*4)
        let ok=pixels.withUnsafeMutableBytes{buffer->Bool in
            guard let ctx=CGContext(data:buffer.baseAddress,width:size,height:size,bitsPerComponent:8,bytesPerRow:size*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
            ctx.interpolationQuality = .medium;ctx.draw(image,in:CGRect(x:0,y:0,width:size,height:size));return true
        };guard ok else{throw PosterError.render}
        var bins:[Int:(Double,Double,Double,Double)]=[:]
        for i in stride(from:0,to:pixels.count,by:4) where pixels[i+3]>16 {
            let r=Int(pixels[i]),g=Int(pixels[i+1]),b=Int(pixels[i+2]),key=(r/16)*256+(g/16)*16+b/16
            let old=bins[key] ?? (0,0,0,0);bins[key]=(old.0+Double(r)/255,old.1+Double(g)/255,old.2+Double(b)/255,old.3+1)
        }
        let samples=bins.sorted{$0.key<$1.key}.map{_ ,v in (PerceptualColor.fromRGB(v.0/v.3,v.1/v.3,v.2/v.3),v.3)}
        guard let first=samples.max(by:{$0.1<$1.1}) else{throw PosterError.invalid("Image has no opaque color samples.")}
        var centers=[first.0]
        while centers.count<min(6,samples.count) {
            let candidate=samples.max{a,b in
                let da=centers.map{PerceptualColor.squared(a.0,$0)}.min() ?? 0,db=centers.map{PerceptualColor.squared(b.0,$0)}.min() ?? 0
                return da*sqrt(a.1)<db*sqrt(b.1)
            }!
            if (centers.map{PerceptualColor.squared(candidate.0,$0)}.min() ?? 0)<0.0012 {break};centers.append(candidate.0)
        }
        var masses=[Double](repeating:0,count:centers.count)
        for _ in 0..<9 {
            var totals=[(Double,Double,Double)](repeating:(0,0,0),count:centers.count);masses=Array(repeating:0,count:centers.count)
            for (point,weight) in samples {let i=centers.indices.min{PerceptualColor.squared(point,centers[$0])<PerceptualColor.squared(point,centers[$1])}!;masses[i]+=weight;totals[i].0+=point.l*weight;totals[i].1+=point.a*weight;totals[i].2+=point.b*weight}
            for i in centers.indices where masses[i]>0 {centers[i]=PerceptualColor.Lab(l:totals[i].0/masses[i],a:totals[i].1/masses[i],b:totals[i].2/masses[i])}
        }
        let total=masses.reduce(0,+)
        var swatches:[NamedSwatch]=[]
        for i in centers.indices where masses[i]/total>=0.008 {
            let lab=centers[i],(hex,mapped)=PerceptualColor.hex(lab),match=Self.names.nearest(lab),chroma=hypot(lab.a,lab.b)
            swatches.append(NamedSwatch(hex:hex,name:match.0.name,namedHex:match.0.hex,basicFamily:PerceptualColor.family(lab),proportion:masses[i]/total,lightness:lab.l,chroma:chroma,hue:chroma<0.035 ? nil:PerceptualColor.hue(lab),nameDistanceOKLab:match.1,gamutMapped:mapped))
        }
        let retained=swatches.reduce(0){$0+$1.proportion};for i in swatches.indices{swatches[i].proportion/=retained}
        swatches.sort{$0.proportion>$1.proportion}
        return Self.profile(swatches:swatches,nameSource:Self.names.source)
    }
    public static func profile(swatches:[NamedSwatch],nameSource:String)->PosterColorProfile {
        let neutral=swatches.filter{$0.hue==nil}.reduce(0){$0+$1.proportion}
        let lightness=swatches.reduce(0){$0+$1.lightness*$1.proportion},chroma=swatches.reduce(0){$0+$1.chroma*$1.proportion}
        var hues:[(Double,Double)]=[]
        for swatch in swatches where swatch.proportion>=0.04 && swatch.chroma>=0.04 {
            guard let hue=swatch.hue else{continue}
            if let i=hues.firstIndex(where:{PerceptualColor.angle($0.0,hue)<22}) {
                let old=hues[i],weight=old.1+swatch.proportion
                let x=cos(old.0 * .pi/180)*old.1+cos(hue * .pi/180)*swatch.proportion,y=sin(old.0 * .pi/180)*old.1+sin(hue * .pi/180)*swatch.proportion
                let angle=atan2(y,x)*180 / .pi;hues[i]=(angle<0 ? angle+360:angle,weight)
            }else{hues.append((hue,swatch.proportion))}
        }
        var types:[String]=[],harmonies:[ColorHarmony]=[]
        if neutral>0.93||hues.isEmpty {types += ["achromatic","neutral"];harmonies.append(ColorHarmony(type:"achromatic",score:min(1,neutral),residualDegrees:0,note:"Hue is undefined for near-neutral swatches."))}
        else if hues.count==1 {types.append("single-hue-with-neutrals");harmonies.append(ColorHarmony(type:"monochromatic",score:0.9,residualDegrees:0,note:"One dominant chromatic hue family, optionally with neutrals."))}
        else {
            let templates:[(String,[Double])]=[("complementary",[0,180]),("triadic",[0,120,240]),("split-complementary",[0,150,210]),("tetradic",[0,60,180,240]),("square",[0,90,180,270])]
            for (name,pattern) in templates where pattern.count==hues.count {
                var best=Double.infinity
                for hue in hues {for step in pattern {
                    let base=hue.0-step
                    let forward=pattern.map{p in hues.map{PerceptualColor.angle($0.0,base+p)}.min() ?? 180}.reduce(0,+)/Double(pattern.count)
                    let reverse=hues.map{h in (pattern.map{PerceptualColor.angle(h.0,base+$0)}.min() ?? 180)*h.1}.reduce(0,+)/max(0.001,hues.reduce(0){$0+$1.1})
                    best=min(best,(forward+reverse)/2)
                }}
                harmonies.append(ColorHarmony(type:name,score:exp(-pow(best/22,2)),residualDegrees:best,note:"Dominant OKLCH hue-cluster template fit; near-neutral and tiny swatches excluded."))
            }
            let extent=hues.map{base in hues.map{h in (h.0-base.0+360).truncatingRemainder(dividingBy:360)}.max() ?? 0}.min() ?? 360
            harmonies.append(ColorHarmony(type:"analogous",score:extent<=75 ? max(0.2,1-extent/110):0,residualDegrees:extent,note:"Smallest arc covering dominant chromatic hue clusters."))
            types.append(harmonies.contains{$0.score>=0.65} ? "harmony-aligned":"multi-hue")
        }
        if swatches.filter({$0.proportion>0.08}).count<=3 {types.append("limited-palette")}
        if neutral>0.15&&neutral<0.93 {types.append("color-with-neutral-support")}
        if lightness<0.38 {types.append("dark")}else if lightness>0.75 {types.append("light")}
        if chroma<0.06 {types.append("muted")}else if chroma>0.13 {types.append("vivid")}
        if lightness>0.75&&chroma>=0.04&&chroma<0.12 {types.append("pastel")}
        if let lo=swatches.map(\.lightness).min(),let hi=swatches.map(\.lightness).max(),hi-lo>0.6 {types.append("wide-lightness-contrast")}
        let chromaticWeight=hues.reduce(0){$0+$1.1},warm=hues.filter{$0.0<110||$0.0>330}.reduce(0){$0+$1.1}/max(0.001,chromaticWeight)
        if chromaticWeight>0.1 {types.append(warm>0.7 ? "warm":warm<0.3 ? "cool":"mixed-temperature")}
        var vector=[Double](repeating:0,count:52)
        for swatch in swatches {
            let l=min(3,max(0,Int(swatch.lightness*4)))
            if let hue=swatch.hue {let h=min(11,Int(hue/30));vector[l*12+h]+=swatch.proportion}else{vector[48+l]+=swatch.proportion}
        }
        let norm=sqrt(vector.reduce(0){$0+$1*$1});if norm>0{vector=vector.map{$0/norm}}
        return PosterColorProfile(nameSource:nameSource,swatches:swatches,paletteTypes:types.sorted(),harmonies:harmonies.sorted{$0.score>$1.score},neutralProportion:neutral,meanLightness:lightness,meanChroma:chroma,colorEmbedding:vector)
    }
}
