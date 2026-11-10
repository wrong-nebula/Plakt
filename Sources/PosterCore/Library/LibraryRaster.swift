import Foundation
import Vision
import ImageIO
import CryptoKit
import CoreImage

public enum LibraryRaster {
    public static let embeddingPreprocessing = "upright-sRGB-vision-scaleFit-v1"
    public static func hash(_ data: Data) -> String { SHA256.hash(data:data).map { String(format:"%02x",$0) }.joined() }
    public static func oriented(_ url: URL, maxSize: Int = 1400) throws -> CGImage {
        guard let source=CGImageSourceCreateWithURL(url as CFURL,nil),
              let image=CGImageSourceCreateThumbnailAtIndex(source,0,[kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:maxSize] as CFDictionary) else { throw PosterError.image("Cannot decode \(url.lastPathComponent).") }
        return image
    }
    public static func embedding(_ image: CGImage) throws -> VisualEmbedding {
        try LibraryVisualEmbedder().embed(image)
    }
    public static func crop(_ image: CGImage, _ b: UnitBox) throws -> CGImage {
        let rect=CGRect(x:b.x*Double(image.width),y:b.y*Double(image.height),width:b.width*Double(image.width),height:b.height*Double(image.height)).integral.intersection(CGRect(x:0,y:0,width:image.width,height:image.height))
        guard let result=image.cropping(to:rect), result.width>=2,result.height>=2 else { throw PosterError.image("Element crop is empty.") }
        return result
    }
    public static func statistics(_ image: CGImage) throws -> VisualStatistics {
        let size=64
        var bytes=[UInt8](repeating:0,count:size*size*4)
        let ok=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:size,height:size,bitsPerComponent:8,bytesPerRow:size*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.draw(image,in:CGRect(x:0,y:0,width:size,height:size));return true
        }
        guard ok else { throw PosterError.render }
        var luminance=[Double](), saturation=0.0, colors:[Int:Int]=[:]
        for i in stride(from:0,to:bytes.count,by:4) {
            let r=Double(bytes[i])/255,g=Double(bytes[i+1])/255,b=Double(bytes[i+2])/255
            luminance.append(0.2126*r + 0.7152*g + 0.0722*b)
            saturation += max(r,g,b)-min(r,g,b)
            let key=Int(bytes[i]/32)*64+Int(bytes[i+1]/32)*8+Int(bytes[i+2]/32);colors[key,default:0]+=1
        }
        let mean=luminance.reduce(0,+)/Double(luminance.count)
        let contrast=sqrt(luminance.reduce(0){$0+pow($1-mean,2)}/Double(luminance.count))
        var edge=0.0
        for y in 1..<size {for x in 1..<size {let i=y*size+x;edge += abs(luminance[i]-luminance[i-1])+abs(luminance[i]-luminance[i-size])}}
        let palette=colors.sorted { $0.value == $1.value ? $0.key<$1.key : $0.value>$1.value }.prefix(6).map { key,count in
            let r=(key/64)*32+16,g=((key/8)%8)*32+16,b=(key%8)*32+16
            return ColorSample(hex:String(format:"#%02x%02x%02x",min(255,r),min(255,g),min(255,b)),proportion:Double(count)/Double(size*size))
        }
        return VisualStatistics(meanLuminance:mean,contrast:contrast,saturation:saturation/Double(size*size),edgeDensity:edge/Double(size*size*2),palette:palette)
    }
    public static func tagNames(_ tags: [TechniqueTag]) -> [String] { tags.filter {$0.state != "rejected"}.map(\.name) }
    public static func write<T:Encodable>(_ value:T,to url:URL) throws {
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys,.prettyPrinted]
        try encoder.encode(value).write(to:url,options:.atomic)
    }
}

// Owned by one catalog actor/analyzer. Reuse Vision request state across a large crop collection.
final class LibraryVisualEmbedder {
    private let request=VNGenerateImageFeaturePrintRequest()
    init(){request.revision=VNGenerateImageFeaturePrintRequestRevision2;request.imageCropAndScaleOption = .scaleFit}
    func embed(_ image:CGImage)throws->VisualEmbedding {
        try VNImageRequestHandler(cgImage:image,options:[:]).perform([request])
        guard let feature=request.results?.first,feature.elementType == .float else{throw PosterError.invalid("Vision did not return float feature data.")}
        return VisualEmbedding(model:"Apple-Vision-image-feature-print",revision:2,dimensions:feature.elementCount,scalar:"float32-le",data:feature.data,preprocessing:LibraryRaster.embeddingPreprocessing)
    }
}
