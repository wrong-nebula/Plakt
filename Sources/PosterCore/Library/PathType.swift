import Foundation
import CoreGraphics
import CoreText

/// Glyph outlines set along a polyline: each glyph sits on the line at its own arc length, turned to the local
/// tangent, with its top to the left of travel. Text repeats until the line is full.
enum PathType {
    static func along(_ points:[CGPoint],text:String,font:CTFont,size:Double,lift:Double=0,repeating:Bool=true)->CGPath {
        let output=CGMutablePath()
        guard points.count>1,size>0,!text.trimmingCharacters(in:.whitespaces).isEmpty else{return output}
        var lengths=[0.0]
        for i in 1..<points.count{lengths.append(lengths[i-1]+hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y))}
        let total=lengths.last!
        guard total>0 else{return output}
        func locate(_ s:Double)->(CGPoint,Double) {
            var i=1
            while i<lengths.count-1 && lengths[i]<s{i+=1}
            let a=points[i-1],b=points[i],span=max(0.000001,lengths[i]-lengths[i-1]),t=min(1,max(0,(s-lengths[i-1])/span))
            return (CGPoint(x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t),atan2(b.y-a.y,b.x-a.x))
        }
        // Glyph outlines and advances at a 100-unit size, so `size` is the em in the caller's units.
        let line=CTLineCreateWithAttributedString(NSAttributedString(string:text+"   ",attributes:[.font:font]))
        var glyphs:[(CGPath,Double,Double)]=[]
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let count=CTRunGetGlyphCount(run)
            var ids=[CGGlyph](repeating:0,count:count),positions=[CGPoint](repeating:.zero,count:count),advances=[CGSize](repeating:.zero,count:count)
            CTRunGetGlyphs(run,CFRange(location:0,length:count),&ids);CTRunGetPositions(run,CFRange(location:0,length:count),&positions);CTRunGetAdvances(run,CFRange(location:0,length:count),&advances)
            let runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
            for i in 0..<count{glyphs.append((CTFontCreatePathForGlyph(runFont,ids[i],nil) ?? CGMutablePath(),positions[i].x,advances[i].width))}
        }
        let width=CTLineGetTypographicBounds(line,nil,nil,nil)
        guard width>0,!glyphs.isEmpty else{return output}
        let scale=size/100,cap=CTFontGetCapHeight(font)
        var offset=0.0
        repeat {
            for (path,x,advance) in glyphs {
                let middle=offset+(x+advance/2)*scale
                guard middle+advance*scale/2<=total else{return output}
                let (point,angle)=locate(middle)
                // Lift moves the baseline to the left of travel; glyphs centre on the line by half their cap height.
                let normal=CGPoint(x:sin(angle),y:-cos(angle)),shift=lift-cap*scale/2
                var t=CGAffineTransform(translationX:point.x+normal.x*shift,y:point.y+normal.y*shift).rotated(by:angle).scaledBy(x:scale,y:-scale).translatedBy(x:-advance/2,y:0)
                if let placed=path.copy(using:&t){output.addPath(placed)}
            }
            offset+=width*scale
        } while repeating && offset<total
        return output
    }
}
