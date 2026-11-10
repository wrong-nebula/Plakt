import Foundation
import CoreGraphics

public struct TypePlacementSettings:Codable,Sendable,Hashable {
    public static let modes=["anchored","mixed","free"]
    public static let contrasts=["off","auto","interlock"]
    public var version="type-placement-v1"
    /// anchored: every text block moves into a system anchor. mixed: title and information only. free: type keeps its layout position.
    public var mode="anchored"
    /// auto recolors type where it sits on a similar-colored shape below it; interlock also knocks it out of shapes drawn above it.
    public var contrast="auto"
    public init(mode:String="anchored",contrast:String="auto"){self.mode=mode;self.contrast=contrast}
    public func validate()throws {guard version=="type-placement-v1",Self.modes.contains(mode),Self.contrasts.contains(contrast) else{throw PosterError.invalid("Type placement must be anchored, mixed or free, with contrast off, auto or interlock.")}}
}

public struct OverlapContrast:Codable,Sendable,Hashable {
    public var ink:String;public var shapeIDs:[String];public var layer:String
    public init(ink:String,shapeIDs:[String],layer:String){self.ink=ink;self.shapeIDs=shapeIDs;self.layer=layer}
    var maskKey:String{shapeIDs.joined(separator:"|")}
}

/// A place a shape system offers to type. Length runs along the reading direction and thickness across it, both in
/// physical poster-width units; x/y is the normalized canvas center and rotation uses the renderer's clockwise degrees.
public struct TypeAnchor:Codable,Sendable,Hashable {
    public var id:String;public var role:String;public var source:String
    public var x:Double;public var y:Double
    public var length:Double;public var thickness:Double;public var rotation:Double
    public var alignment:String;public var vertical:String;public var onShape:Bool
    public var group:String?=nil
    /// Physical point at local (s,t): s along the reading direction, t across it (positive = below the line).
    public func point(_ s:Double,_ t:Double,aspect:Double)->CGPoint {
        let a=rotation * .pi/180
        return CGPoint(x:x+s*cos(a)-t*sin(a),y:y*aspect+s*sin(a)+t*cos(a))
    }
    public func corners(aspect:Double)->[CGPoint]{[(-1.0,-1.0),(1,-1),(1,1),(-1,1)].map{point($0.0*length/2,$0.1*thickness/2,aspect:aspect)}}
    public func footprint(aspect:Double)->UnitBox {
        let c=corners(aspect:aspect),xs=c.map(\.x),ys=c.map{$0.y/aspect}
        return UnitBox(x:xs.min()!,y:ys.min()!,width:xs.max()!-xs.min()!,height:ys.max()!-ys.min()!)
    }
}

/// Where each survey system expects type, derived from the same parameters its renderer draws with.
enum TypeAnchors {
    struct Local {
        var name:String;var role:String;var center:CGPoint;var length:Double;var thickness:Double
        var rotation:Double=0;var alignment="left";var vertical="center";var onShape=false;var group:String?=nil
    }
    /// Carry anchors authored for an upright construction through the renderer's quarter turn or transposition.
    /// Boxes stay boxes and re-derive their reading direction from their turned shape; lines turn with the system.
    static func oriented(_ locals:[Local],_ t:CGAffineTransform)->[Local] {
        guard !t.isIdentity else{return locals}
        let linear=CGAffineTransform(a:t.a,b:t.b,c:t.c,d:t.d,tx:0,ty:0)
        return locals.map{l in
            var m=l;m.center=l.center.applying(t)
            let u=CGPoint(x:cos(l.rotation * .pi/180),y:sin(l.rotation * .pi/180)).applying(linear)
            if abs(l.rotation)<0.5 {
                let horizontal=abs(u.x)>0.5,w=horizontal ? l.length:l.thickness,h=horizontal ? l.thickness:l.length,tall=h>w*2.2 && w<0.16
                m.rotation=tall ? -90:0;m.length=tall ? h:w;m.thickness=tall ? w:h
                if horizontal && t.d<0 {m.vertical=l.vertical=="top" ? "bottom":l.vertical=="bottom" ? "top":l.vertical}else if !horizontal{m.vertical="center"}
            }else{
                var angle=atan2(u.y,u.x)*180 / .pi
                if cos(angle * .pi/180) < -0.01{angle+=180}
                while angle>180{angle-=360}
                m.rotation=angle
            }
            return m
        }
    }
    /// Anchors inside the physical drawing rect the renderers use (y already multiplied by aspect).
    static func recipe(_ id:String,r:CGRect,values:[String:Double])->[Local] {
        func n(_ key:String,_ fallback:Double,_ low:Double,_ high:Double)->Double{let v=values[key] ?? fallback;return v.isFinite ? min(high,max(low,v)):fallback}
        func count(_ key:String,_ fallback:Int,_ low:Int,_ high:Int)->Int{Int(n(key,Double(fallback),Double(low),Double(high)).rounded())}
        // Turned or transposed systems: author upright, then map with the renderer's own transform.
        let turnKeys=["survey-faceted-spire":"direction","survey-sliced-orb":"axis","survey-gravity-drips":"flow"]
        if let key=turnKeys[id] {
            let turn=id=="survey-sliced-orb" ? (count(key,0,0,1)==1 ? 2:0):count(key,0,0,3)
            if turn != 0 && !(id=="survey-gravity-drips" && n("letters",0,0,1)>=0.5) {
                let o=ExtendedSurveyGeometry.orientation(turn,rect:r);var upright=values;upright[key]=0
                return oriented(recipe(id,r:o.authored,values:upright),o.transform)
            }
        }
        if id=="survey-module-substitution",count("direction",0,0,2)==1 {
            var upright=values;upright["direction"]=0
            return oriented(recipe(id,r:CGRect(x:0,y:0,width:r.height,height:r.width),values:upright),CGAffineTransform(a:0,b:1,c:1,d:0,tx:r.minX,ty:r.minY))
        }
        let unit=min(r.width,r.height)
        func p(_ x:Double,_ y:Double)->CGPoint{CGPoint(x:r.minX+x*r.width,y:r.minY+y*r.height)}
        func box(_ name:String,_ role:String,_ x0:Double,_ y0:Double,_ x1:Double,_ y1:Double,align:String="left",vertical:String="center",onShape:Bool=false,rotation:Double=0,group:String?=nil)->Local? {
            guard x1>x0,y1>y0 else{return nil}
            let w=(x1-x0)*r.width,h=(y1-y0)*r.height,turned=abs(rotation)>45
            return Local(name:name,role:role,center:p((x0+x1)/2,(y0+y1)/2),length:turned ? h:w,thickness:turned ? w:h,rotation:rotation,alignment:align,vertical:vertical,onShape:onShape,group:group)
        }
        var out:[Local?]=[]
        switch id {
        case "survey-faceted-spire":
            let spread=n("spread",0.88,0.4,1),spine=n("spine",0.5,0.32,0.68),reach=spread*0.46,k=reach/0.945,spires=count("spires",1,1,3)
            // Repeated spires leave no flanks of their own; each offers its spine.
            if spires>1 {
                for s in 0..<spires{let x=(Double(s)+spine)/Double(spires);out.append(box("spire-\(s)-spine","display",x-0.022,0.5,x+0.022,0.94,onShape:true,rotation:-90))}
                break
            }
            // Largest flank rectangle above an outer wing, whose free width shrinks linearly as it descends.
            func flank(_ room:Double)->Double{min(0.62,max(0.16,(room+k*0.055)/(2*k)))}
            // Edge prongs of the deeper tiers reach into the flanks and across the outer wing.
            let fan=n("tipFan",0,0,1),prongs=ExtendedSurveyGeometry.spireTiers(values).dropFirst().map(\.tip).min() ?? 1
            let ceiling=fan>0 ? prongs-0.05:1,leftBottom=min(ceiling,flank(spine-0.07)),rightBottom=min(ceiling,flank(0.93-spine))
            out.append(box("spire-flank-left","title",0.04,0.03,spine-k*(leftBottom-0.025)-0.03,leftBottom,vertical:"top"))
            out.append(box("spire-flank-right","display",spine+k*(rightBottom-0.025)+0.03,0.03,0.96,rightBottom,align:"right",vertical:"top"))
            for side in [-1.0,1.0] where fan<0.2 {
                let apex=p(spine,0.025),tip=p(spine+side*reach,0.97),dx=tip.x-apex.x,dy=tip.y-apex.y,length=hypot(dx,dy)
                // Read up the left wing and down the right one; the line sits just outside the fold.
                let ux=side<0 ? -dx/length:dx/length,uy=side<0 ? -dy/length:dy/length,thickness=unit*0.05,lift=thickness/2+unit*0.012
                let mid=CGPoint(x:apex.x+dx*0.74,y:apex.y+dy*0.74)
                out.append(Local(name:side<0 ? "spire-wing-left":"spire-wing-right",role:"display",center:CGPoint(x:mid.x+uy*lift,y:mid.y-ux*lift),length:length*0.36,thickness:thickness,rotation:atan2(uy,ux)*180 / .pi,alignment:"center"))
            }
            out.append(box("spire-spine","display",spine-0.022,0.5,spine+0.022,0.94,onShape:true,rotation:-90))
        case "survey-sliced-orb":
            let slices=count("slices",6,2,12),gap=n("gap",0,0,0.045),stack=count("stack",1,1,3),flatten=n("flatten",0.9,0.35,1.2)
            let displacement=n("displacement",0.09,0,0.24),vh=unit*flatten,vw=unit*(values["stack"]==nil ? 0.72:0.98)*n("bleed",1,1,1.7),band=vh/Double(slices)
            let top=r.midY-vh*Double(stack)/2,bottom=r.midY+vh*Double(stack)/2,rule=max(gap*r.height,band*0.34)/2/r.height
            // Slice boundaries are the system's own rules: information sits on them, left and right — unless the
            // title is printed round the volumes, which already fills every slice.
            for i in 1..<(slices*stack) where n("surfaceType",0,0,1)<0.5 {
                let y=(top+Double(i)*band-r.minY)/r.height
                out.append(box("orb-rule-\(i)-left","info",0.03,y-rule,0.48,y+rule,onShape:true,group:"orb-rules"))
                out.append(box("orb-rule-\(i)-right","info",0.52,y-rule,0.97,y+rule,align:"right",onShape:true,group:"orb-rules"))
            }
            let above=(top-r.minY)/r.height,below=(r.maxY-bottom)/r.height
            if above>=0.07{out.append(box("orb-above","title",0.03,0.01,0.97,above-0.01,vertical:"bottom"))}
            if below>=0.05{out.append(box("orb-below","display",0.03,1-below+0.01,0.97,0.99,vertical:"top"))}
            let side=((r.width-vw)/2-displacement*unit)/r.width,y0=above,y1=1-below
            if side>=0.09 {
                out.append(box("orb-side-left","display",0.02,y0,side-0.015,y1,rotation:-90))
                out.append(box("orb-side-right","display",1-side+0.015,y0,0.98,y1,rotation:90))
            }
        case "survey-gravity-drips":
            // Letters are the title band; their streams run down (or up, rising) across the rest of the field.
            if n("letters",0,0,1)>=0.5 {
                let rising=count("flow",0,0,3)==1
                out.append(rising ? box("drip-foot","info",0.05,0.025,0.62,0.2,vertical:"top",onShape:true):box("drip-foot","info",0.05,0.78,0.62,0.975,vertical:"bottom",onShape:true))
                out.append(rising ? box("drip-run","display",0.05,0.24,0.95,0.5,vertical:"top",onShape:true):box("drip-run","display",0.05,0.5,0.95,0.74,vertical:"top",onShape:true))
                break
            }
            let total=count("count",13,4,28),pool=n("pool",0.115,0.045,0.18),reach=n("length",0.67,0.24,0.77)
            var top=Double.infinity,bottom=0.0,ends:[Double]=[]
            if ExtendedSurveyGeometry.legacyDrips(values) {
                var rng=SeededRandom(seed:UInt64(n("shapeSeed",817,0,9_000_000)))
                for i in 0..<total {
                    // Same stream order as the renderer: crest jitter, pool radius, reach, stream width.
                    let t=Double(i)/Double(total-1),x=0.12+t*0.76,y=0.15+0.055*sin(t*Double.pi*2*1.3)+rng.value(-0.025,0.025)
                    let center=p(x,y),raw=pool*rng.value(0.65,1.05)*unit
                    let radius=min(raw,min(center.x-r.minX,r.maxX-center.x)*0.94,(center.y-r.minY)*0.94)
                    top=min(top,center.y-radius);bottom=max(bottom,center.y+radius)
                    ends.append(min(0.965,y+reach*rng.value(0.48,1)));_ = rng.value(0.6,1.3)
                }
            }else{
                // Scattered pools spread the crest; the band covers their middle half rather than every outlier.
                let layout=ExtendedSurveyGeometry.dripLayout(values,rect:r)
                let tops=layout.map{$0.center.y-$0.radius}.sorted(),bottoms=layout.map{$0.center.y+$0.radius}.sorted()
                top=tops[tops.count/4];bottom=bottoms[bottoms.count*3/4]
                ends=layout.flatMap{$0.streams.map{($0.end.y-r.minY)/r.height}}
            }
            // When the letters themselves are the pools, the band already holds the title.
            let crest=((top+bottom)/2-r.minY)/r.height,half=(bottom-top)*0.28/r.height
            if n("letters",0,0,1)<0.5{out.append(box("drip-pools","title",0.1,crest-half,0.9,crest+half,onShape:true))}
            let run=ends.sorted()[ends.count/2]+0.03
            if 0.97-run>=0.16{out.append(box("drip-run","display",0.05,run,0.95,0.86,vertical:"top"))}
            // Long-tailed streams reach the foot, so information may sit across them there; contrast keeps it legible.
            out.append(box("drip-foot","info",0.05,max(min(run,0.8),0.78),0.62,0.975,vertical:"bottom",onShape:true))
        case "survey-bilateral-soft-cross":
            let stretch=n("stretch",1.03,0.65,1.4),bodyScale=n("bodyScale",1,0.5,1.2),centerY=n("centerY",0.5,0.28,0.6),stemWidth=n("stemWidth",0.036,0.02,0.16)
            let form=ExtendedSurveyGeometry.crossForm(values),cx=r.midX,cy=r.minY+r.height*centerY,sx=unit/max(1,stretch),sy=unit*min(1,stretch),peak=0.45*bodyScale
            func radius(_ a:Double)->Double{ExtendedSurveyGeometry.crossRadius(form,a)}
            func inside(_ q:CGPoint)->Bool{let dx=(q.x-cx)/sx,dy=(q.y-cy)/sy;return hypot(dx,dy)<=radius(atan2(dy,dx))}
            // Shrink a horizontal box until every probe lies inside (lobes) or outside (waists) the silhouette.
            func fitted(_ name:String,_ role:String,_ center:CGPoint,_ size:Double,_ wantInside:Bool,align:String="left")->Local? {
                var best:Local?
                for ratio in [2.6,1.9,1.35] {
                    var length=size*sx*sqrt(ratio),thickness=size*sy/sqrt(ratio)
                    for _ in 0..<28 {
                        let probes=[(-1.0,-1.0),(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0)].map{CGPoint(x:center.x+$0.0*length/2,y:center.y+$0.1*thickness/2)}
                        if probes.allSatisfy({inside($0)==wantInside && r.contains($0)}) {
                            if length*thickness>(best.map{$0.length*$0.thickness} ?? 0){best=Local(name:name,role:role,center:center,length:length,thickness:thickness,alignment:align,onShape:wantInside)}
                            break
                        }
                        length*=0.92;thickness*=0.92
                    }
                }
                return (best?.length ?? 0)>=unit*0.1 ? best:nil
            }
            // Lobes crown where cos(lobes·(a−spin)) = −1. The lobe nearest the upper left carries the title, the
            // nearest upper right a display line, the two nearest the lower corners information, as in the source.
            let crowns=(0..<Int(form.lobes)).map{(Double.pi+2*Double.pi*Double($0))/form.lobes+form.spin}
            func nearest(_ target:Double,_ taken:[Double])->Double?{crowns.filter{c in !taken.contains(c)}.min{abs(remainder($0-target,2*Double.pi))<abs(remainder($1-target,2*Double.pi))}}
            var taken:[Double]=[]
            for (name,role,target) in [("cross-lobe-upper-left","title",-135.0),("cross-lobe-upper-right","display",-45),("cross-lobe-lower-left","info",135),("cross-lobe-lower-right","info",45)] {
                guard let a=nearest(target * .pi/180,taken) else{continue}
                taken.append(a)
                out.append(fitted(name,role,CGPoint(x:cx+cos(a)*peak*0.6*sx,y:cy+sin(a)*peak*0.6*sy),peak*0.75,true))
            }
            out.append(fitted("cross-waist-top","display",CGPoint(x:cx,y:cy-peak*0.74*sy),peak*0.42,false,align:"center"))
            let lowest=(0...90).map{i->Double in let a=Double(i)/90 * .pi;return cy+sin(a)*radius(a)*sy}.max() ?? cy
            let highest=(0...90).map{i->Double in let a = -Double(i)/90 * .pi;return cy+sin(a)*radius(a)*sy}.min() ?? cy
            let stemHalf=unit*stemWidth/2/r.width+0.035,foot=(lowest-r.minY)/r.height+0.03,headroom=(highest-r.minY)/r.height
            if 0.98-foot>=0.06 {
                out.append(box("cross-foot-left","info",0.03,foot,0.5-stemHalf,0.98,vertical:"bottom"))
                out.append(box("cross-foot-right","display",0.5+stemHalf,foot,0.97,0.98,align:"right",vertical:"bottom"))
            }
            if headroom>=0.1{out.append(box("cross-above","title",0.03,0.01,0.97,headroom-0.02,vertical:"bottom"))}
        case "survey-portal-type":
            let depth=n("depth",0.44,0.2,0.7),fx=n("focusX",0.53,0.25,0.75),fy=n("focusY",0.5,0.25,0.75)
            // The innermost frame is the only unprinted surface inside the corridor. Polygon frames offer the
            // square inscribed in their apothem.
            let sides=count("sides",4,3,8),side=1-depth,x0=fx*depth,y0=fy*depth
            let inner=sides==4 ? side:side*cos(Double.pi/Double(sides))/sqrt(2),ix=x0+(side-inner)/2,iy=y0+(side-inner)/2,inset=inner*0.08
            out.append(box("portal-aperture-top","display",ix+inset,iy+inset,ix+inner-inset,iy+inner*0.45,align:"center"))
            out.append(box("portal-aperture-base","info",ix+inset,iy+inner*0.5,ix+inner-inset,iy+inner-inset,vertical:"top"))
        case "survey-module-substitution":
            let rows=count("rows",12,4,64),columns=count("columns",9,3,32),bias=n("bias",1.65,0.55,3.2)
            // Radial fields are densest at the centre: the title sits across the core.
            if count("direction",0,0,2)==2{out.append(box("module-core","title",0.12,0.44,0.88,0.56,onShape:true));break}
            var centers:[Double]=[],halves:[Double]=[],pitches:[Double]=[]
            for row in 0..<rows {
                let t=(Double(row)+0.5)/Double(rows),y=0.035+pow(t,bias)*0.93
                let pitch=max(0.002,(pow(min(1,t+0.5/Double(rows)),bias)-pow(max(0,t-0.5/Double(rows)),bias))*0.93*r.height)
                centers.append(r.minY+y*r.height);halves.append(min(r.width/Double(columns)*0.84,pitch*0.84)*0.45);pitches.append(pitch)
            }
            // Sparse rows leave horizontal rules of paper; the densest rows fuse into a band type can sit on.
            for i in 0..<(rows-1) {
                let free=(centers[i+1]-halves[i+1])-(centers[i]+halves[i])
                guard free>=unit*0.03 else{continue}
                let mid=((centers[i]+halves[i]+centers[i+1]-halves[i+1])/2-r.minY)/r.height,t=free*0.4/r.height
                out.append(box("module-gap-\(i)",free>=unit*0.08 ? "display":"info",0.05,mid-t,0.95,mid+t,group:"module-gaps"))
            }
            let densest=pitches.min() ?? 0,dense=pitches.indices.filter{pitches[$0]<=densest*1.8}
            // A letter mask removes parts of the dense band, so it no longer makes a reliable title surface.
            if count("mask",0,0,2)==0,let first=dense.min(),let last=dense.max() {
                let y0=(centers[first]-halves[first]-r.minY)/r.height,y1=(centers[last]+halves[last]-r.minY)/r.height
                if y1-y0>=0.08{out.append(box("module-dense","title",0.05,y0,0.95,y1,onShape:true))}
            }
        case CirclePackGeometry.operation:
            // Type sits inside the largest discs, as in the source: the title in the biggest (along the diagonal when
            // the packing follows it), display and information copy in the next. Letters in circles keep the rest; packed letters carry the title themselves.
            let discs=CirclePackGeometry.circles(values,rect:r),punched=count("holes",0,0,1)==1 && count("field",1,0,1)==1
            let tilt=count("layout",0,0,4)==0 && count("bias",1,0,5)==1 ? atan2(r.height,r.width)*180 / .pi:0
            for (i,d) in discs.prefix([4,2,0,0][count("letters",0,0,3)]).enumerated() where d.radius>=unit*0.08 {
                out.append(Local(name:"pack-\(i)",role:["title","display","info","info"][i],center:d.center,length:d.radius*(i==0 ? 1.72:1.6),thickness:d.radius*(i==0 ? 0.62:0.5),rotation:i==0 ? tilt:0,alignment:"center",onShape:!punched,group:i>=2 ? "pack-info":nil))
            }
        case SawtoothSpringGeometry.operation:
            // Stripes and fins cover the field: the title crosses them as a band, cut out by overlap contrast, and
            // information sits at the foot. A spring leaves paper either side, which the quiet zones take.
            switch count("layout",0,0,5) {
            case 1,2,5:
                out.append(box("saw-band","title",0.05,0.34,0.95,0.66,align:"center",onShape:true))
                out.append(box("saw-foot","info",0.05,0.84,0.62,0.97,vertical:"bottom",onShape:true))
            case 3:
                // A ring holds the title inside it: on the solid blade, or in the open centre of a band.
                let ring=n("radius",0.62,0.1,0.95)*unit/2,hx=ring*0.62/r.width,hy=ring*0.5/r.height
                out.append(box("saw-core","title",0.5-hx,0.5-hy,0.5+hx,0.5+hy,align:"center",onShape:n("fill",1,0.1,1)>=0.999))
                let below=0.5+ring*1.36/r.height
                if below<=0.86{out.append(box("saw-foot","info",0.05,below+0.02,0.95,0.98,vertical:"top"))}
            case 4:
                out.append(box("saw-band","title",0.05,0.38,0.95,0.62,align:"center",onShape:true))
            default:break
            }
        case OrbitWrapGeometry.operation:
            // The title is the subject: it sits on the axis, between the far and near arcs. Paper left above
            // and below the orbits takes display and information copy.
            let cx=n("centerX",0.5,0.2,0.8),cy=n("centerY",0.5,0.2,0.8),radius=n("radius",0.56,0.15,0.8),span=n("height",0.78,0.1,1)
            let reach=abs(n("tilt",0.16,-0.6,0.6))*radius*r.width/r.height+n("band",0.045,0.004,0.12)*unit/r.height
            // The core spans most of the axis, so a large title is wound by several turns. A single ring slid
            // along the axis is a halo: the title takes the axis on its far side.
            var y0=cy-span/2,y1=cy+span/2
            if count("path",1,0,3)==0,count("turns",5,1,9)==1 {
                let ring=cy+n("shift",0,-1,1)*span/2
                if ring<cy-span*0.15{y0=ring+reach}else if ring>cy+span*0.15{y1=ring-reach}
            }
            let wide=min(radius*0.86,min(cx,1-cx)-0.03),pad=(y1-y0)*0.06
            // With the title printed on the band, the band carries it and the core stays clear of type.
            if y1-y0-2*pad>=0.08 && n("bandCopy",0,0,1)<0.5{out.append(box("orbit-core","title",cx-wide,y0+pad,cx+wide,y1-pad,align:"center",onShape:true))}
            let top=min(y0,cy-span/2-reach),bottom=max(y1,cy+span/2+reach)
            if top>=0.12{out.append(box("orbit-above","display",0.04,0.02,0.96,top-0.02,vertical:"bottom"))}
            if bottom<=0.9{out.append(box("orbit-below","info",0.04,bottom+0.02,0.96,0.98,vertical:"top"))}
        default:break
        }
        return out.compactMap{$0}
    }

    /// Recipe anchors in canvas space plus quiet zones measured from the rendered shapes.
    static func compute(_ scene:StyleGenome,systems:[SceneElement],obstacles:[SceneElement])throws->[TypeAnchor] {
        let aspect=scene.aspect
        guard !systems.isEmpty else{return []}
        // Overprinted layers vanish in a white-on-black multiply mask, so measure them opaque.
        func opaque(_ items:[SceneElement])->[SceneElement]{items.map{var e=$0;e.blendMode=nil;if e.kind=="image"{e.kind="shape";e.shape="rectangle";e.rasterAsset=nil};return e}}
        let shapeMask=try DominantShapeMeasurements.mask(scene,only:opaque(systems),width:200)
        let blocked=obstacles.map{ShapeTypePlacement.footprint($0,aspect:aspect)}
        var anchors:[TypeAnchor]=[],seen:Set<String>=[]
        for (index,e) in systems.enumerated() {
            guard let id=PosterShapeLibrary.recipeID(e) else{continue}
            let rect=CGRect(x:e.bounds.x,y:e.bounds.y,width:e.bounds.width*scene.textScale,height:e.bounds.height*scene.textScale)
            let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect)
            for local in recipe(id,r:r,values:e.geometry ?? [:]) {
                // Element rotation pivots on the element rect center in physical space, like the renderer.
                let pivot=CGPoint(x:rect.midX,y:rect.midY*aspect),a=e.rotation * .pi/180,dx=local.center.x-pivot.x,dy=local.center.y-pivot.y
                let name=(systems.count>1 ? "\(index)/":"")+id+":"+local.name
                guard seen.insert(name).inserted else{continue}
                let raw=TypeAnchor(id:name,role:local.role,source:id,x:pivot.x+dx*cos(a)-dy*sin(a),y:(pivot.y+dx*sin(a)+dy*cos(a))/aspect,length:local.length,thickness:local.thickness,rotation:local.rotation+e.rotation,alignment:local.alignment,vertical:local.vertical,onShape:local.onShape,group:local.group)
                guard var anchor=fitted(raw,aspect:aspect,clip:e.allowsBleed==true ? nil:e.clipBounds) else{continue}
                let footprint=anchor.footprint(aspect:aspect)
                if blocked.contains(where:{intersection($0,footprint)>0.2}){continue}
                // An anchor meant to be free that the rendered system mostly covers (outline type, prongs, drips) is not free.
                let covered=shapeMask.occupancy(footprint)
                if !anchor.onShape && covered>0.3{continue}
                if !anchor.onShape && covered>0.15{anchor.onShape=true}
                anchors.append(anchor)
            }
        }
        return anchors+(try quietZones(scene,obstacles:opaque(systems+obstacles+scene.elements.filter{$0.kind=="image"}),taken:anchors))
    }
    /// Intersection as a share of the smaller box.
    static func intersection(_ a:UnitBox,_ b:UnitBox)->Double{let i=a.rect.intersection(b.rect);return i.isNull ? 0:i.width*i.height/max(0.000001,min(a.area,b.area))}
    /// Keep anchors inside the printable area. Bleeding systems are mostly off the paper, so any stretch that still
    /// holds a usable line counts: axis-aligned anchors are cropped, rotated ones keep their longest fitting run.
    static func fitted(_ a:TypeAnchor,aspect:Double,clip:UnitBox?)->TypeAnchor? {
        var safe=CGRect(x:0.025,y:0.02,width:0.95,height:0.96)
        if let clip{safe=safe.intersection(clip.rect)}
        let f=a.footprint(aspect:aspect).rect
        guard !safe.isNull,f.width>0,f.height>0 else{return nil}
        if safe.insetBy(dx:-0.000001,dy:-0.000001).contains(f){return a}
        let usable=min(a.length*0.6,0.18),turns=a.rotation/90
        if abs(turns-turns.rounded())<0.01 {
            let i=f.intersection(safe)
            guard !i.isNull else{return nil}
            let vertical=Int(turns.rounded())%2 != 0,along=vertical ? i.height*aspect:i.width,across=vertical ? i.width:i.height*aspect
            guard along>=usable,across>=a.thickness*0.6 else{return nil}
            var b=a;b.x=i.midX;b.y=i.midY;b.length=along;b.thickness=across;return b
        }
        let paper=CGRect(x:safe.minX,y:safe.minY*aspect,width:safe.width,height:safe.height*aspect).insetBy(dx:-0.000001,dy:-0.000001),steps=160
        var run=(start:0,count:0),current = -1
        for i in 0...steps {
            let s = -a.length/2+a.length*Double(i)/Double(steps)
            if paper.contains(a.point(s,-a.thickness/2,aspect:aspect)) && paper.contains(a.point(s,a.thickness/2,aspect:aspect)) {
                if current<0{current=i}
                if i-current>run.count{run=(current,i-current)}
            }else{current = -1}
        }
        let s0 = -a.length/2+a.length*Double(run.start)/Double(steps),along=a.length*Double(run.count)/Double(steps)
        guard along>=usable else{return nil}
        let c=a.point(s0+along/2,0,aspect:aspect)
        var b=a;b.x=c.x;b.y=c.y/aspect;b.length=along;return b
    }
    /// Up to four of the largest empty rectangles left by shapes, images and free type.
    static func quietZones(_ scene:StyleGenome,obstacles:[SceneElement],taken:[TypeAnchor])throws->[TypeAnchor] {
        let aspect=scene.aspect,mask=try DominantShapeMeasurements.mask(scene,only:obstacles,width:200)
        let columns=24,rows=max(8,Int((Double(columns)*aspect).rounded())),cw=1/Double(columns),ch=1/Double(rows)
        let used=taken.map{$0.footprint(aspect:aspect)}
        var free=(0..<rows).map{row in (0..<columns).map{col->Bool in
            let cell=UnitBox(x:Double(col)*cw,y:Double(row)*ch,width:cw,height:ch)
            return cell.x>=0.02 && cell.x+cw<=0.98 && cell.y>=0.015 && cell.y+ch<=0.985 && mask.occupancy(cell)<0.03 && !used.contains{intersection($0,cell)>0.5}
        }}
        var zones:[TypeAnchor]=[]
        for index in 0..<4 {
            guard let (r0,c0,r1,c1)=largestRectangle(free) else{break}
            let inset=0.35,box=UnitBox(x:(Double(c0)+inset)*cw,y:(Double(r0)+inset)*ch,width:(Double(c1-c0)-inset*2)*cw,height:(Double(r1-r0)-inset*2)*ch)
            let w=box.width,h=box.height*aspect
            guard min(w,h)>=0.045,w*h>=0.012 else{break}
            for row in max(0,r0-1)..<min(rows,r1+1){for col in max(0,c0-1)..<min(columns,c1+1){free[row][col]=false}}
            let tall=h>w*2.2 && w<0.16,thickness=tall ? w:h
            // Measured empty space has no meaning of its own, so any block may use it; size decides the score.
            zones.append(TypeAnchor(id:"quiet-zone:\(index)",role:"any",source:"quiet-zone",x:box.x+box.width/2,y:box.y+box.height/2,length:tall ? h:w,thickness:thickness,rotation:tall ? -90:0,alignment:"left",vertical:tall ? "center":"top",onShape:false))
        }
        return zones
    }
    /// Maximal rectangle of true cells as (row0, col0, row1, col1), end-exclusive.
    static func largestRectangle(_ grid:[[Bool]])->(Int,Int,Int,Int)? {
        guard let width=grid.first?.count else{return nil}
        var heights=[Int](repeating:0,count:width),best=0,result:(Int,Int,Int,Int)?
        for row in grid.indices {
            for col in 0..<width{heights[col]=grid[row][col] ? heights[col]+1:0}
            for col in 0..<width where heights[col]>0 {
                var h=heights[col]
                for end in col..<width {
                    h=min(h,heights[end]);if h==0{break}
                    let area=h*(end-col+1)
                    if area>best{best=area;result=(row-h+1,col,row+1,end+1)}
                }
            }
        }
        return result
    }
}
