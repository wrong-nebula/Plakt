import Foundation
import CoreGraphics

/// Immutable vector construction results; CGPath instances are never mutated.
public struct ContourVectorBand:@unchecked Sendable {
    public let path:CGPath;public let index:Int
}
public enum ContourVectorEngine {
    /// Work in print-sized design coordinates (roughly 1000 units) to avoid tiny
    /// normalized-coordinate boolean tolerances. Round joins are true circular
    /// normal offsets; miter joins retain the rectilinear reference construction.
    public static func offset(_ source:CGPath,by distance:Double,rounded:Bool)->CGPath {
        guard distance.isFinite else{return CGMutablePath()}
        let path=source.normalized(using:.evenOdd)
        if abs(distance)<0.000001{return path}
        let stroke=path.copy(strokingWithWidth:abs(distance)*2,lineCap:.butt,lineJoin:rounded ? .round:.miter,miterLimit:4)
        return distance>0 ? path.union(stroke):path.subtracting(stroke)
    }
    /// Bands are the differences of successive offset regions. With `counters`, expansion
    /// moves only the exterior: rings stay anchored to each counter edge, so counters keep
    /// their size and start with a full-width channel instead of a clipped sliver.
    public static func channels(_ source:CGPath,count:Int,spacing:Double,duty:Double,expansion:Double,rounded:Bool,protecting counters:CGPath?=nil)->[ContourVectorBand] {
        let path=source.normalized(using:.evenOdd)
        guard !path.isEmpty,count>0,spacing.isFinite,spacing>0,duty.isFinite,(0.05...0.95).contains(duty),expansion.isFinite else{return []}
        let total=min(32,count),width=spacing*duty
        let holes=counters.map{$0.normalized(using:.evenOdd)}.flatMap{$0.isEmpty ? nil:$0}
        let anchored=holes != nil && abs(expansion)>0.000001,silhouette=anchored ? path.union(holes!,using:.evenOdd):path
        func region(_ depth:Double)->CGPath {
            let outer=offset(silhouette,by:expansion-depth,rounded:rounded)
            guard anchored,!outer.isEmpty else{return outer}
            return outer.subtracting(offset(holes!,by:depth,rounded:rounded))
        }
        var result:[ContourVectorBand]=[]
        for index in 0..<total {
            let depth=Double(index)*spacing,outer=region(depth)
            guard !outer.isEmpty else{continue}
            let band=outer.subtracting(region(depth+width))
            if !band.isEmpty {result.append(ContourVectorBand(path:band,index:index))}
        }
        return result
    }
    public static func counters(_ source:CGPath,within frame:CGRect)->[CGPath] {
        let background=CGPath(rect:frame,transform:nil).subtracting(source.normalized(using:.evenOdd))
        return background.componentsSeparated().filter{component in
            let b=component.boundingBoxOfPath,tolerance=0.001
            return b.minX>frame.minX+tolerance && b.maxX<frame.maxX-tolerance && b.minY>frame.minY+tolerance && b.maxY<frame.maxY-tolerance
        }
    }
    /// One region for several resolved outlines, so their offsets form a single distance
    /// field: neighbouring glyphs merge channels rather than overprinting each other's gaps.
    public static func union(_ paths:[CGPath])->CGPath {
        var result:CGPath=CGMutablePath()
        for path in paths where !path.isEmpty{result=result.isEmpty ? path.normalized(using:.evenOdd):result.union(path,using:.evenOdd)}
        return result
    }
    public static func fit(_ source:CGPath,to rect:CGRect,preserveAspect:Bool)->CGPath {fit(source,to:rect,stretch:preserveAspect ? 0:1)}
    /// `stretch` 0 keeps the source proportions, 1 fills the rectangle; values between blend
    /// the two scales. `bottom` sits the outline on the rectangle's lower edge.
    public static func fit(_ source:CGPath,to rect:CGRect,stretch:Double,bottom:Bool=false)->CGPath {
        guard var transform=fitTransform(source.boundingBoxOfPath,to:rect,stretch:stretch,bottom:bottom) else{return CGMutablePath()}
        return source.copy(using:&transform) ?? source
    }
    /// The scale and offset `fit` applies, for placing several paths with one shared transform.
    public static func fitTransform(_ bounds:CGRect,to rect:CGRect,stretch:Double,bottom:Bool=false)->CGAffineTransform? {
        guard !bounds.isNull,bounds.width>0,bounds.height>0 else{return nil}
        let fillX=rect.width/bounds.width,fillY=rect.height/bounds.height,uniform=min(fillX,fillY),t=min(1,max(0,stretch))
        let sx=t>=1 ? fillX:uniform+(fillX-uniform)*t,sy=t>=1 ? fillY:uniform+(fillY-uniform)*t
        let tx=rect.midX-bounds.midX*sx,ty=bottom ? rect.maxY-bounds.maxY*sy:rect.midY-bounds.midY*sy
        return CGAffineTransform(a:sx,b:0,c:0,d:sy,tx:tx,ty:ty)
    }
    /// A straight lower edge where the paper cuts a silhouette (a neck or torso), plus a skirt
    /// continuing the adjoining sides below it. Offsetting the skirted shape and clipping at
    /// the cut makes channels run off the edge instead of turning along it.
    public static func openEdge(_ path:CGPath,reach:Double)->(y:Double,skirt:CGPath)? {
        let b=path.boundingBoxOfPath,tolerance=b.height*0.0005
        guard b.width>0,b.height>0,reach.isFinite else{return nil}
        // Only straight segments qualify: the flat bottom of a curve is a turn, not a cut.
        // `leave`/`arrive` are the tangent points next to each end (control points for curves).
        struct Segment{var start:CGPoint;var end:CGPoint;var line:Bool;var leave:CGPoint;var arrive:CGPoint}
        var subpaths:[[Segment]]=[],current=CGPoint.zero,first=CGPoint.zero
        func close(){if hypot(current.x-first.x,current.y-first.y)>1e-9,!subpaths.isEmpty{subpaths[subpaths.count-1].append(Segment(start:current,end:first,line:true,leave:first,arrive:current))};current=first}
        path.applyWithBlock{pointer in
            let e=pointer.pointee
            switch e.type {
            case .moveToPoint:if !(subpaths.last?.isEmpty ?? true){close()};subpaths.append([]);current=e.points[0];first=current
            case .addLineToPoint:subpaths[subpaths.count-1].append(Segment(start:current,end:e.points[0],line:true,leave:e.points[0],arrive:current));current=e.points[0]
            case .addQuadCurveToPoint:subpaths[subpaths.count-1].append(Segment(start:current,end:e.points[1],line:false,leave:e.points[0],arrive:e.points[0]));current=e.points[1]
            case .addCurveToPoint:subpaths[subpaths.count-1].append(Segment(start:current,end:e.points[2],line:false,leave:e.points[0],arrive:e.points[1]));current=e.points[2]
            case .closeSubpath:close()
            @unknown default:break
            }
        }
        if !(subpaths.last?.isEmpty ?? true){close()}
        let skirt=CGMutablePath(),depth=max(0,reach)*1.5+b.height*0.05+20,lift=min(1,b.height*0.002)
        // Horizontal run per unit of depth along a side, continued past the cut.
        func slope(_ from:CGPoint,_ to:CGPoint)->Double{let dx=to.x-from.x,dy=to.y-from.y;return dy>hypot(dx,dy)*0.3 ? dx/dy:0}
        for segments in subpaths where segments.count>=3 {
            let n=segments.count
            for i in 0..<n {
                let s=segments[i],a=s.start,c=s.end
                guard s.line,abs(a.y-b.maxY)<=tolerance,abs(c.y-b.maxY)<=tolerance,abs(c.x-a.x)>=b.width*0.02 else{continue}
                let sa=slope(segments[(i+n-1)%n].arrive,a),sc=slope(segments[(i+1)%n].leave,c)
                skirt.move(to:CGPoint(x:a.x,y:a.y-lift));skirt.addLine(to:CGPoint(x:c.x,y:c.y-lift))
                skirt.addLine(to:CGPoint(x:c.x+sc*depth,y:c.y+depth));skirt.addLine(to:CGPoint(x:a.x+sa*depth,y:a.y+depth));skirt.closeSubpath()
            }
        }
        return skirt.isEmpty ? nil:(Double(b.maxY),skirt)
    }
    /// The requested point when it lies inside the outline; otherwise the deepest sampled
    /// interior point, so nested copies never converge on empty paper.
    public static func interiorPoint(_ path:CGPath,near point:CGPoint,rule:CGPathFillRule = .evenOdd)->CGPoint {
        if path.contains(point,using:rule){return point}
        let b=path.boundingBoxOfPath,steps=24
        let segments=SurveyTypeGeometry.contours(path).flatMap{c in zip(c,c.dropFirst()).map{($0,$1)}}
        guard b.width>0,b.height>0,!segments.isEmpty else{return point}
        var best=point,depth = -1.0
        for i in 0..<steps {
            for j in 0..<steps {
                let q=CGPoint(x:b.minX+(Double(i)+0.5)/Double(steps)*b.width,y:b.minY+(Double(j)+0.5)/Double(steps)*b.height)
                guard path.contains(q,using:rule) else{continue}
                var nearest=Double.infinity
                for (a,c) in segments {
                    let dx=c.x-a.x,dy=c.y-a.y,length=dx*dx+dy*dy
                    let t=length>0 ? min(1,max(0,((q.x-a.x)*dx+(q.y-a.y)*dy)/length)):0
                    nearest=min(nearest,hypot(q.x-a.x-t*dx,q.y-a.y-t*dy))
                }
                if nearest>depth{depth=nearest;best=q}
            }
        }
        return best
    }
}
