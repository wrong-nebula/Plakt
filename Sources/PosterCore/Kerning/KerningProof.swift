import Foundation
import CoreText
import CoreGraphics

/// A proof sheet: one line in several kerning settings, each gap's value under it and, for optical rows, the measured white.
public enum KerningProof {
    public static func render(_ text:String,font name:String,variations:[String:Double]?=nil,rows:[(String,TextKerning)],tracking:Double=0,width:Int=2400,showWhite:Bool=true)throws->CGImage {
        guard !text.isEmpty,!rows.isEmpty,(400...8000).contains(width) else{throw PosterError.invalid("A kerning proof needs text, at least one row and a width of 400–8000 px.")}
        for (_,k) in rows {_=try k.validated()}
        let font=FontLibrary.font(name:name,variations:variations)
        let layouts=rows.map{KerningSystem.layout(text,font:font,tracking:tracking,kerning:$0.1,measure:showWhite && $0.1.mode == .optical)}
        let ascent=Double(CTFontGetAscent(font)),descent=Double(CTFontGetDescent(font))
        let inks=layouts.map{$0.path.boundingBoxOfPath},left=inks.map{Double($0.minX)}.min() ?? 0,right=inks.map{Double($0.maxX)}.max() ?? 1
        let w=Double(width),margin=w*0.04,labelWidth=w*0.16,scale=(w-2*margin-labelWidth)/max(1,right-left)
        let lineHeight=(ascent+descent)*scale,valueHeight=max(18,lineHeight*0.16),rowHeight=lineHeight+valueHeight*2.2
        let height=Int((2*margin+rowHeight*Double(rows.count)).rounded())
        guard let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
        func rgb(_ hex:Int,_ a:Double=1)->CGColor {CGColor(srgbRed:Double((hex>>16)&255)/255,green:Double((hex>>8)&255)/255,blue:Double(hex&255)/255,alpha:a)}
        ctx.setFillColor(rgb(0xf4f2ee));ctx.fill(CGRect(x:0,y:0,width:width,height:height))
        let label=CTFontCreateWithName("HelveticaNeue-Medium" as CFString,valueHeight,nil)
        func write(_ s:String,x:Double,y:Double,color:CGColor,centered:Bool=false) {
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:s,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):label,NSAttributedString.Key(kCTForegroundColorAttributeName as String):color]))
            let w=CTLineGetTypographicBounds(line,nil,nil,nil);ctx.textPosition=CGPoint(x:centered ? x-w/2:x,y:y);CTLineDraw(line,ctx)
        }
        for (i,layout) in layouts.enumerated() {
            let top=Double(height)-margin-Double(i)*rowHeight,baseline=top-ascent*scale-valueHeight*0.4,x0=margin+labelWidth-left*scale
            write(rows[i].0,x:margin,y:baseline,color:rgb(0x141414))
            ctx.saveGState();ctx.translateBy(x:x0,y:baseline);ctx.scaleBy(x:scale,y:scale)
            if showWhite {ctx.setFillColor(rgb(0xff4a1c,0.32));for g in layout.gaps {for r in g.white {ctx.fill(r)}}}
            ctx.addPath(layout.path);ctx.setFillColor(rgb(0x141414));ctx.fillPath();ctx.restoreGState()
            for g in layout.gaps where g.adjustable && !layout.characters[g.index].allSatisfy(\.isWhitespace) && !layout.characters[g.index+1].allSatisfy(\.isWhitespace) {
                let v=Int(g.applied.rounded())
                write(v==0 ? "0":String(v),x:x0+g.x*scale,y:baseline-descent*scale-valueHeight*0.9,color:v<0 ? rgb(0xd1381f):v>0 ? rgb(0x2a6fdb):rgb(0x8a8a8a),centered:true)
            }
        }
        guard let image=ctx.makeImage() else{throw PosterError.render}
        return image
    }
}
