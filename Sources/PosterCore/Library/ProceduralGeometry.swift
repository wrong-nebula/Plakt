import Foundation
import CoreGraphics

/// Vector-only graphic operators. Parameters remain in the scene genome, never in raster assets.
enum ProceduralGeometry {
    static func draw(_ element:SceneElement,rect:CGRect,context:CGContext,aspect:Double,stage:ConstructionStage)->Bool {
        if element.shape.hasPrefix("system-"){return ShapeSystemGeometry.draw(element,rect:rect,context:context,aspect:aspect)}
        guard ["organic-blob","guilloche","halftone-torus","halftone-sphere"].contains(element.shape) else{return false}
        let geometry=element.geometry ?? [:]
        func number(_ key:String,_ fallback:Double,_ low:Double,_ high:Double)->Double {
            let value=geometry[key] ?? fallback
            return value.isFinite ? min(high,max(low,value)):fallback
        }
        context.saveGState();defer{context.restoreGState()}
        // Work in physical canvas units so circular dots and pen widths stay circular/constant.
        context.scaleBy(x:1,y:1/aspect)
        let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect)
        if element.shape=="organic-blob" {
            let phase=number("phase",0,-10,10),lobes=number("lobes",3,2,7),amplitude=number("amplitude",0.10,0.01,0.16)
            let points=(0..<16).map { i->CGPoint in
                let a=Double(i)/16*2*Double.pi,rad=0.34+amplitude*sin(a*lobes+phase)+0.035*cos(a*5-phase)
                return CGPoint(x:r.midX+cos(a)*rad*r.width,y:r.midY+sin(a)*rad*r.height)
            }
            let path=CGMutablePath();path.move(to:points[0])
            for i in points.indices {
                let p0=points[(i+15)%16],p1=points[i],p2=points[(i+1)%16],p3=points[(i+2)%16]
                path.addCurve(to:p2,control1:CGPoint(x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6),control2:CGPoint(x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6))
            }
            path.closeSubpath();context.addPath(path);context.fillPath();return true
        }
        let level=ConstructionStage.allCases.firstIndex(of:stage) ?? 3
        if element.shape=="guilloche" {
            let p=Int(number("lobes",7,5,13)),q=max(2,(p-1)/2),phase=number("phase",0,-10,10)
            let layers=min(Int(number("layers",7,2,10)),[1,3,5,10][level]),steps=[240,600,1200,2200][level]
            let ratio=Double(q)/Double(p),a=1-ratio,pen=number("lineWidth",0.0011,0.0006,0.003)
            context.setStrokeColor(LibrarySceneRenderer.color(element.color));context.setLineWidth(pen)
            for layer in 0..<layers {
                let d=0.36+Double(layer)*0.009,path=CGMutablePath(),rotation=Double(layer)*0.009
                for i in 0...steps {
                    let t=Double(i)/Double(steps)*2*Double.pi*Double(q)
                    let x=(a*cos(t)+d*cos(a/ratio*t+phase))*0.49,y=(a*sin(t)-d*sin(a/ratio*t+phase))*0.49
                    let point=CGPoint(x:r.midX+(x*cos(rotation)-y*sin(rotation))*r.width,y:r.midY+(x*sin(rotation)+y*cos(rotation))*r.height)
                    if i==0{path.move(to:point)}else{path.addLine(to:point)}
                }
                path.closeSubpath();context.addPath(path);context.strokePath()
            }
            return true
        }
        let grid=min(Int(number("grid",58,36,78)),[14,26,42,78][level]),tilt=number("tilt",1.0,0.55,1.35),azimuth=number("light",-0.5,-1.0,1.0)
        let co=cos(tilt),si=sin(tilt),sphere=element.shape=="halftone-sphere"
        func sdf(_ x:Double,_ y:Double,_ z:Double)->Double {
            if sphere{return sqrt(x*x+y*y+z*z)-0.82}
            let yy=y*co-z*si,zz=y*si+z*co,q=sqrt(x*x+zz*zz)-0.62
            return sqrt(q*q+yy*yy)-0.265
        }
        for row in 0..<grid {for column in 0..<grid {
            let x=(Double(column)+0.5)/Double(grid)*2-1,y=(Double(row)+0.5)/Double(grid)*2-1
            var t=0.0,hit=false
            for _ in 0..<64 {
                let delta=sdf(x,y,2.5-t)
                if delta<0.002{hit=true;break}
                t += max(0.002,delta*0.92)
                if t>4.8{break}
            }
            if !hit{continue}
            let z=2.5-t,e=0.003,nx=sdf(x+e,y,z)-sdf(x-e,y,z),ny=sdf(x,y+e,z)-sdf(x,y-e,z),nz=sdf(x,y,z+e)-sdf(x,y,z-e),norm=sqrt(nx*nx+ny*ny+nz*nz)
            let lightNorm=sqrt(azimuth*azimuth+0.55*0.55+0.8*0.8)
            let diffuse=max(0,(nx*azimuth-ny*0.55+nz*0.8)/max(0.0001,norm*lightNorm))
            let coverage=0.06+0.88*(1-(0.15+0.85*diffuse)),radius=min(r.width,r.height)/Double(grid)*0.48*sqrt(coverage)
            context.fillEllipse(in:CGRect(x:r.minX+(x+1)/2*r.width-radius,y:r.minY+(y+1)/2*r.height-radius,width:radius*2,height:radius*2))
        }}
        return true
    }
}
