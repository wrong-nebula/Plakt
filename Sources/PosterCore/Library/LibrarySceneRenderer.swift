import Foundation
import CoreText
import CoreGraphics

public enum LibrarySceneRenderer {
    static func luminance(_ hex:String)->Double {let v=Int(hex.dropFirst(),radix:16) ?? 0;return 0.2126*Double((v>>16)&255)+0.7152*Double((v>>8)&255)+0.0722*Double(v&255)}
    static func color(_ hex:String,alpha:Double=1)->CGColor {let v=Int(hex.dropFirst(),radix:16) ?? 0;return CGColor(colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!,components:[Double((v>>16)&255)/255,Double((v>>8)&255)/255,Double(v&255)/255,alpha])!}
    static func initialGenome(posterID:String,image:CGImage,elements:[PosterElement],statistics:VisualStatistics)->StyleGenome {
        let background=statistics.palette.first?.hex ?? "#eeeeee"
        let items=elements.filter{$0.kind != "word"}.map { element in
            let palette=element.statistics.palette.filter{$0.proportion>0.025}
            let foreground=palette.max {abs(luminance($0.hex)-luminance(background))<abs(luminance($1.hex)-luminance(background))}?.hex ?? (luminance(background)>128 ? "#101010":"#f0f0f0")
            let tags=element.tags.filter{$0.state=="confirmed"}.map(\.name)
            return SceneElement(sourceElementID:element.id,kind:element.kind=="text-line" ? "text":"unresolved-region",bounds:element.bounds,
                rotation:element.rotation,text:element.text,color:foreground,shape:"rectangle",outline:tags.contains("outline-text"),shadow:tags.contains("drop-shadow"),offsetX:0.012,offsetY:0.012,copies:1)
        }
        var genome=StyleGenome(posterID:posterID,aspect:Double(image.height)/Double(image.width),background:background,font:"HelveticaNeue-Bold",textScale:1,tracking:0,elements:items,score:nil,fittingStatus:"measured-layout-prior; font/shape interpretation unreviewed; non-text regions unresolved",sourceEmbeddingModel:"Apple-Vision-r2")
        genome.composition=CompositionPlan.scene(genome);return genome
    }
    public static func render(_ genome:StyleGenome,width:Int=700,seed:UInt64=0,variation:Double=0,title:String?=nil,stage:ConstructionStage = .finished)throws->CGImage {
        guard (200...4000).contains(width),genome.aspect.isFinite,(0.25...4).contains(genome.aspect),variation.isFinite,(0...0.5).contains(variation) else{throw PosterError.invalid("Invalid scene render dimensions or variation.")}
        try FontLibrary.validate(genome);try PaperReliefSystems.validate(genome);try GravityTypeSystems.validate(genome);try KerningSystem.validate(genome)
        let height=Int(Double(width)*genome.aspect)
        guard let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
        let rasters=try rasterImages(genome)
        let masks=try contrastMasks(genome,rasters:rasters,width:width,height:height,stage:stage)
        draw(genome,ctx:ctx,rasters:rasters,contrastMasks:masks,width:Double(width),height:Double(height),seed:seed,variation:variation,title:title,stage:stage)
        guard let image=ctx.makeImage() else{throw PosterError.render};return image
    }
    public static func pdf(_ genome:StyleGenome,to url:URL,seed:UInt64=0)throws {
        guard genome.aspect.isFinite,(0.25...4).contains(genome.aspect) else{throw PosterError.invalid("Invalid scene aspect.")}
        try FontLibrary.validate(genome);try PaperReliefSystems.validate(genome);try GravityTypeSystems.validate(genome);try KerningSystem.validate(genome)
        var box=CGRect(x:0,y:0,width:595.28,height:595.28*genome.aspect)
        guard let ctx=CGContext(url as CFURL,mediaBox:&box,nil) else{throw PosterError.render}
        let rasters=try rasterImages(genome)
        // Type stays vector; only the overlap boundary follows a print-resolution (A4 at 300 dpi) mask.
        let masks=try contrastMasks(genome,rasters:rasters,width:2480,height:Int(2480*genome.aspect),stage:.finished)
        ctx.beginPDFPage(nil)
        draw(genome,ctx:ctx,rasters:rasters,contrastMasks:masks,width:Double(box.width),height:Double(box.height),seed:seed,variation:0,title:nil,stage:.finished)
        ctx.endPDFPage();ctx.closePDF()
    }
    /// One grayscale mask per distinct set of shapes that type must contrast against.
    static func contrastMasks(_ genome:StyleGenome,rasters:[String:CGImage],width:Int,height:Int,stage:ConstructionStage)throws->[String:CGImage] {
        var masks:[String:CGImage]=[:]
        for e in genome.elements {
            guard let contrast=e.overlapContrast,masks[contrast.maskKey]==nil else{continue}
            let shapes=genome.elements.filter{contrast.shapeIDs.contains($0.sourceElementID)}
            guard !shapes.isEmpty else{continue}
            var scene=genome;scene.background="#000000"
            scene.elements=shapes.map{item in var s=item;s.color="#ffffff";s.inks=s.inks?.map{_ in "#ffffff"};s.blendMode=nil;s.overlapContrast=nil;s.shadow=false;return s}
            guard let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGImageAlphaInfo.none.rawValue) else{throw PosterError.render}
            draw(scene,ctx:ctx,rasters:rasters,width:Double(width),height:Double(height),seed:0,variation:0,title:nil,stage:stage)
            // Tonal shapes leave partial ink. Blending both inks there matches the blended ground, so switch
            // steeply around half coverage, where either ink contrasts about equally.
            if let data=ctx.data {
                let bytes=data.assumingMemoryBound(to:UInt8.self),ramp=(0...255).map{v->UInt8 in UInt8((min(1,max(0,(Double(v)/255-0.38)/0.24))*255).rounded())}
                for i in 0..<ctx.bytesPerRow*height{bytes[i]=ramp[Int(bytes[i])]}
            }
            masks[contrast.maskKey]=ctx.makeImage()
        }
        return masks
    }
    /// Glyph outlines at a 100-unit font size, including tracking, glyph treatments and the declared type transform.
    static func textPath(_ element:SceneElement,string:String,genome:StyleGenome)->CGMutablePath {
        var path=CGMutablePath()
        for p in placements(element,string:string,genome:genome) {if var glyph=CTFontCreatePathForGlyph(p.font,p.glyph,nil) {
            if element.glyphTreatment=="heart-tittle",p.stringIndex==element.glyphIndex {glyph=TypeGlyphs.heartTittle(glyph,font:p.font,scale:element.geometry?["heartScale"] ?? 1.5).0}
            path.addPath(glyph,transform:CGAffineTransform(translationX:p.position.x,y:p.position.y))
        }}
        if let t=element.typeTransform {
            var transform=CGAffineTransform(a:t["scaleX"] ?? 1,b:0,c:t["shear"] ?? 0,d:t["scaleY"] ?? 1,tx:0,ty:0)
            if let transformed=path.copy(using:&transform) {let result=CGMutablePath();result.addPath(transformed);path=result}
        }
        return path
    }
    /// Glyph placements at a 100-unit font size. Kerned lines come from KerningSystem; lines without kerning settings keep
    /// their original Core Text setting exactly, so saved scenes replay unchanged.
    static func placements(_ element:SceneElement,string:String,genome:StyleGenome)->[KerningSystem.Placement] {
        if KerningSystem.isKerned(element,genome:genome) {return KerningSystem.layout(element,string:string,genome:genome).placements}
        let font=FontLibrary.font(name:element.fontName ?? genome.font,variations:element.fontVariations)
        let line=CTLineCreateWithAttributedString(NSAttributedString(string:string,attributes:[.font:font,.kern:element.tracking ?? genome.tracking]))
        var out:[KerningSystem.Placement]=[]
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let count=CTRunGetGlyphCount(run)
            var glyphs=[CGGlyph](repeating:0,count:count),positions=[CGPoint](repeating:.zero,count:count),indices=[CFIndex](repeating:0,count:count)
            CTRunGetStringIndices(run,CFRange(location:0,length:count),&indices);CTRunGetGlyphs(run,CFRange(location:0,length:count),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:count),&positions)
            let runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
            for i in 0..<count {out.append(KerningSystem.Placement(glyph:glyphs[i],font:runFont,position:positions[i],stringIndex:indices[i],character:0))}
        }
        return out
    }
    static func rasterImages(_ genome:StyleGenome)throws->[String:CGImage] {
        var images:[String:CGImage]=[:]
        for e in genome.elements where e.kind=="image" || (e.shape=="motif-survey-module-substitution" && e.rasterAsset != nil) {guard let asset=e.rasterAsset else{throw PosterError.invalid("Image layer has no saved asset.")};images[e.sourceElementID]=try SceneRasterLoader.load(asset)}
        return images
    }
    static func draw(_ genome:StyleGenome,ctx:CGContext,rasters:[String:CGImage]=[:],contrastMasks:[String:CGImage]=[:],width:Double,height:Double,seed:UInt64,variation:Double,title:String?,stage:ConstructionStage) {
        ctx.translateBy(x:0,y:Double(height));ctx.scaleBy(x:Double(width),y:-Double(height))
        drawNormalized(genome,ctx:ctx,rasters:rasters,contrastMasks:contrastMasks,width:width,height:height,seed:seed,variation:variation,title:title,stage:stage)
    }
    static func drawNormalized(_ genome:StyleGenome,ctx:CGContext,rasters:[String:CGImage]=[:],contrastMasks:[String:CGImage]=[:],width:Double,height:Double,seed:UInt64,variation:Double,title:String?,stage:ConstructionStage) {
        ctx.setFillColor(color(genome.background));ctx.fill(CGRect(x:0,y:0,width:1,height:1))
        var random=SeededRandom(seed:seed)
        func paint(_ element:SceneElement,rect:CGRect,path:CGPath,bounds:CGRect) {
            for copy in 0..<(stage == .finished ? max(1,min(24,element.copies)):1) {
                ctx.saveGState()
                if let clip=element.clipBounds {ctx.clip(to:clip.rect)}
                if element.blendMode=="multiply"{ctx.setBlendMode(.multiply)}else if element.blendMode=="difference"{ctx.setBlendMode(.difference)}
                ctx.translateBy(x:rect.midX+Double(copy)*element.offsetX,y:rect.midY+Double(copy)*element.offsetY)
                // Account for the normalized non-square canvas when rotating.
                ctx.scaleBy(x:1,y:1/genome.aspect);ctx.rotate(by:element.rotation * .pi/180);ctx.scaleBy(x:1,y:genome.aspect)
                if element.preserveTypeProportions==true {
                    let scale=element.typeEmSize.map{$0*Double(height)/100} ?? min(rect.width*Double(width)/bounds.width,rect.height*Double(height)/bounds.height)
                    let actualHeight=bounds.height*scale/Double(height),actualWidth=bounds.width*scale/Double(width)
                    let alignment=element.textAlignment=="center" ? (rect.width-actualWidth)/2:element.textAlignment=="right" ? rect.width-actualWidth:0
                    ctx.translateBy(x:-rect.width/2+alignment,y:-rect.height/2+actualHeight)
                    ctx.scaleBy(x:scale/Double(width),y:-scale/Double(height))
                }else{
                    ctx.translateBy(x:-rect.width/2,y:rect.height/2)
                    ctx.scaleBy(x:rect.width/bounds.width,y:-rect.height/bounds.height)
                }
                ctx.translateBy(x:-bounds.minX,y:-bounds.minY)
                if element.shadow {
                    ctx.saveGState();ctx.translateBy(x:bounds.width*element.offsetX/max(rect.width,0.001),y:-bounds.height*element.offsetY/max(rect.height,0.001))
                    ctx.addPath(path);ctx.setFillColor(color("#000000",alpha:0.5));ctx.fillPath();ctx.restoreGState()
                }
                ctx.addPath(path);ctx.setFillColor(color(element.color));ctx.setStrokeColor(color(element.color))
                if element.textTreatment=="vector-halftone" {
                    ctx.clip()
                    let step=element.geometry?["screen"] ?? 3.5,phase=element.geometry?["phase"] ?? 0
                    var y=bounds.minY
                    while y<=bounds.maxY {
                        var x=bounds.minX
                        while x<=bounds.maxX {
                            let wave=0.62+0.25*sin((x-bounds.minX)/max(1,bounds.width)*Double.pi*2+phase+(y-bounds.minY)/bounds.height*3)
                            let radius=step*wave*0.49
                            ctx.fillEllipse(in:CGRect(x:x-radius,y:y-radius,width:radius*2,height:radius*2));x += step
                        }
                        y += step
                    }
                }else if element.textTreatment=="knockout-outline" {
                    ctx.setFillColor(color(genome.background));ctx.setLineWidth(element.outlineWidth ?? 1.15);ctx.drawPath(using:.fillStroke)
                }else if element.outline {ctx.setLineWidth(element.outlineWidth ?? 1.0);ctx.strokePath()}else{ctx.fillPath()}
                ctx.restoreGState()
            }
        }
        // The contrast ink is painted only where the declared shapes left ink, so type reads as cut from them.
        func paintContrast(_ element:SceneElement,rect:CGRect,path:CGPath,bounds:CGRect,mask:CGImage) {
            ctx.saveGState()
            ctx.translateBy(x:0,y:1);ctx.scaleBy(x:1,y:-1);ctx.clip(to:CGRect(x:0,y:0,width:1,height:1),mask:mask);ctx.scaleBy(x:1,y:-1);ctx.translateBy(x:0,y:-1)
            paint(element,rect:rect,path:path,bounds:bounds);ctx.restoreGState()
        }
        var interlocked:[(SceneElement,CGRect,CGPath,CGRect,CGImage)]=[]
        let largest=genome.elements.filter{$0.kind=="text"}.max{$0.bounds.area<$1.bounds.area}?.sourceElementID
        let largestText=Set(genome.elements.filter{$0.kind=="text"}.sorted{$0.bounds.area>$1.bounds.area}.prefix(2).map(\.sourceElementID))
        let ordered=OrbitWrapGeometry.passes(genome).enumerated().sorted { a,b in
            let az=a.element.zIndex ?? (a.element.kind=="text" ? 100:0),bz=b.element.zIndex ?? (b.element.kind=="text" ? 100:0)
            return az==bz ? a.offset<b.offset:az<bz
        }.map(\.element)
        for element in ordered {
            if element.paperAttachment != nil{continue}
            guard element.bounds.valid || (element.allowsBleed==true && [element.bounds.x,element.bounds.y,element.bounds.width,element.bounds.height].allSatisfy(\.isFinite) && element.bounds.width>0 && element.bounds.height>0 && element.bounds.width<(element.geometry?["dominantObject"] != nil ? 20:5) && element.bounds.height<(element.geometry?["dominantObject"] != nil ? 20:5)) else{continue}
            if let minimum=element.minimumStage,ConstructionStage.allCases.firstIndex(of:stage)!<minimum{continue}
            let b=element.bounds
            let offsetX=random.value(-variation,variation)*0.12,offsetY=random.value(-variation,variation)*0.12
            let rect=CGRect(x:b.x+offsetX,y:b.y+offsetY,width:b.width*genome.textScale,height:b.height*genome.textScale)
            if GravityTypeSystems.draw(element,scene:genome,context:ctx,stage:stage){continue}
            if element.kind=="image",let image=rasters[element.sourceElementID] {
                ctx.saveGState();if let clip=element.clipBounds{ctx.clip(to:clip.rect)}
                ctx.translateBy(x:b.x,y:b.y+b.height);ctx.scaleBy(x:b.width,y:-b.height)
                ctx.interpolationQuality = .high;ctx.draw(image,in:CGRect(x:0,y:0,width:1,height:1));ctx.restoreGState()
                continue
            }
            // A modified display-type layer: a vector PDF page drawn over the page box.
            if element.kind=="vector" {
                if let url=element.rasterAsset?.url,let page=CGPDFDocument(url as CFURL)?.page(at:1) {
                    let media=page.getBoxRect(.mediaBox)
                    ctx.saveGState();if let clip=element.clipBounds{ctx.clip(to:clip.rect)}
                    ctx.translateBy(x:b.x,y:b.y+b.height);ctx.scaleBy(x:b.width/media.width,y:-b.height/media.height)
                    ctx.drawPDFPage(page);ctx.restoreGState()
                }
                continue
            }
            if stage == .blockout && element.kind=="text" {
                if element.typeSystemID != nil || largestText.contains(element.sourceElementID) || (genome.layoutInheritance != nil && element.sourceAnchor != nil) {
                    ctx.saveGState();ctx.translateBy(x:rect.midX,y:rect.midY);ctx.scaleBy(x:1,y:1/genome.aspect);ctx.rotate(by:element.rotation * .pi/180);ctx.scaleBy(x:1,y:genome.aspect);ctx.translateBy(x:-rect.midX,y:-rect.midY)
                    ctx.setFillColor(color(element.color,alpha:0.9));ctx.fill(rect);ctx.restoreGState()
                }
                continue
            }
            if stage == .primary && element.kind=="text" && !largestText.contains(element.sourceElementID){continue}
            if PaperReliefGeometry.draw(element,scene:genome,rect:rect,context:ctx,stage:stage){continue}
            if ContourSystems.draw(element,rect:rect,context:ctx,aspect:genome.aspect){continue}
            if SurveyTypeGeometry.draw(element,rect:rect,context:ctx,aspect:genome.aspect,text:(element.sourceElementID==largest ? title:nil),image:rasters[element.sourceElementID]){continue}
            if element.kind=="shape" {
                ctx.saveGState();if let clip=element.clipBounds{ctx.clip(to:clip.rect)};ctx.translateBy(x:rect.midX,y:rect.midY);ctx.scaleBy(x:1,y:1/genome.aspect);ctx.rotate(by:element.rotation * .pi/180);ctx.scaleBy(x:1,y:genome.aspect);ctx.translateBy(x:-rect.midX,y:-rect.midY)
                ctx.setFillColor(color(element.color))
                if element.blendMode=="multiply"{ctx.setBlendMode(.multiply)}else if element.blendMode=="difference"{ctx.setBlendMode(.difference)}
                if DominantShapeGeometry.draw(element,rect:rect,context:ctx,aspect:genome.aspect) || PosterShapeGeometry.draw(element,rect:rect,context:ctx,aspect:genome.aspect,stage:stage) || ProceduralGeometry.draw(element,rect:rect,context:ctx,aspect:genome.aspect,stage:stage) {
                }else if element.shape=="quarter-disc" || element.shape=="quarter-ring" {
                    ctx.saveGState();ctx.clip(to:CGRect(x:rect.midX,y:rect.minY,width:rect.width/2,height:rect.height/2));ctx.addEllipse(in:rect)
                    if element.shape=="quarter-ring" {ctx.addEllipse(in:rect.insetBy(dx:rect.width*0.18,dy:rect.height*0.18))};ctx.drawPath(using:.eoFill)
                    ctx.restoreGState()
                }else if element.shape=="disc" {
                    ctx.fillEllipse(in:rect);ctx.setStrokeColor(color(genome.background));ctx.setLineWidth(0.0018);ctx.strokeEllipse(in:rect)
                }else if element.shape=="crescent" {
                    ctx.saveGState();ctx.addEllipse(in:rect);ctx.clip()
                    ctx.addEllipse(in:rect)
                    ctx.addEllipse(in:CGRect(x:rect.minX+rect.width*0.18,y:rect.minY-rect.height*0.03,width:rect.width*0.92,height:rect.height*1.06))
                    ctx.drawPath(using:.eoFill);ctx.restoreGState()
                }else if element.shape=="ribbon" {
                    let path=CGMutablePath();path.move(to:CGPoint(x:rect.minX,y:rect.minY+rect.height*0.2))
                    path.addCurve(to:CGPoint(x:rect.maxX,y:rect.minY+rect.height*0.34),control1:CGPoint(x:rect.minX+rect.width*0.18,y:rect.minY-rect.height*0.35),control2:CGPoint(x:rect.maxX-rect.width*0.2,y:rect.maxY+rect.height*0.1))
                    path.addLine(to:CGPoint(x:rect.maxX,y:rect.minY+rect.height*0.72))
                    path.addCurve(to:CGPoint(x:rect.minX,y:rect.minY+rect.height*0.6),control1:CGPoint(x:rect.maxX-rect.width*0.24,y:rect.maxY+rect.height*0.5),control2:CGPoint(x:rect.minX+rect.width*0.1,y:rect.minY-rect.height*0.05));path.closeSubpath();ctx.addPath(path);ctx.fillPath()
                }else if element.shape=="ellipse-outline"{ctx.setStrokeColor(color(element.color));ctx.setLineWidth(0.0018);ctx.strokeEllipse(in:rect)
                }else if element.shape=="capsule-outline"{ctx.setStrokeColor(color(element.color));ctx.setLineWidth(0.0018);ctx.addPath(CGPath(roundedRect:rect,cornerWidth:min(rect.width/2,rect.height*genome.aspect/2),cornerHeight:min(rect.height/2,rect.width/(2*genome.aspect)),transform:nil));ctx.strokePath()
                }else if element.shape=="ellipse"{ctx.fillEllipse(in:rect)}else if element.shape=="triangle"{ctx.move(to:CGPoint(x:rect.midX,y:rect.minY));ctx.addLine(to:CGPoint(x:rect.maxX,y:rect.maxY));ctx.addLine(to:CGPoint(x:rect.minX,y:rect.maxY));ctx.closePath();ctx.fillPath()}else{ctx.fill(rect)}
                ctx.restoreGState()
                continue
            }
            if element.kind != "text" {
                // This placeholder explicitly preserves an unresolved region rather than copying source pixels.
                ctx.setStrokeColor(color(element.color,alpha:0.28));ctx.setLineWidth(0.0015)
                if element.shape=="ellipse" {ctx.strokeEllipse(in:rect)}else{ctx.stroke(rect)}
                continue
            }
            let string=(element.sourceElementID==largest ? title:nil) ?? element.text ?? ""
            guard !string.isEmpty else{continue}
            let path=textPath(element,string:string,genome:genome)
            let bounds=path.boundingBoxOfPath;guard bounds.width>0,bounds.height>0 else{continue}
            if element.textTreatment=="protected-info" {
                let scale:Double=min(rect.width*width/bounds.width,rect.height*height/bounds.height)
                let inkWidth:Double=bounds.width*scale/width,inkHeight:Double=bounds.height*scale/height
                let clearance=CGRect(x:rect.minX,y:rect.minY,width:inkWidth,height:inkHeight).insetBy(dx:-0.003,dy:-0.002)
                ctx.setFillColor(color(genome.background));ctx.fill(clearance)
            }
            paint(element,rect:rect,path:path,bounds:bounds)
            // Masks are rendered without preview jitter, so jittered previews skip the contrast pass.
            if let contrast=element.overlapContrast,variation==0,let mask=contrastMasks[contrast.maskKey] {
                var inked=element;inked.color=contrast.ink;inked.shadow=false
                if contrast.layer=="top"{interlocked.append((inked,rect,path,bounds,mask))}else{paintContrast(inked,rect:rect,path:path,bounds:bounds,mask:mask)}
            }
        }
        for (element,rect,path,bounds,mask) in interlocked{paintContrast(element,rect:rect,path:path,bounds:bounds,mask:mask)}
    }

}
