import Foundation
import CoreGraphics

enum DominantShapeGeometry {
    static func draw(_ e:SceneElement,rect:CGRect,context:CGContext,aspect:Double)->Bool {
        guard ["poster-helix","poster-loop","poster-ribbon"].contains(e.shape) else{return false}
        let v=e.geometry ?? [:],phase=v["phase"] ?? 0,turns=v["turns"] ?? 2.5,bend=v["bend"] ?? 0.45
        context.saveGState();defer{context.restoreGState()}
        context.scaleBy(x:1,y:1/aspect)
        let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect)
        func point(_ x:Double,_ y:Double)->CGPoint{CGPoint(x:r.minX+x*r.width,y:r.minY+y*r.height)}
        let path=CGMutablePath()
        for i in 0...720 {
            let u:Double=Double(i)/720
            let t:Double=u*turns*Double.pi*2+phase
            var x:Double=0
            var y:Double=0
            if e.shape=="poster-helix" {
                x=0.5+0.43*cos(t)+bend*0.10*(u-0.5)
                y=0.07+0.86*u+0.15*sin(t)
            }else if e.shape=="poster-loop" {
                let a:Double=u*Double.pi*2
                x=0.5+0.44*sin(a+phase)
                y=0.5+0.46*sin(a*2+phase*0.35)*(0.6+bend*0.5)
            }else{
                x=0.5+0.42*sin(u*Double.pi*2+phase)
                y=0.03+u*0.94+bend*0.12*sin(t)
            }
            if i==0{path.move(to:point(x,y))}else{path.addLine(to:point(x,y))}
        }
        if e.shape=="poster-loop"{path.closeSubpath()}
        let width:Double=(v["lineWidth"] ?? 0.012)*min(r.width,r.height)
        context.setLineCap(.round);context.setLineJoin(.round)
        // Outlined vector highlights preserve an editable, printable tubular surface.
        context.saveGState();context.translateBy(x:width*0.18,y:width*0.27)
        context.setStrokeColor(LibrarySceneRenderer.color("#090e16",alpha:0.25));context.setLineWidth(width*1.15);context.addPath(path);context.strokePath();context.restoreGState()
        context.setStrokeColor(LibrarySceneRenderer.color(e.color));context.setLineWidth(width);context.addPath(path);context.strokePath()
        context.saveGState();context.translateBy(x:-width*0.17,y:-width*0.17)
        context.setStrokeColor(LibrarySceneRenderer.color("#ffffff",alpha:0.5));context.setLineWidth(width*0.22);context.addPath(path);context.strokePath();context.restoreGState()
        return true
    }
}
