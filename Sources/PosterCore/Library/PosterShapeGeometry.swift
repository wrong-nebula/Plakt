import Foundation
import CoreGraphics

/// Independent vector grammars. The active SigLIP shape-system implementation is not changed.
enum PosterShapeGeometry {
    static func draw(_ element:SceneElement,rect:CGRect,context:CGContext,aspect:Double,stage:ConstructionStage)->Bool {
        guard element.shape.hasPrefix("motif-") else{return false}
        let operation=String(element.shape.dropFirst(6)),values=element.geometry ?? [:]
        func n(_ key:String,_ fallback:Double)->Double{let v=values[key] ?? fallback;return v.isFinite ? v:fallback}
        func count(_ key:String,_ fallback:Int,_ ceiling:Int=64)->Int{max(1,min(ceiling,Int(n(key,Double(fallback)).rounded())))}
        context.saveGState();defer{context.restoreGState()};context.scaleBy(x:1,y:1/aspect)
        let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect),unit=min(r.width,r.height)
        context.clip(to:r);context.setStrokeColor(LibrarySceneRenderer.color(element.color));context.setLineWidth(unit*n("lineWidth",0.009));context.setLineCap(.round);context.setLineJoin(.round)
        func p(_ x:Double,_ y:Double)->CGPoint{CGPoint(x:r.minX+x*r.width,y:r.minY+y*r.height)}
        func circlePoint(_ a:Double,_ radius:Double)->CGPoint{CGPoint(x:r.midX+cos(a)*radius*unit,y:r.midY+sin(a)*radius*unit)}
        func poly(_ points:[CGPoint],fill:Bool=true){guard let first=points.first else{return};context.beginPath();context.move(to:first);for point in points.dropFirst(){context.addLine(to:point)};context.closePath();if fill{context.fillPath()}else{context.strokePath()}}
        let total=count("count",8),phase=n("phase",0)
        if ReviewedShapeGeometry.draw(operation, rect:r, context:context, values:values){return true}
        if operation==OrbitWrapGeometry.operation, OrbitWrapGeometry.draw(operation, rect:r, context:context, values:values, inks:([element.color]+(element.inks ?? [])).map{LibrarySceneRenderer.color($0)}, text:element.text, font:element.text==nil ? nil:FontLibrary.font(name:element.fontName ?? "HelveticaNeue-Bold",variations:element.fontVariations), stage:stage){return true}
        if operation==CirclePackGeometry.operation, CirclePackGeometry.draw(operation, rect:r, context:context, values:values, inks:([element.color]+(element.inks ?? [])).map{LibrarySceneRenderer.color($0)}, text:element.text, font:element.text==nil ? nil:FontLibrary.font(name:element.fontName ?? "HelveticaNeue",variations:element.fontVariations), stage:stage){return true}
        if operation==SawtoothSpringGeometry.operation, SawtoothSpringGeometry.draw(operation, rect:r, context:context, values:values, inks:([element.color]+(element.inks ?? [])).map{LibrarySceneRenderer.color($0)}, text:element.text, font:element.text==nil ? nil:FontLibrary.font(name:element.fontName ?? "HelveticaNeue-Bold",variations:element.fontVariations), stage:stage){return true}
        if operation.hasPrefix("survey-"), SurveyShapeGeometry.draw(String(operation.dropFirst(7)), rect:r, context:context, values:values){return true}
        if operation.hasPrefix("survey-"), ExtendedSurveyGeometry.draw(String(operation.dropFirst(7)), rect:r, context:context, values:values, ink:LibrarySceneRenderer.color(element.color), inks:([element.color]+(element.inks ?? [])).map{LibrarySceneRenderer.color($0)}, text:element.text, font:element.text==nil ? nil:FontLibrary.font(name:element.fontName ?? "HelveticaNeue-Bold",variations:element.fontVariations), stage:stage){return true}
        if operation.hasPrefix("tone-"){tonal(String(operation.dropFirst(5)),r:r,context:context,values:values,stage:stage);return true}
        switch operation {
        case "superellipse":
            let exponent=max(0.5,n("exponent",3)),angle=phase*0.12
            let points=(0..<240).map{i->CGPoint in let t=Double(i)/240*2*Double.pi,c=cos(t),s=sin(t),x=c.sign == .minus ? -pow(abs(c),2/exponent):pow(abs(c),2/exponent),y=s.sign == .minus ? -pow(abs(s),2/exponent):pow(abs(s),2/exponent);return CGPoint(x:r.midX+(x*cos(angle)-y*sin(angle))*unit*0.43,y:r.midY+(x*sin(angle)+y*cos(angle))*unit*0.43)}
            poly(points)
        case "lens-pair":
            let spread=n("spread",0.25),aperture=n("aperture",0.2),path=CGMutablePath()
            for sign in [-1.0,1.0]{path.addEllipse(in:CGRect(x:r.midX-unit*0.34+sign*spread*unit*0.5,y:r.midY-unit*0.4,width:unit*0.68,height:unit*0.8))}
            path.addEllipse(in:CGRect(x:r.midX-unit*aperture/2,y:r.midY-unit*aperture/2,width:unit*aperture,height:unit*aperture));context.addPath(path);context.drawPath(using:.eoFill)
        case "crescent-orbits":
            for i in 0..<total {
                context.saveGState()
                context.translateBy(x:r.midX,y:r.midY)
                context.rotate(by:phase+Double(i)/Double(total)*2*Double.pi)
                context.translateBy(x:unit*0.25,y:0)
                let radius:Double=Double(unit)*0.20
                let outer=CGRect(x:-radius,y:-radius,width:radius*2,height:radius*2)
                context.addEllipse(in:outer);context.clip()
                let path=CGMutablePath();path.addEllipse(in:outer)
                path.addEllipse(in:outer.offsetBy(dx:Double(unit)*n("spread",0.25)*0.65,dy:0))
                context.addPath(path);context.drawPath(using:.eoFill);context.restoreGState()
            }
        case "offset-discs":
            let spread=n("spread",0.25)
            for i in 0..<total {let t=Double(i)/Double(max(1,total-1)),radius=unit*(0.28-0.12*t),x=r.midX+(t-0.5)*r.width*spread*2,y=r.midY+(t-0.5)*r.height*spread;context.strokeEllipse(in:CGRect(x:x-radius,y:y-radius,width:2*radius,height:2*radius))}
        case "ring-stack":
            let drift=n("eccentricity",0.08)
            for i in 0..<total {let t=Double(i)/Double(total),radius=(0.46-0.41*t)*unit;context.strokeEllipse(in:CGRect(x:r.midX-radius+drift*t*unit,y:r.midY-radius,width:radius*2,height:radius*2))}
        case "triangle-fan":
            let duty=n("duty",0.55)
            for i in 0..<total {let a=Double(i)/Double(total)*2*Double.pi+phase,b=a+2*Double.pi/Double(total)*duty;poly([circlePoint(a,0.035),circlePoint(a,0.48),circlePoint(b,0.48)])}
        case "ribbon-knot":
            for layer in 0..<total {let offset=(Double(layer)-Double(total-1)/2)*0.009,path=CGMutablePath(),bend=n("bend",0.4)
                for i in 0...700 {let t=Double(i)/700*2*Double.pi,x=0.5+0.43*sin(t+phase),y=0.5+(0.15+bend*0.2)*sin(t*2)+offset;let point=p(x,y);if i==0{path.move(to:point)}else{path.addLine(to:point)}};path.closeSubpath();context.addPath(path);context.strokePath()}
        case "lissajous":
            let path=CGMutablePath(),a=Double(max(2,total)),b=a+1
            for i in 0...1800 {let t=Double(i)/1800*2*Double.pi,point=p(0.5+0.45*sin(a*t+phase),0.5+0.45*sin(b*t));if i==0{path.move(to:point)}else{path.addLine(to:point)}};path.closeSubpath();context.addPath(path);context.strokePath()
        case "contour-islands":
            for layer in 0..<total {let scale=0.95-Double(layer)/Double(total)*0.84,path=CGMutablePath()
                for i in 0...400 {let t=Double(i)/400*2*Double.pi,radius=(0.36+n("amplitude",0.16)*0.45*sin(t*3+phase)+0.035*cos(t*7-phase))*scale;let point=circlePoint(t,radius);if i==0{path.move(to:point)}else{path.addLine(to:point)}};path.closeSubpath();context.addPath(path);context.strokePath()}
        case "modular-arcs":
            let rows=count("rows",6,16),columns=count("columns",5,16);var rng=SeededRandom(seed:UInt64(max(0,n("shapeSeed",1))))
            for row in 0..<rows {for column in 0..<columns {let w=r.width/Double(columns),h=r.height/Double(rows),x=r.minX+Double(column)*w,y=r.minY+Double(row)*h,angle=Double(rng.int(4))*Double.pi/2
                context.saveGState();context.clip(to:CGRect(x:x,y:y,width:w,height:h));context.translateBy(x:x+w/2,y:y+h/2);context.rotate(by:angle);context.beginPath();context.addArc(center:CGPoint(x:-w/2,y:-h/2),radius:min(w,h)*0.9,startAngle:0,endAngle:Double.pi/2,clockwise:false);context.strokePath();context.restoreGState()}}
        case "checker-warp":
            let rows=count("rows",6,18),columns=count("columns",6,18),amplitude=n("amplitude",0.16)
            func vertex(_ x:Int,_ y:Int)->CGPoint{let u=Double(x)/Double(columns),v=Double(y)/Double(rows);return p(u+sin(v*2*Double.pi+phase)*amplitude*sin(u*Double.pi),v+sin(u*2*Double.pi)*amplitude*sin(v*Double.pi))}
            for row in 0..<rows {for column in 0..<columns where (row+column)%2==0{poly([vertex(column,row),vertex(column+1,row),vertex(column+1,row+1),vertex(column,row+1)])}}
        case "folded-fan":
            let bend=n("bend",0.4)
            for i in 0..<total {let a=(-0.85+Double(i)/Double(total)*1.7)+phase*0.1,b=a+1.7/Double(total)*0.72;poly([p(0.5,0.82),p(0.5+cos(a-Double.pi/2)*0.47,0.5+sin(a-Double.pi/2)*(0.35+bend*0.1)),p(0.5+cos(b-Double.pi/2)*0.47,0.5+sin(b-Double.pi/2)*(0.35+bend*0.1))])}
        case "voronoi-shards":
            var rng=SeededRandom(seed:UInt64(max(0,n("shapeSeed",1))));let sites=(0..<min(total,30)).map{_ in CGPoint(x:rng.value(0.05,0.95),y:rng.value(0.05,0.95))},gutter=n("gutter",0.04)
            for site in sites {var polygon=[CGPoint(x:0,y:0),CGPoint(x:1,y:0),CGPoint(x:1,y:1),CGPoint(x:0,y:1)]
                for other in sites where other != site {let nx=other.x-site.x,ny=other.y-site.y,limit=(other.x*other.x+other.y*other.y-site.x*site.x-site.y*site.y)/2;polygon=clip(polygon,nx:nx,ny:ny,limit:limit)}
                if polygon.count>2 {let center=CGPoint(x:polygon.map(\.x).reduce(0,+)/Double(polygon.count),y:polygon.map(\.y).reduce(0,+)/Double(polygon.count));poly(polygon.map{p(center.x+($0.x-center.x)*(1-gutter*3),center.y+($0.y-center.y)*(1-gutter*3))})}}
        case "split-monolith":
            let block=CGRect(x:r.midX-unit*0.39,y:r.midY-unit*0.45,width:unit*0.78,height:unit*0.9),path=CGMutablePath();context.clip(to:block);path.addRect(block)
            for i in 0..<total {let x=block.minX+Double(i+1)/Double(total+1)*block.width,w=unit*n("aperture",0.07),shift=unit*(0.15+phase*0.02);path.move(to:CGPoint(x:x-w/2,y:block.minY));path.addLine(to:CGPoint(x:x+w/2,y:block.minY));path.addLine(to:CGPoint(x:x+w/2+shift,y:block.maxY));path.addLine(to:CGPoint(x:x-w/2+shift,y:block.maxY));path.closeSubpath()};context.addPath(path);context.drawPath(using:.eoFill)
        case "moire-grid":
            for angle in [-n("angle",0.22)/2,n("angle",0.22)/2] {context.saveGState();context.translateBy(x:r.midX,y:r.midY);context.rotate(by:angle)
                for i in 0..<total {let x=(Double(i)/Double(max(1,total-1))-0.5)*max(r.width,r.height)*1.4;context.move(to:CGPoint(x:x,y:-max(r.width,r.height)));context.addLine(to:CGPoint(x:x,y:max(r.width,r.height)))};context.strokePath();context.restoreGState()}
        case "orbital-paths":
            for i in 0..<total {context.saveGState();context.translateBy(x:r.midX,y:r.midY);context.rotate(by:Double(i)/Double(total)*Double.pi+phase);context.strokeEllipse(in:CGRect(x:-unit*0.46,y:-unit*n("flatten",0.3)/2,width:unit*0.92,height:unit*n("flatten",0.3)));context.restoreGState()}
        case "leaf-ribbons":
            for i in 0..<total {let t=Double(i)/Double(max(1,total-1)),x=0.15+t*0.7+sin(phase+t*2)*0.035,bend=n("bend",0.4),path=CGMutablePath();path.move(to:p(x-0.1,0.85));path.addCurve(to:p(x+0.1,0.15),control1:p(x-bend*0.8,0.5),control2:p(x+bend*0.3,0.25));path.addCurve(to:p(x-0.1,0.85),control1:p(x+bend*0.65,0.45),control2:p(x-bend*0.3,0.7));path.closeSubpath();context.addPath(path);context.fillPath()}
        case "woven-strips":
            let rows=count("rows",6,16),columns=count("columns",5,16),gap=n("gap",0.2)
            for row in 0..<rows{for column in 0..<columns{let w=r.width/Double(columns),h=r.height/Double(rows),x=r.minX+Double(column)*w,y=r.minY+Double(row)*h;if (row+column)%2==0{context.fill(CGRect(x:x+gap*w/2,y:y+h*0.3,width:w*(1-gap),height:h*0.4))}else{context.fill(CGRect(x:x+w*0.3,y:y+gap*h/2,width:w*0.4,height:h*(1-gap)))}}}
        default:return false
        }
        return true
    }
    private static func clip(_ polygon:[CGPoint],nx:Double,ny:Double,limit:Double)->[CGPoint] {
        guard !polygon.isEmpty else{return []};var output:[CGPoint]=[]
        for i in polygon.indices {let a=polygon[i],b=polygon[(i+1)%polygon.count],da=a.x*nx+a.y*ny-limit,db=b.x*nx+b.y*ny-limit
            if da<=0{output.append(a)}
            if (da<=0) != (db<=0){let t=da/(da-db);output.append(CGPoint(x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t))}
        };return output
    }
    private static func tonal(_ kind:String,r:CGRect,context:CGContext,values:[String:Double],stage:ConstructionStage) {
        let unit=min(r.width,r.height),level=ConstructionStage.allCases.firstIndex(of:stage) ?? 3,grid=min(Int(values["grid"] ?? 48),[14,26,38,70][level]),tilt=values["tilt"] ?? 0.8,roundness=values["roundness"] ?? 0.16,light=values["light"] ?? -0.5
        func sdf(_ px:Double,_ py:Double,_ pz:Double)->Double {
            let x=px*cos(0.35)-pz*sin(0.35),zz=px*sin(0.35)+pz*cos(0.35),y=py*cos(tilt)-zz*sin(tilt),z=py*sin(tilt)+zz*cos(tilt)
            func torus(_ a:Double,_ b:Double,_ c:Double,_ radius:Double=0.52)->Double{let q=hypot(a,c)-radius;return hypot(q,b)-(0.15+roundness*0.4)}
            switch kind {
            case "sphere":return sqrt(x*x+y*y+z*z)-(0.68+roundness*0.35)
            case "torus":return torus(x,y,z)
            case "capsule":return sqrt(x*x+pow(y-max(-0.4,min(0.4,y)),2)+z*z)-(0.22+roundness*0.45)
            case "cube":let qx=abs(x)-0.49,qy=abs(y)-0.49,qz=abs(z)-0.49;return sqrt(pow(max(qx,0),2)+pow(max(qy,0),2)+pow(max(qz,0),2))+min(max(qx,max(qy,qz)),0)-roundness*0.6
            case "cone":return max((hypot(x,z)-(0.44-y*0.45))*0.85,abs(y)-0.68)-roundness*0.15
            case "ellipsoid":return (sqrt(pow(x/0.75,2)+pow(y/0.42,2)+pow(z/0.55,2))-1)*0.42-roundness*0.12
            case "link":
                let tube:Double=0.075+roundness*0.22
                let a:Double=hypot(hypot(x-0.25,z)-0.40,y)-tube
                let b:Double=hypot(hypot(y+0.25,z)-0.40,x)-tube
                return min(a,b)
            case "gyroid":let wave=abs(sin(4*x)*cos(4*y)+sin(4*y)*cos(4*z)+sin(4*z)*cos(4*x))/6-(0.05+roundness*0.2);return max(wave,sqrt(x*x+y*y+z*z)-0.82)
            default:return 10
            }
        }
        for row in 0..<grid{for column in 0..<grid{let x=(Double(column)+0.5)/Double(grid)*2-1,y=(Double(row)+0.5)/Double(grid)*2-1;var t=0.0,hit=false
            for _ in 0..<90{let d=sdf(x,y,2-t);if d<0.002{hit=true;break};t+=max(0.002,d*0.68);if t>4{break}}
            if !hit{continue};let z=2-t,e=0.003,nx=sdf(x+e,y,z)-sdf(x-e,y,z),ny=sdf(x,y+e,z)-sdf(x,y-e,z),nz=sdf(x,y,z+e)-sdf(x,y,z-e),norm=sqrt(nx*nx+ny*ny+nz*nz),ln=sqrt(light*light+0.4*0.4+0.85*0.85),diffuse=max(0,(nx*light-ny*0.4+nz*0.85)/max(0.00001,norm*ln)),coverage=0.09+0.84*(1-diffuse*0.9),radius=unit/Double(grid)*0.47*sqrt(coverage)
            context.fillEllipse(in:CGRect(x:r.midX+x*unit*0.5-radius,y:r.midY+y*unit*0.5-radius,width:2*radius,height:2*radius))
        }}
    }
}
