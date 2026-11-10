import Foundation
import CoreText

/// A source observation is a proposal, never a manual border confirmation or a style label.
public struct LayoutInheritance:Codable,Sendable {
    public var version="source-composition-dna-v1"
    public var skeletonPosterID:String
    public var donorPosterIDs:[String]
    public var sourceImages:[URL]
    public var operations:[String]
    public var retainedAnchorCount:Int
    public var transferredAnchorCount:Int
    public var informationBounds:UnitBox
    public var note="OCR supplies observed type placement and rotation, not original font files or designer layers. Source borders retain their existing review status. Display distortion/bleed is intentional; supporting copy uses natural glyph proportions."
}

/// Source A owns the topology; B can replace a complete local cluster. Style controls
/// treatments, never a switch of hard-coded page coordinates.
public enum SourceLayoutDNA {
    struct Slot {
        var id:String;var posterID:String;var observed:UnitBox;var local:UnitBox
        var rotation:Double;var original:String;var aspect:Double
    }
    static func localBox(_ box:UnitBox,rotation:Double,aspect:Double)->UnitBox {
        let angle=rotation * .pi/180,c=abs(cos(angle)),s=abs(sin(angle))
        let w=box.width,h=box.height*aspect,d=c*c-s*s
        var lw=w,lh=h
        if abs(d)>0.22 {
            let x=(w*c-h*s)/d,y=(h*c-w*s)/d
            if x>0.006 && y>0.006 {lw=x;lh=y}
        }
        return UnitBox(x:box.x+box.width/2-lw/2,y:box.y+box.height/2-lh/2/aspect,width:lw,height:lh/aspect)
    }
    static func slots(_ record:PosterRecord)->[Slot] {
        let lines=record.elements.filter{$0.kind=="text-line" && $0.reviewStatus != "rejected" && $0.bounds.valid && ($0.text?.filter(\.isLetter).count ?? 0)>0}
        let candidates=lines.map{e in Slot(id:e.id,posterID:record.id,observed:e.bounds,local:localBox(e.bounds,rotation:e.rotation,aspect:record.genome.aspect),rotation:e.rotation,original:e.text ?? "",aspect:record.genome.aspect)}
        let maxHeight=candidates.map{$0.local.height}.max() ?? 0.1
        var display=candidates.filter{$0.local.height>=max(0.037,maxHeight*0.28) && $0.observed.area>0.009}.sorted{$0.observed.area>$1.observed.area}
        if display.count<2 {display=Array(candidates.sorted{$0.observed.area>$1.observed.area}.prefix(4))}
        var unique:[Slot]=[]
        for slot in display where unique.count<18 {
            if !unique.contains(where:{$0.observed.overlap(slot.observed)>0.82 && abs($0.rotation-slot.rotation)<6}){unique.append(slot)}
        }
        return unique.sorted{a,b in abs(a.observed.y-b.observed.y)<0.035 ? a.observed.x<b.observed.x:a.observed.y<b.observed.y}
    }
    public static func compatibility(_ a:PosterRecord,_ b:PosterRecord)->Double {
        let aa=slots(a),bb=slots(b)
        guard !aa.isEmpty,!bb.isEmpty else{return 0}
        let count=exp(-abs(log(Double(aa.count)/Double(bb.count))))
        let av=Double(aa.filter{abs($0.rotation)>40}.count)/Double(aa.count)
        let bv=Double(bb.filter{abs($0.rotation)>40}.count)/Double(bb.count)
        let orientation=abs(av-bv)
        let aspect=exp(-abs(log(a.genome.aspect/b.genome.aspect)))
        var distance=0.0
        for s in aa {
            var nearest=Double.infinity
            for t in bb {
                let xy=abs(s.observed.x-t.observed.x)+abs(s.observed.y-t.observed.y)
                let wh=abs(s.observed.width-t.observed.width)+abs(s.observed.height-t.observed.height)
                nearest=min(nearest,xy+wh*0.5)
            }
            distance += nearest
        }
        return count*0.2+(1-orientation)*0.2+aspect*0.2+exp(-distance/Double(aa.count)*2)*0.4
    }
    private static func union(_ slots:[Slot])->UnitBox {
        let r=slots.reduce(CGRect.null){$0.union($1.observed.rect)}
        return UnitBox(x:r.minX,y:r.minY,width:r.width,height:r.height)
    }
    private static func clusterTransfer(_ a:[Slot],_ b:[Slot],rng:inout SeededRandom)->([Slot],Int) {
        guard a.count>=3,b.count>=3,rng.unit()<0.6 else{return(a,0)}
        // Nearest neighbors form a local donor cluster; transform that group as a unit.
        let pivot=b[rng.int(b.count)]
        let group=Array(b.sorted { x,y in
            func distance(_ s:Slot)->Double {hypot(s.observed.x-pivot.observed.x,s.observed.y-pivot.observed.y)}
            return distance(x)<distance(y)
        }.prefix(rng.int(2)+2))
        let source=union(group)
        let targets=a.filter{$0.observed.width>0.3 && $0.observed.height>0.08}
        guard let target=targets.min(by:{abs(log(($0.observed.width/$0.observed.height)/(source.width/source.height)))<abs(log(($1.observed.width/$1.observed.height)/(source.width/source.height)))}),source.area>0 else{return(a,0)}
        let box=target.observed
        guard source.area<0.48,source.height<0.62,
              abs(log((box.width/box.height)/(source.width/source.height)))<0.65,
              group.allSatisfy({abs(sin(($0.rotation-target.rotation) * .pi/180))<0.5}) else{return(a,0)}
        let aspectRatio=group[0].aspect/target.aspect
        let scale=min(box.width/source.width,box.height/(source.height*aspectRatio))
        let sx=scale,sy=scale*aspectRatio
        let originX=box.x+(box.width-source.width*sx)/2,originY=box.y+(box.height-source.height*sy)/2
        // Retain internal relative anchors, not an interpolation between unrelated rectangles.
        let inserted=group.map{s->Slot in
            var t=s
            t.observed=UnitBox(x:originX+(s.observed.x-source.x)*sx,y:originY+(s.observed.y-source.y)*sy,width:s.observed.width*sx,height:s.observed.height*sy)
            t.local=localBox(t.observed,rotation:s.rotation,aspect:1.414)
            return t
        }
        return(a.filter{$0.id != target.id}+inserted,inserted.count)
    }
    private static func luminance(_ hex:String)->Double {
        let n=Int(hex.dropFirst(),radix:16) ?? 0
        let rgb=[(n>>16)&255,(n>>8)&255,n&255].map{v->Double in let x=Double(v)/255;return x<0.04045 ? x/12.92:pow((x+0.055)/1.055,2.4)}
        return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722
    }
    private static func contrast(_ a:String,_ b:String)->Double {let x=luminance(a),y=luminance(b);return(max(x,y)+0.05)/(min(x,y)+0.05)}
    static func informationZone(_ slots:[Slot],record:PosterRecord,fields:[String])->UnitBox {
        // Search actual source whitespace; if dense, place a paper island at the least
        // occupied observed information location. No shared top/bottom template.
        var best=UnitBox(x:0.04,y:0.4,width:0.52,height:0.18),score = -Double.infinity
        let sourceSmall=record.elements.filter{$0.kind=="text-line" && $0.reviewStatus != "rejected" && $0.bounds.height<0.035}.map(\.bounds)
        for w in [0.24,0.32,0.42,0.54,0.66] {
            let lineCount=fields.reduce(0){$0+wrapped($1,width:w-0.018,height:0.0125,aspect:record.genome.aspect,font:"HelveticaNeue-Medium").count}
            let h=Double(lineCount)*0.0155+Double(fields.count)*0.003+0.018
            guard h<0.88 else{continue}
            for iy in 0..<27 {for ix in 0..<23 {
                let x=0.035+Double(ix)/22*(0.93-w),y=0.035+Double(iy)/26*(0.93-h)
                let box=UnitBox(x:x,y:y,width:w,height:h)
                let overlap=slots.reduce(0.0){v,s in let r=box.rect.intersection(s.observed.rect);return v+(r.isNull ? 0:r.width*r.height)}
                let affinity=sourceSmall.map{b in exp(-hypot((b.x+b.width/2)-(x+w/2),(b.y+b.height/2)-(y+h/2))*8)}.max() ?? 0
                let value = -overlap/box.area*4+affinity*0.45-w*0.06
                if value>score {score=value;best=box}
            }}
        }
        return best
    }
    private static func wrapped(_ text:String,width:Double,height:Double,aspect:Double,font:String)->[String] {
        let face=CTFontCreateWithName(font as CFString,100,nil)
        func fits(_ s:String)->Bool {
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:s,attributes:[.font:face]))
            let r=CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
            return r.height<=0 || r.width/r.height*height*aspect<=width
        }
        var result:[String]=[],current=""
        for word in text.split(whereSeparator:{$0.isWhitespace}).map(String.init) {
            let next=current.isEmpty ? word:current+" "+word
            if fits(next){current=next}else{
                if !current.isEmpty{result.append(current);current=""}
                for character in word {
                    if !fits(current+String(character)),!current.isEmpty{result.append(current);current=""}
                    current.append(character)
                }
            }
        }
        if !current.isEmpty{result.append(current)}
        return result
    }
    public static func make(_ a:PosterRecord,_ b:PosterRecord,category:String,seed:UInt64,copy:PosterCopy,id:String,fontProfileID:String?=nil,typeSystem:TypeSystemVariant?=nil,shapePreset:PosterShapePreset?=nil)->StyleGenome {
        var rng=SeededRandom(seed:seed),items:[SceneElement]=[],operations:[String]=[]
        let original=slots(a),other=slots(b)
        var (display,transferred)=clusterTransfer(original,other,rng:&rng)
        if transferred>0{operations.append("Transplant \(transferred) adjacent type anchors from \(b.id) into one source-A display zone; retain their internal ordering.")}
        let aspect=a.genome.aspect
        let vertical=display.filter{abs(sin($0.rotation * .pi/180))>0.8}.count>display.count/2
        display.sort{x,y in
            if vertical{return abs(x.observed.x-y.observed.x)>0.04 ? x.observed.x<y.observed.x:x.observed.y<y.observed.y}
            return abs(x.observed.y-y.observed.y)>0.035 ? x.observed.y<y.observed.y:x.observed.x<y.observed.x
        }
        // Keep the original aspect, including the local unrotation of OCR's axis-aligned boxes.
        for i in display.indices {display[i].local=localBox(display[i].observed,rotation:display[i].rotation,aspect:aspect)}
        let paletteRecord=rng.unit()<0.25 ? b:a
        let background=paletteRecord.genome.background
        let swatches=(paletteRecord.colors?.swatches.map(\.hex) ?? paletteRecord.statistics.palette.map(\.hex))
        let foreground=(swatches+["#111111","#f7f3e9"]).max{contrast($0,background)<contrast($1,background)} ?? "#111111"
        let accent=(b.colors?.swatches ?? []).filter{contrast($0.hex,background)>2.7 && $0.chroma>0.055}.first?.hex ?? foreground
        let serif=["editorial","guilloche"].contains(category)
        let faces=serif ? ["Didot","TimesNewRomanPSMT","BodoniSvtyTwoITCTT-Book","Didot-Italic"]:["HelveticaNeue-Bold","HelveticaNeue-CondensedBlack","DINCondensed-Bold","HelveticaNeue-Light"]
        let profile=(fontProfileID ?? shapePreset?.fontProfileID).flatMap{FontLibrary.shared.profile($0)} ?? FontLibrary.shared.choose(category:category,seed:seed)
        let fallback=category=="brutalist" ? "HelveticaNeue-CondensedBlack":faces[rng.int(faces.count)]
        let face=profile?.postscriptName ?? fallback,treatment=rng.int(6)
        let measuringFace=FontLibrary.font(name:face,variations:profile?.variations)
        var measuredRatios:[String:Double]=[:]
        func wordRatio(_ value:String)->Double {
            if let known=measuredRatios[value]{return known}
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:value,attributes:[.font:measuringFace]))
            let box=CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
            let ratio=box.width/max(1,box.height);measuredRatios[value]=ratio;return ratio
        }
        var usage:[String:Int]=[:]
        let compact=copy.words.joined().uppercased()
        // Copy allocation follows the number and capacity of observed source fragments.
        var flowing:[String]=[]
        if copy.briefID==nil && display.count>=3 && display.count<=5 {
            flowing.append(copy.words.first!.uppercased())
            let rest=Array(copy.words.dropFirst().joined().uppercased())
            var position=0
            for index in 1..<display.count {
                let remaining=display.count-index
                let n=max(0,Int(ceil(Double(rest.count-position)/Double(remaining))))
                flowing.append(String(rest.dropFirst(position).prefix(n)));position += n
            }
        }
        let hero=display.indices.max{display[$0].observed.area<display[$1].observed.area}
        for (i,slot) in display.enumerated() {
            let value:String
            if i==hero,let primary=copy.displayPhrases?.first {value=primary}
            else if display.count<=2 && copy.briefID==nil {value=copy.words[i%copy.words.count].uppercased()}
            else if !flowing.isEmpty {value=flowing[i].isEmpty ? copy.initials[i%copy.initials.count]:flowing[i]}
            else {
                let target=slot.local.width/max(0.001,slot.local.height*aspect)
                let repeated=Set(display.map{$0.original.lowercased()}).count<=max(2,display.count/3)
                let title=copy.words.joined(separator:" ").uppercased()
                var vocabulary=copy.words.map{$0.uppercased()}+[copy.subtitle.uppercased(),copy.institution.uppercased(),copy.footer.uppercased(),title]
                vocabulary += copy.subtitle.split(separator:" ").filter{$0.count>2}.map{String($0).uppercased()}
                vocabulary += copy.footer.split(whereSeparator:{$0==" " || $0=="/" || $0=="•"}).filter{$0.count>2}.map{String($0).uppercased()}
                if target<2{vocabulary += copy.initials}
                if target>14{vocabulary.append(title+" / "+copy.subtitle.uppercased())}
                if repeated {vocabulary=copy.words.map{$0.uppercased()}+[title]}
                if let curated=copy.displayPhrases,!curated.isEmpty {vocabulary=curated}
                vocabulary=Array(Set(vocabulary)).sorted()
                let ranked=vocabulary.sorted{a,b in
                    let x=abs(log(max(0.01,wordRatio(a))/target))+Double(usage[a] ?? 0)*0.09
                    let y=abs(log(max(0.01,wordRatio(b))/target))+Double(usage[b] ?? 0)*0.09
                    return x==y ? a<b:x<y
                }
                value=ranked[rng.unit()<0.8 ? 0:min(1,ranked.count-1)]
                usage[value,default:0] += 1
            }
            var box=slot.local
            // Group-safe mutations: original anchor center and baseline survive.
            let expansion=treatment==4 ? rng.value(1.03,1.13):1
            box.x -= box.width*(expansion-1)/2;box.width *= expansion
            var e=SceneElement(sourceElementID:"art:source-type:\(i):\(slot.id)",kind:"text",bounds:box,rotation:slot.rotation,text:value,color:i%3==1 && treatment%2==1 ? accent:foreground,shape:"rectangle",outline:treatment==2,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:false,fontName:face,textAlignment:"left",minimumStage:i<2 ? 1:2,textTreatment:"source-block-fit",clipBounds:.full)
            if ["editorial","minimal","swiss","guilloche"].contains(category) {
                e.preserveTypeProportions=true;e.textTreatment="source-uniform-fit"
            }else if display.count>5 && treatment%2==0 {
                e.preserveTypeProportions=true;e.textTreatment="source-uniform-fit"
            }
            e.sourcePosterID=slot.posterID;e.sourceAnchor=slot.observed;e.zIndex=10+i;e.allowsBleed=true
            e.tracking=treatment==3 ? rng.value(2,10):0
            e.outlineWidth=1.8
            if category=="halftone"{e.textTreatment="vector-halftone";e.geometry=["screen":rng.value(2.7,4.8),"phase":rng.value(0,6.28)]}
            if category=="optical" && treatment%2==0{e.outline=true;e.copies=3+rng.int(4);e.offsetX=0.002;e.offsetY=0.001}
            if category=="typographic-collage"{e.outline=i%3==1;e.outlineWidth=2}
            if category=="color-field"{e.color=i%2==0 ? foreground:accent;if luminance(background)>0.45{e.blendMode="multiply"}}
            if treatment==1 && ["kinetic","expressive","constructivist"].contains(category){e.typeTransform=["shear":rng.value(-0.28,0.28)]}
            if treatment==5 && i>=display.count/2 && ["editorial","typographic-collage","optical"].contains(category){e.typeTransform=["scaleX":-1];operations.append("Mirror display cluster \(i) within its inherited source anchor.")}
            items.append(e)
        }
        operations.append("Source-sized display type: \(face); treatment \(treatment); \(display.count) measured anchors, original baseline rotations and gaps. Word capacity uses the selected font’s actual glyph metrics; natural fits and intentional display block fits are stored per element.")
        // Add a procedural image only in an observed non-text image region, never a
        // category-specific decorative slot. Skip contours that cover the type field.
        if shapePreset != nil || ["abstract","color-field","halftone","guilloche","bauhaus","optical"].contains(category) {
            let regions=a.elements.filter{e in
                guard e.kind != "word",e.kind != "text-line",e.reviewStatus != "rejected",e.bounds.area>0.055,e.bounds.area<0.6 else{return false}
                return !display.contains{$0.observed.overlap(e.bounds)>0.3}
            }.sorted{$0.bounds.area>$1.bounds.area}
            if let region=regions.first {
                let density=min(1,display.reduce(0.0){$0+$1.observed.area})
                if let choice=PosterShapeLibrary.choose(seed:seed,profile:profile,field:region.bounds,posterAspect:aspect,category:category,textDensity:density,sourcePosterID:a.id,preset:shapePreset) {
                    let art=PosterShapeLibrary.element(choice,field:region.bounds,color:accent,seed:seed,sourceID:region.id,sourcePosterID:a.id)
                    items.append(art)
                    operations.append("Shape library: \(choice.recipe.id), \(choice.recipe.logic) Authored font/layout compatibility \(String(format:"%.3f",choice.compatibility.score)); observed region \(region.id). "+choice.compatibility.reasons.joined(separator:" "))
                }
            }
        }
        // Full copy occupies one source-dependent information island. The island is
        // ordered after display type, making intentional figure/ground overlap explicit.
        var typeApplications:[TypeSystemApplication]
        if let typeSystem,let application=try? TypeSystemLibrary.shared.transplant(typeSystem,into:&items,aspect:aspect,profile:profile,copy:copy){typeApplications=[application]}
        else{typeApplications=TypeSystemLibrary.shared.recombine(&items,a:a,b:b,copy:copy,profile:profile,seed:seed)}
        for application in typeApplications {operations.append("Reuse \(application.operation) from \(application.sourcePosterID): \(application.input); \(application.steps.count) traced outputs in its observed source field.")}
        let displayed=items.compactMap(\.text).joined().uppercased().filter(\.isLetter)
        let titleInDisplay=displayed.contains(compact.filter(\.isLetter))
        let fields=(titleInDisplay ? []:[copy.title.replacingOccurrences(of:"\n",with:" ")])+[copy.subtitle,copy.institution,copy.footer]
        let occupied=display+typeApplications.map{application in Slot(id:application.genomeID,posterID:a.id,observed:application.field,local:application.field,rotation:0,original:"",aspect:aspect)}
        let info=informationZone(occupied,record:a,fields:fields)
        var island=SceneElement(sourceElementID:"art:information-paper",kind:"shape",bounds:info,rotation:0,text:nil,color:background,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        island.zIndex=60;island.minimumStage=3;items.append(island)
        let inset=0.009,w=info.width-inset*2,bodyFace="HelveticaNeue-Medium",lineHeight=0.0125,gap=0.003
        var y=info.y+inset
        for (fieldIndex,field) in fields.enumerated() {
            let lines=wrapped(field,width:w,height:lineHeight,aspect:aspect,font:bodyFace)
            for (lineIndex,line) in lines.enumerated() {
                var e=SceneElement(sourceElementID:fieldIndex==0 && !titleInDisplay ? "title:source-info:\(lineIndex)":"meta:source-info:\(fieldIndex):\(lineIndex)",kind:"text",bounds:.init(x:info.x+inset,y:y,width:w,height:lineHeight),rotation:0,text:line,color:foreground,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:bodyFace,textAlignment:"left",minimumStage:3)
                e.zIndex=70;items.append(e);y += lineHeight+gap
            }
            y += gap
        }
        // Enlarge downward/upward around the chosen source location if unusually long
        // editable fields require more lines. No clipped or missing metadata.
        let needed=y-info.y
        if needed>info.height {
            let shift=max(0,info.y+needed-0.97)
            for i in items.indices where (items[i].zIndex ?? 0)>=60 {
                items[i].bounds.y -= shift
                if items[i].sourceElementID=="art:information-paper"{items[i].bounds.height=needed}
            }
        }
        operations.append("Place full copy in source-derived whitespace / information island (\(String(format:"%.3f",info.x)), \(String(format:"%.3f",info.y))); natural supporting type and explicit late paper layer.")
        var genome=StyleGenome(version:"observed-source-layout-v11",posterID:id,aspect:aspect,background:background,font:face,textScale:1,tracking:0,elements:items,score:nil,fittingStatus:"Observed source topology with declared cluster transfer and graphic typography; borders/fonts remain interpretations.",sourceEmbeddingModel:"Apple-Vision-r2")
        genome.styleCategory=category;genome.layoutVariant=treatment
        genome.posterCopy=copy;genome.contentBrief=ContentBriefLibrary.brief(copy.briefID)
        genome.appliedTypeSystems=typeApplications;genome.typeSystemIDs=typeApplications.map(\.genomeID)
        genome.layoutInheritance=LayoutInheritance(skeletonPosterID:a.id,donorPosterIDs:[a.id,b.id],sourceImages:[a.imageURL,b.imageURL],operations:operations,retainedAnchorCount:display.count-transferred,transferredAnchorCount:transferred,informationBounds:items.first{$0.sourceElementID=="art:information-paper"}!.bounds)
        if let profile{FontLibrary.apply(profile,to:&genome)}
        genome.composition=plan(genome)
        return genome
    }
    static func plan(_ genome:StyleGenome)->CompositionPlan {
        var p=CompositionPlan.scene(genome,origin:"observed-source-topology",style:genome.styleCategory)
        if let dna=genome.layoutInheritance {
            p.description="Actual composition skeleton: \(dna.skeletonPosterID). \(dna.retainedAnchorCount) retained anchors; \(dna.transferredAnchorCount) coherent donor-cluster anchors. "+dna.operations.joined(separator:" ")
            p.grid.type="observed-source-anchor-graph";p.grid.columns=nil
            p.constraints.removeAll{$0.type=="natural-glyph-proportions"}
            p.constraints.append(LayoutConstraint(type:"source-composition-inheritance",targets:dna.donorPosterIDs,values:["retainedAnchors":Double(dna.retainedAnchorCount),"transferredAnchors":Double(dna.transferredAnchorCount)],reason:dna.note))
            p.constraints.append(LayoutConstraint(type:"intentional-display-block-fit",targets:genome.elements.filter{$0.sourceAnchor != nil && $0.preserveTypeProportions != true}.map(\.sourceElementID),values:[:],reason:"Display glyphs fill observed local type blocks, with explicitly declared bleed, mirror and shear; protected information type fits uniformly."))
            p.constraints.append(LayoutConstraint(type:"natural-source-type-fit",targets:genome.elements.filter{$0.sourceAnchor != nil && $0.preserveTypeProportions==true}.map(\.sourceElementID),values:["stretchXOverY":1],reason:"Selected font metrics determine natural fit inside observed source anchors; short words are never stretched into accidental horizontal slabs."))
            p.note=dna.note+" "+p.note
        }
        let font=genome.elements.compactMap(\.fontProfileID).first.flatMap{FontLibrary.shared.profile($0)}
        let density=min(1,genome.elements.filter{$0.kind=="text" && $0.sourceAnchor != nil}.reduce(0.0){$0+$1.bounds.area})
        for element in genome.elements {if let id=PosterShapeLibrary.recipeID(element),let recipe=PosterShapeLibrary.recipe(id) {
            let match=PosterShapeLibrary.compatibility(recipe,profile:font,field:element.bounds,posterAspect:genome.aspect,category:genome.styleCategory ?? "abstract",textDensity:density,sourcePosterID:element.sourcePosterID)
            p.constraints.append(LayoutConstraint(type:"shape-font-layout-compatibility",targets:[element.sourceElementID],values:match.components,reason:recipe.name+". "+recipe.logic+" "+match.reasons.joined(separator:" ")+" "+recipe.basis))
        }}
        return p
    }
    static func cross(_ a:StyleGenome,_ b:StyleGenome,seed:UInt64,id:String)->StyleGenome {
        var rng=SeededRandom(seed:seed)
        var child=rng.unit()<0.45 ? a:b
        let other=child.posterID==a.posterID ? b:a
        // A complete source graph survives. Cross ink and typographic vocabulary,
        // never average incompatible source anchors into a generic page layout.
        let fontDonor=other.elements.first{$0.sourceAnchor != nil && $0.kind=="text"}
        if rng.unit()<0.65,let fontDonor {
            if let id=fontDonor.fontProfileID,let profile=FontLibrary.shared.profile(id){FontLibrary.apply(profile,to:&child)}
            else {
                for i in child.elements.indices where child.elements[i].sourceAnchor != nil && child.elements[i].kind=="text" {
                    child.elements[i].fontName=fontDonor.fontName;child.elements[i].fontProfileID=nil;child.elements[i].fontAssetID=nil;child.elements[i].fontAssetSHA256=nil;child.elements[i].fontVariations=nil
                }
            }
            child.layoutInheritance?.operations.append("Crossover inherits the complete face/weight/width profile from parent \(other.posterID); all source anchor relationships survive.")
        }
        child.posterID=id;child.composition=plan(child);return child
    }
}
