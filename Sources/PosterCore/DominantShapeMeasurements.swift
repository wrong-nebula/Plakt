import Foundation
import CoreGraphics

public struct DominantShapeMetrics:Codable,Sendable {
    public var inkCoverage:Double
    public var widthSpan:Double
    public var heightSpan:Double
    public var edgeShare:Double
    public var cornerShare:Double
    public var frontTypeOcclusion:Double
    public var backTypeIntersection:Double
    public var displacement:Double
    public var displacedBlocks:Int
    public var scores:[String:Double]
}

public enum DominantShapeMeasurements {
    struct Mask {
        let width:Int;let height:Int;let pixels:[UInt8]
        var fraction:Double {var count=0;for i in stride(from:0,to:pixels.count,by:4){if pixels[i]>100{count+=1}};return Double(count)/Double(width*height)}
        func ink(_ x:Int,_ y:Int)->Bool {pixels[(y*width+x)*4]>100}
        func occupancy(_ box:UnitBox)->Double {
            let x0=max(0,min(width-1,Int(box.x*Double(width)))),x1=max(0,min(width,Int((box.x+box.width)*Double(width))))
            let y0=max(0,min(height-1,Int(box.y*Double(height)))),y1=max(0,min(height,Int((box.y+box.height)*Double(height))))
            guard x1>x0,y1>y0 else{return 1}
            var covered=0,total=0
            for y in stride(from:y0,to:y1,by:2){for x in stride(from:x0,to:x1,by:2){total+=1;if ink(x,y){covered+=1}}}
            return Double(covered)/Double(max(1,total))
        }
    }
    static func mask(_ base:StyleGenome,only elements:[SceneElement],width:Int=240)throws->Mask {
        var scene=base;scene.background="#000000"
        scene.elements=elements.map{item in var e=item;e.color="#ffffff";e.inks=e.inks?.map{_ in "#ffffff"};e.shadow=false;e.outline=false;e.overlapContrast=nil;if e.kind=="text"{e.textTreatment=nil};return e}
        let image=try LibrarySceneRenderer.render(scene,width:width)
        var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        let ok=bytes.withUnsafeMutableBytes{ptr->Bool in guard let ctx=CGContext(data:ptr.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false};ctx.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height));return true}
        guard ok else{throw PosterError.render};return Mask(width:image.width,height:image.height,pixels:bytes)
    }
    public static func evaluate(_ scene:StyleGenome,settings:DominantShapeSettings)throws->DominantShapeMetrics {
        let backs=scene.elements.filter{$0.geometry?["dominantDepth"]==0},fronts=scene.elements.filter{$0.geometry?["dominantDepth"]==1}
        let type=scene.elements.filter{$0.kind=="text" && ($0.zIndex ?? 100)<300}
        let back=try mask(scene,only:backs),front=try mask(scene,only:fronts),glyphs=try mask(scene,only:type)
        var ink=0,edge=0,corner=0,typeInk=0,frontCovered=0,backCovered=0
        var minX=back.width,maxX=0,minY=back.height,maxY=0
        for y in 0..<back.height {for x in 0..<back.width {
            let u=Double(x)/Double(back.width),v=Double(y)/Double(back.height)
            if back.ink(x,y){ink+=1;minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y)
                if u<0.16 || u>0.84 || v<0.13 || v>0.87{edge+=1}
                if (u<0.28 || u>0.72) && (v<0.28 || v>0.72){corner+=1}
            }
            if glyphs.ink(x,y){typeInk+=1;if front.ink(x,y){frontCovered+=1};if back.ink(x,y){backCovered+=1}}
        }}
        let coverage=Double(ink)/Double(back.width*back.height)
        let width=ink>0 ? Double(maxX-minX+1)/Double(back.width):0
        let height=ink>0 ? Double(maxY-minY+1)/Double(back.height):0
        let edgeShare=Double(edge)/Double(max(1,ink)),cornerShare=Double(corner)/Double(max(1,ink))
        let occlusion=Double(frontCovered)/Double(max(1,typeInk)),intersection=Double(backCovered-frontCovered)/Double(max(1,typeInk))
        var displacement=0.0,displaced=0
        for e in type {let d=hypot(e.geometry?["nudgeX"] ?? 0,e.geometry?["nudgeY"] ?? 0);displacement+=d;if d>0.003{displaced+=1}}
        let framing:Double
        func target(_ value:Double,_ goal:Double,_ tolerance:Double)->Double{exp(-pow((value-goal)/tolerance,2))}
        switch settings.framing {
        case "edge":framing=target(coverage,0.09,0.16)*0.60+edgeShare*0.40
        case "corner":framing=target(coverage,0.035,0.10)*0.55+cornerShare*0.45
        case "zoom":framing=min(1,width/0.95)*0.25+min(1,height/0.95)*0.25+target(coverage,0.48,0.47)*0.5
        case "offset":framing=min(1,max(width,height)/0.9)*0.5+target(coverage,0.28,0.35)*0.5
        default:framing=min(1,width/0.82)*0.4+min(1,height/0.9)*0.4+min(1,coverage/0.045)*0.2
        }
        let crossing:Double
        if settings.depth=="behind"{crossing=1}
        else if settings.depth=="front"{crossing=target(occlusion,0.20,0.28)}
        else{crossing=target(occlusion,0.13,0.20)*0.6+min(1,max(0,intersection)/0.05)*0.4}
        let visible=coverage<0.001 ? 0:min(1,coverage/0.008)
        let breathing=coverage>0.88 ? max(0,1-(coverage-0.88)*6):1
        let displacementScore=settings.displacement>0 ? min(1,Double(displaced)/2)*0.5+min(1,displacement/0.05)*0.5:1
        let scores=["Framing intent":framing*visible,"Controlled crossing":crossing,"Shape visibility":visible*breathing,"Type displacement":displacementScore]
        return DominantShapeMetrics(inkCoverage:coverage,widthSpan:width,heightSpan:height,edgeShare:edgeShare,cornerShare:cornerShare,frontTypeOcclusion:occlusion,backTypeIntersection:max(0,intersection),displacement:displacement,displacedBlocks:displaced,scores:scores)
    }
}
