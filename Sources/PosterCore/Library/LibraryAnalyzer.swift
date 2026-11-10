import Foundation
import ImageIO
import Vision
import CoreImage

final class LibraryAnalyzer {
    private let ci = CIContext()
    private let visual=LibraryVisualEmbedder()
    private let colorAnalyzer=PosterColorAnalyzer()
    func embedding(_ image:CGImage)throws->VisualEmbedding {try visual.embed(image)}
    struct Surface { var image:CGImage;var quad:[[Double]];var confidence:Double;var warning:String? }
    static func validQuad(_ quad:[[Double]])->Bool {
        guard quad.count==4,quad.allSatisfy({$0.count==2 && $0.allSatisfy({$0.isFinite && (0...1).contains($0)})}) else{return false}
        var crosses:[Double]=[]
        for i in 0..<4 {let a=quad[i],b=quad[(i+1)%4],c=quad[(i+2)%4];crosses.append((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))}
        let area=(0..<4).reduce(0.0){sum,i in let j=(i+1)%4;return sum+quad[i][0]*quad[j][1]-quad[j][0]*quad[i][1]}/2
        return crosses.allSatisfy{$0>0.00001} && area>0.005
    }
    func manualSurface(_ image:CGImage,quad:[[Double]])throws->Surface {
        guard Self.validQuad(quad) else{throw PosterError.invalid("Choose four convex poster corners clockwise: top-left, top-right, bottom-right, bottom-left. Corners must be inside the photo.")}
        let keys=["inputTopLeft","inputTopRight","inputBottomRight","inputBottomLeft"]
        var parameters:[String:Any]=[kCIInputImageKey:CIImage(cgImage:image)]
        for (key,p) in zip(keys,quad){parameters[key]=CIVector(x:p[0]*Double(image.width),y:(1-p[1])*Double(image.height))}
        guard let filter=CIFilter(name:"CIPerspectiveCorrection",parameters:parameters),var output=filter.outputImage else{throw PosterError.image("Manual poster correction failed.")}
        let scale=min(1,1400/max(output.extent.width,output.extent.height));output=output.transformed(by:CGAffineTransform(scaleX:scale,y:scale))
        guard let result=ci.createCGImage(output,from:output.extent) else{throw PosterError.render}
        return Surface(image:result,quad:quad,confidence:1,warning:"Poster border confirmed manually; re-extracted elements still require review.")
    }
    func surfaces(_ image: CGImage) throws -> [Surface] {
        let request=VNDetectRectanglesRequest()
        request.maximumObservations=12;request.minimumConfidence=0.65;request.minimumSize=0.22
        request.minimumAspectRatio=0.32;request.maximumAspectRatio=1.0;request.quadratureTolerance=25
        try VNImageRequestHandler(cgImage:image,options:[:]).perform([request])
        let rectangles=(request.results ?? []).filter { $0.boundingBox.width*$0.boundingBox.height > 0.09 }.sorted { $0.boundingBox.width*$0.boundingBox.height > $1.boundingBox.width*$1.boundingBox.height }
        var selected:[VNRectangleObservation]=[]
        for r in rectangles {
            let overlap=selected.contains { prior in
                let i=prior.boundingBox.intersection(r.boundingBox)
                return !i.isNull && i.width*i.height/max(0.001,r.boundingBox.width*r.boundingBox.height)>0.70
            }
            if !overlap { selected.append(r) }
            if selected.count==4 {break}
        }
        if selected.isEmpty {return [Surface(image:image,quad:[[0,0],[1,0],[1,1],[0,1]],confidence:0,warning:"No reliable poster quadrilateral found; full photograph retained. Review/correct surface before trusting its style model.")]}
        return try selected.map { rectangle in
            let points=[rectangle.topLeft,rectangle.topRight,rectangle.bottomRight,rectangle.bottomLeft]
            let keys=["inputTopLeft","inputTopRight","inputBottomRight","inputBottomLeft"]
            var parameters:[String:Any]=[kCIInputImageKey:CIImage(cgImage:image)]
            for (key,p) in zip(keys,points) {parameters[key]=CIVector(x:p.x*Double(image.width),y:p.y*Double(image.height))}
            guard let filter=CIFilter(name:"CIPerspectiveCorrection",parameters:parameters),let output=filter.outputImage,
                  let corrected=ci.createCGImage(output,from:output.extent) else { throw PosterError.image("Perspective correction failed.") }
            return Surface(image:corrected,quad:points.map{[Double($0.x),1-Double($0.y)]},confidence:Double(rectangle.confidence),warning:"Detected rectangle is a poster-surface proposal; photographs may contain windows, frames or several posters. Confirm the surface in review.")
        }
    }
    func analyze(surface:Surface,source:SourceAttribution,sourceID:String,index:Int,directory:URL,words:Bool) throws -> PosterRecord {
        let id=sourceID+"-p\(index)"
        let folder=directory.appending(path:"posters/\(id)")
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let image=surface.image,url=folder.appending(path:"poster.jpg")
        try Self.jpeg(image,to:url,maxDimension:1400,quality:0.92)
        let stats=try LibraryRaster.statistics(image),embedding=try self.embedding(image)
        let text=VNRecognizeTextRequest();text.recognitionLevel = .accurate;text.usesLanguageCorrection=false
        text.minimumTextHeight=0.008;text.automaticallyDetectsLanguage=true
        try VNImageRequestHandler(cgImage:image,options:[:]).perform([text])
        var elements:[PosterElement]=[]
        func box(_ r:CGRect)->UnitBox {
            let x=max(0,Double(r.minX)),y=max(0,1-Double(r.maxY))
            return UnitBox(x:x,y:y,width:min(1-x,Double(r.width)),height:min(1-y,Double(r.height)))
        }
        func append(kind:String,bounds:UnitBox,value:String?,confidence:Double,rotation:Double,parent:String) throws -> String? {
            guard bounds.valid, bounds.width*Double(image.width)>=5,bounds.height*Double(image.height)>=5 else{return nil}
            let key="\(kind):\(bounds.x):\(bounds.y):\(bounds.width):\(bounds.height):\(value ?? "")"
            let eid=id+"-"+String(LibraryRaster.hash(Data(key.utf8)).prefix(12))
            let crop=try LibraryRaster.crop(image,bounds)
            let cropURL=folder.appending(path:"\(eid).jpg")
            try Self.jpeg(crop,to:cropURL)
            let metrics=try LibraryRaster.statistics(crop)
            var tags=Self.measuredTags(metrics:metrics,rotation:rotation)
            if kind=="text-line" || kind=="word" { tags.append(TechniqueTag("typography",state:"detected",confidence:confidence,evidence:["Vision recognized text in this crop."],origin:"OCR")) }
            elements.append(PosterElement(id:eid,parentID:parent,kind:kind,bounds:bounds,rotation:rotation,text:value,
                confidence:confidence,reviewStatus:kind=="region-proposal" ? "proposal" : "unreviewed",imageURL:cropURL,
                embedding:try self.embedding(crop),statistics:metrics,tags:tags,relatedIDs:[],colors:try colorAnalyzer.analyze(crop)))
            return eid
        }
        for observation in text.results ?? [] {
            guard let value=observation.topCandidates(1).first else{continue}
            let rotation = -atan2(Double(observation.topRight.y-observation.topLeft.y),Double(observation.topRight.x-observation.topLeft.x))*180 / .pi
            let lineID=try append(kind:"text-line",bounds:box(observation.boundingBox),value:value.string,confidence:Double(value.confidence),rotation:rotation,parent:id)
            if words, let lineID {
                var cursor=value.string.startIndex
                while cursor<value.string.endIndex {
                    while cursor<value.string.endIndex && value.string[cursor].isWhitespace {cursor=value.string.index(after:cursor)}
                    let start=cursor
                    while cursor<value.string.endIndex && !value.string[cursor].isWhitespace {cursor=value.string.index(after:cursor)}
                    guard start<cursor else{continue}
                    if let wordBox=try? value.boundingBox(for:start..<cursor) {
                        _ = try append(kind:"word",bounds:box(wordBox.boundingBox),value:String(value.string[start..<cursor]),confidence:Double(value.confidence),rotation:rotation,parent:lineID)
                    }
                }
            }
        }
        // Contours propose non-text regions. They are not a semantic segmentation model.
        let contours=VNDetectContoursRequest();contours.maximumImageDimension=512;contours.detectsDarkOnLight=stats.meanLuminance>0.5
        var warnings=[surface.warning].compactMap{$0}
        do {
            try VNImageRequestHandler(cgImage:image,options:[:]).perform([contours])
            let paths=contours.results?.first?.topLevelContours ?? []
            let boxes=paths.map {box($0.normalizedPath.boundingBoxOfPath)}.filter {$0.area>0.009 && $0.area<0.75}.sorted{$0.area>$1.area}
            var used:[UnitBox]=[]
            for b in boxes {
                if used.contains(where:{$0.overlap(b)>0.85}) {continue}
                let textCoverage=elements.filter{$0.kind=="text-line" && b.overlap($0.bounds)>0.65}.reduce(0.0){$0+$1.bounds.area}
                if textCoverage/max(b.area,0.001)>0.5 {continue}
                _ = try append(kind:"region-proposal",bounds:b,value:nil,confidence:0.35,rotation:0,parent:id)
                used.append(b);if used.count>=16 {warnings.append("Region proposals capped at 16; use review to add missing elements.");break}
            }
        }catch {warnings.append("Contour proposals unavailable: \(error.localizedDescription)")}
        if elements.isEmpty {
            _ = try append(kind:"region-proposal",bounds:.full,value:nil,confidence:0.2,rotation:0,parent:id)
            warnings.append("No text or distinct regions found; full-surface proposal embedded.")
        }
        var tags=Self.measuredTags(metrics:stats,rotation:0)
        let lines=elements.indices.filter{elements[$0].kind=="text-line"}
        var repeated:[String:[Int]]=[:]
        for i in lines {
            let normalized=(elements[i].text ?? "").lowercased().filter{$0.isLetter || $0.isNumber}
            if normalized.count>=3 {repeated[normalized,default:[]].append(i)}
        }
        for group in repeated.values where group.count>1 {
            let tag=TechniqueTag("text-duplication",state:"detected",confidence:0.84,evidence:["The same OCR string occurs in \(group.count) separate text-line boxes."],origin:"OCR")
            tags.append(tag)
            for i in group {elements[i].tags.append(tag);elements[i].relatedIDs=group.filter{$0 != i}.map{elements[$0].id}}
            let ordered=group.sorted{elements[$0].bounds.y<elements[$1].bounds.y}
            for pair in zip(ordered,ordered.dropFirst()) {
                let a=elements[pair.0].bounds,b=elements[pair.1].bounds
                if abs(a.x-b.x)<0.08 && abs(a.y-b.y)<max(a.height,b.height)*1.4 {
                    let offset=TechniqueTag("offset-replication",confidence:0.55,evidence:["Repeated text has a small positional shift; offset, outline and shadow remain ambiguous."],origin:"OCR")
                    tags.append(offset);elements[pair.0].tags.append(offset);elements[pair.1].tags.append(offset)
                }
            }
        }
        if lines.count>18 {tags.append(TechniqueTag("dense-typography",state:"detected",confidence:0.8,evidence:["\(lines.count) recognized text lines on the rectified surface."],origin:"measurement"))}
        if elements.contains(where:{$0.kind=="text-line" && abs($0.rotation)>12}) {tags.append(TechniqueTag("rotation",state:"detected",confidence:0.85,evidence:["OCR quadrilaterals contain text rotated by more than 12 degrees."],origin:"OCR"))}
        // Compare region crops with actual image features to suggest replication, never infer it from color alone.
        let regions=elements.indices.filter{elements[$0].kind=="region-proposal"}
        for (position,i) in regions.enumerated() { for j in regions.dropFirst(position+1) {
            let a=elements[i],b=elements[j]
            let ratio=a.bounds.area/max(0.0001,b.bounds.area)
            if (0.65...1.55).contains(ratio),a.bounds.overlap(b.bounds)<0.2,try a.embedding.distance(to:b.embedding)<0.45 {
                let tag=TechniqueTag("shape-replication",confidence:0.6,evidence:["Two disjoint, similarly sized region crops have nearby Vision feature prints."],origin:"measurement")
                elements[i].tags.append(tag);elements[j].tags.append(tag);elements[i].relatedIDs.append(b.id);elements[j].relatedIDs.append(a.id);tags.append(tag)
            }
        }}
        let terms:[String:String]=["shadow":"drop-shadow","ombre":"drop-shadow","offset":"offset-replication","halftone":"halftone","gradient":"gradient","collage":"collage","outline":"outline-text","duplication":"text-duplication"]
        for (word,tag) in terms where source.caption.lowercased().contains(word) {
            tags.append(TechniqueTag(tag,confidence:0.45,evidence:["Caption contains ‘\(word)’; this is a caption hint, not visual verification."],origin:"caption"))
        }
        tags=Self.uniqueTags(tags)
        let textIndex=([source.caption]+elements.compactMap(\.text)).joined(separator:" ")
        let genome=LibrarySceneRenderer.initialGenome(posterID:id,image:image,elements:elements,statistics:stats)
        return PosterRecord(id:id,sourceID:sourceID,source:source,surfaceIndex:index,sourceQuad:surface.quad,
            surfaceConfidence:surface.confidence,reviewStatus:"surface-and-elements-need-review",warnings:warnings,imageURL:url,
            width:image.width,height:image.height,embedding:embedding,textIndex:textIndex,statistics:stats,tags:tags,elements:elements,genome:genome,colors:try colorAnalyzer.analyze(image))
    }
    static func measuredTags(metrics:VisualStatistics,rotation:Double)->[TechniqueTag] {
        var tags:[TechniqueTag]=[]
        if metrics.saturation<0.055 {tags.append(TechniqueTag("monochrome",state:"detected",confidence:0.96,evidence:["Mean RGB chroma is below 0.055 on an upright sRGB thumbnail."],origin:"measurement"))}
        if metrics.contrast>0.31 {tags.append(TechniqueTag("high-contrast",state:"detected",confidence:0.9,evidence:["Luminance standard deviation exceeds 0.31."],origin:"measurement"))}
        if abs(rotation)>12 {tags.append(TechniqueTag("rotation",state:"detected",confidence:0.85,evidence:["Text baseline rotated \(Int(rotation)) degrees."],origin:"OCR"))}
        return tags
    }
    static func uniqueTags(_ tags:[TechniqueTag])->[TechniqueTag] {
        var best:[String:TechniqueTag]=[:]
        for tag in tags {if best[tag.name].map({$0.confidence<tag.confidence}) ?? true {best[tag.name]=tag}}
        return best.values.sorted{$0.name<$1.name}
    }
    static func jpeg(_ image:CGImage,to url:URL,maxDimension:Int=512,quality:Double=0.82)throws {
        var image=image
        if max(image.width,image.height)>maxDimension {
            let ratio=Double(maxDimension)/Double(max(image.width,image.height)),w=max(2,Int(Double(image.width)*ratio)),h=max(2,Int(Double(image.height)*ratio))
            guard let context=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
            context.interpolationQuality = .high;context.draw(image,in:CGRect(x:0,y:0,width:w,height:h));guard let resized=context.makeImage() else{throw PosterError.render};image=resized
        }
        guard let target=CGImageDestinationCreateWithURL(url as CFURL,"public.jpeg" as CFString,1,nil) else{throw PosterError.render}
        CGImageDestinationAddImage(target,image,[kCGImageDestinationLossyCompressionQuality:quality] as CFDictionary)
        guard CGImageDestinationFinalize(target) else{throw PosterError.render}
    }
}
