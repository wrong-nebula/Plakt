import Foundation
import CoreGraphics
import CoreText
import PosterCore
extension PosterChecks {
    static func checkPhysics()throws {
        // Engine: a six-box tower and a pinned bar come to rest without sinking; equal inputs give equal results.
        func tower(_ spin:Double)->PhysicsWorld {
            var w=PhysicsWorld()
            w.addBody([PhysicsWorld.box(center:PhysicsVector(0,11),halfWidth:20,halfHeight:1)],kind:.fixed)
            for i in 0..<6{w.addBody([PhysicsWorld.box(center:PhysicsVector(Double(i%2)*0.02,9.5-Double(i)),halfWidth:0.5,halfHeight:0.5)],kind:.dynamic)}
            let bar=w.addBody([PhysicsWorld.box(center:PhysicsVector(-6,2),halfWidth:1.5,halfHeight:0.2)],kind:.dynamic)
            w.bodies[bar].angularVelocity=spin
            w.pins.append(PhysicsPin(bodyA:nil,bodyB:bar,anchorA:PhysicsVector(-7.4,2),anchorB:PhysicsVector(-1.4,0),frictionTorque:4))
            w.settle(dt:1.0/120,limit:12);return w
        }
        let w=tower(0),again=tower(0),spun=tower(3)
        try require(w.isSettled && abs(w.bodies[6].position.y-4.5)<0.15 && w.bodies[1...6].allSatisfy{abs($0.position.x)<0.05 && abs($0.angle)<0.01},"Box tower sank, toppled or never slept")
        try require(zip(w.bodies,again.bodies).allSatisfy{$0.position==$1.position && $0.angle==$1.angle},"Physics replay is not deterministic")
        try require((w.bodies[7].world(PhysicsVector(-1.4,0))-PhysicsVector(-7.4,2)).length<0.01 && abs(w.bodies[7].angle-Double.pi/2)<0.35,"Pinned bar left its pin or did not hang")
        try require(spun.bodies[7].angle != w.bodies[7].angle,"Initial spin ignored")
        // Substeps: a thin plate thrown at 40 m/s stops on a thin shelf instead of passing through it.
        var thrown=PhysicsWorld()
        thrown.addBody([PhysicsWorld.box(center:PhysicsVector(0,5),halfWidth:2,halfHeight:0.05)],kind:.fixed)
        let plate=thrown.addBody([PhysicsWorld.box(center:PhysicsVector(0,-2),halfWidth:0.5,halfHeight:0.05)],kind:.dynamic)
        thrown.bodies[plate].velocity=PhysicsVector(0,40);thrown.settle(limit:4)
        try require(thrown.bodies[plate].position.y<5 && thrown.isSettled,"A fast thin body tunnelled through a thin shelf")

        // Collision outlines: counters and crooks stay open, ink is covered.
        let font=CTFontCreateWithName("Helvetica-Bold" as CFString,100,nil)
        func pieces(_ c:String)->([[PhysicsVector]],CGRect) {
            var g=CGGlyph(0),u=Array(c.utf16);CTFontGetGlyphsForCharacters(font,&u,&g,1)
            var flip=CGAffineTransform(scaleX:0.02,y:-0.02);let path=CTFontCreatePathForGlyph(font,g,nil)!.copy(using:&flip)!
            return (PhysicsOutline.pieces(path),path.boundingBoxOfPath)
        }
        func covered(_ p:[[PhysicsVector]],_ x:Double,_ y:Double)->Bool{p.contains{poly in poly.indices.allSatisfy{(poly[($0+1)%poly.count]-poly[$0]).cross(PhysicsVector(x,y)-poly[$0]) >= -1e-9}}}
        let (o,ob)=pieces("O"),(l,lb)=pieces("L")
        try require(!covered(o,ob.midX,ob.midY) && covered(o,ob.minX+ob.width*0.08,ob.midY),"O counter filled or its stroke missed")
        try require(!covered(l,lb.maxX-lb.width*0.2,lb.minY+lb.height*0.3) && covered(l,lb.minX+lb.width*0.1,lb.midY),"L crook filled or its stem missed")
        try require((o+l).allSatisfy{$0.count<=8 && PhysicsWorld.area($0)>0 && PhysicsWorld.hull($0).count==$0.count},"Collision pieces must be small convex polygons")

        // Specimen: letters fall, rest above the floor inside the walls, and replay exactly.
        let recipe=PosterShapeLibrary.recipe(GravityTypeSystems.recipeID)!
        var p=PosterShapePreset(recipe:recipe,seed:817,parameters:["detach":0.5,"hang":0.25,"strobe":3])
        p.physics=GravityTypeCustomization(title:"LOOSE\nTYPE")
        let scene=try PosterShapeLibrary.scene(p)
        let art=scene.elements.first{$0.shape==GravityTypeSystems.shape}!,g=art.physics!
        try g.validate()
        let moving=g.glyphs.filter{$0.state != "fixed"},hanging=g.glyphs.filter{$0.state=="hanging"}
        try require(g.glyphs.count==9 && moving.count==Int((0.5*9).rounded()) && hanging.count==Int((0.25*Double(moving.count)).rounded()) && hanging.allSatisfy{$0.pin != nil},"Detached and hanging counts do not follow the parameters")
        try require(g.settled && g.time<8,"Specimen never came to rest")
        func box(_ x:PhysicsGlyph)->CGRect {
            let path=CTFontCreatePathForGlyph(FontLibrary.font(name:x.font,variations:x.fontVariations),CGGlyph(x.glyph),nil)!
            let rest=CGAffineTransform(a:x.rest[0],b:x.rest[1],c:x.rest[2],d:x.rest[3],tx:x.rest[4],ty:x.rest[5])
            let t=rest.concatenating(CGAffineTransform(translationX:-x.center[0],y:-x.center[1])).concatenating(CGAffineTransform(rotationAngle:x.pose[2])).concatenating(CGAffineTransform(translationX:x.pose[0],y:x.pose[1]))
            var copy=t;return path.copy(using:&copy)!.boundingBoxOfPath
        }
        let floor=g.floor!
        try require(moving.filter{$0.state=="fallen"}.allSatisfy{let b=box($0);return b.maxY<=floor+0.004 && b.minX >= -0.004 && b.maxX<=1.004},"A fallen letter sank through the floor or a wall")
        try require(moving.filter{$0.state=="fallen"}.contains{box($0).maxY>floor-0.02},"No letter reached the floor")
        try require(moving.filter{$0.state=="fallen"}.allSatisfy{($0.trail?.count ?? 0)==3},"Motion exposures missing")
        let sorted=JSONEncoder();sorted.outputFormatting=[.sortedKeys]
        let encoded=try sorted.encode(scene)
        let repeated=try sorted.encode(PosterShapeLibrary.scene(p))
        try require(encoded==repeated,"Specimen simulation is not repeatable")
        var other=p;other.seed=818
        let reseeded=try sorted.encode(PosterShapeLibrary.scene(other))
        try require(encoded != reseeded,"Seed does not change the fall")
        var more=p;more.parameters["detach"]=0.8
        let wider=try PosterShapeLibrary.scene(more).elements.first{$0.shape==GravityTypeSystems.shape}!.physics!
        try require(Set(moving.map(\.id)).isSubset(of:Set(wider.glyphs.filter{$0.state != "fixed"}.map(\.id))),"Raising detach changed which letters fall")
        func pixels(_ s:StyleGenome,_ stage:ConstructionStage = .finished)throws->Data{Data(try rgba(LibrarySceneRenderer.render(s,width:360,stage:stage)))}
        let first=try pixels(scene),saved=try JSONDecoder().decode(StyleGenome.self,from:encoded)
        let replayed=try pixels(saved)
        try require(first==replayed,"Saved poses replay differently")
        let stages=try ConstructionStage.allCases.map{try pixels(saved,$0)}
        try require(Set(stages).count==4,"Physics construction stages collapsed")
        var caught=p;caught.parameters["time"]=0.45
        let mid=try PosterShapeLibrary.scene(caught).elements.first{$0.shape==GravityTypeSystems.shape}!.physics!
        try require(!mid.settled && abs(mid.time-0.45)<0.01 && mid.glyphs.contains{$0.state=="fallen" && abs($0.pose[1]-$0.center[1])>0.01},"Moment control does not freeze letters mid-fall")
        var still=p;still.parameters["time"]=0
        let stillScene=try PosterShapeLibrary.scene(still)
        try require(stillScene.elements.first{$0.shape==GravityTypeSystems.shape}!.physics!.glyphs.allSatisfy{$0.pose[0]==$0.center[0] && $0.pose[1]==$0.center[1] && $0.pose[2]==0},"Time zero moved letters")
        var broken=saved;let index=broken.elements.firstIndex{$0.shape==GravityTypeSystems.shape}!
        broken.elements[index].physics?.glyphs[0].pose=[Double.nan,0,0]
        try require(rejected{_ = try LibrarySceneRenderer.render(broken,width:300)},"Non-finite pose accepted")

        // Recipe in a poster field follows the brief title.
        var copy=saved;copy.posterCopy?.title="NEW WORDS"
        PosterShapeLibrary.resolveSurveyContent(in:&copy)
        try require(copy.elements[index].physics?.text=="LOOSE\nTYPE","Explicit falling title was replaced by the brief")
        var briefed=saved;briefed.elements[index].physics?.titleOverride=nil;briefed.posterCopy?.title="NEW WORDS"
        PosterShapeLibrary.resolveSurveyContent(in:&briefed)
        try require(briefed.elements[index].physics?.text=="NEW WORDS" && briefed.elements[index].physics!.glyphs.count==8,"Falling title ignores the brief")
        let field=UnitBox(x:0.1,y:0.45,width:0.8,height:0.45)
        let choice=PosterShapeLibrary.choose(seed:9,profile:nil,field:field,posterAspect:1.4,category:"kinetic",textDensity:0.2,preset:PosterShapePreset(recipe:recipe,seed:9))!
        var inPoster=saved;inPoster.elements=[PosterShapeLibrary.element(choice,field:field,color:"#202020",seed:9)];inPoster.posterCopy?.title="FIELD"
        PosterShapeLibrary.resolveSurveyContent(in:&inPoster)
        let fieldGenome=inPoster.elements[0].physics!
        let fieldPixels=try pixels(inPoster)
        try require(fieldGenome.text=="FIELD" && abs(fieldGenome.aspect-0.45*inPoster.aspect/0.8)<1e-9 && !fieldPixels.isEmpty,"Image-area falling letters not fitted to their field")

        // Arrangements: each comes to rest inside the page above the floor and keeps its own construction.
        for (index,name) in GravityTypeSystems.arrangements.enumerated() {
            var q=PosterShapePreset(recipe:recipe,seed:817,parameters:["arrangement":Double(index),"detach":name=="garland" ? 0.2:0.5,"hang":0.3])
            q.physics=GravityTypeCustomization(title:"LOOSE\nTYPE")
            let made=try PosterShapeLibrary.scene(q),world=made.elements.first{$0.shape==GravityTypeSystems.shape}!.physics!
            try world.validate()
            try require(world.settled,"\(name) never came to rest")
            try require(world.glyphs.allSatisfy{let b=box($0);return b.minX >= -0.01 && b.maxX<=1.01 && b.maxY<=world.floor!+0.006},"\(name): a letter left the page or sank through the floor")
            switch name {
            case "pour":try require(world.glyphs.allSatisfy{$0.state=="fallen" && $0.center[1]<0 && box($0).minY>0},"Pour did not start above the page and land on it")
            case "sign":try require(world.nails?.count==2*world.glyphs.count && world.glyphs.filter{$0.state=="hanging"}.allSatisfy{g in world.nails!.contains{hypot($0[0]-g.pin![0],$0[1]-g.pin![1])<1e-9}},"Sign nails missing or hanging letters off their nail")
            case "stairs":try require(world.fixtures?.filter{$0.role=="shelf"}.count==4,"Stairs need one shelf per step")
            case "garland":
                // Linked neighbours still share their ring after the chain has settled.
                for (i,g) in world.glyphs.enumerated() {for r in g.rivets ?? [] {
                    let next=world.glyphs[i+1],here=CGPoint(x:r[0],y:r[1])
                    func moved(_ x:PhysicsGlyph)->CGPoint{here.applying(CGAffineTransform(translationX:-x.center[0],y:-x.center[1]).concatenating(CGAffineTransform(rotationAngle:x.pose[2])).concatenating(CGAffineTransform(translationX:x.pose[0],y:x.pose[1])))}
                    let a=moved(g),b=moved(next)
                    try require(hypot(a.x-b.x,a.y-b.y)<0.003,"Garland ring pulled apart")
                }}
                try require(world.glyphs.allSatisfy{abs($0.rest[5]-world.glyphs[0].rest[5])<1e-9},"A garland title must be set on one line")
                try require(world.nails?.count==2 && world.glyphs.contains{($0.rivets ?? []).count>0} && world.glyphs.contains{$0.state=="hanging" && $0.pose[1]>$0.center[1]+0.02},"Garland has no linked, sagging chain")
            case "balance":try require(Set(world.fixtures?.map(\.role) ?? [])==["beam","pivot"] && world.nails?.count==1+world.glyphs.filter{$0.state=="hanging"}.count,"Balance needs a beam on a pivot")
            default:break
            }
        }
        // Glass letters: hard landings break into shards that cover the whole glyph, stay in the page and replay exactly.
        var glassy=p;glassy.parameters=["shatter":1,"detach":0.6]
        let shattered=try PosterShapeLibrary.scene(glassy),glass=shattered.elements.first{$0.shape==GravityTypeSystems.shape}!.physics!
        try glass.validate()
        let cracked=glass.glyphs.filter{$0.shards != nil}
        try require(!cracked.isEmpty && glass.settled,"No glass letter broke on landing, or the shards never came to rest")
        func inside(_ cell:[[Double]],_ q:CGPoint)->Bool {
            let signs=cell.indices.map{k->Double in let a=cell[k],b=cell[(k+1)%cell.count];return (b[0]-a[0])*(q.y-a[1])-(b[1]-a[1])*(q.x-a[0])}
            return signs.allSatisfy{$0 >= -1e-12} || signs.allSatisfy{$0<=1e-12}
        }
        for x in cracked {
            let shards=x.shards!,path=CTFontCreatePathForGlyph(FontLibrary.font(name:x.font,variations:x.fontVariations),CGGlyph(x.glyph),nil)!
            var rest=CGAffineTransform(a:x.rest[0],b:x.rest[1],c:x.rest[2],d:x.rest[3],tx:x.rest[4],ty:x.rest[5])
            let ink=path.copy(using:&rest)!.boundingBoxOfPath,cells=shards.flatMap{$0.cells}
            try require(shards.count>=2,"A break left a single piece")
            try require([CGPoint(x:ink.minX,y:ink.minY),CGPoint(x:ink.maxX,y:ink.minY),CGPoint(x:ink.maxX,y:ink.maxY),CGPoint(x:ink.minX,y:ink.maxY),CGPoint(x:ink.midX,y:ink.midY)].allSatisfy{q in cells.contains{inside($0,q)}},"Shard cells leave part of a glyph undrawn")
            try require(shards.allSatisfy{$0.pose[0]>0 && $0.pose[0]<1 && $0.pose[1]<glass.floor!},"A shard left the page")
        }
        let glassJSON=try sorted.encode(shattered),glassAgain=try sorted.encode(PosterShapeLibrary.scene(glassy))
        try require(glassJSON==glassAgain,"Glass letters broke differently on a second run")
        let glassPixels=try pixels(shattered),glassReplay=try pixels(JSONDecoder().decode(StyleGenome.self,from:glassJSON))
        try require(glassPixels==glassReplay,"Saved shards replay differently")
        var tough=glassy;tough.parameters["toughness"]=16
        let toughWorld=try PosterShapeLibrary.scene(tough).elements.first{$0.shape==GravityTypeSystems.shape}!.physics!
        try require(toughWorld.glyphs.filter{$0.shards != nil}.count<=cracked.count,"Tougher letters broke more often")

        var looks:[Data]=[]
        for look in 0...3{var q=p;q.parameters["look"]=Double(look);looks.append(try pixels(PosterShapeLibrary.scene(q)))}
        try require(Set(looks).count==4,"Looks do not change the drawing")

        // Any poster: loosen type, keep its exact placement until it moves, and restore it.
        func text(_ id:String,_ value:String,_ box:String,rotation:Double,extra:String)->String{##"{"sourceElementID":"\##(id)","kind":"text","bounds":\##(box),"rotation":\##(rotation),"text":"\##(value)","color":"#151515","shape":"rectangle","outline":false,"shadow":false,"offsetX":0,"offsetY":0,"copies":1\##(extra)}"##}
        let elements=[text("title","GRAVITY",#"{"x":0.08,"y":0.08,"width":0.84,"height":0.16}"#,rotation:-4,extra:#","preserveTypeProportions":true,"fontName":"HelveticaNeue-Bold","textAlignment":"center","zIndex":5"#),
                      text("info","Supporting information",#"{"x":0.08,"y":0.6,"width":0.5,"height":0.04}"#,rotation:0,extra:#","preserveTypeProportions":true"#),
                      text("stretched","WIDE",#"{"x":0.1,"y":0.3,"width":0.6,"height":0.18}"#,rotation:7,extra:#","fontName":"HelveticaNeue-Bold","tracking":4"#)]
        let plain=try JSONDecoder().decode(StyleGenome.self,from:Data(##"{"version":"layout-genome-v1","posterID":"physics-check","aspect":1.4,"background":"#f2f0ea","font":"HelveticaNeue-Bold","textScale":1,"tracking":0,"fittingStatus":"check","sourceEmbeddingModel":"check","elements":[\##(elements.joined(separator:","))]}"##.utf8))
        for target in ["title","stretched"] {
            var only=plain;only.elements=only.elements.filter{$0.sourceElementID==target}
            var loose=only;try GravityTypeSystems.loosen(&loose,targetIDs:[target],parameters:["detach":0],seed:4)
            let a=try rgba(LibrarySceneRenderer.render(only,width:500)),b=try rgba(LibrarySceneRenderer.render(loose,width:500))
            let differing=zip(a,b).filter{abs(Int($0)-Int($1))>48}.count
            try require(differing<a.count/400,"Loosened \(target) is not drawn where the renderer placed it (\(differing) bytes differ)")
        }
        var loose=plain;try GravityTypeSystems.loosen(&loose,parameters:["detach":0.6,"hang":0],seed:4,accent:"#ff4a1c")
        let made=loose.elements.first{$0.shape==GravityTypeSystems.shape}!
        try require(loose.elements.count==3 && made.physics?.sources?.first?.sourceElementID=="title" && made.zIndex==5 && made.physics!.glyphs.filter{$0.state != "fixed"}.count==4,"Loosen did not replace exactly the title")
        try require(made.physics!.obstacleIDs==["info","stretched"] && made.physics!.settled,"Other text was not an obstacle, or the fall never ended")
        var restored=loose;GravityTypeSystems.restore(&restored)
        let restoredJSON=try sorted.encode(restored.elements),plainJSON=try sorted.encode(plain.elements)
        try require(restoredJSON==plainJSON,"Restore did not return the original text elements")
        try require(rejected{var s=plain;try GravityTypeSystems.loosen(&s,targetIDs:["missing"],seed:1)},"Unknown loosen target accepted")
        // With shapesCollide, a shape under the title catches every falling letter.
        var shelf=try JSONDecoder().decode(SceneElement.self,from:Data(##"{"sourceElementID":"block","kind":"shape","bounds":{"x":0.02,"y":0.62,"width":0.96,"height":0.08},"rotation":0,"color":"#151515","shape":"rectangle","outline":false,"shadow":false,"offsetX":0,"offsetY":0,"copies":1}"##.utf8))
        shelf.zIndex=0
        var blocked=plain;blocked.elements.append(shelf)
        try GravityTypeSystems.loosen(&blocked,targetIDs:["title"],parameters:["detach":1,"collapse":0],seed:4,shapesCollide:true)
        let landed=blocked.elements.first{$0.shape==GravityTypeSystems.shape}!.physics!
        try require(landed.obstacleIDs?.contains("block")==true && landed.glyphs.allSatisfy{box($0).maxY<=0.62*1.4+0.006},"Letters fell through a solid shape")
        print("PASS: rigid-body tower/pin rest and replay, anti-tunnelling substeps, six arrangements at rest (pour, sign nails, stairs, garland rings, balance), glass letters (complete shards, in the page, exact replay, toughness), four looks, glyph collision counters, specimen falls/hangs/rests above the floor, monotone detach, exact pose replay, four stages, mid-fall moment, invalid pose rejection, brief and field resolution, renderer-exact loosening (proportional and stretched), restore, shapes as obstacles")
    }
}
