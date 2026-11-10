import Foundation
import CoreGraphics
import PosterCore

extension PosterChecks {
    static func checkColors()throws {
        let red=PerceptualColor.fromHex("#ff0000")
        try require(abs(red.l-0.627955)<0.00001 && abs(red.a-0.224863)<0.00001 && abs(red.b-0.125846)<0.00001,"OKLab reference red is incorrect")
        for hex in ["#ff0000","#0088ff","#000000","#ffffff","#3f753a"] {
            try require(PerceptualColor.hex(PerceptualColor.fromHex(hex)).0==hex,"sRGB/OKLab roundtrip failed")
        }
        let mapped=PerceptualColor.hex(.init(l:0.7,a:0.5,b:0.5))
        try require(mapped.1 && mapped.0.count==7,"Out-of-gamut color was not mapped")
        let ctx=CGContext(data:nil,width:100,height:100,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setFillColor(CGColor(gray:0,alpha:1));ctx.fill(CGRect(x:0,y:0,width:100,height:100))
        ctx.setFillColor(CGColor(gray:1,alpha:1));ctx.fill(CGRect(x:0,y:0,width:25,height:100))
        let analyzer=PosterColorAnalyzer(),profile=try analyzer.analyze(ctx.makeImage()!)
        try require(profile.nameSource.contains("14.86.0"),"Bundled Meodai catalog missing")
        try require(profile.paletteTypes.contains("achromatic") && profile.swatches.allSatisfy{$0.hue==nil},"Black and white acquired a spurious hue harmony")
        try require(profile.swatches.contains{$0.name=="Black"} && profile.swatches.contains{$0.name=="White"},"Exact color names were not recovered")
        try require(abs(profile.swatches.reduce(0){$0+$1.proportion}-1)<1e-9,"Palette proportions do not sum to one")
        try require(profile.colorEmbedding.count==52 && abs(profile.colorEmbedding.reduce(0){$0+$1*$1}-1)<1e-9,"Color embedding schema or norm invalid")
        ctx.setFillColor(CGColor(colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!,components:[1,0,0,1])!);ctx.fill(CGRect(x:0,y:0,width:100,height:100))
        let redProfile=try analyzer.analyze(ctx.makeImage()!)
        try require(redProfile.swatches.first?.namedHex.lowercased()=="#ff0000" && (redProfile.swatches.first?.nameDistanceOKLab ?? 1)<0.001,"Colored swatches used a fallback name catalog: \(redProfile.swatches)")
        func swatch(_ hue:Double,_ weight:Double)->NamedSwatch {
            let a=0.12*cos(hue * .pi/180),b=0.12*sin(hue * .pi/180),lab=PerceptualColor.Lab(l:0.65,a:a,b:b)
            return NamedSwatch(hex:PerceptualColor.hex(lab).0,name:"fixture",namedHex:"#000000",basicFamily:"fixture",proportion:weight,lightness:0.65,chroma:0.12,hue:hue,nameDistanceOKLab:0,gamutMapped:false)
        }
        let triad=PosterColorAnalyzer.profile(swatches:[0.0,120,240].map{swatch($0,1/3)},nameSource:"test")
        let pair=PosterColorAnalyzer.profile(swatches:[swatch(30,0.5),swatch(210,0.5)],nameSource:"test")
        try require(triad.harmonies.first?.type=="triadic" && (triad.harmonies.first?.score ?? 0)>0.99,"Triadic hue fixture misclassified")
        try require(pair.harmonies.first?.type=="complementary" && (pair.harmonies.first?.score ?? 0)>0.99,"Complementary hue fixture misclassified")
        print("PASS: color conversions, gamut mapping, names, proportions, neutral hues and harmony fixtures")
    }
}
