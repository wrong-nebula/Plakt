import Foundation
import CoreText
import CoreGraphics

/// Sets one line of type with explicit kerning. Every line starts from its plain advances; each gap then gets the
/// font's pair (metrics), a pair measured from the outlines (optical) or nothing, plus your pairs, your gap values,
/// the word space and the tracking. Lengths in the layout are in the font's points; kerning values are thousandths of an em.
public enum KerningSystem {
    public struct Placement {
        public var glyph:CGGlyph
        public var font:CTFont
        public var position:CGPoint
        /// UTF-16 offset of the glyph's character, as Core Text reports it.
        public var stringIndex:Int
        /// Index of the glyph's character (grapheme cluster) in the text.
        public var character:Int
    }
    public struct Gap {
        /// The gap follows this character.
        public var index:Int
        public var pair:String
        /// The font's own kerning for the pair.
        public var font:Double
        /// The optical measurement, when the line was measured.
        public var optical:Double?
        /// Your value for every occurrence of the pair, and for this one gap.
        public var pairValue:Double
        public var gapValue:Double
        /// What the line uses here: the mode's value plus your pair and gap values and the word space. Tracking is separate.
        public var applied:Double
        /// False inside a ligature, where both characters share one glyph.
        public var adjustable:Bool
        /// Midpoint between the two letters' ink, for labels.
        public var x:Double
        /// The measured white between the letters, one rectangle per band (y up from the baseline). Empty unless measured.
        public var white:[CGRect]
    }
    public struct Layout {
        public var text:String
        public var characters:[String]
        public var placements:[Placement]
        public var gaps:[Gap]
        public var path:CGMutablePath
        /// Font size: kerning values are thousandths of it.
        public var size:Double
        public var tracking:Double
    }

    // Optical measurement, in ems. Per band, each letter's white counts up to `side` (so the open side of a T, L or r does
    // not count endless white) and the distance between the two letters up to `total`. The measure mixes the mean band
    // (area) with the narrowest band (closest approach); bands with ink on one side only count `alone`. Type designers
    // close a little under half of the white this finds (fitted to the kerning of seven fonts), so strength 1 applies `gain`.
    static let bands=240,side=0.3,total=0.35,closest=0.6,alone=0.35,gain=0.44
    static let fontKey=NSAttributedString.Key(kCTFontAttributeName as String),kernKey=NSAttributedString.Key(kCTKernAttributeName as String)

    /// A layout depends only on its arguments, and the optical measure is costly (every letter is sliced into bands), while
    /// a poster sets the same line many times: fitting, measuring ink, every render pass. So equal requests share one
    /// computation. Each caller gets its own copy of the path.
    public static func layout(_ text:String,font:CTFont,tracking:Double,kerning:TextKerning,measure:Bool=false)->Layout {
        let key=LayoutKey(text:text,font:fontIdentity(font),tracking:tracking,kerning:kerning,measure:measure)
        var result=layoutCache.value(key){compute(text,font:font,tracking:tracking,kerning:kerning,measure:measure)}
        result.path=result.path.mutableCopy() ?? result.path
        return result
    }
    struct LayoutKey:Hashable {var text:String,font:String,tracking:Double,kerning:TextKerning,measure:Bool}
    /// Name, size, variation axes, matrix and file: two fonts that agree on all of these set a line the same way.
    static func fontIdentity(_ font:CTFont)->String {
        let variation=(CTFontCopyVariation(font) as? [NSNumber:NSNumber] ?? [:]).map{"\($0.key)=\($0.value)"}.sorted().joined(separator:",")
        let m=CTFontGetMatrix(font),url=(CTFontCopyAttribute(font,kCTFontURLAttribute) as? URL)?.path ?? ""
        return "\(CTFontCopyPostScriptName(font))|\(CTFontGetSize(font))|\(variation)|\(m.a),\(m.b),\(m.c),\(m.d),\(m.tx),\(m.ty)|\(url)"
    }
    final class LayoutCache:@unchecked Sendable {
        private let lock=NSLock()
        private var stored:[LayoutKey:Layout]=[:]
        /// Layouts are computed outside the lock: two threads may both compute a new line, and both get the same answer.
        func value(_ key:LayoutKey,_ make:()->Layout)->Layout {
            lock.lock();let hit=stored[key];lock.unlock()
            if let hit {return hit}
            let made=make()
            lock.lock();if stored.count>=4096 {stored.removeAll(keepingCapacity:true)};stored[key]=made;lock.unlock()
            return made
        }
    }
    static let layoutCache=LayoutCache()

    static func compute(_ text:String,font:CTFont,tracking:Double,kerning:TextKerning,measure:Bool)->Layout {
        let size=Double(CTFontGetSize(font)),unit=size/1000
        let characters=text.map{String($0)}
        var starts:[Int]=[],offset=0
        for c in characters {starts.append(offset);offset+=c.utf16.count}
        func character(_ utf16:Int)->Int {
            var lo=0,hi=max(0,starts.count-1)
            while lo<hi {let mid=(lo+hi+1)/2;if starts[mid]<=utf16 {lo=mid}else{hi=mid-1}}
            return lo
        }
        // A zero kern switches the font's pairs off: those are the plain advances every mode starts from.
        let plain=glyphs(text,[fontKey:font,kernKey:0],character),kerned=glyphs(text,[fontKey:font],character)
        var first:[Int:Double]=[:],firstKerned:[Int:Double]=[:]
        for p in plain where first[p.character]==nil {first[p.character]=Double(p.position.x)}
        for p in kerned where firstKerned[p.character]==nil {firstKerned[p.character]=Double(p.position.x)}
        // Characters without a glyph of their own (inside a ligature) belong to the character before them.
        var owner=Array(characters.indices)
        for i in characters.indices where first[i]==nil {owner[i]=i>0 ? owner[i-1]:i}
        var paths:[Int:CGMutablePath]=[:]
        for p in plain {
            guard let g=CTFontCreatePathForGlyph(p.font,p.glyph,nil) else{continue}
            let cluster=paths[owner[p.character]] ?? CGMutablePath()
            cluster.addPath(g,transform:CGAffineTransform(translationX:p.position.x,y:p.position.y));paths[owner[p.character]]=cluster
        }
        let optical=kerning.mode == .optical || measure
        let profiles=optical ? paths.mapValues{profile($0,font:font)}:[:]
        let target=optical ? targets(font:font):nil
        var gaps:[Gap]=[],shift=[Double](repeating:0,count:characters.count+1)
        var measured:[(index:Int,left:Int,right:Int)]=[]
        for i in 0..<max(0,characters.count-1) {
            let left=owner[i],right=i+1,adjustable=first[right] != nil
            var g=Gap(index:i,pair:TextKerning.pairKey(characters[i],characters[i+1]),font:0,optical:nil,pairValue:0,gapValue:0,applied:0,adjustable:adjustable,x:0,white:[])
            if adjustable,let a=first[left],let b=first[right],let ka=firstKerned[left],let kb=firstKerned[right] {g.font=((kb-ka)-(b-a))/unit}
            if adjustable,optical,let l=profiles[left],let r=profiles[right] {measured.append((i,left,right))}
            gaps.append(g)
        }
        // Optical: move every measured pair to the white of an even pair of its case (or, without reference letters, this line's median).
        if optical {
            let values=measured.map{profiles[$0.left]!.measure(to:profiles[$0.right]!)}.sorted(),median=values.dropFirst(values.count/2).first ?? 0
            for m in measured {
                let l=profiles[m.left]!,r=profiles[m.right]!,upper=[characters[m.index],characters[m.index+1]].allSatisfy{$0.first.map{$0.isUppercase || $0.isNumber} ?? false}
                var k=l.solve(r,target:(upper ? target?.upper:target?.lower) ?? median)
                k=gain*kerning.strength*k+kerning.tightness*unit
                if let minimum=kerning.minimumGap,let near=l.nearest(r) {k=max(k,min(0,minimum*unit-near))}
                gaps[m.index].optical=max(-0.3*size,k)/unit
            }
        }
        for i in gaps.indices where gaps[i].adjustable {
            let mode=kerning.mode == .metrics ? gaps[i].font:kerning.mode == .optical ? gaps[i].optical ?? 0:0
            gaps[i].pairValue=kerning.pairs[gaps[i].pair] ?? 0;gaps[i].gapValue=kerning.gap(i,in:text)
            let space=characters[i].allSatisfy(\.isWhitespace) ? kerning.wordSpace:0
            gaps[i].applied=mode+gaps[i].pairValue+gaps[i].gapValue+space
        }
        // Tracking follows every glyph, as Core Text applies it: none inside a ligature.
        for i in gaps.indices {shift[i+1]=shift[i]+(gaps[i].adjustable ? gaps[i].applied*unit+tracking:0)}
        var placements=plain,path=CGMutablePath()
        for j in placements.indices {
            placements[j].position.x+=shift[placements[j].character]
            if let g=CTFontCreatePathForGlyph(placements[j].font,placements[j].glyph,nil) {path.addPath(g,transform:CGAffineTransform(translationX:placements[j].position.x,y:placements[j].position.y))}
        }
        // Label positions and, when measured, the white each band leaves between the two letters as they now sit.
        for i in gaps.indices {
            let left=owner[i],right=i+1,dl=shift[left],dr=shift[right]
            let lb=paths[left]?.boundingBoxOfPath,rb=paths[right]?.boundingBoxOfPath
            switch (lb,rb) {
            case let (l?,r?):gaps[i].x=(Double(l.maxX)+dl+Double(r.minX)+dr)/2
            case let (l?,nil):gaps[i].x=Double(l.maxX)+dl
            case let (nil,r?):gaps[i].x=Double(r.minX)+dr
            default:gaps[i].x=(first[right] ?? 0)+dr
            }
            if let l=profiles[left],let r=profiles[right],gaps[i].adjustable {gaps[i].white=l.white(to:r,shiftLeft:dl,shiftRight:dr)}
        }
        return Layout(text:text,characters:characters,placements:placements,gaps:gaps,path:path,size:size,tracking:tracking)
    }

    static func glyphs(_ text:String,_ attributes:[NSAttributedString.Key:Any],_ character:(Int)->Int)->[Placement] {
        let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:attributes))
        var out:[Placement]=[]
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let count=CTRunGetGlyphCount(run)
            var glyphs=[CGGlyph](repeating:0,count:count),positions=[CGPoint](repeating:.zero,count:count),indices=[CFIndex](repeating:0,count:count)
            CTRunGetGlyphs(run,CFRange(location:0,length:count),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:count),&positions);CTRunGetStringIndices(run,CFRange(location:0,length:count),&indices)
            let runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
            for i in 0..<count {out.append(Placement(glyph:glyphs[i],font:runFont,position:positions[i],stringIndex:indices[i],character:character(indices[i])))}
        }
        return out
    }

    /// Each band's leftmost and rightmost ink (NaN where a band has none), across the font's full height.
    struct Profile {
        var left:[Double],right:[Double],minX:Double,maxX:Double
        var y0:Double,step:Double,tall:Bool
        var cap:Double,xHeight:Double,side:Double,total:Double,size:Double
        func zone(with other:Profile)->Range<Int> {
            let top=tall && other.tall ? cap:xHeight
            return max(0,Int((0-y0)/step))..<min(left.count,Int((top-y0)/step))
        }
        /// Measured white between this letter and `other` once `other` moves `k` points from its plain advance.
        func measure(to other:Profile,shift k:Double=0)->Double {
            var sum=0.0,least=Double.infinity,n=0.0
            let d=other.minX+k-maxX
            for b in zone(with:other) {
                let l=right[b],r=other.left[b],g=min(total,d+(l.isNaN ? side:min(side,maxX-l))+(r.isNaN ? side:min(side,r-other.minX)))
                // A band with ink on one side only (the dot of a period beside an r) counts for less.
                let weight=l.isNaN || r.isNaN ? KerningSystem.alone:1
                sum+=g*weight;n+=weight
                if weight==1 {least=min(least,g)}
            }
            guard n>0 else{return d}
            let mean=sum/n
            return (1-KerningSystem.closest)*mean+KerningSystem.closest*(least.isFinite ? least:mean)
        }
        /// The shift of `other` that brings the measured white to `target`. The measure only grows with the shift.
        func solve(_ other:Profile,target:Double)->Double {
            var lo = -0.5*size,hi=0.5*size
            if measure(to:other,shift:lo)>=target {return lo}
            if measure(to:other,shift:hi)<=target {return hi}
            for _ in 0..<40 {let mid=(lo+hi)/2;if measure(to:other,shift:mid)<target {lo=mid}else{hi=mid}}
            return (lo+hi)/2
        }
        /// Closest horizontal approach of the two inks at their plain advances, over every band both have ink in.
        func nearest(_ other:Profile)->Double? {
            var near:Double?=nil
            for b in left.indices where !right[b].isNaN && !other.left[b].isNaN {near=min(near ?? .infinity,other.left[b]-right[b])}
            return near
        }
        func white(to other:Profile,shiftLeft:Double,shiftRight:Double)->[CGRect] {
            zone(with:other).compactMap{b in
                let x0=(right[b].isNaN ? maxX-side:max(right[b],maxX-side))+shiftLeft,x1=min(x0+total,(other.left[b].isNaN ? other.minX+side:min(other.left[b],other.minX+side))+shiftRight)
                return x1>x0 ? CGRect(x:x0,y:y0+Double(b)*step,width:x1-x0,height:step):nil
            }
        }
    }
    static func profile(_ path:CGPath,font:CTFont)->Profile {
        let ascent=Double(CTFontGetAscent(font)),descent=Double(CTFontGetDescent(font)),size=Double(CTFontGetSize(font))
        let box=path.boundingBoxOfPath,y0=min(-descent,Double(box.minY)),y1=max(ascent,Double(box.maxY)),step=(y1-y0)/Double(bands)
        var left=[Double](repeating:.nan,count:bands),right=[Double](repeating:.nan,count:bands)
        let segments=flatten(path)
        for b in 0..<bands {
            let y=y0+(Double(b)+0.5)*step
            for (p,q) in segments where (p.y<=y) != (q.y<=y) {
                let x=p.x+(y-p.y)/(q.y-p.y)*(q.x-p.x)
                left[b]=left[b].isNaN ? x:min(left[b],x);right[b]=right[b].isNaN ? x:max(right[b],x)
            }
        }
        let xs=left.filter{!$0.isNaN},xh=Double(CTFontGetXHeight(font)),cap=Double(CTFontGetCapHeight(font))
        return Profile(left:left,right:right,minX:xs.min() ?? Double(box.minX),maxX:right.filter{!$0.isNaN}.max() ?? Double(box.maxX),
                       y0:y0,step:step,tall:Double(box.maxY)>xh*1.2,cap:cap,xHeight:xh,side:side*size,total:total*size,size:size)
    }
    static func flatten(_ path:CGPath)->[(CGPoint,CGPoint)] {
        var out:[(CGPoint,CGPoint)]=[],start=CGPoint.zero,current=CGPoint.zero
        // Bézier points as weighted sums of their control points.
        func mix(_ points:[CGPoint],_ weights:[CGFloat])->CGPoint {
            var x:CGFloat=0,y:CGFloat=0
            for (p,w) in zip(points,weights) {x+=p.x*w;y+=p.y*w}
            return CGPoint(x:x,y:y)
        }
        func curve(_ points:[CGPoint],steps:Int) {
            for s in 1...steps {
                let t=CGFloat(s)/CGFloat(steps),u=1-t
                let p=points.count==3 ? mix(points,[u*u,2*u*t,t*t]):mix(points,[u*u*u,3*u*u*t,3*u*t*t,t*t*t])
                out.append((current,p));current=p
            }
        }
        path.applyWithBlock {e in
            let p=e.pointee.points
            switch e.pointee.type {
            case .moveToPoint:start=p[0];current=p[0]
            case .addLineToPoint:out.append((current,p[0]));current=p[0]
            case .addQuadCurveToPoint:curve([current,p[0],p[1]],steps:10)
            case .addCurveToPoint:curve([current,p[0],p[1],p[2]],steps:14)
            case .closeSubpath:if current != start {out.append((current,start))};current=start
            @unknown default:break
            }
        }
        return out
    }
    /// The white an evenly spaced pair of the font leaves, for capitals (HH HO OO OH) and lowercase (nn no oo on).
    static func targets(font:CTFont)->(upper:Double,lower:Double)? {
        func mean(_ text:String)->Double? {
            let chars=Array(text.utf16);var glyphs=[CGGlyph](repeating:0,count:chars.count)
            guard CTFontGetGlyphsForCharacters(font,chars,&glyphs,chars.count),!glyphs.contains(0) else{return nil}
            let placed=KerningSystem.glyphs(text,[fontKey:font,kernKey:0]){$0}
            let profiles=placed.compactMap{p in CTFontCreatePathForGlyph(p.font,p.glyph,nil).map{g in let m=CGMutablePath();m.addPath(g,transform:CGAffineTransform(translationX:p.position.x,y:p.position.y));return profile(m,font:font)}}
            guard profiles.count==chars.count else{return nil}
            let values=zip(profiles,profiles.dropFirst()).map{$0.measure(to:$1)}
            return values.reduce(0,+)/Double(values.count)
        }
        guard let upper=mean("HHOOH") else{return nil}
        return (upper,mean("nnoon") ?? upper)
    }
}
