import Foundation
import CoreGraphics
import CoreText

/// Glyph-component substitution, independent of font file format. Never masks a
/// guessed rectangle over a word: the selected dot contour is replaced in glyph space.
enum TypeGlyphs {
    static func heartTittle(_ glyph:CGPath,font:CTFont,scale:Double)->(CGPath,Bool) {
        var components:[CGPath]=[],current:CGMutablePath?
        glyph.applyWithBlock{pointer in
            let e=pointer.pointee
            switch e.type {
            case .moveToPoint:
                if let p=current{components.append(p)}
                let p=CGMutablePath();p.move(to:e.points[0]);current=p
            case .addLineToPoint:current?.addLine(to:e.points[0])
            case .addQuadCurveToPoint:current?.addQuadCurve(to:e.points[1],control:e.points[0])
            case .addCurveToPoint:current?.addCurve(to:e.points[2],control1:e.points[0],control2:e.points[1])
            case .closeSubpath:if let p=current{p.closeSubpath();components.append(p);current=nil}
            @unknown default:break
            }
        }
        if let p=current{components.append(p)}
        let cap=CTFontGetCapHeight(font)
        let candidates=components.indices.filter{i in let b=components[i].boundingBoxOfPath;return b.height<cap*0.38 && b.minY>cap*0.52 && b.width<cap*0.45}
        guard let dot=candidates.max(by:{components[$0].boundingBoxOfPath.maxY<components[$1].boundingBoxOfPath.maxY}),components.count>=2 else{return(glyph,false)}
        let box=components[dot].boundingBoxOfPath,s=max(0.8,min(2.5,scale)),w=box.width*s,h=max(box.height,box.width)*s
        let r=CGRect(x:box.midX-w/2,y:box.midY-h/2,width:w,height:h),heart=CGMutablePath()
        heart.move(to:CGPoint(x:r.midX,y:r.minY))
        heart.addCurve(to:CGPoint(x:r.minX,y:r.minY+r.height*0.65),control1:CGPoint(x:r.minX+r.width*0.30,y:r.minY+r.height*0.28),control2:CGPoint(x:r.minX,y:r.minY+r.height*0.45))
        heart.addCurve(to:CGPoint(x:r.midX,y:r.minY+r.height*0.78),control1:CGPoint(x:r.minX,y:r.maxY+r.height*0.12),control2:CGPoint(x:r.midX-r.width*0.13,y:r.maxY+r.height*0.12))
        heart.addCurve(to:CGPoint(x:r.maxX,y:r.minY+r.height*0.65),control1:CGPoint(x:r.midX+r.width*0.13,y:r.maxY+r.height*0.12),control2:CGPoint(x:r.maxX,y:r.maxY+r.height*0.12))
        heart.addCurve(to:CGPoint(x:r.midX,y:r.minY),control1:CGPoint(x:r.maxX,y:r.minY+r.height*0.45),control2:CGPoint(x:r.maxX-r.width*0.30,y:r.minY+r.height*0.28));heart.closeSubpath()
        let result=CGMutablePath();for i in components.indices where i != dot{result.addPath(components[i])};result.addPath(heart)
        return(result,true)
    }
    static func supportsTittle(font:CTFont)->Bool {
        var character=UniChar(105),glyph=CGGlyph();guard CTFontGetGlyphsForCharacters(font,&character,&glyph,1),let path=CTFontCreatePathForGlyph(font,glyph,nil) else{return false}
        return heartTittle(path,font:font,scale:1.5).1
    }
}
