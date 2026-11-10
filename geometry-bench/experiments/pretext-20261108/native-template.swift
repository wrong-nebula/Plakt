import Foundation
import AppKit
import CoreText
import CoreGraphics

// The runner inserts the exact captured production function here, inside a namespace.
enum Current {
__WRAPPED_FUNCTION__
}

struct Fixture: Decodable {
    let id:String, text:String, fontName:String, calibration:String
    let fontSize:Double, lineHeight:Double, width:Double, height:Double
    let widths:[Double]
}
let input=URL(fileURLWithPath:CommandLine.arguments[1])
let fixtures=try JSONDecoder().decode([Fixture].self,from:Data(contentsOf:input))
let renderInput: [String:[String]] = CommandLine.arguments.count>2
    ? try JSONDecoder().decode([String:[String]].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[2]))) : [:]
func font(_ f:Fixture,_ size:Double=100)->CTFont {CTFontCreateWithName(f.fontName as CFString,size,nil)}
func line(_ value:String,_ face:CTFont)->CTLine {CTLineCreateWithAttributedString(NSAttributedString(string:value,attributes:[.font:face]))}
func bounds(_ value:String,_ face:CTFont)->CGRect {CTLineGetBoundsWithOptions(line(value,face),[.useGlyphPathBounds])}
func path(_ value:String,_ face:CTFont)->CGPath {
    let p=CGMutablePath()
    for run in CTLineGetGlyphRuns(line(value,face)) as! [CTRun] {
        let n=CTRunGetGlyphCount(run)
        var glyphs=[CGGlyph](repeating:0,count:n),positions=[CGPoint](repeating:.zero,count:n)
        CTRunGetGlyphs(run,CFRange(location:0,length:n),&glyphs)
        CTRunGetPositions(run,CFRange(location:0,length:n),&positions)
        let runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
        for i in 0..<n {if let g=CTFontCreatePathForGlyph(runFont,glyphs[i],nil) {p.addPath(g,transform:CGAffineTransform(translationX:positions[i].x,y:positions[i].y))}}
    }
    return p
}
func d(_ p:CGPath)->String {
    var result=""
    func n(_ v:Double)->String {String(format:"%.4f",locale:Locale(identifier:"en_US_POSIX"),v)}
    p.applyWithBlock {e in
        let v=e.pointee, q=v.points
        switch v.type {
        case .moveToPoint:result += "M\(n(q[0].x)) \(n(q[0].y))"
        case .addLineToPoint:result += "L\(n(q[0].x)) \(n(q[0].y))"
        case .addQuadCurveToPoint:result += "Q\(n(q[0].x)) \(n(q[0].y)) \(n(q[1].x)) \(n(q[1].y))"
        case .addCurveToPoint:result += "C\(n(q[0].x)) \(n(q[0].y)) \(n(q[1].x)) \(n(q[1].y)) \(n(q[2].x)) \(n(q[2].y))"
        case .closeSubpath:result += "Z"
        @unknown default:break
        }
    }
    return result
}
func now()->Double {Double(DispatchTime.now().uptimeNanoseconds)/1e6}
func native(_ f:Fixture,_ w:Double)->[String] {
    Current.wrapped(f.text,width:w,height:bounds(f.calibration,font(f,f.fontSize)).height,aspect:1,font:f.fontName)
}
var checksum=0
func sweep(_ f:Fixture) {for w in f.widths {checksum += native(f,w).count}}
var output:[String:Any]=[:]
for f in fixtures {
    let face=font(f), inkHeight=bounds(f.calibration,font(f,f.fontSize)).height
    let values=renderInput[f.id] ?? native(f,f.width)
    var fragments:[String]=[],metrics:[[String:Any]]=[]
    for (i,text) in values.enumerated() {
        let p=path(text,face),b=p.boundingBoxOfPath
        guard b.width>0,b.height>0 else {continue}
        let fitted=renderInput[f.id]==nil
        let scale=fitted ? min(f.width/b.width,inkHeight/b.height):f.fontSize/100
        let tx=fitted ? -b.minX*scale:0
        let ty=fitted ? Double(i)*f.lineHeight+b.maxY*scale:Double(i)*f.lineHeight+CTFontGetAscent(face)*scale
        fragments.append("<path transform=\"translate(\(tx) \(ty)) scale(\(scale) \(-scale))\" d=\"\(d(p))\"/>")
        metrics.append(["text":text,"width":b.width*scale,"inkHeight":b.height*scale,"effectiveFontSize":100*scale,"advance":CTLineGetTypographicBounds(line(text,face),nil,nil,nil)*scale])
    }
    var timing:[Double]=[],iterations=1
    if renderInput.isEmpty {
        for _ in 0..<4 {sweep(f)}
        let t=now();sweep(f);let one=max(0.001,now()-t)
        iterations=max(1,min(100,Int(15/one)))
        for _ in 0..<21 {
            let t=now()
            for _ in 0..<iterations {autoreleasepool{sweep(f)}}
            timing.append((now()-t)/Double(iterations))
        }
    }
    let byWidth=renderInput.isEmpty ? f.widths.map{["width":$0,"lines":native(f,$0)] as [String:Any]} : []
    let svg="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 \(f.width) \(f.height)\" width=\"\(f.width)\" height=\"\(f.height)\"><g fill=\"#181c21\">\(fragments.joined())</g></svg>"
    output[f.id]=["fontResolved":CTFontCopyPostScriptName(face),"inkTarget":inkHeight,"lines":values,"lineMetrics":metrics,"byWidth":byWidth,"sweepSamplesMs":timing,"sweepsPerSample":iterations,"svg":svg]
}
output["checksum"]=checksum
let data=try JSONSerialization.data(withJSONObject:output,options:[.prettyPrinted,.sortedKeys])
FileHandle.standardOutput.write(data)
