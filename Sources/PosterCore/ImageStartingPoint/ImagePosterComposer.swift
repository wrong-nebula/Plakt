import Foundation
import CoreGraphics

public enum ImagePosterComposer {
    static func area(_ a:UnitBox,_ b:UnitBox)->Double {let r=a.rect.intersection(b.rect);return r.isNull ? 0:r.width*r.height}
    static func union(_ elements:[SceneElement])->CGRect {elements.reduce(CGRect.null){$0.union($1.bounds.rect)}}
    public static func sourcePoint(_ x:Double,_ y:Double,frame:UnitBox,crop:UnitBox)->CGPoint? {
        guard frame.rect.contains(CGPoint(x:x,y:y)) else{return nil}
        return CGPoint(x:crop.x+(x-frame.x)/frame.width*crop.width,y:crop.y+(y-frame.y)/frame.height*crop.height)
    }
    static func projected(_ box:UnitBox,frame:UnitBox,crop:UnitBox)->UnitBox {
        let projected=CGRect(x:frame.x+(box.x-crop.x)/crop.width*frame.width,y:frame.y+(box.y-crop.y)/crop.height*frame.height,width:box.width/crop.width*frame.width,height:box.height/crop.height*frame.height).intersection(frame.rect)
        if projected.isNull{return .init(x:frame.x,y:frame.y,width:0,height:0)}
        return .init(x:projected.minX,y:projected.minY,width:projected.width,height:projected.height)
    }
    static func mapCost(_ box:UnitBox,profile:ImageInfluenceProfile,frame:UnitBox,crop:UnitBox)->Double {
        let cells=profile.cells.map{($0,projected($0.bounds,frame:frame,crop:crop))}
        var cost=0.0
        for (cell,b) in cells {cost += area(box,b)*cell.edge*2}
        for r in profile.attention {cost += area(box,projected(r.bounds,frame:frame,crop:crop))*(r.kind=="face" ? 3:r.kind=="existing lettering" ? 2.5:1.4)}
        return cost/max(0.005,box.area)
    }
    static func sampleLuminance(_ box:UnitBox,profile:ImageInfluenceProfile,frame:UnitBox,crop:UnitBox,paper:Double)->Double {
        var total=0.0,weight=0.0
        for cell in profile.cells {let a=area(box,projected(cell.bounds,frame:frame,crop:crop));total+=a*cell.luminance;weight+=a}
        return (total+max(0,box.area-weight)*paper)/max(0.0001,box.area)
    }
    static func mix(_ a:String,_ b:String,_ t:Double)->String {
        let x=PerceptualColor.fromHex(a),y=PerceptualColor.fromHex(b)
        return PerceptualColor.hex(.init(l:x.l*(1-t)+y.l*t,a:x.a*(1-t)+y.a*t,b:x.b*(1-t)+y.b*t)).0
    }
    static func crop(aspect:Double,frame:UnitBox,posterAspect:Double,profile:ImageInfluenceProfile)->UnitBox {
        let needed=frame.height*posterAspect/frame.width
        var crop=UnitBox.full
        if needed>aspect {crop.width=aspect/needed}else{crop.height=needed/aspect}
        let focal=profile.attention.filter{$0.kind != "existing lettering"}.max{$0.bounds.area<$1.bounds.area}?.bounds ?? .init(x:0.4,y:0.4,width:0.2,height:0.2)
        crop.x=max(0,min(1-crop.width,focal.x+focal.width/2-crop.width/2));crop.y=max(0,min(1-crop.height,focal.y+focal.height/2-crop.height/2))
        return crop
    }
    public static func compose(_ base:StyleGenome,profile:ImageInfluenceProfile,settings:ImageInfluenceSettings,seed:UInt64,copy:PosterCopy,donorIDs:[String],shapePreset:PosterShapePreset?=nil,direction:ImageCompositionDirection?=nil)throws->StyleGenome {
        try settings.validate()
        var rng=SeededRandom(seed:seed ^ 0x494d414745),scene=base
        let aspect=max(0.65,min(2.2,profile.aspect)),oldAspect=base.aspect
        scene.aspect=aspect;scene.posterCopy=copy
        let autoPlacement:String
        switch direction {case .imageLed:autoPlacement=rng.unit()<0.65 ? "full-bleed":"split";case .typeLed:autoPlacement="framed";case .interaction:autoPlacement=rng.unit()<0.7 ? "full-bleed":"split";case nil:autoPlacement=["full-bleed","full-bleed","framed","split"][rng.int(4)]}
        let placement=settings.placement=="mixed" ? autoPlacement:settings.placement
        let frame:UnitBox
        switch placement {
        case "framed":
            let w=direction == .typeLed ? rng.value(0.50,0.72):rng.value(0.75,0.91),h=min(direction == .typeLed ? 0.62:0.74,w*profile.aspect/aspect)
            frame = .init(x:(1-w)/2,y:direction == .typeLed ? rng.value(0.23,0.35):rng.value(0.16,0.23),width:w,height:h)
        case "split":
            let h=direction == .imageLed ? rng.value(0.72,0.84):rng.value(0.56,0.72),top=rng.unit()<0.5
            frame = .init(x:0,y:top ? 0:1-h,width:1,height:h)
        default:frame = .full
        }
        let sourceCrop=crop(aspect:profile.aspect,frame:frame,posterAspect:aspect,profile:profile)
        let palette=profile.statistics.palette
        let dominant=palette.first?.hex ?? "#303030"
        let chromatic=palette.max{let a=PerceptualColor.fromHex($0.hex),b=PerceptualColor.fromHex($1.hex);return hypot(a.a,a.b)<hypot(b.a,b.b)}?.hex ?? dominant
        scene.background=mix(base.background,dominant,settings.palette)
        var operations=["Measured texture \(profile.statistics.edgeDensity), dominant direction \(profile.dominantAngle)° and Vision affinity influence donor choice; source style route \(base.styleCategory ?? "automatic") supplies the typeface vocabulary.","Image \(profile.asset.sha256); \(placement) frame; focal crop \(sourceCrop). Palette influence \(settings.palette), layout \(settings.layout), shapes \(settings.shapes)."]
        var display=base.elements.filter{$0.kind=="text" && ($0.sourceAnchor != nil || $0.typeSystemID != nil)}
        if display.isEmpty{display=base.elements.filter{$0.kind=="text" && !$0.sourceElementID.hasPrefix("meta:")}}
        // Preserve the source cluster's internal geometry and physical type proportions.
        let original=union(display)
        guard !original.isNull,original.width>0,original.height>0 else{throw PosterError.invalid("Source genome has no usable display cluster.")}
        let calmCells=profile.cells.filter{cell in
            cell.edge<0.08 && !profile.attention.contains{region in region.bounds.overlap(cell.bounds)>0.3}
        }
        let calmShare=Double(calmCells.count)/Double(max(1,profile.cells.count))
        let sourceLetterHeight=display.map{e->Double in var upright=e;upright.rotation=0;return CompositionJudges.inkBounds(upright,genome:base).height}.max() ?? 0.05
        let desiredLetterHeight=(direction == .typeLed ? 0.09:direction == .imageLed ? 0.025:0.05)+calmShare*(direction == .imageLed ? 0.025:0.07)
        let roomDrivenScale=desiredLetterHeight/max(0.004,sourceLetterHeight*oldAspect/aspect)
        let compact=max(0.70+rng.unit()*0.80,1+(roomDrivenScale-1)*settings.layout)
        let directionScale=direction == .imageLed ? min(compact,0.68):direction == .typeLed ? max(compact,1.1):compact
        let sx=min(directionScale,0.92/original.width,0.87/(original.height*oldAspect/aspect)),sy=sx*oldAspect/aspect
        let groupWidth=original.width*sx,groupHeight=original.height*sy
        var best:UnitBox?,bestCost=Double.infinity
        for _ in 0..<48 {
            let x=rng.value(0.035,max(0.035,0.965-groupWidth)),y=rng.value(0.035,max(0.035,0.965-groupHeight))
            var cost=0.0
            for e in display {
                let b=UnitBox(x:x+(e.bounds.x-original.minX)*sx,y:y+(e.bounds.y-original.minY)*sy,width:e.bounds.width*sx,height:e.bounds.height*sy)
                cost += mapCost(b,profile:profile,frame:frame,crop:sourceCrop)*b.area*(direction == .interaction ? 0.16:1)
            }
            // Low influence retains measured source placement; high influence follows image space.
            let displacement=hypot(x-original.minX,y-original.minY)
            cost=cost*settings.layout+(1-settings.layout)*displacement*0.12+rng.value(0,0.004)
            if cost<bestCost{bestCost=cost;best = .init(x:x,y:y,width:groupWidth,height:groupHeight)}
        }
        let target=best!
        for i in display.indices {
            let b=display[i].bounds
            display[i].bounds = .init(x:target.x+(b.x-original.minX)*sx,y:target.y+(b.y-original.minY)*sy,width:b.width*sx,height:b.height*sy)
            if let em=display[i].typeEmSize{display[i].typeEmSize=em*sy}
            display[i].offsetX *= sx;display[i].offsetY *= sy
            display[i].clipBounds = .full;display[i].zIndex=100+i
            if direction == .interaction{display[i].rotation += max(-12,min(12,profile.dominantAngle*0.15))}
            display[i].minimumStage=1
            let lum=sampleLuminance(display[i].bounds,profile:profile,frame:frame,crop:sourceCrop,paper:LibrarySceneRenderer.luminance(scene.background)/255)
            let ink=lum>0.48 ? "#171714":"#fff6e8"
            display[i].color=mix(display[i].color,ink,settings.palette)
            display[i].blendMode=nil
        }
        operations.append("Coherently scale and translate \(display.count) inherited display elements; preserve ordering, relative spacing and rotations. Evaluate 48 placements against texture, attention, faces and existing lettering. Physical aspect compensation \(oldAspect/aspect).")
        var image=SceneElement(sourceElementID:"image:starting-point",kind:"image",bounds:frame,rotation:0,text:nil,color:"#ffffff",shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        image.rasterAsset = .init(url:profile.asset.url,sha256:profile.asset.sha256,crop:sourceCrop);image.zIndex = -100;image.minimumStage=0
        scene.elements=[image]+display
        // A shape echoes the image's measured directional field, palette and texture.
        if settings.shapes>0 && rng.unit()<settings.effectiveShapeFrequency {
            let recipePool=PosterShapeLibrary.recipes.filter{r in
                let detail=r.traits["detail"] ?? 0.5
                return profile.statistics.edgeDensity>0.055 ? detail<0.65:detail>0.15
            }
            let pool=recipePool.isEmpty ? PosterShapeLibrary.recipes:recipePool
            if let recipe=shapePreset?.recipe ?? (pool.isEmpty ? nil:pool[rng.int(pool.count)]) {
                let preferred=settings.shapePreferredWidth ?? 0.86
                let w=max(0.48,min(1.4,preferred+rng.value(-0.30,0.38))),h=min(1.35,w/max(0.4,recipe.idealAspect)/aspect)
                var field=UnitBox(x:rng.value(0.04,0.65),y:rng.value(0.05,0.75),width:w,height:h),lowest=Double.infinity
                for _ in 0..<20 {let candidate=UnitBox(x:rng.value(0.035,0.965-w),y:rng.value(0.04,0.95-h),width:w,height:h);let cost=mapCost(candidate,profile:profile,frame:frame,crop:sourceCrop)+display.reduce(0){$0+area(candidate,$1.bounds)*5};if cost<lowest{field=candidate;lowest=cost}}
                let choice=PosterShapeChoice(recipe:recipe,parameters:try recipe.values(shapePreset?.parameters ?? [:]),compatibility:PosterShapeLibrary.fontCompatibility(recipe,profile:nil),contour:shapePreset?.contour,relief:shapePreset?.relief)
                var shape=PosterShapeLibrary.element(choice,field:field,color:mix(chromatic,display.first?.color ?? "#ffffff",0.2),seed:seed,sourceID:"image-response")
                shape.rotation=profile.dominantAngle*settings.shapes;shape.zIndex=30;shape.clipBounds = .full;shape.allowsBleed=true
                scene.elements.append(shape)
                operations.append("Shape \(recipe.id) selected from \(pool.count) texture-compatible recipes; direction \(profile.dominantAngle)° × influence; palette-derived ink; quiet-region placement.")
            }
        }
        // Search actual calm space at several sizes. Small information type is a
        // fallback for constrained images, rather than the default for every photo.
        let displayed=display.compactMap(\.text).joined().uppercased().filter(\.isLetter)
        let title=copy.title.uppercased().filter(\.isLetter)
        let fields=(displayed.contains(title) ? []:[copy.title.replacingOccurrences(of:"\n",with:" ")])+[copy.subtitle,copy.institution,copy.footer]
        var chosen:(UnitBox,[String],Double,Double)?
        var fallback:(UnitBox,[String],Double,Double)?
        let displayInk=display.map{CompositionJudges.inkBounds($0,genome:scene)}
        let gapRatio=0.24
        for lineHeight in [0.030,0.025,0.020,0.015] {
            var sizeBest:(UnitBox,[String],Double,Double)?
            for infoWidth in [0.90,0.65,0.43] {
                let lines=fields.filter{!$0.isEmpty}.flatMap{TextWrapping.lines($0,width:infoWidth-0.014,height:lineHeight,aspect:aspect,font:"HelveticaNeue-Medium",method:.previous)}
                let infoHeight=Double(lines.count)*lineHeight*(1+gapRatio)+0.014
                guard infoHeight<0.65 else{continue}
                for y in stride(from:0.035,through:max(0.035,0.965-infoHeight),by:0.055) {
                    for x in [0.04,(1-infoWidth)/2,0.96-infoWidth] {
                        let b=UnitBox(x:x,y:y,width:infoWidth,height:infoHeight)
                        let collision=displayInk.reduce(0.0){$0+area(b,$1)/b.area}
                        let cost=mapCost(b,profile:profile,frame:frame,crop:sourceCrop)+collision*4
                        let result=(b,lines,lineHeight,cost)
                        if sizeBest==nil || cost<sizeBest!.3{sizeBest=result}
                        let fallbackResult=(b,lines,lineHeight,cost+b.area*1.5)
                        if fallback==nil || fallbackResult.3<fallback!.3{fallback=fallbackResult}
                    }
                }
            }
            if let best=sizeBest,best.3<0.24{chosen=best;break}
        }
        let selectedInfo=chosen ?? fallback!
        let info=selectedInfo.0,lines=selectedInfo.1,lineHeight=selectedInfo.2,gap=lineHeight*gapRatio
        let lum=sampleLuminance(info,profile:profile,frame:frame,crop:sourceCrop,paper:LibrarySceneRenderer.luminance(scene.background)/255),infoInk=lum>0.45 ? "#181816":"#fff6e8"
        let needsPaper=mapCost(info,profile:profile,frame:frame,crop:sourceCrop)>0.3
        if needsPaper {
            var island=SceneElement(sourceElementID:"image:information-paper",kind:"shape",bounds:info,rotation:0,text:nil,color:scene.background,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1);island.zIndex=190;island.minimumStage=2;scene.elements.append(island)
        }
        let finalInfoInk=needsPaper ? (LibrarySceneRenderer.luminance(scene.background)>120 ? "#181816":"#fff6e8"):infoInk
        for (i,line) in lines.enumerated(){var e=SceneElement(sourceElementID:"meta:image-info:\(i)",kind:"text",bounds:.init(x:info.x+0.007,y:info.y+0.007+Double(i)*(lineHeight+gap),width:info.width-0.014,height:lineHeight),rotation:0,text:line,color:finalInfoInk,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:"HelveticaNeue-Medium",minimumStage:2);e.zIndex=200;scene.elements.append(e)}
        operations.append("Available calm share \(calmShare); aim for display letter height \(desiredLetterHeight). Fit supporting copy at \(lineHeight) of poster height in a \(info.width) × \(info.height) calm island. Tiny information type is used only when larger fields cannot fit quietly. Avoid repeating a title already present in the display.")
        scene.imageInfluence = .init(profile:profile,settings:settings,placement:placement,imageFrame:frame,operations:operations,donorIDs:donorIDs)
        if let direction{scene.imageInfluence?.hypothesis=direction.rawValue;scene.imageInfluence?.operations.append("Composition hypothesis: \(direction.label). Separate parent pool; source/article emphasis remains a valid artistic option.")}
        scene.layoutInheritance?.operations += operations
        scene.appliedTypeSystems=nil // source-space traces are retained in the saved source genome, never mislabeled as transformed coordinates.
        PosterShapeLibrary.resolveSurveyContent(in:&scene)
        scene.composition=CompositionPlan.scene(scene,origin:"image-influenced-source-composition",style:scene.styleCategory)
        scene.composition?.description=operations.joined(separator:" ")
        return scene
    }
    public static func scores(_ scene:StyleGenome)->[String:Double] {
        guard let influence=scene.imageInfluence,let asset=scene.elements.first(where:{$0.kind=="image"})?.rasterAsset else{return [:]}
        let type=scene.elements.filter{$0.kind=="text"},frame=influence.imageFrame
        var profile=influence.profile
        if profile.cells.isEmpty,let url=influence.analysisURL,url.isFileURL,let data=try? Data(contentsOf:url),let restored=try? JSONDecoder().decode(ImageInfluenceProfile.self,from:data),restored.asset.sha256==profile.asset.sha256{profile=restored}
        let costs=type.map{mapCost(CompositionJudges.inkBounds($0,genome:scene),profile:profile,frame:frame,crop:asset.crop)}
        let mass=profile.attention.filter{$0.kind != "existing lettering"}.reduce(0.0){$0+$1.bounds.area}
        let retained=profile.attention.filter{$0.kind != "existing lettering"}.reduce(0.0){$0+area($1.bounds,asset.crop)}
        let display=type.filter{!$0.sourceElementID.hasPrefix("meta:")}
        let intrinsic=display.map{e->UnitBox in var upright=e;upright.rotation=0;return CompositionJudges.inkBounds(upright,genome:scene)}
        let inkMass=intrinsic.reduce(0.0){$0+$1.area}
        let letterHeight=intrinsic.map(\.height).max() ?? 0
        let presence=min(1,sqrt(inkMass/0.12))*0.5+min(1,letterHeight/0.07)*0.5
        return ["Image breathing room":exp(-(costs.reduce(0,+)/Double(max(1,costs.count)))*1.5),"Image retention":mass>0 ? min(1,retained/mass):1,"Display presence":presence]
    }
}
