import Foundation
import CoreGraphics
import Vision

/// Immutable, checksum-bound media. Crops use upright, top-left normalized coordinates.
public struct SceneRasterAsset: Codable, Sendable {
    public var url: URL
    public var sha256: String
    public var crop: UnitBox
    public init(url:URL,sha256:String,crop:UnitBox = .full){self.url=url;self.sha256=sha256;self.crop=crop}
}
public struct ImageAttentionRegion:Codable,Sendable {
    public var kind:String;public var bounds:UnitBox;public var confidence:Double
}
public struct ImageSpatialCell:Codable,Sendable {
    public var bounds:UnitBox;public var luminance:Double;public var edge:Double
}
public struct ImageInfluenceProfile:Codable,Sendable {
    public var version="image-influence-v1"
    public var asset:SceneRasterAsset
    public var originalName:String
    public var width:Int;public var height:Int
    public var statistics:VisualStatistics
    public var attention:[ImageAttentionRegion]
    public var cells:[ImageSpatialCell]
    public var dominantAngle:Double
    public var embedding:VisualEmbedding?
    public var notes:[String]
    public var aspect:Double{Double(height)/Double(width)}
    public var quietest:ImageSpatialCell?{cells.min{$0.edge<$1.edge}}
}
public struct ImageInfluenceSettings:Codable,Sendable {
    public var generatedTypeJudging:Bool? = nil
    public var diverseFinalists:Bool? = nil
    public var compositionDirections:Bool? = nil
    public var useGeneratedTypeJudging:Bool{generatedTypeJudging ?? false}
    public var useDiverseFinalists:Bool{diverseFinalists ?? false}
    public var useCompositionDirections:Bool{compositionDirections ?? false}
    public var palette=0.85
    public var layout=0.85
    public var shapes=0.65
    public var shapeFrequency:Double? = nil
    public var shapePreferredWidth:Double? = nil
    public var effectiveShapeFrequency:Double{shapeFrequency ?? 0.25}
    public var placement="mixed"
    public init(){}
    public func validate()throws {
        guard (shapePreferredWidth.map{ $0.isFinite && (0.48...1.4).contains($0)} ?? true),[palette,layout,shapes,effectiveShapeFrequency].allSatisfy({$0.isFinite && (0...1).contains($0)}),["mixed","full-bleed","framed","split"].contains(placement) else{throw PosterError.invalid("Invalid image influence controls.")}
    }
}
public struct ImageCompositionInfluence:Codable,Sendable {
    public var hypothesis:String? = nil
    public var analysisURL:URL? = nil
    public var profile:ImageInfluenceProfile
    public var settings:ImageInfluenceSettings
    public var placement:String
    public var imageFrame:UnitBox
    public var operations:[String]
    public var donorIDs:[String]
}

public enum ImageInfluenceAnalyzer {
    /// Analysis never writes to the poster library, model directories or semantic indexes.
    public static func analyze(_ url:URL,assets:URL)throws->ImageInfluenceProfile {
        guard url.isFileURL else{throw PosterError.invalid("Choose a local image.")}
        let image=try LibraryRaster.oriented(url,maxSize:3000)
        guard image.width>=64,image.height>=64 else{throw PosterError.invalid("Choose an image at least 64 × 64 pixels.")}
        let statistics=try LibraryRaster.statistics(image)
        let (cells,angle)=try spatial(image)
        var regions:[ImageAttentionRegion]=[],notes:[String]=[]
        func topLeft(_ rect:CGRect)->UnitBox{.init(x:max(0,rect.minX),y:max(0,1-rect.maxY),width:min(1,rect.width),height:min(1,rect.height))}
        let saliency=VNGenerateAttentionBasedSaliencyImageRequest()
        do{try VNImageRequestHandler(cgImage:image).perform([saliency]);for r in saliency.results?.first?.salientObjects ?? []{regions.append(.init(kind:"attention",bounds:topLeft(r.boundingBox),confidence:Double(r.confidence)))}}catch{notes.append("Attention detection unavailable: \(error.localizedDescription); local edge map remains active.")}
        let faces=VNDetectFaceRectanglesRequest()
        do{try VNImageRequestHandler(cgImage:image).perform([faces]);for r in faces.results ?? []{regions.append(.init(kind:"face",bounds:topLeft(r.boundingBox),confidence:Double(r.confidence)))}}catch{notes.append("Face detection unavailable; attention and texture remain active.")}
        let text=VNRecognizeTextRequest();text.recognitionLevel = .fast;text.usesLanguageCorrection=false
        do{try VNImageRequestHandler(cgImage:image).perform([text]);for r in text.results ?? [] where (r.topCandidates(1).first?.confidence ?? 0)>0.45{regions.append(.init(kind:"existing lettering",bounds:topLeft(r.boundingBox),confidence:Double(r.confidence)))}}catch{notes.append("Existing lettering detection unavailable.")}
        let embedding=try? LibraryRaster.embedding(image)
        if embedding==nil{notes.append("Vision image embedding unavailable; donor matching uses composition and texture measurements.")}
        try FileManager.default.createDirectory(at:assets,withIntermediateDirectories:true)
        let temporary=assets.appending(path:"normalized-\(UUID().uuidString).png")
        defer{try? FileManager.default.removeItem(at:temporary)}
        try PosterRenderer.png(image,to:temporary)
        let data=try Data(contentsOf:temporary),digest=LibraryRaster.hash(data),target=assets.appending(path:digest+".png")
        if !FileManager.default.fileExists(atPath:target.path){try data.write(to:target,options:.atomic)}
        notes.append("Palette, texture and direction are measured descriptors, not a semantic style classification. Vision attention, faces and existing lettering are proposals. Overlap remains an artistic choice.")
        return ImageInfluenceProfile(asset:.init(url:target,sha256:digest),originalName:url.lastPathComponent,width:image.width,height:image.height,statistics:statistics,attention:regions,cells:cells,dominantAngle:angle,embedding:embedding,notes:notes)
    }
    static func spatial(_ image:CGImage)throws->([ImageSpatialCell],Double) {
        let w=96,h=max(48,min(288,Int(Double(w)*Double(image.height)/Double(image.width))))
        var pixels=[UInt8](repeating:0,count:w*h*4)
        let ok=pixels.withUnsafeMutableBytes{p->Bool in
            guard let ctx=CGContext(data:p.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
            ctx.setFillColor(CGColor(gray:0.96,alpha:1));ctx.fill(CGRect(x:0,y:0,width:w,height:h))
            ctx.draw(image,in:CGRect(x:0,y:0,width:w,height:h));return true
        }
        guard ok else{throw PosterError.render}
        var l=[Double](repeating:0,count:w*h)
        for i in 0..<w*h {
            let red=Double(pixels[i*4])/255.0
            let green=Double(pixels[i*4+1])/255.0
            let blue=Double(pixels[i*4+2])/255.0
            l[i]=red*0.2126+green*0.7152+blue*0.0722
        }
        var edges=[Double](repeating:0,count:w*h),xx=0.0,yy=0.0,xy=0.0
        for y in 1..<h-1 {for x in 1..<w-1 {
            let i=y*w+x
            let gx:Double=(l[i+1]-l[i-1])/2.0
            let gy:Double=(l[i+w]-l[i-w])/2.0
            edges[i]=min(1.0,hypot(gx,gy)*4.0)
            xx+=gx*gx;yy+=gy*gy;xy+=gx*gy
        }}
        var cells:[ImageSpatialCell]=[]
        let rows=h/4
        for y in 0..<rows {for x in 0..<24 {var lum=0.0,edge=0.0;for dy in 0..<4{for dx in 0..<4{let i=(y*4+dy)*w+x*4+dx;lum+=l[i];edge+=edges[i]}}
            cells.append(.init(bounds:.init(x:Double(x)/24,y:Double(y)/Double(rows),width:1/24,height:1/Double(rows)),luminance:lum/16,edge:edge/16))}}
        // Structure-tensor tangent in image coordinates, folded to -90...90 degrees.
        var angle=0.5*atan2(2*xy,xx-yy)*180 / .pi+90
        if angle>90{angle-=180}
        return(cells,angle)
    }
}

public enum SceneRasterLoader {
    public static func load(_ asset:SceneRasterAsset)throws->CGImage {
        guard asset.url.isFileURL,asset.crop.valid,asset.sha256.count==64 else{throw PosterError.invalid("Malformed poster image asset.")}
        let size=(try asset.url.resourceValues(forKeys:[.fileSizeKey])).fileSize ?? 0
        guard size>0,size<100_000_000 else{throw PosterError.invalid("Poster image asset is missing or too large.")}
        let data=try Data(contentsOf:asset.url)
        guard LibraryRaster.hash(data)==asset.sha256 else{throw PosterError.invalid("The poster image changed since this genome was saved. Import it again.")}
        return try LibraryRaster.crop(LibraryRaster.oriented(asset.url,maxSize:4000),asset.crop)
    }
}
