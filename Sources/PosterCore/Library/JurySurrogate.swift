import Foundation

/// Pre-render stand-in for the source-study jury: a LightGBM LambdaRank model trained on stored rounds
/// (scripts/jury-surrogate). It reads only the genome, so it can rank proposals before anything renders.
/// Scores are relative: compare proposals within one slot or round, never across studies.
public final class JurySurrogate:@unchecked Sendable {
    public static let shared=try? JurySurrogate()
    private final class Node {
        let feature:Int,threshold:Double,categories:Set<Int>?,defaultLeft:Bool,missing:String,value:Double
        let left:Node?,right:Node?
        init(_ json:[String:Any]) {
            if let leaf=json["v"] as? Double {value=leaf;feature = -1;threshold=0;categories=nil;defaultLeft=true;missing="None";left=nil;right=nil;return}
            value=0;feature=json["f"] as! Int;threshold=json["t"] as? Double ?? 0
            categories=(json["c"] as? [Int]).map(Set.init);defaultLeft=json["dl"] as? Bool ?? true;missing=json["m"] as? String ?? "None"
            left=Node(json["l"] as! [String:Any]);right=Node(json["r"] as! [String:Any])
        }
        func evaluate(_ x:[Double])->Double {
            guard let left,let right else{return value}
            var v=x[feature]
            if let categories {
                // LightGBM sends NaN and negative (unseen) categories right.
                guard v.isFinite,v>=0 else{return right.evaluate(x)}
                return (categories.contains(Int(v)) ? left:right).evaluate(x)
            }
            if missing=="NaN",v.isNaN {return (defaultLeft ? left:right).evaluate(x)}
            if missing=="Zero",v.isNaN || abs(v)<=1e-35 {return (defaultLeft ? left:right).evaluate(x)}
            if v.isNaN {v=0}
            return (v<=threshold ? left:right).evaluate(x)
        }
    }
    public let version:String
    private let features:[String],categorical:[String],vocab:[String:[String:Int]],trees:[Node]
    public init(url:URL?=nil)throws {
        guard let url=url ?? PosterResources.bundle.url(forResource:"JurySurrogate",withExtension:"json") else{throw PosterError.invalid("Missing JurySurrogate.json resource.")}
        let json=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        version=json["version"] as! String;features=json["features"] as! [String];categorical=json["categorical"] as! [String]
        vocab=json["vocab"] as! [String:[String:Int]];trees=(json["trees"] as! [[String:Any]]).map(Node.init)
    }
    /// Higher means the jury is predicted to rank this genome higher among its siblings.
    public func score(_ genome:StyleGenome,direction:String)throws->Double {
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        let g=try JSONSerialization.jsonObject(with:encoder.encode(genome)) as! [String:Any]
        let numeric=Self.features(g)
        let labels=["style":g["styleCategory"] as? String ?? "","font":g["font"] as? String ?? "","version":g["version"] as? String ?? "","direction":direction]
        let x=features.map{name->Double in
            if categorical.contains(name) {return Double(vocab[name]?[labels[name] ?? ""] ?? -1)}
            return numeric[name] ?? .nan
        }
        return trees.reduce(0){$0+$1.evaluate(x)}
    }

    // Mirrors scripts/jury-surrogate/extract.py `features` exactly; change both together.
    private static func rgb(_ hex:String)->(Double,Double,Double)? {
        let h=String(hex.drop{$0=="#"}.prefix(6))
        guard h.count==6,let v=UInt32(h,radix:16) else{return nil}
        return(Double(v>>16 & 255)/255,Double(v>>8 & 255)/255,Double(v & 255)/255)
    }
    private static func luminance(_ c:(Double,Double,Double))->Double {
        func f(_ v:Double)->Double{v<=0.03928 ? v/12.92:pow((v+0.055)/1.055,2.4)}
        return 0.2126*f(c.0)+0.7152*f(c.1)+0.0722*f(c.2)
    }
    private static func contrast(_ a:(Double,Double,Double),_ b:(Double,Double,Double))->Double {
        let la=luminance(a),lb=luminance(b)
        return(max(la,lb)+0.05)/(min(la,lb)+0.05)
    }
    /// Python colorsys.rgb_to_hls.
    private static func hls(_ c:(Double,Double,Double))->(Double,Double,Double) {
        let (r,g,b)=c,maxc=max(r,g,b),minc=min(r,g,b),sum=maxc+minc,range=maxc-minc,l=sum/2
        guard minc != maxc else{return(0,l,0)}
        let s=l<=0.5 ? range/sum:range/(2-maxc-minc)
        let rc=(maxc-r)/range,gc=(maxc-g)/range,bc=(maxc-b)/range
        let h=r==maxc ? bc-gc:(g==maxc ? 2+rc-bc:4+gc-rc)
        let wrapped=(h/6).truncatingRemainder(dividingBy:1)
        return(wrapped<0 ? wrapped+1:wrapped,l,s)
    }
    private static func stats(_ prefix:String,_ values:[Double],_ out:inout [String:Double]) {
        let xs=values.isEmpty ? [0]:values,n=Double(xs.count),m=xs.reduce(0,+)/n
        out[prefix+"_mean"]=m;out[prefix+"_max"]=xs.max()!;out[prefix+"_min"]=xs.min()!
        out[prefix+"_std"]=sqrt(xs.reduce(0){$0+($1-m)*($1-m)}/n)
    }
    private static func number(_ value:Any?,_ fallback:Double)->Double {(value as? NSNumber)?.doubleValue ?? fallback}
    static func features(_ g:[String:Any])->[String:Double] {
        var f:[String:Double]=[:]
        f["aspect"]=number(g["aspect"],1.414);f["textScale"]=number(g["textScale"],1);f["tracking"]=number(g["tracking"],0)
        f["layoutVariant"]=number(g["layoutVariant"],-1)
        f["n_typeSystems"]=Double((g["typeSystemIDs"] as? [Any])?.count ?? 0)
        let bg=rgb(g["background"] as? String ?? "#ffffff") ?? (1,1,1),bh=hls(bg)
        f["bg_h"]=bh.0;f["bg_l"]=bh.1;f["bg_s"]=bh.2;f["bg_lum"]=luminance(bg)
        let comp=g["composition"] as? [String:Any] ?? [:],grid=comp["grid"] as? [String:Any] ?? [:]
        f["whitespace_est"]=number(comp["estimatedWhitespace"],-1)
        f["n_regions"]=Double((comp["regions"] as? [Any])?.count ?? 0)
        f["n_constraints"]=Double((comp["constraints"] as? [Any])?.count ?? 0)
        f["n_hierarchy"]=Double((comp["hierarchy"] as? [Any])?.count ?? 0)
        let margins=grid["margins"] as? [String:Any] ?? [:]
        for k in ["top","bottom","left","right"]{f["margin_"+k]=number(margins[k],-1)}
        f["gutter"]=number(grid["gutter"],-1)

        let elements=g["elements"] as? [[String:Any]] ?? []
        f["n_elements"]=Double(elements.count)
        var kinds:[String:Int]=[:],colors:Set<String>=[],fonts:Set<String>=[]
        var areas:[Double]=[],textH:[Double]=[],textArea:[Double]=[],xs:[Double]=[],ys:[Double]=[],rots:[Double]=[],contrasts:[Double]=[],sats:[Double]=[]
        var bleed=0.0,outline=0.0,shadow=0.0,copied=0.0
        for e in elements {
            let kind=e["kind"] as? String ?? "?";kinds[kind,default:0]+=1
            let b=e["bounds"] as? [String:Any] ?? [:],w=number(b["width"],0),h=number(b["height"],0)
            let copies=number(e["copies"],1)
            areas.append(w*h*max(1,copies))
            xs.append(number(b["x"],0)+w/2);ys.append(number(b["y"],0)+h/2)
            rots.append(abs(number(e["rotation"],0)).truncatingRemainder(dividingBy:180))
            if let c=rgb(e["color"] as? String ?? "#000000") {
                colors.insert(String((e["color"] as? String ?? "").lowercased().prefix(7)))
                contrasts.append(contrast(c,bg));sats.append(hls(c).2)
            }
            if kind=="text" {textH.append(h);textArea.append(w*h);fonts.insert(e["fontName"] as? String ?? "\u{0}none")}
            if e["allowsBleed"] as? Bool == true {bleed+=1}
            if e["outline"] as? Bool == true {outline+=1}
            if e["shadow"] as? Bool == true {shadow+=1}
            if copies>1 {copied+=1}
        }
        let listed=["text","shape","image","path","line"]
        for k in listed{f["n_"+k]=Double(kinds[k] ?? 0)}
        f["n_kind_other"]=Double(elements.count-listed.reduce(0){$0+(kinds[$1] ?? 0)})
        f["coverage_sum"]=areas.reduce(0,+)
        stats("area",areas,&f);stats("text_h",textH,&f);stats("cx",xs,&f);stats("cy",ys,&f)
        stats("rot",rots,&f);stats("contrast",contrasts,&f);stats("sat",sats,&f)
        f["text_area_sum"]=textArea.reduce(0,+)
        if textH.isEmpty {f["title_ratio"]=0}
        else {let median=textH.sorted()[textH.count/2];f["title_ratio"]=textH.max()!/(median==0 ? 1e-3:median)}
        f["n_colors"]=Double(colors.count)
        f["n_bleed"]=bleed;f["n_outline"]=outline;f["n_shadow"]=shadow;f["n_copies"]=copied
        f["n_fonts"]=Double(fonts.count)
        return f
    }
}

/// What the pre-render filter did in one round, stored in round.json for later evaluation.
public struct SurrogateFilterLog:Codable,Sendable {
    public var model:String;public var proposalsPerSlot:Int
    /// Candidate ID → surrogate scores of every valid proposal built for that slot; the chosen one is the maximum.
    public var proposals:[String:[Double]]
}
