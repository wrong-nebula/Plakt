import Foundation
import CoreGraphics

/// Vector-only, parameter-driven interpretations of visually inspected source relationships.
enum ShapeSystemGeometry {
    static func draw(_ element:SceneElement,rect:CGRect,context:CGContext,aspect:Double)->Bool {
        let operation=String(element.shape.dropFirst("system-".count))
        guard ShapeSystemEngine.operations.contains(operation) else{return false}
        let values=element.geometry ?? [:]
        func n(_ key:String,_ fallback:Double,_ low:Double,_ high:Double)->Double{min(high,max(low,values[key] ?? fallback))}
        func count(_ key:String,_ fallback:Int,_ max:Int=32)->Int{Int(n(key,Double(fallback),1,Double(max)))}
        context.saveGState();defer{context.restoreGState()}
        context.scaleBy(x:1,y:1/aspect)
        let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect),unit=min(r.width,r.height)
        context.clip(to:r);context.setStrokeColor(LibrarySceneRenderer.color(element.color))
        context.setLineWidth(unit*n("lineWidth",0.009,0.001,0.08));context.setLineCap(.round);context.setLineJoin(.round)
        func point(_ x:Double,_ y:Double)->CGPoint{CGPoint(x:r.minX+x*r.width,y:r.minY+y*r.height)}
        func dot(_ x:Double,_ y:Double,_ radius:Double){context.fillEllipse(in:CGRect(x:r.minX+x*r.width-radius,y:r.minY+y*r.height-radius,width:radius*2,height:radius*2))}
        if ReviewedShapeGeometry.draw(operation, rect:r, context:context, values:values){return true}
        switch operation {
        case "spiral-stack":
            let total=count("count",5,12),turns=n("turns",1.75,0.5,6),phase=n("phase",0,-20,20),growth=n("growth",0.5,0,1.2)
            let weights=(0..<total).map{exp(Double($0)*growth)},sum=weights.reduce(0,+)
            var accumulated=0.0
            for row in 0..<total {
                let fraction=weights[row]/sum,rx=0.46,ry=fraction*0.44
                let center=accumulated+fraction/2,path=CGMutablePath();accumulated += fraction
                for step in 0...700 {
                    let t=Double(step)/700,angle=t*turns*2*Double.pi+phase
                    let p=point(0.5+rx*t*cos(angle),center+ry*t*sin(angle))
                    if step==0{path.move(to:p)}else{path.addLine(to:p)}
                }
                context.addPath(path);context.strokePath()
            }
        case "wave-lines":
            let total=count("count",22,80),amplitude=n("amplitude",0.16,0,0.32),frequency=n("frequency",1.25,0.2,5),phase=n("phase",0,-20,20)
            for row in 0..<total {
                let base=(Double(row)+0.5)/Double(total),path=CGMutablePath()
                for step in 0...350 {
                    let x=Double(step)/350,amount=amplitude*(1-abs(base-0.5)*1.7)
                    let y=base+amount*sin(x*Double.pi*2*frequency+phase)*sin(x*Double.pi)
                    let p=point(x,y);if step==0{path.move(to:p)}else{path.addLine(to:p)}
                }
                context.addPath(path);context.strokePath()
            }
        case "mirror-arcs":
            let total=count("count",6,24),bend=n("bend",0.48,0.05,0.75)
            for side in 0..<2 {for half in 0..<2 {for i in 0..<total {
                let t=Double(i)/Double(max(1,total-1)),endX=0.23+0.24*t,endY=0.02+0.36*t
                func reflected(_ x:Double,_ y:Double)->CGPoint {
                    point(side==0 ? x:1-x,half==0 ? y:1-y)
                }
                let path=CGMutablePath();path.move(to:reflected(0.04,0.5))
                path.addCurve(to:reflected(endX,endY),
                    control1:reflected(0.04+0.25*t,0.5-bend*0.25*(1-t)),
                    control2:reflected(endX,endY+(0.5-endY)*bend))
                context.addPath(path);context.strokePath()
            }}}
        case "folded-tiles":
            let rows=count("rows",7,24),columns=count("columns",5,24),slant=n("slant",0.43,0.05,0.9)
            for row in 0..<rows {for column in 0..<columns {
                let x=Double(column)/Double(columns),y=Double(row)/Double(rows),w=1/Double(columns),h=1/Double(rows)
                let path=CGMutablePath();path.move(to:point(x,y+h));path.addLine(to:point(x+w,y-h*slant));path.addLine(to:point(x+w*(1-slant),y+h*0.55));path.closeSubpath()
                context.addPath(path);context.fillPath()
            }}
        case "circle-clusters":
            let rows=count("rows",6,16),columns=count("columns",4,16),satellite=n("satellite",0.45,0,0.8),phase=n("phase",0,-20,20)
            let cell=min(r.width/Double(columns),r.height/Double(rows)),radius=cell*n("radius",0.30,0.1,0.38)
            for row in 0..<rows {for column in 0..<columns {
                let center=point((Double(column)+0.5)/Double(columns),(Double(row)+0.5)/Double(rows)),angle=phase+Double(row+column)*Double.pi/3
                context.fillEllipse(in:CGRect(x:center.x-radius,y:center.y-radius,width:radius*2,height:radius*2))
                for side in [-1.0,1.0] {let x=center.x+cos(angle)*radius*side,y=center.y+sin(angle)*radius*side,small=radius*satellite;context.fillEllipse(in:CGRect(x:x-small,y:y-small,width:small*2,height:small*2))}
            }}
        case "perforated-grid":
            let rows=count("rows",4,12),columns=count("columns",3,12),holes=count("holes",4,8)
            for row in 0..<rows {for column in 0..<columns {
                let x=Double(column)/Double(columns),y=Double(row)/Double(rows),w=1/Double(columns),h=1/Double(rows)
                let box=CGRect(x:r.minX+(x+w*0.08)*r.width,y:r.minY+(y+h*0.08)*r.height,width:w*r.width*0.84,height:h*r.height*0.84)
                let path=CGMutablePath();path.addRoundedRect(in:box,cornerWidth:box.width*0.35,cornerHeight:box.height*0.35)
                for hole in 0..<holes {let angle=Double(hole)/Double(holes)*2*Double.pi,rr=min(box.width,box.height)*0.105,cx=box.midX+cos(angle)*box.width*0.26,cy=box.midY+sin(angle)*box.height*0.26;path.addEllipse(in:CGRect(x:cx-rr,y:cy-rr,width:rr*2,height:rr*2))}
                context.addPath(path);context.drawPath(using:.eoFill)
            }}
        case "radial-spokes":
            let total=count("count",32,96),inner=n("innerRadius",0.06,0,0.4),outer=n("outerRadius",0.46,0.2,0.49),phase=n("phase",0,-20,20)
            for i in 0..<total {let a=Double(i)/Double(total)*2*Double.pi+phase,path=CGMutablePath();path.move(to:CGPoint(x:r.midX+cos(a)*unit*inner,y:r.midY+sin(a)*unit*inner));path.addLine(to:CGPoint(x:r.midX+cos(a)*unit*outer,y:r.midY+sin(a)*unit*outer));context.addPath(path);context.strokePath()}
        case "petal-rosette":
            let total=count("count",8,24),outer=n("outerRadius",0.46,0.2,0.49),width=n("petalWidth",0.35,0.08,0.8),phase=n("phase",0,-20,20)
            for i in 0..<total {
                let a=Double(i)/Double(total)*2*Double.pi+phase
                func p(_ distance:Double,_ offset:Double)->CGPoint{CGPoint(x:r.midX+cos(a+offset)*unit*distance,y:r.midY+sin(a+offset)*unit*distance)}
                let path=CGMutablePath();path.move(to:p(0.03,0));path.addCurve(to:p(outer,0),control1:p(outer*0.45,-width),control2:p(outer,-width));path.addCurve(to:p(0.03,0),control1:p(outer,width),control2:p(outer*0.45,width));path.closeSubpath();context.addPath(path);context.fillPath()
            }
        default:return false
        }
        return true
    }
}
