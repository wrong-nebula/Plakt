import Foundation

/// 2D vector in world units (y points down the poster).
public struct PhysicsVector:Codable,Hashable,Sendable {
    public var x:Double;public var y:Double
    public init(_ x:Double,_ y:Double){self.x=x;self.y=y}
    public static let zero=PhysicsVector(0,0)
    public static func +(a:Self,b:Self)->Self{Self(a.x+b.x,a.y+b.y)}
    public static func -(a:Self,b:Self)->Self{Self(a.x-b.x,a.y-b.y)}
    public static prefix func -(a:Self)->Self{Self(-a.x,-a.y)}
    public static func *(s:Double,a:Self)->Self{Self(s*a.x,s*a.y)}
    public static func +=(a:inout Self,b:Self){a=a+b}
    public static func -=(a:inout Self,b:Self){a=a-b}
    public var length:Double{hypot(x,y)}
    public var normalized:Self{let l=length;return l>1e-12 ? Self(x/l,y/l):.zero}
    public func dot(_ b:Self)->Double{x*b.x+y*b.y}
    public func cross(_ b:Self)->Double{x*b.y-y*b.x}
    /// v × s: the in-plane perpendicular used for face normals and tangents.
    func cross(_ s:Double)->Self{Self(s*y,-s*x)}
    func rotated(_ c:Double,_ s:Double)->Self{Self(c*x-s*y,s*x+c*y)}
    func unrotated(_ c:Double,_ s:Double)->Self{Self(c*x+s*y,-s*x+c*y)}
}
/// s × v for an angular velocity s.
@inline(__always) func physicsCross(_ s:Double,_ v:PhysicsVector)->PhysicsVector{PhysicsVector(-s*v.y,s*v.x)}

/// A rigid body: one or more convex polygons around its centre of mass.
public struct PhysicsBody:Sendable {
    public enum Kind:String,Codable,Sendable{case fixed,dynamic}
    public var kind:Kind
    public var position:PhysicsVector
    public var angle:Double
    public var velocity=PhysicsVector.zero
    public var angularVelocity=0.0
    public internal(set) var polygons:[[PhysicsVector]]
    var normals:[[PhysicsVector]]
    public internal(set) var mass=0.0
    public internal(set) var inertia=0.0
    /// Distance from the centre of mass to the farthest vertex.
    public internal(set) var reach=0.0
    var inverseMass=0.0,inverseInertia=0.0
    public var friction=0.6,restitution=0.1
    public var linearDamping=0.0,angularDamping=0.05
    /// Angular damping applied only while the body touches something, so round letters stop rolling.
    public var rollingResistance=0.0
    /// Held in its starting pose, as if fixed, until world time reaches this.
    public var releaseTime=0.0
    public internal(set) var awake=true
    public internal(set) var escaped=false
    /// Breaks are reported, not performed: an approach faster than this (m/s) at a contact is recorded in `impacts`.
    public var breakSpeed:Double?=nil
    /// Taken out of the world, for example after it was replaced by its fragments.
    public internal(set) var retired=false
    /// When released, push out of bodies it already overlaps instead of ignoring them until they separate.
    /// Fragments use this, because the body they replace may have sunk slightly into what it struck.
    public var separatesOnRelease=false
    var sleepTime=0.0,released=false
    public func world(_ local:PhysicsVector)->PhysicsVector{position+local.rotated(cos(angle),sin(angle))}
}

/// A contact that struck a breakable body faster than its break speed, with the body's motion just before the hit.
public struct PhysicsImpact:Sendable {
    public var body:Int
    public var point:PhysicsVector
    public var speed:Double
    public var velocity:PhysicsVector
    public var angularVelocity:Double
}

/// A pivot that keeps a point on one body over a point on another body, or on the world.
public struct PhysicsPin:Sendable {
    public var bodyA:Int?
    public var bodyB:Int
    /// Body-local anchor on A, or the world anchor when A is nil.
    public var anchorA:PhysicsVector
    public var anchorB:PhysicsVector
    /// Torque that resists rotation about the pin, so swinging bodies come to rest.
    public var frictionTorque:Double
    var impulse=PhysicsVector.zero,angularImpulse=0.0
    var rA=PhysicsVector.zero,rB=PhysicsVector.zero,k=(0.0,0.0,0.0),angularMass=0.0
    public init(bodyA:Int?,bodyB:Int,anchorA:PhysicsVector,anchorB:PhysicsVector,frictionTorque:Double=0){self.bodyA=bodyA;self.bodyB=bodyB;self.anchorA=anchorA;self.anchorB=anchorB;self.frictionTorque=frictionTorque}
}

/// Deterministic rigid-body world: SAT polygon contacts with clipped two-point manifolds, a sequential-impulse
/// solver with warm starting, Coulomb friction and restitution, a two-point block solver for resting contact,
/// non-linear Gauss–Seidel position correction, pins and island sleeping. Iteration order never depends on
/// hashing, so equal inputs give identical results on one machine.
public struct PhysicsWorld:Sendable {
    public var gravity=PhysicsVector(0,10)
    public var bodies:[PhysicsBody]=[]
    public var pins:[PhysicsPin]=[]
    /// Ten velocity iterations keep stacks up to about eight bodies still; taller stacks can creep before they sleep.
    public var velocityIterations=10,positionIterations=3
    /// Allowed penetration; tuned, as in Box2D, for bodies about 0.1–10 units across.
    public var linearSlop=0.005
    public var restitutionThreshold=1.0
    public var sleepLinear=0.02,sleepAngular=2*Double.pi/180,timeToSleep=0.5
    /// Dynamic bodies that pass this height are frozen and marked escaped.
    public var escapeY:Double?=nil
    /// Longest distance any point of a body may travel in one substep, and the most substeps per step.
    public var maxTravel=0.05,maxSubsteps=8
    public private(set) var time=0.0
    public private(set) var steps=0
    /// Hard hits on breakable bodies during the last `step`, in contact order.
    public private(set) var impacts:[PhysicsImpact]=[]
    var contacts:[Contact]=[]
    var ignored:Set<Int>=[]
    public init(){}

    struct Feature:Hashable {var key:Int;var id:UInt32}
    struct ContactPoint {
        var local:PhysicsVector;var id:UInt32;var normalImpulse=0.0;var tangentImpulse=0.0
        var rA=PhysicsVector.zero,rB=PhysicsVector.zero,normalMass=0.0,tangentMass=0.0,bias=0.0
    }
    struct Contact {
        var a:Int;var b:Int;var shapeA:Int;var shapeB:Int;var faceB:Bool
        var localNormal:PhysicsVector;var localPoint:PhysicsVector;var points:[ContactPoint]
        var friction=0.0,restitution=0.0,normal=PhysicsVector.zero
        var k=(0.0,0.0,0.0),blockMass=(0.0,0.0,0.0)
        var key:Int{((a*256+shapeA)*65536+b)*256+shapeB}
    }

    // MARK: Bodies

    /// Adds a body from world-space polygons. Each polygon is replaced by its convex hull.
    @discardableResult
    public mutating func addBody(_ polygons:[[PhysicsVector]],kind:PhysicsBody.Kind,density:Double=1,friction:Double=0.6,restitution:Double=0.1)->Int {
        let hulls=polygons.map(Self.hull).filter{$0.count>=3 && Self.area($0)>1e-9}
        var mass=0.0,center=PhysicsVector.zero,parts:[(Double,PhysicsVector,Double)]=[]
        for hull in hulls {let p=Self.massData(hull,density:max(density,1e-9));parts.append(p);mass+=p.0;center+=p.0*p.1}
        center=mass>0 ? (1/mass)*center:(hulls.first?.first ?? .zero)
        let inertia=parts.reduce(0.0){$0+$1.2+$1.0*($1.1-center).dot($1.1-center)}
        let local=hulls.map{$0.map{$0-center}}
        var body=PhysicsBody(kind:kind,position:center,angle:0,polygons:local,normals:local.map(Self.normals))
        body.friction=friction;body.restitution=restitution;body.reach=local.flatMap{$0}.map(\.length).max() ?? 0
        if kind == .dynamic,mass>0 {body.mass=mass;body.inertia=inertia;body.inverseMass=1/mass;body.inverseInertia=inertia>0 ? 1/inertia:0}
        bodies.append(body);return bodies.count-1
    }
    public static func box(center:PhysicsVector,halfWidth:Double,halfHeight:Double,angle:Double=0)->[PhysicsVector] {
        let c=cos(angle),s=sin(angle)
        return [PhysicsVector(-halfWidth,-halfHeight),PhysicsVector(halfWidth,-halfHeight),PhysicsVector(halfWidth,halfHeight),PhysicsVector(-halfWidth,halfHeight)].map{center+$0.rotated(c,s)}
    }
    /// Counter-clockwise hull (positive signed area) without collinear points.
    public static func hull(_ points:[PhysicsVector])->[PhysicsVector] {
        let p=points.filter{$0.x.isFinite && $0.y.isFinite}.sorted{$0.x==$1.x ? $0.y<$1.y:$0.x<$1.x}
        guard p.count>2 else{return p}
        func turn(_ o:PhysicsVector,_ a:PhysicsVector,_ b:PhysicsVector)->Double{(a-o).cross(b-o)}
        var lower:[PhysicsVector]=[],upper:[PhysicsVector]=[]
        for v in p{while lower.count>=2 && turn(lower[lower.count-2],lower[lower.count-1],v)<=1e-12{lower.removeLast()};lower.append(v)}
        for v in p.reversed(){while upper.count>=2 && turn(upper[upper.count-2],upper[upper.count-1],v)<=1e-12{upper.removeLast()};upper.append(v)}
        return Array(lower.dropLast()+upper.dropLast())
    }
    public static func area(_ polygon:[PhysicsVector])->Double {
        guard polygon.count>2 else{return 0}
        return polygon.indices.reduce(0.0){$0+polygon[$1].cross(polygon[($1+1)%polygon.count])}*0.5
    }
    static func normals(_ polygon:[PhysicsVector])->[PhysicsVector]{polygon.indices.map{(polygon[($0+1)%polygon.count]-polygon[$0]).cross(1).normalized}}
    /// Mass, centroid and inertia about the centroid of a convex polygon.
    static func massData(_ v:[PhysicsVector],density:Double)->(Double,PhysicsVector,Double) {
        let s=v[0];var area=0.0,center=PhysicsVector.zero,inertia=0.0
        for i in v.indices {
            let e1=v[i]-s,e2=v[(i+1)%v.count]-s,d=e1.cross(e2),triangle=0.5*d
            area+=triangle;center+=(triangle/3)*(e1+e2)
            let x2=e1.x*e1.x+e2.x*e1.x+e2.x*e2.x,y2=e1.y*e1.y+e2.y*e1.y+e2.y*e2.y
            inertia+=(0.25/3*d)*(x2+y2)
        }
        let local=(1/area)*center,mass=density*area
        return (mass,s+local,density*inertia-mass*local.dot(local))
    }

    // MARK: Stepping

    var radius:Double{2*linearSlop}
    func movable(_ i:Int)->Bool{let b=bodies[i];return b.kind == .dynamic && b.released && b.awake && !b.escaped && !b.retired}
    func inverse(_ i:Int)->(Double,Double){movable(i) ? (bodies[i].inverseMass,bodies[i].inverseInertia):(0,0)}
    public var isSettled:Bool{bodies.allSatisfy{$0.kind == .fixed || $0.escaped || $0.retired || ($0.released && !$0.awake)}}
    /// Removes a body from collisions and integration; its last pose stays readable.
    public mutating func retire(_ i:Int){bodies[i].retired=true;bodies[i].awake=false;bodies[i].velocity = .zero;bodies[i].angularVelocity=0}

    /// Advances by `dt`, split into equal substeps when a body would otherwise travel further than `maxTravel`
    /// in one, so fast letters cannot pass through thin strokes. The split depends only on the state, so it is deterministic.
    public mutating func step(_ dt:Double) {
        guard dt>0,dt.isFinite else{return}
        impacts=[]
        var travel=0.0
        for (i,b) in bodies.enumerated() where b.kind == .dynamic && !b.escaped && (movable(i) || (!b.released && time+dt>=b.releaseTime)) {
            travel=max(travel,((b.velocity+dt*gravity).length+abs(b.angularVelocity)*b.reach)*dt)
        }
        let count=max(1,min(maxSubsteps,Int((travel/maxTravel).rounded(.up))))
        for _ in 0..<count{advance(dt/Double(count))}
        steps+=1
    }
    mutating func advance(_ dt:Double) {
        for i in bodies.indices where bodies[i].kind == .dynamic && !bodies[i].released && time>=bodies[i].releaseTime {release(i)}
        collide()
        var v=bodies.map(\.velocity),w=bodies.map(\.angularVelocity)
        for i in bodies.indices where movable(i) {
            let b=bodies[i]
            v[i]=(1/(1+dt*b.linearDamping))*(v[i]+dt*gravity);w[i]=w[i]/(1+dt*b.angularDamping)
        }
        prepare(&v,&w)
        for _ in 0..<velocityIterations {
            for j in pins.indices{solvePin(j,dt,&v,&w)}
            for c in contacts.indices{solveContact(c,&v,&w)}
        }
        for i in Set(contacts.flatMap{[$0.a,$0.b]}) where movable(i) && bodies[i].rollingResistance>0 {w[i]/=1+dt*bodies[i].rollingResistance}
        for i in bodies.indices where movable(i) {
            var dx=dt*v[i];if dx.length>2{v[i]=(2/dx.length)*v[i];dx=dt*v[i]}
            if abs(dt*w[i])>0.5*Double.pi{w[i]*=0.5*Double.pi/abs(dt*w[i])}
            bodies[i].position+=dx;bodies[i].angle+=dt*w[i]
            bodies[i].velocity=v[i];bodies[i].angularVelocity=w[i]
        }
        for _ in 0..<positionIterations {
            var solved=true
            for c in contacts.indices{solved=positionContact(c) && solved}
            for j in pins.indices{solved=positionPin(j) && solved}
            if solved{break}
        }
        updateSleep(dt)
        time+=dt
    }
    /// Steps until every body sleeps or escapes, or until the time limit.
    public mutating func settle(dt:Double=1.0/120,limit:Double=8){while time<limit && !isSettled{step(dt)}}

    mutating func release(_ i:Int) {
        bodies[i].released=true;bodies[i].awake=true;bodies[i].sleepTime=0
        // Neighbours that already overlap the released body (kerned letters, tight leading) are not pushed apart;
        // the pair collides again once the bodies have separated.
        guard !bodies[i].separatesOnRelease else{return}
        for j in bodies.indices where j != i && overlapping(i,j){ignored.insert(min(i,j)*65536+max(i,j))}
    }
    func bounds(_ i:Int)->[(PhysicsVector,PhysicsVector)] {
        let b=bodies[i],c=cos(b.angle),s=sin(b.angle)
        return b.polygons.map{poly in
            var lo=PhysicsVector(Double.infinity,Double.infinity),hi=PhysicsVector(-Double.infinity,-Double.infinity)
            for p in poly{let q=b.position+p.rotated(c,s);lo=PhysicsVector(min(lo.x,q.x),min(lo.y,q.y));hi=PhysicsVector(max(hi.x,q.x),max(hi.y,q.y))}
            return (lo-PhysicsVector(radius,radius),hi+PhysicsVector(radius,radius))
        }
    }
    static func union(_ boxes:[(PhysicsVector,PhysicsVector)])->(PhysicsVector,PhysicsVector) {
        boxes.reduce((PhysicsVector(Double.infinity,Double.infinity),PhysicsVector(-Double.infinity,-Double.infinity))){(PhysicsVector(min($0.0.x,$1.0.x),min($0.0.y,$1.0.y)),PhysicsVector(max($0.1.x,$1.1.x),max($0.1.y,$1.1.y)))}
    }
    static func overlaps(_ a:(PhysicsVector,PhysicsVector),_ b:(PhysicsVector,PhysicsVector))->Bool{a.0.x<=b.1.x && b.0.x<=a.1.x && a.0.y<=b.1.y && b.0.y<=a.1.y}
    func overlapping(_ i:Int,_ j:Int)->Bool {
        let ba=bounds(i),bb=bounds(j)
        guard Self.overlaps(Self.union(ba),Self.union(bb)) else{return false}
        for (sa,boxA) in ba.enumerated() {for (sb,boxB) in bb.enumerated() where Self.overlaps(boxA,boxB) {
            if let m=manifold(i,sa,j,sb),penetrates(m){return true}
        }}
        return false
    }
    /// The polygon cores overlap, beyond the collision skin that resting bodies always share.
    func penetrates(_ m:Contact)->Bool{separations(m).contains{$0+2*radius < -linearSlop}}

    mutating func collide() {
        let boxes=bodies.indices.map(bounds),total=boxes.map(Self.union)
        let previous=Dictionary(contacts.flatMap{c in c.points.map{(Feature(key:c.key,id:$0.id),($0.normalImpulse,$0.tangentImpulse))}},uniquingKeysWith:{a,_ in a})
        var next:[Contact]=[]
        // Bodies joined by a pin do not collide with each other, as in Box2D's default joint.
        let linked=Set(pins.compactMap{p in p.bodyA.map{min($0,p.bodyB)*65536+max($0,p.bodyB)}})
        // Sweep and prune along x; the sort is stable, so equal bounds keep body order.
        let order=bodies.indices.sorted{total[$0].0.x==total[$1].0.x ? $0<$1:total[$0].0.x<total[$1].0.x}
        for (n,i) in order.enumerated() {
            for j in order[(n+1)...] {
                if total[j].0.x>total[i].1.x{break}
                guard movable(i) || movable(j),!bodies[i].retired,!bodies[j].retired,Self.overlaps(total[i],total[j]) else{continue}
                if bodies[i].kind == .fixed && bodies[j].kind == .fixed{continue}
                let a=min(i,j),b=max(i,j),pair=a*65536+b
                if linked.contains(pair){continue}
                var found:[Contact]=[]
                for (sa,boxA) in boxes[a].enumerated() {for (sb,boxB) in boxes[b].enumerated() where Self.overlaps(boxA,boxB) {
                    if var m=manifold(a,sa,b,sb) {
                        for k in m.points.indices{if let old=previous[Feature(key:m.key,id:m.points[k].id)]{m.points[k].normalImpulse=old.0;m.points[k].tangentImpulse=old.1}}
                        found.append(m)
                    }
                }}
                if ignored.contains(pair) {
                    if found.contains(where:penetrates){continue}
                    ignored.remove(pair)
                }
                guard !found.isEmpty else{continue}
                // A moving body wakes a sleeping one; a body coming to rest on a sleeping one does not.
                for (x,y) in [(a,b),(b,a)] where movable(x) && bodies[y].kind == .dynamic && bodies[y].released && !bodies[y].awake && !bodies[y].escaped && bodies[x].sleepTime==0 {bodies[y].awake=true;bodies[y].sleepTime=0}
                next+=found
            }
        }
        // Wakes can turn a skipped sleeping pair into a live one; those pairs join on the next step.
        contacts=next.filter{movable($0.a) || movable($0.b)}
    }

    // MARK: Narrow phase (Box2D-style polygon clipping)

    func manifold(_ a:Int,_ sa:Int,_ b:Int,_ sb:Int)->Contact? {
        let A=bodies[a],B=bodies[b],pa=A.polygons[sa],pb=B.polygons[sb],na=A.normals[sa],nb=B.normals[sb]
        let ca=cos(A.angle),sA=sin(A.angle),cb=cos(B.angle),sB=sin(B.angle)
        let total=2*radius
        let (edgeA,separationA)=Self.maxSeparation(pa,na,A.position,ca,sA,pb,B.position,cb,sB)
        if separationA>total{return nil}
        let (edgeB,separationB)=Self.maxSeparation(pb,nb,B.position,cb,sB,pa,A.position,ca,sA)
        if separationB>total{return nil}
        let flip=separationB>separationA+0.1*linearSlop
        let (p1,n1,x1,c1,s1,p2,n2,x2,c2,s2,edge)=flip ? (pb,nb,B.position,cb,sB,pa,na,A.position,ca,sA,edgeB):(pa,na,A.position,ca,sA,pb,nb,B.position,cb,sB,edgeA)
        // The incident edge on the other polygon is the one most anti-parallel to the reference normal.
        let refNormal=n1[edge].rotated(c1,s1).unrotated(c2,s2)
        var incident=0,best=Double.infinity
        for i in n2.indices{let d=refNormal.dot(n2[i]);if d<best{best=d;incident=i}}
        let i2=(incident+1)%p2.count
        var clip=[(x2+p2[incident].rotated(c2,s2),Self.feature(edge,incident,0,1)),(x2+p2[i2].rotated(c2,s2),Self.feature(edge,i2,0,1))]
        let iv1=edge,iv2=(edge+1)%p1.count,v11=p1[iv1],v12=p1[iv2]
        let localTangent=(v12-v11).normalized,localNormal=localTangent.cross(1),planePoint=0.5*(v11+v12)
        let tangent=localTangent.rotated(c1,s1),normal=tangent.cross(1)
        let w11=x1+v11.rotated(c1,s1),w12=x1+v12.rotated(c1,s1)
        let front=normal.dot(w11),side1 = -tangent.dot(w11)+total,side2=tangent.dot(w12)+total
        clip=Self.clipSegment(clip,-tangent,side1,iv1);if clip.count<2{return nil}
        clip=Self.clipSegment(clip,tangent,side2,iv2);if clip.count<2{return nil}
        var points:[ContactPoint]=[]
        for (v,id) in clip where normal.dot(v)-front<=total {
            let local=(v-x2).unrotated(c2,s2)
            points.append(ContactPoint(local:local,id:flip ? Self.swapped(id):id))
        }
        guard !points.isEmpty else{return nil}
        return Contact(a:a,b:b,shapeA:sa,shapeB:sb,faceB:flip,localNormal:localNormal,localPoint:planePoint,points:points,friction:sqrt(A.friction*B.friction),restitution:max(A.restitution,B.restitution))
    }
    static func feature(_ indexA:Int,_ indexB:Int,_ typeA:UInt32,_ typeB:UInt32)->UInt32{UInt32(indexA&255)|UInt32(indexB&255)<<8|typeA<<16|typeB<<24}
    static func swapped(_ id:UInt32)->UInt32{(id>>8&255)|(id&255)<<8|(id>>24&255)<<16|(id>>16&255)<<24}
    static func maxSeparation(_ p1:[PhysicsVector],_ n1:[PhysicsVector],_ x1:PhysicsVector,_ c1:Double,_ s1:Double,_ p2:[PhysicsVector],_ x2:PhysicsVector,_ c2:Double,_ s2:Double)->(Int,Double) {
        // Polygon 1 expressed in polygon 2's frame.
        let other=p2
        var best=0,maxSeparation = -Double.infinity
        for i in p1.indices {
            let n=n1[i].rotated(c1,s1).unrotated(c2,s2),v=(x1+p1[i].rotated(c1,s1)-x2).unrotated(c2,s2)
            var si=Double.infinity
            for q in other{si=min(si,n.dot(q-v))}
            if si>maxSeparation{maxSeparation=si;best=i}
        }
        return (best,maxSeparation)
    }
    static func clipSegment(_ input:[(PhysicsVector,UInt32)],_ normal:PhysicsVector,_ offset:Double,_ vertex:Int)->[(PhysicsVector,UInt32)] {
        var out:[(PhysicsVector,UInt32)]=[]
        let d0=normal.dot(input[0].0)-offset,d1=normal.dot(input[1].0)-offset
        if d0<=0{out.append(input[0])};if d1<=0{out.append(input[1])}
        if d0*d1<0 {
            let t=d0/(d0-d1)
            out.append((input[0].0+t*(input[1].0-input[0].0),feature(vertex,Int(input[0].1>>8&255),1,0)))
        }
        return out
    }
    /// World normal (A to B) and per-point separations, including the collision skin.
    func world(_ m:Contact)->(PhysicsVector,[PhysicsVector],[Double]) {
        let A=bodies[m.a],B=bodies[m.b]
        let (ref,inc)=m.faceB ? (B,A):(A,B)
        let normal=m.localNormal.rotated(cos(ref.angle),sin(ref.angle)),plane=ref.world(m.localPoint)
        var points:[PhysicsVector]=[],separations:[Double]=[]
        for p in m.points {
            let clip=inc.world(p.local),onRef=clip+(radius-(clip-plane).dot(normal))*normal,onInc=clip-radius*normal
            points.append(0.5*(onRef+onInc));separations.append((onInc-onRef).dot(normal))
        }
        return (m.faceB ? -normal:normal,points,separations)
    }
    func separations(_ m:Contact)->[Double]{world(m).2}

    // MARK: Solver

    mutating func prepare(_ v:inout [PhysicsVector],_ w:inout [Double]) {
        for c in contacts.indices {
            let m=contacts[c],(mA,iA)=inverse(m.a),(mB,iB)=inverse(m.b)
            let (normal,points,_)=world(m),tangent=normal.cross(1)
            contacts[c].normal=normal
            for k in m.points.indices {
                var p=m.points[k];p.rA=points[k]-bodies[m.a].position;p.rB=points[k]-bodies[m.b].position
                let rnA=p.rA.cross(normal),rnB=p.rB.cross(normal),kn=mA+mB+iA*rnA*rnA+iB*rnB*rnB
                let rtA=p.rA.cross(tangent),rtB=p.rB.cross(tangent),kt=mA+mB+iA*rtA*rtA+iB*rtB*rtB
                p.normalMass=kn>0 ? 1/kn:0;p.tangentMass=kt>0 ? 1/kt:0
                // Restitution targets the approach speed before any impulse of this step is applied.
                let dv=v[m.b]+physicsCross(w[m.b],p.rB)-v[m.a]-physicsCross(w[m.a],p.rA),vn=normal.dot(dv)
                p.bias=vn < -restitutionThreshold ? -m.restitution*vn:0
                for x in [m.a,m.b] where movable(x) {
                    if let limit=bodies[x].breakSpeed,-vn>limit{impacts.append(PhysicsImpact(body:x,point:points[k],speed:-vn,velocity:v[x],angularVelocity:w[x]))}
                }
                contacts[c].points[k]=p
            }
            if contacts[c].points.count==2 {
                let p1=contacts[c].points[0],p2=contacts[c].points[1]
                let rn1A=p1.rA.cross(normal),rn1B=p1.rB.cross(normal),rn2A=p2.rA.cross(normal),rn2B=p2.rB.cross(normal)
                let k11=mA+mB+iA*rn1A*rn1A+iB*rn1B*rn1B,k22=mA+mB+iA*rn2A*rn2A+iB*rn2B*rn2B,k12=mA+mB+iA*rn1A*rn2A+iB*rn1B*rn2B
                let det=k11*k22-k12*k12
                // Nearly coincident points make the block system ill-conditioned; keep one of them.
                if k11*k11<1000*det,det != 0 {contacts[c].k=(k11,k12,k22);contacts[c].blockMass=(k22/det,-k12/det,k11/det)}else{contacts[c].points.removeLast()}
            }
        }
        for c in contacts.indices {
            let m=contacts[c],(mA,iA)=inverse(m.a),(mB,iB)=inverse(m.b),tangent=m.normal.cross(1)
            for p in m.points {
                let impulse=p.normalImpulse*m.normal+p.tangentImpulse*tangent
                v[m.a]-=mA*impulse;w[m.a]-=iA*p.rA.cross(impulse);v[m.b]+=mB*impulse;w[m.b]+=iB*p.rB.cross(impulse)
            }
        }
        for j in pins.indices {
            var p=pins[j];let b=p.bodyB,(mB,iB)=inverse(b),(mA,iA)=p.bodyA.map{inverse($0)} ?? (0,0)
            p.rA=p.bodyA.map{p.anchorA.rotated(cos(bodies[$0].angle),sin(bodies[$0].angle))} ?? .zero
            p.rB=p.anchorB.rotated(cos(bodies[b].angle),sin(bodies[b].angle))
            p.k=(mA+mB+iA*p.rA.y*p.rA.y+iB*p.rB.y*p.rB.y,-iA*p.rA.x*p.rA.y-iB*p.rB.x*p.rB.y,mA+mB+iA*p.rA.x*p.rA.x+iB*p.rB.x*p.rB.x)
            p.angularMass=iA+iB>0 ? 1/(iA+iB):0
            if let a=p.bodyA{v[a]-=mA*p.impulse;w[a]-=iA*(p.rA.cross(p.impulse)+p.angularImpulse)}
            v[b]+=mB*p.impulse;w[b]+=iB*(p.rB.cross(p.impulse)+p.angularImpulse)
            pins[j]=p
        }
    }
    mutating func solveContact(_ c:Int,_ v:inout [PhysicsVector],_ w:inout [Double]) {
        let m=contacts[c],a=m.a,b=m.b,(mA,iA)=inverse(a),(mB,iB)=inverse(b),normal=m.normal,tangent=normal.cross(1)
        func relative(_ p:ContactPoint)->PhysicsVector{v[b]+physicsCross(w[b],p.rB)-v[a]-physicsCross(w[a],p.rA)}
        func apply(_ p:ContactPoint,_ impulse:PhysicsVector){v[a]-=mA*impulse;w[a]-=iA*p.rA.cross(impulse);v[b]+=mB*impulse;w[b]+=iB*p.rB.cross(impulse)}
        for k in m.points.indices {
            var p=contacts[c].points[k]
            let limit=m.friction*p.normalImpulse,lambda=p.tangentMass * -relative(p).dot(tangent)
            let updated=max(-limit,min(limit,p.tangentImpulse+lambda))
            apply(p,(updated-p.tangentImpulse)*tangent);p.tangentImpulse=updated;contacts[c].points[k]=p
        }
        if contacts[c].points.count==1 {
            var p=contacts[c].points[0]
            let lambda = -p.normalMass*(relative(p).dot(normal)-p.bias),updated=max(p.normalImpulse+lambda,0)
            apply(p,(updated-p.normalImpulse)*normal);p.normalImpulse=updated;contacts[c].points[0]=p
            return
        }
        // Two-point block solver (total enumeration of the four complementarity cases).
        var p1=contacts[c].points[0],p2=contacts[c].points[1]
        let (k11,k12,k22)=m.k,(m11,m12,m22)=m.blockMass
        let ax=p1.normalImpulse,ay=p2.normalImpulse
        let bx=relative(p1).dot(normal)-p1.bias-(k11*ax+k12*ay),by=relative(p2).dot(normal)-p2.bias-(k12*ax+k22*ay)
        func finish(_ x:Double,_ y:Double) {
            let d1=(x-ax)*normal,d2=(y-ay)*normal
            v[a]-=mA*(d1+d2);w[a]-=iA*(p1.rA.cross(d1)+p2.rA.cross(d2))
            v[b]+=mB*(d1+d2);w[b]+=iB*(p1.rB.cross(d1)+p2.rB.cross(d2))
            p1.normalImpulse=x;p2.normalImpulse=y;contacts[c].points[0]=p1;contacts[c].points[1]=p2
        }
        let x1 = -(m11*bx+m12*by),y1 = -(m12*bx+m22*by)
        if x1>=0 && y1>=0{finish(x1,y1);return}
        let x2 = -p1.normalMass*bx
        if x2>=0 && k12*x2+by>=0{finish(x2,0);return}
        let y3 = -p2.normalMass*by
        if y3>=0 && k12*y3+bx>=0{finish(0,y3);return}
        if bx>=0 && by>=0{finish(0,0)}
    }
    mutating func solvePin(_ j:Int,_ dt:Double,_ v:inout [PhysicsVector],_ w:inout [Double]) {
        var p=pins[j];let b=p.bodyB,(mB,iB)=inverse(b),(mA,iA)=p.bodyA.map{inverse($0)} ?? (0,0)
        let va=p.bodyA.map{v[$0]} ?? .zero,wa=p.bodyA.map{w[$0]} ?? 0
        if p.frictionTorque>0,p.angularMass>0 {
            let limit=dt*p.frictionTorque,old=p.angularImpulse
            p.angularImpulse=max(-limit,min(limit,old-p.angularMass*(w[b]-wa)))
            let delta=p.angularImpulse-old
            if let a=p.bodyA{w[a]-=iA*delta};w[b]+=iB*delta
        }
        let va2=p.bodyA.map{v[$0]} ?? va,wa2=p.bodyA.map{w[$0]} ?? wa
        let cdot=v[b]+physicsCross(w[b],p.rB)-va2-physicsCross(wa2,p.rA)
        let impulse = -Self.solve(p.k,cdot)
        p.impulse+=impulse
        if let a=p.bodyA{v[a]-=mA*impulse;w[a]-=iA*p.rA.cross(impulse)}
        v[b]+=mB*impulse;w[b]+=iB*p.rB.cross(impulse)
        pins[j]=p
    }
    static func solve(_ k:(Double,Double,Double),_ r:PhysicsVector)->PhysicsVector {
        let det=k.0*k.2-k.1*k.1;guard det != 0 else{return .zero}
        return PhysicsVector((k.2*r.x-k.1*r.y)/det,(k.0*r.y-k.1*r.x)/det)
    }
    mutating func positionContact(_ c:Int)->Bool {
        let m=contacts[c],a=m.a,b=m.b,(mA,iA)=inverse(a),(mB,iB)=inverse(b)
        var minimum=0.0
        for p in m.points {
            let (ref,inc)=m.faceB ? (bodies[b],bodies[a]):(bodies[a],bodies[b])
            var normal=m.localNormal.rotated(cos(ref.angle),sin(ref.angle))
            let plane=ref.world(m.localPoint),point=inc.world(p.local)
            let separation=(point-plane).dot(normal)-2*radius
            if m.faceB{normal = -normal}
            let rA=point-bodies[a].position,rB=point-bodies[b].position
            minimum=min(minimum,separation)
            let correction=max(-0.2,min(0,0.2*(separation+linearSlop)))
            let rnA=rA.cross(normal),rnB=rB.cross(normal),k=mA+mB+iA*rnA*rnA+iB*rnB*rnB
            let impulse=(k>0 ? -correction/k:0)*normal
            bodies[a].position-=mA*impulse;bodies[a].angle-=iA*rA.cross(impulse)
            bodies[b].position+=mB*impulse;bodies[b].angle+=iB*rB.cross(impulse)
        }
        return minimum >= -3*linearSlop
    }
    mutating func positionPin(_ j:Int)->Bool {
        let p=pins[j],b=p.bodyB,(mB,iB)=inverse(b),(mA,iA)=p.bodyA.map{inverse($0)} ?? (0,0)
        let rA=p.bodyA.map{p.anchorA.rotated(cos(bodies[$0].angle),sin(bodies[$0].angle))} ?? .zero
        let rB=p.anchorB.rotated(cos(bodies[b].angle),sin(bodies[b].angle))
        let error=bodies[b].position+rB-(p.bodyA.map{bodies[$0].position+rA} ?? p.anchorA)
        let k=(mA+mB+iA*rA.y*rA.y+iB*rB.y*rB.y,-iA*rA.x*rA.y-iB*rB.x*rB.y,mA+mB+iA*rA.x*rA.x+iB*rB.x*rB.x)
        // Large errors (a chain started longer than its span) close over several steps instead of snapping.
        let impulse = -Self.solve(k,error.length>0.2 ? (0.2/error.length)*error:error)
        if let a=p.bodyA{bodies[a].position-=mA*impulse;bodies[a].angle-=iA*rA.cross(impulse)}
        bodies[b].position+=mB*impulse;bodies[b].angle+=iB*rB.cross(impulse)
        return error.length<=linearSlop
    }

    // MARK: Sleep

    mutating func updateSleep(_ dt:Double) {
        for i in bodies.indices where movable(i) {
            if let limit=escapeY,bodies[i].position.y>limit{bodies[i].escaped=true;bodies[i].velocity = .zero;bodies[i].angularVelocity=0;continue}
            let b=bodies[i]
            if b.velocity.dot(b.velocity)>sleepLinear*sleepLinear || b.angularVelocity*b.angularVelocity>sleepAngular*sleepAngular{bodies[i].sleepTime=0}else{bodies[i].sleepTime+=dt}
        }
        // Islands: bodies joined by touching contacts or pins sleep together.
        var parent=Array(bodies.indices)
        func root(_ i:Int)->Int{var i=i;while parent[i] != i{parent[i]=parent[parent[i]];i=parent[i]};return i}
        func join(_ a:Int,_ b:Int){guard bodies[a].kind == .dynamic,bodies[b].kind == .dynamic else{return};let x=root(a),y=root(b);if x != y{parent[max(x,y)]=min(x,y)}}
        for c in contacts where separations(c).contains(where:{$0<=linearSlop}){join(c.a,c.b)}
        for p in pins{if let a=p.bodyA{join(a,p.bodyB)}}
        var rest:[Int:Double]=[:],live:Set<Int>=[]
        for i in bodies.indices where bodies[i].kind == .dynamic && bodies[i].released && !bodies[i].escaped {
            let r=root(i),t=movable(i) ? bodies[i].sleepTime:Double.infinity
            rest[r]=min(rest[r] ?? .infinity,t);if movable(i){live.insert(r)}
        }
        for i in bodies.indices where movable(i) {
            let r=root(i);guard live.contains(r),(rest[r] ?? 0)>=timeToSleep else{continue}
            bodies[i].awake=false;bodies[i].velocity = .zero;bodies[i].angularVelocity=0
        }
    }
}
