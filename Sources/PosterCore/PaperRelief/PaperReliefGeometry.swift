import Foundation
import CoreGraphics

/// Orthographic 2.5D paper. Surface paths, cutouts, shadows and type remain vector.
public enum PaperReliefGeometry {
    private struct Point3 {var x:Double;var y:Double;var z:Double}
    private static func value(_ e:SceneElement,_ key:String,_ fallback:Double)->Double{let v=e.geometry?[key] ?? fallback;return v.isFinite ? v:fallback}
    private static func box(_ s:PaperReliefSurface,_ e:SceneElement,_ aspect:Double)->CGRect {
        let b=s.bounds,overlap=s.level>0.35 && s.kind=="panel" ? value(e,"overlap",0.08):0
        return CGRect(x:b.x*1000,y:b.y*1000*aspect,width:b.width*1000*(1+overlap),height:b.height*1000*aspect)
    }
    private static func world(_ u:Double,_ v:Double,_ s:PaperReliefSurface,_ e:SceneElement,_ aspect:Double)->Point3 {
        let b=box(s,e,aspect),x=u*b.width,y=v*b.height
        var z=s.level*value(e,s.level<0 ? "recessDepth":"lift",0.025)*1000
        guard s.kind=="flap" else{return Point3(x:b.minX+x,y:b.minY+y,z:z)}
        let hinges:[(CGPoint,CGPoint)]=[(.zero,CGPoint(x:b.width,y:0)),(CGPoint(x:b.width,y:0),CGPoint(x:b.width,y:b.height)),(CGPoint(x:b.width,y:b.height),CGPoint(x:0,y:b.height)),(CGPoint(x:0,y:b.height),.zero),(.zero,CGPoint(x:b.width,y:b.height)),(CGPoint(x:b.width,y:0),CGPoint(x:0,y:b.height))]
        let (a,c)=hinges[max(0,min(5,s.hinge))],length=max(0.001,hypot(c.x-a.x,c.y-a.y)),ax=(c.x-a.x)/length,ay=(c.y-a.y)/length
        let qx=x-a.x,qy=y-a.y,dot=qx*ax+qy*ay
        let freeX=s.hinge==5 ? b.width:b.width*0.15,freeY=b.height*0.85
        let cross=ax*(freeY-a.y)-ay*(freeX-a.x),sign=cross<0 ? -1.0:1.0
        let angle=value(e,"foldAngle",34)*Double.pi/180*sign,cosine=cos(angle),sine=sin(angle)
        let rx=qx*cosine+ax*dot*(1-cosine),ry=qy*cosine+ay*dot*(1-cosine)
        z=max(0,z)+(ax*qy-ay*qx)*sine
        return Point3(x:b.minX+a.x+rx,y:b.minY+a.y+ry,z:z)
    }
    private static func projected(_ p:Point3)->CGPoint{CGPoint(x:p.x-p.z*0.24,y:p.y-p.z*0.32)}
    public static func projectedCorners(_ surface:PaperReliefSurface,parent:SceneElement,aspect:Double)->[CGPoint] {
        [(0.0,0.0),(1.0,0.0),(1.0,1.0),(0.0,1.0)].map{projected(world($0.0,$0.1,surface,parent,aspect))}
    }
    private static func transform(_ points:[CGPoint])->CGAffineTransform{CGAffineTransform(a:points[1].x-points[0].x,b:points[1].y-points[0].y,c:points[3].x-points[0].x,d:points[3].y-points[0].y,tx:points[0].x,ty:points[0].y)}
    private static func localPath(_ s:PaperReliefSurface,_ e:SceneElement,_ aspect:Double)->CGPath {
        let p=CGMutablePath()
        if s.kind=="disc"{p.addEllipse(in:CGRect(x:0,y:0,width:1,height:1));return p}
        if s.kind=="flap",s.hinge>=4 {
            let pts=s.hinge==4 ? [CGPoint(x:0,y:0),CGPoint(x:1,y:1),CGPoint(x:0,y:1)]:[CGPoint(x:1,y:0),CGPoint(x:0,y:1),CGPoint(x:1,y:1)]
            p.move(to:pts[0]);for v in pts.dropFirst(){p.addLine(to:v)};p.closeSubpath();return p
        }
        p.addRect(CGRect(x:0,y:0,width:1,height:1))
        if s.kind=="hole" {
            let b=box(s,e,aspect),radius=min(b.width,b.height)*0.32*value(e,"aperture",0.92)
            let hole=CGPath(ellipseIn:CGRect(x:0.5-radius/b.width,y:0.5-radius/b.height,width:radius*2/b.width,height:radius*2/b.height),transform:nil)
            return p.subtracting(hole)
        }
        return p
    }
    private static func face(_ s:PaperReliefSurface,_ e:SceneElement,_ aspect:Double,shadow:Bool=false)->CGPath {
        let points:[CGPoint]
        if shadow {
            let angle=value(e,"lightAngle",0.9),dx=cos(angle),dy=sin(angle)
            points=[(0.0,0.0),(1.0,0.0),(1.0,1.0),(0.0,1.0)].map{uv in let p=world(uv.0,uv.1,s,e,aspect);return CGPoint(x:p.x+p.z*dx,y:p.y+p.z*dy)}
        }else{points=projectedCorners(s,parent:e,aspect:aspect)}
        var t=transform(points);let path=localPath(s,e,aspect);return path.copy(using:&t) ?? path
    }
    public static func surfacePath(_ s:PaperReliefSurface,parent:SceneElement,aspect:Double)->CGPath{face(s,parent,aspect)}
    private static func fitted(_ field:CGRect,_ parent:SceneElement)->CGRect {
        let aspect=parent.paperRelief?.aspect ?? (field.height/field.width)
        let width=min(field.width,field.height/aspect),height=width*aspect
        return CGRect(x:field.midX-width/2,y:field.midY-height/2,width:width,height:height)
    }
    /// Bounds in physical canvas units: x uses poster width; y includes poster aspect.
    public static func fittedFrame(parent:SceneElement,aspect:Double)->CGRect {
        let b=parent.bounds
        return fitted(CGRect(x:b.x,y:b.y*aspect,width:b.width,height:b.height*aspect),parent)
    }
    public static func annotationBounds(_ s:PaperReliefSurface,attachment:PaperSurfaceAttachment,parent:SceneElement,aspect:Double)->UnitBox {
        let frame=fittedFrame(parent:parent,aspect:aspect)
        let t=transform(projectedCorners(s,parent:parent,aspect:frame.height/frame.width))
        let r=attachment.localBounds.rect.applying(t),scale=frame.width/1000
        let x=frame.minX+r.minX*scale,y=(frame.minY+r.minY*scale)/aspect,w=r.width*scale,h=r.height*scale/aspect
        return UnitBox(x:x,y:y,width:max(0.0001,w),height:max(0.0001,h))
    }
    private static func poly(_ points:[CGPoint])->CGPath{let p=CGMutablePath();p.move(to:points[0]);for q in points.dropFirst(){p.addLine(to:q)};p.closeSubpath();return p}
    private static func color(_ e:SceneElement,_ shade:Double,_ alpha:Double=1)->CGColor {
        let hex=Int(e.color.dropFirst(),radix:16) ?? 0,mix=value(e,"colorMix",0)*0.55
        let rgb=[Double((hex>>16)&255)/255,Double((hex>>8)&255)/255,Double(hex&255)/255]
        let components=rgb.map{max(0,min(1,shade*(1-mix)+$0*mix))}+[alpha]
        return CGColor(colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!,components:components.map{CGFloat($0)})!
    }
    private static func shadow(_ path:CGPath,_ context:CGContext,_ amount:Double,_ blur:Double){
        guard amount>0 else{return}
        for i in stride(from:7,through:1,by:-1) {
            context.setFillColor(CGColor(gray:0,alpha:amount*0.018));context.addPath(path.copy(strokingWithWidth:blur*Double(i)/3.5,lineCap:.round,lineJoin:.round,miterLimit:2));context.fillPath()
        }
        context.setFillColor(CGColor(gray:0,alpha:amount*0.24));context.addPath(path);context.fillPath()
    }
    private static func text(_ label:SceneElement,surface:PaperReliefSurface,parent:SceneElement,aspect:Double,context:CGContext) {
        guard let a=label.paperAttachment,let string=label.text,!string.isEmpty else{return}
        let raw=SurveyTypeGeometry.outline(string,font:FontLibrary.font(name:label.fontName ?? "HelveticaNeue",variations:label.fontVariations))
        var flip=CGAffineTransform(scaleX:1,y:-1);let outline=raw.copy(using:&flip) ?? raw
        let b=box(surface,parent,aspect),scale=value(parent,"labelScale",0.94),local=a.localBounds
        var target=CGRect(x:local.x*b.width,y:local.y*b.height,width:local.width*b.width,height:local.height*b.height)
        if abs(a.rotation)==90 {let w=target.height,h=target.width;target=CGRect(x:target.midX-w/2,y:target.midY-h/2,width:w,height:h)}
        target=target.insetBy(dx:target.width*(1-scale)/2,dy:target.height*(1-scale)/2)
        let layout=Int(value(parent,"layout",0)),cap=(layout==0 ? 23.0:layout==1 ? 60.0:48.0)*scale
        if target.height>cap{target=CGRect(x:target.minX,y:target.midY-cap/2,width:target.width,height:cap)}
        let fitted=ContourVectorEngine.fit(outline,to:target,preserveAspect:true)
        let angle=a.rotation*Double.pi/180,c=cos(angle),s=sin(angle),cx=target.midX,cy=target.midY
        var rotation=CGAffineTransform(a:c,b:s,c:-s,d:c,tx:cx-c*cx+s*cy,ty:cy-s*cx-c*cy)
        guard let rotated=fitted.copy(using:&rotation) else{return}
        var normalize=CGAffineTransform(scaleX:1/b.width,y:1/b.height)
        let normalized=rotated.copy(using:&normalize) ?? rotated
        var projection=transform(projectedCorners(surface,parent:parent,aspect:aspect))
        context.setFillColor(LibrarySceneRenderer.color(label.color));context.addPath(normalized.copy(using:&projection) ?? normalized);context.fillPath()
    }
    static func draw(_ e:SceneElement,scene:StyleGenome,rect:CGRect,context:CGContext,stage:ConstructionStage)->Bool {
        guard e.shape==PaperReliefSystems.shape,let paper=e.paperRelief else{return false}
        let canvasAspect=scene.aspect
        context.saveGState();defer{context.restoreGState()}
        if let clip=e.clipBounds{context.clip(to:clip.rect)}
        context.translateBy(x:rect.midX,y:rect.midY);context.scaleBy(x:1,y:1/canvasAspect);context.rotate(by:e.rotation*Double.pi/180);context.scaleBy(x:1,y:canvasAspect);context.translateBy(x:-rect.midX,y:-rect.midY)
        context.scaleBy(x:1,y:1/canvasAspect)
        let field=CGRect(x:rect.minX,y:rect.minY*canvasAspect,width:rect.width,height:rect.height*canvasAspect)
        let r=fitted(field,e),aspect=r.height/r.width
        context.clip(to:r);context.translateBy(x:r.minX,y:r.minY);context.scaleBy(x:r.width/1000,y:r.width/1000)
        context.setFillColor(color(e,0.17));context.fill(CGRect(x:0,y:0,width:1000,height:1000*aspect))
        let level=ConstructionStage.allCases.firstIndex(of:stage) ?? 3
        var renderParent=e;if level==0{renderParent.geometry?["lift"]=0;renderParent.geometry?["recessDepth"]=0;renderParent.geometry?["foldAngle"]=0}
        let labels=scene.elements.filter{$0.paperAttachment?.parentID==e.sourceElementID}
        let ordered=paper.surfaces.enumerated().sorted{a,b in
            let az=a.element.kind=="recess" ? 0:a.element.kind=="flap" || a.element.level>0.6 ? 2:1
            let bz=b.element.kind=="recess" ? 0:b.element.kind=="flap" || b.element.level>0.6 ? 2:1
            return az==bz ? a.offset<b.offset:az<bz
        }.map(\.element)
        for surface in ordered {
            let path=face(surface,renderParent,aspect),b=box(surface,renderParent,aspect),points=projectedCorners(surface,parent:renderParent,aspect:aspect)
            context.saveGState()
            if surface.kind=="recess" {
                context.clip(to:b);context.setFillColor(color(e,0.075));context.fill(b)
                let rim=[CGPoint(x:b.minX,y:b.minY),CGPoint(x:b.maxX,y:b.minY),CGPoint(x:b.maxX,y:b.maxY),CGPoint(x:b.minX,y:b.maxY)]
                for i in 0..<4 {let j=(i+1)%4;context.setFillColor(color(e,i==0 || i==3 ? 0.10:0.28));context.addPath(poly([rim[i],rim[j],points[j],points[i]]));context.fillPath()}
            }else if level>0 {
                let shade=value(e,"shadow",0.65),lift=surface.kind=="flap" ? value(e,"foldAngle",34)/800:abs(surface.level*value(e,"lift",0.025))
                shadow(face(surface,renderParent,aspect,shadow:true),context,shade,1+lift*100)
            }
            if surface.kind=="hole" {
                let radius=min(b.width,b.height)*0.32*value(e,"aperture",0.92)
                let opening=CGPath(ellipseIn:CGRect(x:0.5-radius/b.width,y:0.5-radius/b.height,width:radius*2/b.width,height:radius*2/b.height),transform:nil)
                var top=transform(points);let openingPath=opening.copy(using:&top) ?? opening
                var floorSurface=surface;floorSurface.level = -0.6
                var floorTransform=transform(projectedCorners(floorSurface,parent:renderParent,aspect:aspect));let floorPath=opening.copy(using:&floorTransform) ?? opening
                context.saveGState();context.addPath(openingPath);context.clip()
                context.setFillColor(color(e,0.12));context.fill(b.insetBy(dx:-20,dy:-20))
                context.addPath(floorPath);context.clip()
                let inset=CGGradient(colorsSpace:CGColorSpace(name:CGColorSpace.sRGB),colors:[color(e,0.32),color(e,0.58)] as CFArray,locations:[0,1])!
                context.drawLinearGradient(inset,start:CGPoint(x:b.minX,y:b.minY),end:CGPoint(x:b.maxX,y:b.maxY),options:[.drawsBeforeStartLocation,.drawsAfterEndLocation]);context.restoreGState()
            }
            let shade=surface.dark ? 0.19:0.89
            context.saveGState();context.addPath(path);context.clip(using:.evenOdd)
            if level>0 {
                let angle=value(e,"lightAngle",0.9),radius=max(b.width,b.height)*0.7
                let start=CGPoint(x:b.midX-cos(angle)*radius,y:b.midY-sin(angle)*radius),end=CGPoint(x:b.midX+cos(angle)*radius,y:b.midY+sin(angle)*radius)
                let origin=world(0,0,surface,renderParent,aspect),right=world(1,0,surface,renderParent,aspect),down=world(0,1,surface,renderParent,aspect)
                let ux=right.x-origin.x,uy=right.y-origin.y,uz=right.z-origin.z,vx=down.x-origin.x,vy=down.y-origin.y,vz=down.z-origin.z
                let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,norm=max(0.001,sqrt(nx*nx+ny*ny+nz*nz))
                let diffuse=max(0,(-nx*cos(angle)-ny*sin(angle)+nz*1.7)/(norm*sqrt(3.89))),lit=shade*(0.65+0.35*diffuse)
                let gradient=CGGradient(colorsSpace:CGColorSpace(name:CGColorSpace.sRGB),colors:[color(e,lit+0.07),color(e,lit-0.035)] as CFArray,locations:[0,1])!
                context.drawLinearGradient(gradient,start:start,end:end,options:[.drawsBeforeStartLocation,.drawsAfterEndLocation])
            }else{context.setFillColor(color(e,shade));context.addPath(path);context.fillPath()}
            if level>0 {
                context.setStrokeColor(color(e,surface.dark ? 0.30:0.99,0.7));context.setLineWidth(value(e,"thickness",0.002)*1000);context.addPath(path);context.strokePath()
            }
            if level>=3,surface.kind=="flap" {
                let indices=surface.hinge==4 ? [0,2]:surface.hinge==5 ? [1,3]:[surface.hinge,(surface.hinge+1)%4]
                context.setStrokeColor(color(e,surface.dark ? 0.32:0.70,0.55));context.setLineWidth(0.7);context.move(to:points[indices[0]]);context.addLine(to:points[indices[1]]);context.strokePath()
            }
            for label in labels where label.paperAttachment?.surfaceID==surface.id {
                if level==0{continue}
                if level==1,!(["title","word"].contains(label.paperAttachment?.role ?? "")){continue}
                text(label,surface:surface,parent:renderParent,aspect:aspect,context:context)
            }
            context.restoreGState();context.restoreGState()
        }
        return true
    }
}
