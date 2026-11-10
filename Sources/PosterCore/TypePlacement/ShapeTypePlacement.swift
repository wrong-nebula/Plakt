import Foundation
import CoreGraphics

/// Moves type into the places a shape system defines (or leaves it free) and declares overlap contrast.
public enum ShapeTypePlacement {
    public static func apply(to scene:inout StyleGenome,settings:TypePlacementSettings)throws {
        try arrange(&scene,settings:settings);try declareContrast(&scene,settings:settings)
    }

    static func isPlainText(_ e:SceneElement)->Bool {
        e.kind=="text" && PosterShapeLibrary.recipeID(e)==nil && !SurveyTypeGeometry.shapes.contains(e.shape) && e.shape != ContourSystems.typeShape && e.paperAttachment==nil && !(e.text ?? "").isEmpty
    }
    static func isSystem(_ e:SceneElement)->Bool{PosterShapeLibrary.recipeID(e) != nil && e.geometry?["dominantDepth"] != 1}
    static func z(_ e:SceneElement)->Int{e.zIndex ?? (e.kind=="text" ? 100:0)}
    /// Axis-aligned canvas box of an element after its rotation, limited to its clip.
    static func footprint(_ e:SceneElement,aspect:Double)->UnitBox {
        let b=e.bounds,a=e.rotation * .pi/180,w=b.width,h=b.height*aspect
        let ex=abs(w*cos(a))+abs(h*sin(a)),ey=(abs(w*sin(a))+abs(h*cos(a)))/aspect
        var box=CGRect(x:b.x+b.width/2-ex/2,y:b.y+b.height/2-ey/2,width:ex,height:ey)
        if let clip=e.clipBounds{box=box.intersection(clip.rect)}
        box=box.intersection(CGRect(x:0,y:0,width:1,height:1))
        return box.isNull ? UnitBox(x:0,y:0,width:0,height:0):UnitBox(x:box.minX,y:box.minY,width:box.width,height:box.height)
    }

    struct Metrics {var width:Double;var height:Double;var top:Double;var bottom:Double}
    /// Ink bounds at the renderer's 100-unit font size; top and bottom are measured from the baseline, y up.
    static func metrics(_ e:SceneElement,_ string:String,scene:StyleGenome)->Metrics? {
        let b=LibrarySceneRenderer.textPath(e,string:string,genome:scene).boundingBoxOfPath
        guard b.width>0,b.height>0,b.width.isFinite else{return nil}
        return Metrics(width:b.width,height:b.height,top:b.maxY,bottom:b.minY)
    }
    struct Line {var text:String;var metrics:Metrics;var template:Int}
    struct Placed {var line:Line;var bounds:UnitBox;var em:Double}
    /// One em size for every line; baselines advance by `leading` em, with extra space before each field break.
    static func stack(_ lines:[Line],in a:TypeAnchor,leading:Double,breaks:Set<Int>,em range:ClosedRange<Double>,aspect:Double)->[Placed]? {
        guard !lines.isEmpty else{return nil}
        var baselines:[Double]=[],y=0.0
        for i in lines.indices{if i>0{y+=leading+(breaks.contains(i) ? 0.45:0)};baselines.append(y)}
        let top=baselines[0]-lines[0].metrics.top/100,extent=baselines[lines.count-1]-lines[lines.count-1].metrics.bottom/100-top
        let widest=lines.map{$0.metrics.width}.max()!/100
        let em=min(range.upperBound,a.length*0.97/widest,a.thickness*0.97/max(0.0001,extent))
        guard em>=range.lowerBound else{return nil}
        let start=a.vertical=="top" ? -a.thickness/2:a.vertical=="bottom" ? a.thickness/2-extent*em:-extent*em/2
        return lines.indices.map{i in
            let line=lines[i],w=line.metrics.width/100*em,h=line.metrics.height/100*em
            let t=start+(baselines[i]-line.metrics.top/100-top)*em+h/2
            let s=a.alignment=="right" ? a.length/2-w/2:a.alignment=="center" ? 0:-a.length/2+w/2
            let c=a.point(s,t,aspect:aspect)
            return Placed(line:line,bounds:UnitBox(x:c.x-w/2,y:(c.y-h/2)/aspect,width:w,height:h/aspect),em:em)
        }
    }
    static func roleFit(_ block:String,_ anchor:String)->Double {
        if anchor=="any"{return 0.85}
        switch (block,anchor) {
        case ("title","title"),("display","display"),("info","info"):return 1
        case ("display","title"):return 0.75
        case ("title","display"):return 0.7
        case ("info","display"):return 0.6
        case ("display","info"):return 0.35
        default:return 0
        }
    }
    static func emRange(_ role:String,aspect:Double)->ClosedRange<Double> {
        switch role {case "title":return 0.045*aspect...0.42*aspect;case "display":return 0.022*aspect...0.2*aspect;default:return 0.0105*aspect...0.0155*aspect}
    }
    static func score(_ role:String,_ anchor:TypeAnchor,placed:[Placed],aspect:Double)->Double {
        guard let em=placed.first?.em else{return 0}
        let h=em/aspect,size=role=="title" ? min(1,h/0.14):role=="display" ? min(1,h/0.07):min(1,h/0.0155)
        let fill=role=="info" ? 1:min(1,placed.map{$0.bounds.width}.max()!/max(0.0001,anchor.length))
        // Small information set sideways is hard to read; slight tilts that follow a rotated system are fine.
        let turned=abs(anchor.rotation.truncatingRemainder(dividingBy:180))
        let sideways=role=="info" && min(turned,180-turned)>20 ? 0.6:1
        return roleFit(role,anchor.role)*sideways*(0.6*size+0.25*fill+(role=="info" && anchor.onShape ? 0:0.15))
    }
    /// Balanced line breaks that minimize the widest line.
    static func wraps(_ text:String,maxLines:Int,measure:(String)->Double?)->[[String]] {
        let words=text.split(separator:" ").map(String.init)
        let limit=min(maxLines,words.count,4)
        guard limit>=2 else{return [[text]]}
        var options:[[String]]=[[text]]
        for k in 2...limit {
            var best:[String]?,widest=Double.infinity
            func split(_ from:Int,_ left:Int,_ lines:[String]) {
                if left==1 {
                    let all=lines+[words[from...].joined(separator:" ")],w=all.compactMap(measure).max() ?? .infinity
                    if w<widest{widest=w;best=all};return
                }
                guard from+left<=words.count else{return}
                for end in (from+1)...(words.count-left+1){split(end,left-1,lines+[words[from..<end].joined(separator:" ")])}
            }
            if words.count<=12{split(0,k,[])}
            if let best{options.append(best)}
        }
        return options
    }

    struct Block {var role:String;var members:[Int];var kind:String;var key:String;var area:Double}
    static func field(_ id:String)->String {
        let parts=id.split(separator:":").map(String.init)
        if id.hasPrefix("meta:source-info:"),parts.count>=4{return parts[2]}
        if id.hasPrefix("title:source-info"){return "title"}
        return id
    }
    static func key(_ text:String)->String{String(text.uppercased().filter{$0.isLetter || $0.isNumber})}

    public static func arrange(_ scene:inout StyleGenome,settings:TypePlacementSettings)throws {
        try settings.validate()
        scene.typePlacement=settings
        for i in scene.elements.indices where scene.elements[i].typeAnchorID != nil{scene.elements[i].typeAnchorID=nil}
        let aspect=scene.aspect,elements=scene.elements
        let systems=elements.filter(isSystem)
        guard !systems.isEmpty else{scene.typeAnchors=[];return}
        let systemZ=systems.map(z).max() ?? 0
        // Blocks: information stays together, type-system outputs move rigidly, other text moves line by line.
        var blocks:[Block]=[],claimed:Set<Int>=[]
        let texts=elements.indices.filter{isPlainText(elements[$0])}
        func area(_ members:[Int])->Double{members.reduce(0){$0+footprint(elements[$1],aspect:aspect).area}}
        let source=texts.filter{elements[$0].sourceElementID.contains("source-info")},meta=texts.filter{elements[$0].sourceElementID.hasPrefix("meta:") && !source.contains($0)}
        for members in [source,meta] where !members.isEmpty {blocks.append(Block(role:"info",members:members,kind:"fields",key:"",area:area(members)));claimed.formUnion(members)}
        for (_,members) in Dictionary(grouping:texts.filter{!claimed.contains($0) && elements[$0].typeSystemID != nil},by:{elements[$0].typeSystemID!}).sorted(by:{$0.key<$1.key}) {
            blocks.append(Block(role:"display",members:members,kind:"rigid",key:"",area:area(members)));claimed.formUnion(members)
        }
        for i in texts where !claimed.contains(i){blocks.append(Block(role:"display",members:[i],kind:"line",key:key(elements[i].text ?? ""),area:area([i])))}
        let lines=blocks.indices.filter{blocks[$0].kind=="line"}
        let named=lines.filter{elements[blocks[$0].members[0]].sourceElementID.hasPrefix("title:")}
        if let title=(named.isEmpty ? lines:named).max(by:{blocks[$0].area<blocks[$1].area}){blocks[title].role="title"}
        let candidates:[Int]
        switch settings.mode {
        case "anchored":candidates=Array(blocks.indices)
        case "mixed":candidates=blocks.indices.filter{blocks[$0].role != "display"}
        default:candidates=[]
        }
        // A block with no anchor stays where it was. Later passes treat it as a fixed obstacle, so nothing
        // placed earlier in the same pass can land on it.
        var stuck:Set<Int>=[],result:(replacements:[Int:[SceneElement]],anchoredInfo:Bool)=([:],false)
        for pass in 0..<3 {
            let moving=candidates.filter{!stuck.contains($0)}
            let still=blocks.indices.filter{!moving.contains($0)}.flatMap{blocks[$0].members}.map{elements[$0]}
            var available=try TypeAnchors.compute(scene,systems:systems,obstacles:still)
            scene.typeAnchors=available
            guard !moving.isEmpty else{return}

            // Spatial type systems (portal walls, module fields) and material systems set in the title already carry their words.
            var replacements:[Int:[SceneElement]]=[:],placedBoxes:[UnitBox]=[],anchoredInfo=false,failed:[Int]=[]
            var placedKeys=Set(elements.filter{!isPlainText($0) && PosterShapeLibrary.recipeID($0) != nil && $0.text != nil}.map{key($0.text ?? "")}.filter{!$0.isEmpty})
            for b in stuck where blocks[b].role != "info"{placedKeys.insert(blocks[b].key)}
            let order=moving.sorted{a,b in
                let rank=["title":0,"info":1,"display":2]
                let x=rank[blocks[a].role]!,y=rank[blocks[b].role]!
                return x==y ? (blocks[a].area==blocks[b].area ? a<b:blocks[a].area>blocks[b].area):x<y
            }
            func prepared(_ index:Int,anchor:TypeAnchor)->SceneElement {
                var e=elements[index];e.typeAnchorID=anchor.id;e.zIndex=max(z(e),systemZ+1)
                if ["source-block-fit","source-uniform-fit","protected-info"].contains(e.textTreatment ?? ""){e.textTreatment="anchor-fit"}
                return e
            }
            func lineElements(_ placed:[Placed],anchor:TypeAnchor)->[Int:[SceneElement]] {
                var out:[Int:[SceneElement]]=[:]
                for (i,item) in placed.enumerated() {
                    var e=prepared(item.line.template,anchor:anchor)
                    if out[item.line.template] != nil{e.sourceElementID += ":line-\(i)"}
                    e.text=item.line.text;e.bounds=item.bounds;e.rotation=anchor.rotation;e.typeEmSize=item.em/aspect
                    // A line turned into a tall anchor keeps its unturned box, which can leave the page while its ink does not.
                    if !e.bounds.valid{e.allowsBleed=true}
                    e.preserveTypeProportions=true;e.textAlignment="left";e.clipBounds=nil
                    out[item.line.template,default:[]].append(e)
                }
                return out
            }
            func consume(_ used:[TypeAnchor],content:[UnitBox]) {
                let ids=Set(used.map(\.id))
                available.removeAll{a in ids.contains(a.id) || content.contains{TypeAnchors.intersection($0,a.footprint(aspect:aspect))>0.05}}
                placedBoxes += content
            }
            // In anchored mode, echoes of words that already have an anchor are dropped instead of stacking around them.
            func echo(_ block:Block)->Bool{settings.mode=="anchored" && block.kind=="line" && block.role != "title" && !block.key.isEmpty && placedKeys.contains{$0.contains(block.key)}}
            for b in order {
                let block=blocks[b]
                if echo(block){for i in block.members{replacements[i]=[]};continue}
                var best:(score:Double,anchors:[TypeAnchor],elements:[Int:[SceneElement]],boxes:[UnitBox])?
                func offer(_ value:Double,_ anchors:[TypeAnchor],_ out:[Int:[SceneElement]],_ boxes:[UnitBox]){if value>(best?.score ?? 0.2){best=(value,anchors,out,boxes)}}
                switch block.kind {
                case "line":
                    let index=block.members[0],e=elements[index],text=e.text ?? ""
                    var cache:[String:Metrics]=[:]
                    func measure(_ s:String)->Metrics?{if let m=cache[s]{return m};let m=metrics(e,s,scene:scene);cache[s]=m;return m}
                    let options=wraps(text,maxLines:block.role=="title" ? 4:2,measure:{measure($0)?.width})
                    for anchor in available where roleFit(block.role,anchor.role)>0 {
                        for option in options {
                            let lines=option.compactMap{s in measure(s).map{Line(text:s,metrics:$0,template:index)}}
                            guard lines.count==option.count,let placed=stack(lines,in:anchor,leading:0.94,breaks:[],em:emRange(block.role,aspect:aspect),aspect:aspect) else{continue}
                            // Prefer fewer lines unless wrapping buys clearly larger type.
                            offer(score(block.role,anchor,placed:placed,aspect:aspect)-Double(option.count-1)*0.03,[anchor],lineElements(placed,anchor:anchor),placed.map(\.bounds))
                        }
                    }
                case "fields":
                    let members=block.members.sorted{elements[$0].bounds.y==elements[$1].bounds.y ? elements[$0].bounds.x<elements[$1].bounds.x:elements[$0].bounds.y<elements[$1].bounds.y}
                    let lines=members.compactMap{i in metrics(elements[i],elements[i].text ?? "",scene:scene).map{Line(text:elements[i].text ?? "",metrics:$0,template:i)}}
                    var breaks:Set<Int>=[]
                    for i in lines.indices.dropFirst() where field(elements[lines[i].template].sourceElementID) != field(elements[lines[i-1].template].sourceElementID){breaks.insert(i)}
                    let range=emRange("info",aspect:aspect)
                    for anchor in available where roleFit("info",anchor.role)>0 {
                        guard let placed=stack(lines,in:anchor,leading:1.22,breaks:breaks,em:range,aspect:aspect) else{continue}
                        offer(score("info",anchor,placed:placed,aspect:aspect),[anchor],lineElements(placed,anchor:anchor),placed.map(\.bounds))
                    }
                    // Or one field per anchor along a rule group, the way the orb's slices carry information.
                    var fields:[[Int]]=[]
                    for i in members{if let last=fields.last?.last,field(elements[last].sourceElementID)==field(elements[i].sourceElementID){fields[fields.count-1].append(i)}else{fields.append([i])}}
                    for (_,group) in Dictionary(grouping:available.filter{$0.group != nil},by:{$0.group!}).sorted(by:{$0.key<$1.key}) where group.count>=fields.count {
                        let slots=group.sorted{abs($0.y-$1.y)>0.004 ? $0.y<$1.y:$0.x<$1.x}.prefix(fields.count)
                        var placed:[Placed]=[],ok=true
                        let merged=fields.map{f in f.map{elements[$0].text ?? ""}.joined(separator:" ")}
                        let measured=zip(fields,merged).map{f,s in metrics(elements[f[0]],s,scene:scene).map{Line(text:s,metrics:$0,template:f[0])}}
                        let em=min(range.upperBound,zip(measured,slots).map{m,a->Double in guard let m else{return 0};return min(a.length*0.97/(m.metrics.width/100),a.thickness*0.97/(m.metrics.height/100))}.min() ?? 0)
                        guard em>=range.lowerBound else{continue}
                        for (m,a) in zip(measured,slots) {guard let m,let p=stack([m],in:a,leading:1,breaks:[],em:em*0.999...em,aspect:aspect) else{ok=false;break};placed += p}
                        guard ok else{continue}
                        var out:[Int:[SceneElement]]=[:]
                        for (f,(p,a)) in zip(fields,zip(placed,slots)) {
                            out.merge(lineElements([p],anchor:a)){$1}
                            for i in f.dropFirst(){out[i]=[]}
                        }
                        offer(score("info",slots.first!,placed:placed,aspect:aspect)+0.02,Array(slots),out,placed.map(\.bounds))
                    }
                default:
                    let boxes=block.members.map{footprint(elements[$0],aspect:aspect)}
                    let u=boxes.dropFirst().reduce(boxes[0].rect){$0.union($1.rect)},w=u.width,h=u.height*aspect
                    guard w>0,h>0 else{break}
                    for anchor in available where roleFit("display",anchor.role)>0 && abs(anchor.rotation)<0.5 {
                        let s=min(2.5,anchor.length*0.97/w,anchor.thickness*0.97/h)
                        guard s>=0.6 else{continue}
                        let ox=anchor.alignment=="right" ? anchor.x+anchor.length/2-w*s:anchor.alignment=="center" ? anchor.x-w*s/2:anchor.x-anchor.length/2
                        let top=anchor.y*aspect-anchor.thickness/2,oy=(anchor.vertical=="top" ? top:anchor.vertical=="bottom" ? top+anchor.thickness-h*s:anchor.y*aspect-h*s/2)/aspect
                        var out:[Int:[SceneElement]]=[:]
                        for i in block.members {
                            var e=prepared(i,anchor:anchor),bounds=e.bounds
                            bounds.x=ox+(bounds.x-u.minX)*s;bounds.y=oy+(bounds.y-u.minY)*s;bounds.width*=s;bounds.height*=s
                            e.bounds=bounds;e.typeEmSize=e.typeEmSize.map{$0*s};e.clipBounds=nil;out[i]=[e]
                        }
                        offer(roleFit("display",anchor.role)*(0.6*min(1,s)+0.4*min(1,w*s/anchor.length)),[anchor],out,[UnitBox(x:ox,y:oy,width:w*s,height:h*s/aspect)])
                    }
                }
                guard let best else{
                    // Unplaced type stays where it was: later blocks must avoid it, and its words are already on the poster.
                    consume([],content:block.members.map{footprint(elements[$0],aspect:aspect)})
                    if block.role != "info"{placedKeys.insert(block.key)}
                    failed.append(b);continue
                }
                for (i,list) in best.elements{replacements[i]=list}
                consume(best.anchors,content:best.boxes)
                if block.role != "info"{placedKeys.insert(block.key)}
                if block.members.contains(where:{elements[$0].sourceElementID.contains("source-info")}){anchoredInfo=true}
            }
            result=(replacements,anchoredInfo)
            if failed.isEmpty || pass==2{break}
            stuck.formUnion(failed)
        }
        var next:[SceneElement]=[]
        for (i,e) in elements.enumerated() {
            if result.anchoredInfo && e.sourceElementID=="art:information-paper"{continue}
            next += result.replacements[i] ?? [e]
        }
        scene.elements=next
    }

    static func linear(_ hex:String)->Double {
        let v=Int(hex.dropFirst(),radix:16) ?? 0
        let rgb=[(v>>16)&255,(v>>8)&255,v&255].map{c->Double in let x=Double(c)/255;return x<0.04045 ? x/12.92:pow((x+0.055)/1.055,2.4)}
        return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722
    }
    public static func contrastRatio(_ a:String,_ b:String)->Double{let x=linear(a),y=linear(b);return (max(x,y)+0.05)/(min(x,y)+0.05)}
    static func contrastTarget(_ e:SceneElement,_ scene:StyleGenome)->Bool {
        if e.sourceElementID=="art:information-paper" || e.kind=="image" || e.kind=="unresolved-region"{return false}
        if e.kind=="shape"{return e.color.lowercased() != scene.background.lowercased()}
        return PosterShapeLibrary.recipeID(e) != nil
    }
    /// Inks that fill area. The orb's second ink only draws lines and glow; inverted, its darker ink is the volume.
    static func areaInks(_ shape:SceneElement)->[String] {
        guard PosterShapeLibrary.recipeID(shape)=="survey-sliced-orb" else{return [shape.color]+(shape.inks ?? [])}
        guard (shape.geometry?["invert"] ?? 0)>=0.5,let second=shape.inks?.first else{return [shape.color]}
        return [LibrarySceneRenderer.luminance(shape.color)<=LibrarySceneRenderer.luminance(second) ? shape.color:second]
    }
    /// Type that crosses ink of a similar color is redrawn, inside that ink only, in the nearest palette color that reads there.
    public static func declareContrast(_ scene:inout StyleGenome,settings:TypePlacementSettings)throws {
        try settings.validate()
        for i in scene.elements.indices{scene.elements[i].overlapContrast=nil}
        guard settings.contrast != "off" else{return}
        let aspect=scene.aspect,elements=scene.elements
        let order=elements.indices.sorted{a,b in let x=z(elements[a]),y=z(elements[b]);return x==y ? a<b:x<y}
        var rank:[Int:Int]=[:];for (n,i) in order.enumerated(){rank[i]=n}
        let shapes=elements.indices.filter{contrastTarget(elements[$0],scene)}
        // The poster's own inks first; near-black and paper only when none of them reads.
        let palette=[scene.background]+Array(Set(elements.filter(isPlainText).map(\.color)+shapes.flatMap{areaInks(elements[$0])})).sorted()
        let fallback=["#111111","#f6f2e8"]
        for i in elements.indices where isPlainText(elements[i]) {
            let text=elements[i],box=footprint(text,aspect:aspect)
            guard box.area>0 else{continue}
            var ids:[String]=[],colors:[String]=[],front=false
            for j in shapes {
                let shape=elements[j]
                let shapeInks=areaInks(shape)
                guard TypeAnchors.intersection(box,footprint(shape,aspect:aspect))>0,shapeInks.contains(where:{contrastRatio(text.color,$0)<3}) else{continue}
                let above=rank[j]!>rank[i]!
                if above && settings.contrast != "interlock"{continue}
                ids.append(shape.sourceElementID);colors += shapeInks;front=front || above
            }
            guard !ids.isEmpty else{continue}
            // Paper if it reads; else the palette ink nearest the type's own color that reads on every crossed ink;
            // else whatever reads best.
            let ink=InkRules.worstRatio(scene.background,on:colors)>=3 ? scene.background
                :InkRules.closest(text.color,in:palette,readableOn:colors,ratio:3)
                ?? InkRules.bestContrastWith(colors,in:palette+fallback)!
            scene.elements[i].overlapContrast=OverlapContrast(ink:ink,shapeIDs:Array(Set(ids)).sorted(),layer:front ? "top":"inline")
        }
    }

    /// The rendered poster with every anchor outlined: solid when type occupies it, dashed when open.
    public static func anchorOverlay(_ scene:StyleGenome,width:Int=900)throws->CGImage {
        let image=try LibrarySceneRenderer.render(scene,width:width)
        guard let ctx=CGContext(data:nil,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
        ctx.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
        let px=1/Double(image.width),used=Set(scene.elements.compactMap(\.typeAnchorID))
        ctx.translateBy(x:0,y:Double(image.height));ctx.scaleBy(x:Double(image.width),y:-Double(image.width))
        for anchor in scene.typeAnchors ?? [] {
            let color=anchor.role=="title" ? "#e5007e":anchor.role=="display" ? "#0a6cff":anchor.role=="info" ? "#00a35c":"#8c8c8c",taken=used.contains(anchor.id)
            ctx.setStrokeColor(LibrarySceneRenderer.color(color));ctx.setFillColor(LibrarySceneRenderer.color(color))
            ctx.setLineWidth((taken ? 2.6:1.3)*px);ctx.setLineDash(phase:0,lengths:taken ? []:[7*px,4*px])
            let c=anchor.corners(aspect:scene.aspect)
            ctx.beginPath();ctx.addLines(between:c);ctx.closePath();ctx.strokePath()
            let start=anchor.point(-anchor.length/2,0,aspect:scene.aspect)
            ctx.fillEllipse(in:CGRect(x:start.x-3*px,y:start.y-3*px,width:6*px,height:6*px))
        }
        guard let out=ctx.makeImage() else{throw PosterError.render};return out
    }
}
