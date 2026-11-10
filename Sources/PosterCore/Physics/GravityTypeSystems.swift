import Foundation
import CoreGraphics
import CoreText

/// Fallen letters: type set in place, then some glyphs released into a rigid-body world. Each glyph collides
/// with its real outline (counters and crooks included), the letters that stayed, other text and the floor.
/// The simulation runs when the scene is made; the scene stores every pose, so replay, PNG and vector PDF
/// export never re-simulate.
public enum GravityTypeSystems {
    public static let recipeID="fallen-letters"
    public static let shape="gravity-type"
    public static let defaultTitle="LET IT\nFALL"
    /// Physics units per world unit: a poster one unit wide is simulated ten metres wide, where the solver's
    /// tolerances suit letter-sized bodies and gravity is 10 m/s².
    static let meters=10.0
    /// Inset of the floor rule from the bottom edge, and of the headline from the sides, in world units.
    static let ruleInset=0.075,margin=0.055
    /// Headline top in the specimen, below the two lines of supporting copy.
    static let specimenTop=0.15

    static func value(_ p:[String:Double]?,_ key:String,_ fallback:Double)->Double{let v=p?[key] ?? fallback;return v.isFinite ? v:fallback}

    struct Source {var character:String;var glyph:CGGlyph;var outline:CGPath;var fontName:String;var variations:[String:Double]?;var rest:CGAffineTransform;var element:SceneElement}

    /// CoreText can return a curved variable-font outline whose last bits differ between the first request in a
    /// process and later ones. A borderline raster cell then changes a collision piece and the whole fall. Layout and
    /// collision use outlines snapped to 1/8192 font unit, far below anything visible, so equal inputs repeat exactly.
    static func snap(_ v:Double)->Double{(v*8192).rounded()/8192}
    static func snapped(_ path:CGPath)->CGPath {
        let out=CGMutablePath()
        func s(_ p:CGPoint)->CGPoint{CGPoint(x:snap(p.x),y:snap(p.y))}
        path.applyWithBlock{element in
            let p=element.pointee.points
            switch element.pointee.type {
            case .moveToPoint:out.move(to:s(p[0]))
            case .addLineToPoint:out.addLine(to:s(p[0]))
            case .addQuadCurveToPoint:out.addQuadCurve(to:s(p[1]),control:s(p[0]))
            case .addCurveToPoint:out.addCurve(to:s(p[2]),control1:s(p[0]),control2:s(p[1]))
            case .closeSubpath:out.closeSubpath()
            @unknown default:break
            }
        }
        return out
    }

    /// Glyphs of a text element with the exact transform LibrarySceneRenderer draws them with (first copy, no preview jitter).
    static func glyphs(of e:SceneElement,in genome:StyleGenome)->[Source] {
        guard let text=e.text,!text.isEmpty else{return []}
        let fontName=e.fontName ?? genome.font,font=FontLibrary.font(name:fontName,variations:e.fontVariations)
        let string=text as NSString,all=CGMutablePath()
        var items:[(String,CGGlyph,CGPath,String,CGAffineTransform)]=[]
        // The renderer's own placements, so kerned lines fall from where they were drawn.
        for p in LibrarySceneRenderer.placements(e,string:text,genome:genome) {
            let runName=CTFontCopyPostScriptName(p.font) as String
            guard let outline=CTFontCreatePathForGlyph(p.font,p.glyph,nil).map(snapped) else{continue}
            var placement=CGAffineTransform(translationX:snap(p.position.x),y:snap(p.position.y))
            if let t=e.typeTransform{placement=placement.concatenating(CGAffineTransform(a:t["scaleX"] ?? 1,b:0,c:t["shear"] ?? 0,d:t["scaleY"] ?? 1,tx:0,ty:0))}
            all.addPath(outline,transform:placement)
            guard !outline.boundingBoxOfPath.isEmpty else{continue}
            items.append((string.substring(with:string.rangeOfComposedCharacterSequence(at:p.stringIndex)),p.glyph,outline,runName==CTFontCopyPostScriptName(font) as String ? fontName:runName,placement))
        }
        let b=all.boundingBoxOfPath;guard b.width>0,b.height>0 else{return []}
        // The renderer fits the string's ink box into the element, then rotates about the box centre in physical units.
        let a=genome.aspect,rect=CGRect(x:e.bounds.x,y:e.bounds.y,width:e.bounds.width*genome.textScale,height:e.bounds.height*genome.textScale)
        var sx:Double,sy:Double,tx:Double,ty:Double
        if e.preserveTypeProportions==true {
            sx=e.typeEmSize.map{$0*a/100} ?? min(rect.width/b.width,rect.height*a/b.height);sy=sx/a
            let w=b.width*sx,align=e.textAlignment=="center" ? (rect.width-w)/2:e.textAlignment=="right" ? rect.width-w:0
            tx = -rect.width/2+align;ty = -rect.height/2+b.height*sy
        }else{sx=rect.width/b.width;sy=rect.height/b.height;tx = -rect.width/2;ty=rect.height/2}
        let angle=e.rotation * .pi/180,c=cos(angle),s=sin(angle),ox = -sx*b.minX+tx,oy=a*(sy*b.minY+ty)
        let place=CGAffineTransform(a:c*sx,b:s*sx,c:s*a*sy,d:-c*a*sy,tx:rect.midX+c*ox-s*oy,ty:a*rect.midY+s*ox+c*oy)
        return items.map{Source(character:$0.0,glyph:$0.1,outline:$0.2,fontName:$0.3,variations:e.fontVariations,rest:$0.4.concatenating(place),element:e)}
    }

    // MARK: Simulation

    /// Arrangements; the source collapse is the first.
    public static let arrangements=["collapse","pour","sign","stairs","garland","balance"]

    /// Releases a seeded share of the targets' glyphs into a world one unit wide and `genome.aspect` tall.
    /// Obstacle text and `solids` (world polygons) stay fixed. Each glyph keeps its own random stream, so raising
    /// `detach` adds falling letters without changing how the others fall.
    static func simulate(targets:[SceneElement],obstacles:[SceneElement],solids:[[PhysicsVector]]=[],in genome:StyleGenome,parameters p:[String:Double],seed:UInt64,origin:String)->PhysicsTypeGenome {
        let a=genome.aspect,m=meters
        let arrangement=max(0,min(arrangements.count-1,Int(value(p,"arrangement",0).rounded())))
        var sources=Array(targets.flatMap{glyphs(of:$0,in:genome)}.prefix(400));let n=sources.count
        var streams=(0..<n).map{SeededRandom(seed:seed ^ 0x4752415649545901 &+ UInt64($0) &* 0x9e3779b97f4a7c15)}
        // Collapse: lower glyphs fall first and earlier, clearing the way for the ones above (0 = purely random).
        let heights=sources.map{$0.rest.ty},low=heights.min() ?? 0,high=heights.max() ?? 0
        let collapse=high-low>1e-6 ? max(0,min(1,value(p,"collapse",0.65))):0
        let raised=heights.map{high>low ? (high-$0)/(high-low):0}
        let fallKey=streams.indices.map{(1-collapse)*streams[$0].unit()+collapse*raised[$0]},hangKey=streams.indices.map{streams[$0].unit()}
        let order=(0..<n).sorted{fallKey[$0]==fallKey[$1] ? $0<$1:fallKey[$0]<fallKey[$1]}
        let detached=Array(order.prefix(Int((max(0,min(1,value(p,"detach",0.42)))*Double(n)).rounded())))
        let hanging=Set(detached.sorted{hangKey[$0]==hangKey[$1] ? $0<$1:hangKey[$0]<hangKey[$1]}.prefix(Int((max(0,min(1,value(p,"hang",0.18)))*Double(detached.count)).rounded())))
        var state=[String](repeating:"fixed",count:n)
        for i in detached{state[i]=hanging.contains(i) ? "hanging":"fallen"}
        if arrangement==1{state=[String](repeating:"fallen",count:n)}
        // A garland is one chain of hanging letters; released letters break out of it.
        if arrangement==4{state=(0..<n).map{detached.contains($0) ? "fallen":"hanging"}}
        func box(_ i:Int)->CGRect{sources[i].outline.boundingBoxOfPath.applying(sources[i].rest)}
        let block=(0..<n).map(box).reduce(CGRect.null){$0.union($1)},blockBottom=block.isNull ? 0.3:block.maxY
        if arrangement==1 {
            // Pour: the set title starts above the field, each letter shifted sideways and up by the spread. A letter
            // whose start would overlap one already placed rises above it, so the heap never starts interpenetrated.
            let scatter=max(0,min(1,value(p,"scatter",0.4)))
            var placed:[CGRect]=[]
            for i in 0..<n {
                let b=box(i),dx=max(-b.minX+0.01,min(0.99-b.maxX,scatter*streams[i].value(-0.3,0.3)))
                var dy = -(blockBottom+0.05)-scatter*streams[i].value(0,0.6),start=b.offsetBy(dx:dx,dy:dy)
                while let hit=placed.first(where:{$0.intersects(start)}){dy-=start.maxY-hit.minY+0.01;start=b.offsetBy(dx:dx,dy:dy)}
                placed.append(start)
                sources[i].rest=sources[i].rest.concatenating(CGAffineTransform(translationX:dx,y:dy))
            }
        }

        var world=PhysicsWorld()
        let tilt=max(-80,min(80,value(p,"gravityAngle",0))) * .pi/180
        world.gravity=PhysicsVector(10*sin(tilt),10*cos(tilt))
        let friction=max(0,value(p,"friction",0.55)),bounce=max(0,min(1,value(p,"bounce",0.12)))
        let mode=Int(value(p,"floor",1).rounded()),floor:Double?=mode==2 ? nil:mode==1 ? a-ruleInset:a
        if let floor{world.addBody([PhysicsWorld.box(center:PhysicsVector(0.5*m,(floor+1)*m),halfWidth:2*m,halfHeight:m)],kind:.fixed,friction:friction,restitution:bounce)}else{world.escapeY=(a+0.6)*m}
        for x in [-0.5,1.5]{world.addBody([PhysicsWorld.box(center:PhysicsVector(x*m,a*0.5*m),halfWidth:0.5*m,halfHeight:(a+2)*m)],kind:.fixed,friction:friction,restitution:bounce)}
        for e in obstacles {for g in glyphs(of:e,in:genome) {
            let box=g.outline.boundingBoxOfPath
            let corners=[CGPoint(x:box.minX,y:box.minY),CGPoint(x:box.maxX,y:box.minY),CGPoint(x:box.maxX,y:box.maxY),CGPoint(x:box.minX,y:box.maxY)].map{$0.applying(g.rest)}
            world.addBody([corners.map{PhysicsVector($0.x*m,$0.y*m)}],kind:.fixed,friction:friction,restitution:bounce)
        }}
        for solid in solids{world.addBody([solid.map{m*$0}],kind:.fixed,friction:friction,restitution:bounce)}
        // Scenery: fixed fixtures keep their polygon; a moving one remembers its body.
        var fixtures:[(String,Int?,[PhysicsVector])]=[]
        let ground=floor ?? a
        if arrangement==3 {
            // Stairs: shelves step down to the right under the headline, each tipped so letters slide to the next.
            let steps=max(1,min(12,Int(value(p,"steps",4).rounded()))),top=min(ground-0.1,blockBottom+0.07),width=(1-2*margin)/Double(steps)
            for k in 0..<steps {
                let x=margin+Double(k)*width,y=top+(ground-0.05-top)*Double(k)/Double(steps),drop=width*0.09
                let shelf=[PhysicsVector(x,y),PhysicsVector(x+width*1.02,y+drop),PhysicsVector(x+width*1.02,y+drop+0.012),PhysicsVector(x,y+0.012)]
                world.addBody([shelf.map{m*$0}],kind:.fixed,friction:friction,restitution:bounce);fixtures.append(("shelf",nil,shelf))
            }
        }
        var nails:[PhysicsVector]=[]
        if arrangement==5 {
            // Balance: a beam on a pivot catches the falling letters and tips under their weight.
            let x=max(0.2,min(0.8,value(p,"pivot",0.42))),y=ground-0.16,half=0.31
            let beam=world.addBody([PhysicsWorld.box(center:PhysicsVector(x*m,y*m),halfWidth:half*m,halfHeight:0.008*m)],kind:.dynamic,density:3,friction:friction,restitution:bounce)
            world.bodies[beam].angularDamping=0.6
            world.pins.append(PhysicsPin(bodyA:nil,bodyB:beam,anchorA:PhysicsVector(x*m,y*m),anchorB:.zero,frictionTorque:2))
            let pivot=[PhysicsVector(x,y+0.012),PhysicsVector(x+0.045,ground),PhysicsVector(x-0.045,ground)]
            world.addBody([pivot.map{m*$0}],kind:.fixed,friction:friction,restitution:bounce)
            fixtures+=[("pivot",nil,pivot),("beam",beam,world.bodies[beam].polygons[0].map{(1/m)*$0})]
            nails.append(PhysicsVector(x,y))
        }
        var body=[Int](repeating:-1,count:n),pins=[PhysicsVector?](repeating:nil,count:n),bodyPaths=[CGPath?](repeating:nil,count:n)
        let kick=max(0,value(p,"kick",0.35)),stagger=max(0,value(p,"stagger",0.9))
        // Glass letters: a free-falling letter that strikes anything faster than its toughness breaks into shards.
        let glass=value(p,"shatter",0)>0.5,shardCount=max(2,min(12,Int(value(p,"shards",6).rounded()))),toughness=max(0.5,value(p,"toughness",6)),burst=max(0,min(1,value(p,"burst",0.5)))
        var owner:[Int:Int]=[:]
        // A nail near one upper corner, between that corner of a top piece and the piece's centre, so it is always in
        // material and far enough from the centre of mass for the letter to swing.
        func nail(_ pieces:[[PhysicsVector]],_ box:CGRect,left:Bool)->PhysicsVector {
            let side:Double=left ? 1:-1,top=pieces.filter{$0.map(\.y).min()! <= box.minY+box.height*0.3}
            let piece=(top.isEmpty ? pieces:top).min{a,b in a.map{side*$0.x}.min()! < b.map{side*$0.x}.min()!}!
            let corner=piece.min{side*$0.x+0.5*$0.y < side*$1.x+0.5*$1.y}!,centre=(1/Double(piece.count))*piece.reduce(PhysicsVector.zero,+)
            return corner+0.35*(centre-corner)
        }
        for i in 0..<n {
            var t=sources[i].rest.concatenating(CGAffineTransform(scaleX:m,y:m))
            guard let path=sources[i].outline.copy(using:&t) else{continue}
            let pieces=PhysicsOutline.pieces(path);bodyPaths[i]=path
            // A degenerate outline with no collision pieces cannot fall; it stays in place.
            if pieces.isEmpty{state[i]="fixed"}
            let moving=state[i] != "fixed"
            let b=world.addBody(pieces,kind:moving ? .dynamic:.fixed,friction:friction,restitution:bounce);body[i]=b
            if arrangement==2,!pieces.isEmpty {
                // Sign: every letter was nailed at both upper corners; the nails stay in the wall when it comes loose.
                let pair=[nail(pieces,path.boundingBoxOfPath,left:true),nail(pieces,path.boundingBoxOfPath,left:false)]
                nails+=pair.map{(1/m)*$0}
                if state[i]=="hanging"{pins[i]=pair[streams[i].unit()<0.5 ? 0:1]}
            }
            guard moving else{continue}
            var rng=streams[i]
            world.bodies[b].rollingResistance=4
            world.bodies[b].releaseTime=arrangement==4 && state[i]=="hanging" ? 0:stagger*((1-collapse)*rng.unit()+collapse*raised[i])
            world.bodies[b].angularVelocity=kick*rng.value(-4,4)
            world.bodies[b].velocity=PhysicsVector(kick*rng.value(-2,2),-kick*rng.value(0,1.5))
            // Each letter's toughness varies a little, so equal falls do not all break alike.
            if glass && state[i]=="fallen"{world.bodies[b].breakSpeed=toughness*(0.75+0.5*rng.unit());owner[b]=i}
            if state[i]=="hanging" && arrangement != 4 {
                let box=path.boundingBoxOfPath,point=pins[i] ?? nail(pieces,box,left:rng.unit()<0.5)
                let position=world.bodies[b].position,mass=world.bodies[b].mass
                world.pins.append(PhysicsPin(bodyA:nil,bodyB:b,anchorA:point,anchorB:point-position,frictionTorque:mass*10*box.height*0.04))
                world.bodies[b].angularDamping=0.8;world.bodies[b].velocity = .zero;world.bodies[b].angularVelocity=kick*rng.value(-1,1)
                pins[i]=point;if arrangement != 2{nails.append((1/m)*point)}
            }
            streams[i]=rng
        }
        var rivets=[[PhysicsVector]](repeating:[],count:n)
        if arrangement==4 {
            // Garland: neighbours are linked by rings at their upper corners; the ends hang from nails pulled in by
            // the slack, so the chain sags. A released letter breaks the chain and the pieces dangle or fall.
            world.velocityIterations=20
            let chain=(0..<n).filter{body[$0]>=0 && bodyPaths[$0] != nil}
            func anchor(_ i:Int,right:Bool)->PhysicsVector{let b=bodyPaths[i]!.boundingBoxOfPath;return PhysicsVector(right ? b.maxX-b.width*0.08:b.minX+b.width*0.08,b.minY+b.height*0.12)}
            for i in chain where state[i]=="hanging"{world.bodies[body[i]].linearDamping=0.6;world.bodies[body[i]].angularDamping=1.5;world.bodies[body[i]].velocity=0.3*world.bodies[body[i]].velocity;world.bodies[body[i]].angularVelocity*=0.3}
            for (x,y) in zip(chain,chain.dropFirst()) where state[x]=="hanging" && state[y]=="hanging" {
                let ring=0.5*(anchor(x,right:true)+anchor(y,right:false))
                world.pins.append(PhysicsPin(bodyA:body[x],bodyB:body[y],anchorA:ring-world.bodies[body[x]].position,anchorB:ring-world.bodies[body[y]].position,frictionTorque:0.3))
                rivets[x].append((1/m)*ring)
            }
            if let first=chain.first,let last=chain.last {
                let start=anchor(first,right:false),end=anchor(last,right:true),pull=max(0,min(0.8,value(p,"slack",0.28)))*(end.x-start.x)/2
                for (i,point,hook) in [(first,start,PhysicsVector(start.x+pull,start.y)),(last,end,PhysicsVector(end.x-pull,end.y))] {
                    nails.append((1/m)*hook)
                    if state[i]=="hanging"{world.pins.append(PhysicsPin(bodyA:nil,bodyB:body[i],anchorA:hook,anchorB:point-world.bodies[body[i]].position,frictionTorque:0.3))}
                }
            }
        }
        let rest=body.map{$0<0 ? PhysicsVector.zero:world.bodies[$0].position}
        let exposures=max(0,min(12,Int(value(p,"strobe",0).rounded())))
        var paths=[[(PhysicsVector,Double)]](repeating:[],count:n)
        if exposures>0{for i in 0..<n where state[i] != "fixed" && body[i]>=0 {paths[i]=[(rest[i],0)]}}
        let limit=max(0,min(12,value(p,"time",8)))
        var broken=[(angle:Double,parts:[(body:Int,cells:[[PhysicsVector]],centre:PhysicsVector)])?](repeating:nil,count:n)
        func shatter(_ impact:PhysicsImpact) {
            guard let i=owner[impact.body],broken[i]==nil,!world.bodies[impact.body].retired else{return}
            let parent=world.bodies[impact.body],c=cos(parent.angle),s=sin(parent.angle)
            var rng=streams[i]
            let fragments=PhysicsFracture.fragments(pieces:parent.polygons,impact:(impact.point-parent.position).unrotated(c,s),count:shardCount,rng:&rng)
            guard fragments.count>=2 else{world.bodies[impact.body].breakSpeed=nil;return}
            var parts:[(body:Int,cells:[[PhysicsVector]],centre:PhysicsVector)]=[]
            for f in fragments {
                // Each shard keeps the letter's motion just before the hit and is thrown away from the impact.
                let id=world.addBody(f.pieces.map{$0.map{parent.position+$0.rotated(c,s)}},kind:.dynamic,friction:friction,restitution:bounce)
                let arm=world.bodies[id].position-parent.position,away=(world.bodies[id].position-impact.point).normalized
                world.bodies[id].velocity=impact.velocity+physicsCross(impact.angularVelocity,arm)+(burst*0.3*impact.speed)*away
                world.bodies[id].angularVelocity=impact.angularVelocity+burst*rng.value(-3,3)
                world.bodies[id].rollingResistance=4;world.bodies[id].separatesOnRelease=true;world.bodies[id].releaseTime=world.time
                parts.append((id,f.cells,arm.unrotated(c,s)))
            }
            world.retire(impact.body);broken[i]=(parent.angle,parts);streams[i]=rng
        }
        while world.time+1e-9<limit && !world.isSettled {
            world.step(1.0/120)
            for impact in world.impacts{shatter(impact)}
            for i in 0..<n where !paths[i].isEmpty {let b=world.bodies[body[i]];if b.released && b.awake{paths[i].append((b.position,b.angle))}}
        }
        var records:[PhysicsGlyph]=[]
        for i in 0..<n where body[i]>=0 {
            let b=world.bodies[body[i]],r=sources[i].rest
            var g=PhysicsGlyph(id:"g\(i)",character:sources[i].character,glyph:Int(sources[i].glyph),font:sources[i].fontName,fontVariations:sources[i].variations,rest:[r.a,r.b,r.c,r.d,r.tx,r.ty],center:[rest[i].x/m,rest[i].y/m],pose:[b.position.x/m,b.position.y/m,b.angle],state:state[i],source:sources[i].element.sourceElementID)
            if origin=="scene"{g.color=sources[i].element.color}
            if let pin=pins[i]{g.pin=[pin.x/m,pin.y/m]}
            if !rivets[i].isEmpty{g.rivets=rivets[i].map{[$0.x,$0.y]}}
            if let (angle,parts)=broken[i] {
                // Body-local points are offsets from the rest centre, because every glyph body starts unrotated.
                g.shards=parts.map{part in
                    let f=world.bodies[part.body],centre=rest[i]+part.centre
                    return PhysicsShard(cells:part.cells.map{$0.map{[(rest[i].x+$0.x)/m,(rest[i].y+$0.y)/m]}},center:[centre.x/m,centre.y/m],pose:[f.position.x/m,f.position.y/m,f.angle+angle])
                }
            }
            if exposures>0,paths[i].count>2 {
                let radius=b.mass>0 ? sqrt(b.inertia/b.mass):1
                g.trail=strobe(paths[i]+[(b.position,b.angle)],count:exposures,radius:radius).map{[$0.0.x/m,$0.0.y/m,$0.1]}
            }
            records.append(g)
        }
        var genome=PhysicsTypeGenome(aspect:a,text:targets.compactMap(\.text).joined(separator:"\n"),glyphs:records,floor:floor,rule:mode==1,time:world.time,steps:world.steps,settled:world.isSettled,origin:origin)
        if !fixtures.isEmpty{genome.fixtures=fixtures.map{f in PhysicsFixture(role:f.0,points:(f.1.map{id in world.bodies[id].polygons[0].map{(1/m)*world.bodies[id].world($0)}} ?? f.2).map{[$0.x,$0.y]})}}
        if !nails.isEmpty{genome.nails=nails.map{[$0.x,$0.y]}}
        return genome
    }
    /// Poses evenly spaced along a path's length, where turning counts as travel at the radius of gyration.
    static func strobe(_ path:[(PhysicsVector,Double)],count:Int,radius:Double)->[(PhysicsVector,Double)] {
        var lengths=[0.0]
        for k in 1..<path.count{lengths.append(lengths[k-1]+(path[k].0-path[k-1].0).length+abs(path[k].1-path[k-1].1)*radius)}
        guard let total=lengths.last,total>1e-6 else{return []}
        var out:[(PhysicsVector,Double)]=[],k=1
        for j in 1...count {
            let target=total*Double(j)/Double(count+1)
            while k<lengths.count-1 && lengths[k]<target{k+=1}
            let span=max(1e-12,lengths[k]-lengths[k-1]),t=(target-lengths[k-1])/span
            out.append((path[k-1].0+t*(path[k].0-path[k-1].0),path[k-1].1+t*(path[k].1-path[k-1].1)))
        }
        return out
    }

    // MARK: Headline layout

    /// Title lines: typed breaks are kept; one long line is balanced over up to three lines.
    static func lines(_ title:String)->[String] {
        let typed=title.replacingOccurrences(of:"\r\n",with:"\n").components(separatedBy:"\n").map{$0.trimmingCharacters(in:.whitespaces)}.filter{!$0.isEmpty}
        guard typed.count==1,typed[0].count>10 else{return typed}
        let words=typed[0].split(separator:" ").map(String.init)
        guard words.count>1 else{return typed}
        let count=min(3,words.count,Int((Double(typed[0].count)/9).rounded(.up))),target=Double(typed[0].count)/Double(count)
        var out:[String]=[],current=""
        for w in words {
            if !current.isEmpty && out.count<count-1 && Double(current.count+w.count/2)>=target{out.append(current);current=w}else{current=current.isEmpty ? w:current+" "+w}
        }
        return out+[current]
    }
    /// Lines set flush left across the top of a world `aspect` tall. Each line fills the measure; the block
    /// shrinks as a whole when it would take more than about half the height.
    static func headline(_ title:String,font:String,variations:[String:Double]?,color:String,aspect a:Double,size:Double,top:Double,singleLine:Bool=false)->[SceneElement] {
        let ct=FontLibrary.font(name:font,variations:variations),measure=(1-2*margin)*max(0.3,min(1,size))
        let boxes=(singleLine ? [lines(title).joined(separator:" ")]:lines(title)).map{text->(String,CGRect) in
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):ct]))
            let path=CGMutablePath()
            for run in CTLineGetGlyphRuns(line) as! [CTRun] {
                let count=CTRunGetGlyphCount(run);var glyphs=[CGGlyph](repeating:0,count:count),positions=[CGPoint](repeating:.zero,count:count)
                CTRunGetGlyphs(run,CFRange(location:0,length:count),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:count),&positions)
                let runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
                for i in 0..<count{if let g=CTFontCreatePathForGlyph(runFont,glyphs[i],nil).map(snapped){path.addPath(g,transform:CGAffineTransform(translationX:snap(positions[i].x),y:snap(positions[i].y)))}}
            }
            return (text,path.boundingBoxOfPath)
        }.filter{$0.1.width>0 && $0.1.height>0}
        var scales=boxes.map{min(measure/$0.1.width,0.32*a/$0.1.height)}
        let gap=0.07,total=zip(boxes,scales).reduce(0.0){$0+$1.0.1.height*$1.1}*(1+gap)
        if total>0.5*a{scales=scales.map{$0*0.5*a/total}}
        var y=top,out:[SceneElement]=[]
        for (i,(text,box)) in boxes.enumerated() {
            let k=scales[i],h=box.height*k
            var e=SceneElement(sourceElementID:"gravity-headline:\(i)",kind:"text",bounds:UnitBox(x:margin,y:y/a,width:box.width*k,height:h/a),rotation:0,text:text,color:color,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:font,textAlignment:"left")
            e.typeEmSize=k*100/a;e.fontVariations=variations
            out.append(e);y+=h*(1+gap)
        }
        return out
    }
    /// Falling letters are kerned optically but kept at least 0.04 em apart. With optical's usual 0.012 em, neighbours
    /// start nearly in contact and a collapsing headline does not come to rest within the 8 s a poster can show.
    static let kerning=TextKerning(mode:.optical,minimumGap:40)
    static func space(aspect:Double,font:String)->StyleGenome {
        var g=StyleGenome(posterID:"gravity-world",aspect:aspect,background:"#ffffff",font:font,textScale:1,tracking:0,elements:[],score:nil,fittingStatus:"",sourceEmbeddingModel:"")
        g.kerning=kerning;return g
    }

    /// Lays out the title in a field world and simulates it; obstacles share the world's coordinates.
    public static func make(title:String,font:String,variations:[String:Double]?,aspect:Double,parameters:[String:Double],seed:UInt64,obstacles:[SceneElement]=[],titleOverride:String?=nil,top:Double?=nil)->PhysicsTypeGenome {
        let world=space(aspect:aspect,font:font)
        // A garland is one chain, so its title is set on one line.
        let garland=Int(value(parameters,"arrangement",0).rounded())==arrangements.firstIndex(of:"garland")
        let top=top ?? margin,lines=headline(title,font:font,variations:variations,color:"#000000",aspect:aspect,size:value(parameters,"size",1),top:top,singleLine:garland)
        var genome=simulate(targets:lines,obstacles:obstacles,in:world,parameters:parameters,seed:seed,origin:"recipe")
        genome.text=title;genome.titleOverride=titleOverride;genome.font=font;genome.fontVariations=variations;genome.top=top
        genome.obstacleIDs=obstacles.isEmpty ? nil:obstacles.map(\.sourceElementID)
        return genome
    }
    static func fieldAspect(_ e:SceneElement,posterAspect:Double)->Double{max(0.05,min(20,e.bounds.height*posterAspect/max(0.0001,e.bounds.width)))}
    /// Provisional simulation for PosterShapeLibrary.element, which knows neither the poster's aspect, title nor font;
    /// `resolve` replaces it once the element is in a scene.
    static func prepare(_ e:inout SceneElement,title:String?,parameters:[String:Double],seed:UInt64) {
        let text=title ?? defaultTitle
        e.kind="text";e.text=text
        e.physics=make(title:text,font:"HelveticaNeue-Bold",variations:nil,aspect:fieldAspect(e,posterAspect:2.squareRoot()),parameters:parameters,seed:UInt64(max(0,value(parameters,"shapeSeed",Double(seed%9_000_000)))),titleOverride:title)
    }
    /// The library's stored shape seed, so a later re-simulation repeats the same fall.
    static func seed(_ e:SceneElement)->UInt64{UInt64(max(0,value(e.geometry,"shapeSeed",817)))}

    /// Recipe genomes follow the scene's title, font and field; scene-origin genomes are explicit and stay as made.
    public static func resolve(in scene:inout StyleGenome) {
        for i in scene.elements.indices where scene.elements[i].shape==shape {
            let e=scene.elements[i]
            if e.physics?.origin=="scene"{continue}
            let title=e.physics?.titleOverride ?? scene.posterCopy?.title ?? e.text ?? defaultTitle
            let font=e.fontName ?? scene.font,aspect=fieldAspect(e,posterAspect:scene.aspect)
            if let g=e.physics,g.text==title,g.font==font,g.fontVariations==e.fontVariations,abs(g.aspect-aspect)<=0.01*aspect{continue}
            let obstacles=scene.elements.filter{o in e.physics?.obstacleIDs?.contains(o.sourceElementID) ?? false}
            scene.elements[i].physics=make(title:title,font:font,variations:e.fontVariations,aspect:aspect,parameters:e.geometry ?? [:],seed:seed(e),obstacles:obstacles,titleOverride:e.physics?.titleOverride,top:e.physics?.top)
            scene.elements[i].text=title
        }
    }

    // MARK: Specimen

    public static func scene(_ preset:PosterShapePreset)throws->StyleGenome {
        try preset.physics?.validate();try ShapeMaterials.validate(preset.inks)
        let values=try preset.recipe.values(preset.parameters)
        let profile=preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)} ?? PosterShapeLibrary.suggestedFonts(preset.recipe,limit:1).first?.0
        let font=profile?.postscriptName ?? "HelveticaNeue-Bold",inks=preset.inks ?? preset.recipe.inks ?? ["#141414","#ff4a1c"]
        let a=1/preset.recipe.idealAspect,title=preset.physics?.title ?? defaultTitle,paper=inks.count>2 ? inks[2]:"#eeebe4"
        var scene=StyleGenome(version:"gravity-type-scene-v1",posterID:preset.recipe.id,aspect:a,background:paper,font:font,textScale:1,tracking:0,elements:[],score:nil,fittingStatus:preset.recipe.basis,sourceEmbeddingModel:"gravity-type-v1")
        scene.kerning=kerning
        let g=value(values,"gravityAngle",0),footer=String(format:"g 9.8 · tilt %+.0f° · μ %.2f · e %.2f · seed %llu",g,value(values,"friction",0.55),value(values,"bounce",0.12),preset.seed)
        scene.posterCopy=PosterCopy(title:title,subtitle:"Loose type, simulated in place",institution:"PosterLab · Rigid-body studies",footer:footer)
        // Supporting copy heads the page, so the drop from the headline to the floor stays open.
        var info:[SceneElement]=[]
        for (i,text) in ["Loose type, simulated in place","PosterLab · Rigid-body studies"].enumerated() {
            var e=SceneElement(sourceElementID:"gravity-info:\(i)",kind:"text",bounds:UnitBox(x:margin,y:(margin+Double(i)*0.03)/a,width:0.5,height:0.02/a),rotation:0,text:text,color:inks[0],shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:font,textAlignment:"left")
            e.fontVariations=profile?.variations;e.zIndex=10;info.append(e)
        }
        if Int(value(values,"floor",1).rounded())==1 {
            var e=SceneElement(sourceElementID:"gravity-footer",kind:"text",bounds:UnitBox(x:margin,y:(a-ruleInset+0.022)/a,width:1-2*margin,height:0.018/a),rotation:0,text:footer,color:inks[0],shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:font,textAlignment:"left")
            e.fontVariations=profile?.variations;e.zIndex=10;info.append(e)
        }
        // Built like PosterShapeLibrary.element, without its provisional simulation.
        var art=SceneElement(sourceElementID:"art:shape-library:"+preset.recipe.id+":specimen",kind:"text",bounds:.full,rotation:0,text:title,color:inks[0],shape:shape,outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        var geometry=values;geometry["shapeSeed"]=Double(preset.seed%9_000_000)
        art.geometry=geometry;art.inks=inks.count>1 ? [inks[1]]:nil;art.clipBounds = .full;art.sourceAnchor = .full;art.zIndex=20
        art.fontName=font;art.fontVariations=profile?.variations;art.fontProfileID=profile?.id;art.fontAssetID=profile?.assetID;art.fontAssetSHA256=profile?.assetSHA256
        // Poured letters arrive from above, where the supporting copy would catch them.
        let pour=Int(value(values,"arrangement",0).rounded())==arrangements.firstIndex(of:"pour")
        art.physics=make(title:title,font:font,variations:profile?.variations,aspect:a,parameters:geometry,seed:seed(art),obstacles:pour ? []:info,titleOverride:preset.physics?.title,top:specimenTop)
        scene.elements=info+[art]
        scene.composition=CompositionPlan.scene(scene,origin:"gravity-type-specimen");scene.composition?.description=preset.recipe.logic
        return scene
    }

    // MARK: Existing posters

    static func loosenable(_ e:SceneElement)->Bool {
        e.kind=="text" && !(e.text ?? "").isEmpty && e.physics==nil && e.paperAttachment==nil && e.shape != shape && !ContourSystems.isContour(e.shape) && !SurveyTypeGeometry.shapes.contains(e.shape)
    }
    /// Makes letters of existing text elements fall: the largest text block by default, or the given IDs.
    /// Other text stays put and blocks falling letters. The originals are kept so `restore` can undo it.
    public static func loosen(_ scene:inout StyleGenome,targetIDs:[String]?=nil,parameters overrides:[String:Double]=[:],seed:UInt64,accent:String?=nil,shapesCollide:Bool=false)throws {
        guard let recipe=PosterShapeLibrary.recipe(recipeID) else{throw PosterError.invalid("The fallen-letters recipe is missing from the bundle.")}
        if let accent{try ShapeMaterials.validate([accent])}
        // An existing poster has no rule of its own: letters land on the paper edge unless a floor is asked for.
        var values=try recipe.values(overrides.merging(["floor":0]){given,_ in given})
        let candidates=scene.elements.filter(loosenable)
        // Candidates keep scene order, so the first target sets the physics element's place and ink.
        let targets:[SceneElement]
        if let ids=targetIDs {
            targets=candidates.filter{ids.contains($0.sourceElementID)}
            guard !ids.isEmpty,targets.count==Set(ids).count else{throw PosterError.invalid("Each target must be a plain text element in this scene.")}
        }else{
            guard let largest=candidates.max(by:{$0.bounds.area==$1.bounds.area ? $0.sourceElementID>$1.sourceElementID:$0.bounds.area<$1.bounds.area}) else{throw PosterError.invalid("This scene has no text to loosen.")}
            targets=[largest]
        }
        let ids=Set(targets.map(\.sourceElementID)),obstacles=candidates.filter{!ids.contains($0.sourceElementID)}
        let shapes=shapesCollide ? scene.elements.filter{($0.kind=="shape" || $0.kind=="image") && $0.shape != shape && $0.paperAttachment==nil}:[]
        var genome=simulate(targets:targets,obstacles:obstacles,solids:shapes.map{solid($0,aspect:scene.aspect)},in:scene,parameters:values,seed:seed,origin:"scene")
        genome.sources=targets;genome.obstacleIDs=(obstacles+shapes).map(\.sourceElementID)
        if accent==nil{values["accent"]=0};values["shapeSeed"]=Double(seed%9_000_000)
        let first=targets[0]
        var e=SceneElement(sourceElementID:"art:shape-library:"+recipeID+":"+first.sourceElementID,kind:"text",bounds:.full,rotation:0,text:genome.text,color:first.color,shape:shape,outline:first.outline,shadow:false,offsetX:0,offsetY:0,copies:1)
        e.geometry=values;e.inks=accent.map{[$0]};e.physics=genome;e.zIndex=targets.map{$0.zIndex ?? 100}.max();e.outlineWidth=first.outlineWidth;e.blendMode=first.blendMode
        e.fontName=first.fontName ?? scene.font;e.fontVariations=first.fontVariations;e.fontProfileID=first.fontProfileID;e.fontAssetID=first.fontAssetID;e.fontAssetSHA256=first.fontAssetSHA256
        let index=scene.elements.firstIndex{ids.contains($0.sourceElementID)}!
        scene.elements.removeAll{ids.contains($0.sourceElementID)};scene.elements.insert(e,at:index)
        scene.composition=CompositionPlan.scene(scene,origin:"gravity-type-loosen")
        scene.composition?.constraints.append(LayoutConstraint(type:"rigid-body-simulation",targets:[e.sourceElementID],values:["glyphs":Double(genome.glyphs.count),"moving":Double(genome.glyphs.filter{$0.state != "fixed"}.count),"seconds":genome.time,"settled":genome.settled ? 1:0],reason:"Glyphs collide by outline with the type that stayed, other text and the floor; poses are stored, not re-simulated."))
    }
    /// A shape or image element's footprint in physical units: its rotated box, or a polygon for round shapes.
    static func solid(_ e:SceneElement,aspect a:Double)->[PhysicsVector] {
        let b=e.bounds,angle=e.rotation * .pi/180,c=cos(angle),s=sin(angle),centre=PhysicsVector(b.x+b.width/2,a*(b.y+b.height/2))
        let rx=b.width/2,ry=a*b.height/2
        let round=["disc","ellipse","ellipse-outline","organic-blob","halftone-sphere"].contains(e.shape)
        let local=round ? (0..<16).map{k in let t=Double(k)/16*2 * .pi;return PhysicsVector(rx*cos(t),ry*sin(t))}:[PhysicsVector(-rx,-ry),PhysicsVector(rx,-ry),PhysicsVector(rx,ry),PhysicsVector(-rx,ry)]
        return local.map{centre+$0.rotated(c,s)}
    }
    /// Puts loosened text elements back exactly as they were.
    public static func restore(_ scene:inout StyleGenome) {
        var out:[SceneElement]=[]
        for e in scene.elements{if e.shape==shape,e.physics?.origin=="scene",let sources=e.physics?.sources{out+=sources}else{out.append(e)}}
        scene.elements=out;scene.composition=CompositionPlan.scene(scene,origin:"gravity-type-restored")
    }
    public static func validate(_ scene:StyleGenome)throws {for e in scene.elements where e.shape==shape{try e.physics?.validate()}}

    // MARK: Drawing

    /// Draws a physics element from its saved poses in the context's normalised poster space.
    static func draw(_ e:SceneElement,scene:StyleGenome,context ctx:CGContext,stage:ConstructionStage)->Bool {
        guard e.shape==shape else{return false}
        guard let g=e.physics,(try? g.validate()) != nil else{return true}
        let f=e.bounds,a=scene.aspect,s=min(f.width,f.height*a/g.aspect)
        ctx.saveGState();defer{ctx.restoreGState()}
        ctx.clip(to:f.rect)
        // World units: one unit across the fitted field, uniform in physical units, resting on the field's bottom.
        ctx.translateBy(x:f.x+(f.width-s)/2,y:f.y+f.height-s*g.aspect/a);ctx.scaleBy(x:s,y:s/a)
        if e.blendMode=="multiply"{ctx.setBlendMode(.multiply)}else if e.blendMode=="difference"{ctx.setBlendMode(.difference)}
        ctx.setLineJoin(.round);ctx.setLineCap(.round)
        var fonts:[String:CTFont]=[:]
        func outline(_ x:PhysicsGlyph)->CGPath? {
            let key=x.font+(x.fontVariations ?? [:]).sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined()
            let font=fonts[key] ?? FontLibrary.font(name:x.font,variations:x.fontVariations);fonts[key]=font
            return CTFontCreatePathForGlyph(font,CGGlyph(x.glyph),nil)
        }
        func transform(_ x:PhysicsGlyph,_ pose:[Double])->CGAffineTransform {
            CGAffineTransform(a:x.rest[0],b:x.rest[1],c:x.rest[2],d:x.rest[3],tx:x.rest[4],ty:x.rest[5]).concatenating(move(x,pose))
        }
        let accent=value(e.geometry,"accent",1)>0.5 ? e.inks?.first:nil
        let look=e.outline ? 1:max(0,min(3,Int(value(e.geometry,"look",0).rounded())))
        func hex(_ x:PhysicsGlyph)->String{x.state=="fixed" ? (x.color ?? e.color):(accent ?? x.color ?? e.color)}
        /// Inks a path in the current transform with the element's look; widths are given in `unit`s of that transform.
        func ink(_ path:CGPath,_ color:String,alpha:Double=1,unit:Double) {
            switch look {
            case 1:
                ctx.addPath(path);ctx.setStrokeColor(LibrarySceneRenderer.color(color,alpha:alpha));ctx.setLineWidth((e.outline ? e.outlineWidth ?? 1:2.4)*unit);ctx.strokePath()
            case 3:
                // Neon: soft vector glow, a faint body and a near-white core, all PDF-safe strokes.
                // Seven stacked strokes give a smooth falloff without visible bands, even on large letters.
                for (width,glow) in [(22.0,0.025),(17.0,0.035),(13.0,0.05),(9.5,0.07),(6.5,0.1),(4.0,0.16),(2.6,0.28)]{ctx.addPath(path);ctx.setStrokeColor(LibrarySceneRenderer.color(color,alpha:alpha*glow));ctx.setLineWidth(width*unit);ctx.strokePath()}
                ctx.addPath(path);ctx.setFillColor(LibrarySceneRenderer.color(color,alpha:alpha*0.1));ctx.fillPath()
                ctx.addPath(path);ctx.setStrokeColor(LibrarySceneRenderer.color(tint(color,toward:"#ffffff",0.6),alpha:alpha));ctx.setLineWidth(1.7*unit);ctx.strokePath()
            default:
                ctx.addPath(path);ctx.setFillColor(LibrarySceneRenderer.color(color,alpha:alpha));ctx.fillPath()
            }
        }
        func paint(_ x:PhysicsGlyph,_ t:CGAffineTransform,alpha:Double=1,stroke:Double?=nil,shadow:Bool=false) {
            guard let path=outline(x) else{return}
            ctx.saveGState()
            // Cast shadows fall down and to the right by a fixed world distance, whatever the letter's size.
            if shadow{ctx.translateBy(x:0.006,y:0.009)}
            ctx.concatenate(t)
            if shadow{ctx.addPath(path);ctx.setFillColor(LibrarySceneRenderer.color(hex(x),alpha:0.22));ctx.fillPath()}
            else if let stroke{ctx.addPath(path);ctx.setStrokeColor(LibrarySceneRenderer.color(hex(x),alpha:alpha));ctx.setLineWidth(stroke);ctx.strokePath()}
            else{ink(path,hex(x),alpha:alpha,unit:1)}
            ctx.restoreGState()
        }
        let fixtures=(g.fixtures ?? []).map{f->CGPath in let path=CGMutablePath();path.addLines(between:f.points.map{CGPoint(x:$0[0],y:$0[1])});path.closeSubpath();return path}
        let level=ConstructionStage.allCases.firstIndex(of:stage) ?? 3
        if stage == .blockout {
            for path in fixtures{ctx.addPath(path);ctx.setFillColor(LibrarySceneRenderer.color(e.color,alpha:0.9));ctx.fillPath()}
            for x in g.glyphs {
                guard let path=outline(x) else{continue}
                ctx.setFillColor(LibrarySceneRenderer.color(hex(x),alpha:0.9))
                if let shards=x.shards {
                    for shard in shards{ctx.saveGState();ctx.concatenate(move(center:shard.center,shard.pose));for cell in shard.cells{ctx.addLines(between:cell.map{CGPoint(x:$0[0],y:$0[1])});ctx.closePath()};ctx.fillPath();ctx.restoreGState()}
                    continue
                }
                ctx.saveGState();ctx.concatenate(transform(x,x.pose));ctx.fill(path.boundingBoxOfPath);ctx.restoreGState()
            }
            return true
        }
        if look==2{for path in fixtures{ctx.saveGState();ctx.translateBy(x:0.006,y:0.009);ctx.addPath(path);ctx.setFillColor(LibrarySceneRenderer.color(e.color,alpha:0.22));ctx.fillPath();ctx.restoreGState()}}
        for path in fixtures{ink(path,e.color,unit:0.0025)}
        if level>=2 {
            if g.rule,let floor=g.floor{ink(CGPath(rect:CGRect(x:margin,y:floor,width:1-2*margin,height:0.0045),transform:nil),e.color,unit:0.0012)}
            let ghost=max(0,min(1,value(e.geometry,"ghost",0.45)))
            if ghost>0{for x in g.glyphs where x.state != "fixed"{paint(x,transform(x,[x.center[0],x.center[1],0]),alpha:ghost,stroke:1.6)}}
        }
        if level>=3 {
            for x in g.glyphs {
                let trail=x.trail ?? []
                for (k,pose) in trail.enumerated(){paint(x,transform(x,pose),alpha:0.1+0.3*Double(k+1)/Double(trail.count))}
            }
        }
        /// A broken glyph is drawn shard by shard: each shard moves into its pose, clips to its cells (world units at
        /// rest) and inks the whole outline, so the pieces stay exact vector type.
        func paintShards(_ x:PhysicsGlyph,shadow:Bool=false) {
            guard let path=outline(x),let shards=x.shards else{return}
            let rest=CGAffineTransform(a:x.rest[0],b:x.rest[1],c:x.rest[2],d:x.rest[3],tx:x.rest[4],ty:x.rest[5])
            for shard in shards {
                ctx.saveGState()
                if shadow{ctx.translateBy(x:0.006,y:0.009)}
                ctx.concatenate(move(center:shard.center,shard.pose))
                for cell in shard.cells{ctx.addLines(between:cell.map{CGPoint(x:$0[0],y:$0[1])});ctx.closePath()}
                ctx.clip();ctx.concatenate(rest)
                if shadow{ctx.addPath(path);ctx.setFillColor(LibrarySceneRenderer.color(hex(x),alpha:0.22));ctx.fillPath()}else{ink(path,hex(x),unit:1)}
                ctx.restoreGState()
            }
        }
        func whole(_ x:PhysicsGlyph,shadow:Bool=false){if x.shards != nil{paintShards(x,shadow:shadow)}else{paint(x,transform(x,x.pose),shadow:shadow)}}
        if look==2{for x in g.glyphs{whole(x,shadow:true)}}
        for x in g.glyphs where x.state=="fixed"{whole(x)}
        for x in g.glyphs where x.state != "fixed"{whole(x)}
        if level>=2 {
            func fastener(_ point:CGPoint,ring:Bool) {
                let r=ring ? 0.0075:0.0065
                if ring{ctx.setStrokeColor(LibrarySceneRenderer.color(e.color));ctx.setLineWidth(0.0024);ctx.strokeEllipse(in:CGRect(x:point.x-r,y:point.y-r,width:2*r,height:2*r));return}
                ctx.setFillColor(LibrarySceneRenderer.color(e.color));ctx.fillEllipse(in:CGRect(x:point.x-r,y:point.y-r,width:2*r,height:2*r))
                ctx.setStrokeColor(LibrarySceneRenderer.color(scene.background,alpha:0.85));ctx.setLineWidth(0.0018);ctx.strokeEllipse(in:CGRect(x:point.x-r*0.55,y:point.y-r*0.55,width:r*1.1,height:r*1.1))
            }
            // Nails stay in the wall; rings travel with the letter that carries them.
            for n in g.nails ?? g.glyphs.compactMap(\.pin){fastener(CGPoint(x:n[0],y:n[1]),ring:false)}
            for x in g.glyphs{for r in x.rivets ?? []{fastener(CGPoint(x:r[0],y:r[1]).applying(move(x,x.pose)),ring:true)}}
        }
        return true
    }
    /// Moves a rest-world point with the glyph from its rest pose to `pose`.
    static func move(_ x:PhysicsGlyph,_ pose:[Double])->CGAffineTransform{move(center:x.center,pose)}
    /// Moves a rest-world point with a rigid body whose centre at rest is `center` to `pose`.
    static func move(center:[Double],_ pose:[Double])->CGAffineTransform{CGAffineTransform(translationX:-center[0],y:-center[1]).concatenating(CGAffineTransform(rotationAngle:pose[2])).concatenating(CGAffineTransform(translationX:pose[0],y:pose[1]))}
    static func tint(_ hex:String,toward other:String,_ t:Double)->String {
        let a=Int(hex.dropFirst(),radix:16) ?? 0,b=Int(other.dropFirst(),radix:16) ?? 0
        let mix:[Int]=[16,8,0].map{shift->Int in
            let from=Double((a>>shift)&255),to=Double((b>>shift)&255)
            return Int((from*(1-t)+to*t).rounded())
        }
        return String(format:"#%02x%02x%02x",mix[0],mix[1],mix[2])
    }
}
