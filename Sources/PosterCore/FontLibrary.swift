import Foundation
import CoreText
import CoreGraphics
import CryptoKit

public struct FontAsset:Codable,Sendable {
    public var filename:String;public var postscriptName:String;public var style:String
    public var weight:Int;public var sha256:String
}
public struct FontFamilyRecord:Codable,Identifiable,Sendable {
    public var id:String;public var family:String;public var category:String;public var designer:String
    public var sourceURL:URL;public var license:String;public var licenseFile:String;public var faces:[FontAsset]
}
public struct FontAssetManifest:Codable,Sendable {public var version:Int;public var provider:String;public var revision:String;public var families:[FontFamilyRecord]}
public struct FontStyleProfile:Codable,Identifiable,Sendable {
    public var id:String;public var familyID:String;public var family:String;public var category:String
    public var postscriptName:String;public var assetID:String;public var assetSHA256:String
    public var variations:[String:Double];public var weight:Double;public var width:Double;public var italic:Bool
    public var featureValues:[Double];public var embedding:[Double]
    public var specimenEmbedding:VisualEmbedding?
    public var label:String {"\(family) · \(Int(weight))"+(width != 100 ? " · width \(Int(width))":"")+(italic ? " · italic":"")}
}
public struct FontProfileIndex:Codable,Sendable {
    public var version="font-style-embeddings-v2"
    public var specimenRecipe="three fixed-copy rows; independent text position per row; sRGB PNG scaleFit Vision rev2"
    public var sourceRevision:String
    public var featureNames:[String]
    public var dimensions:Int
    public var profiles:[FontStyleProfile]
    public var note="Deterministic descriptive embeddings: category/axis metadata plus Core Text glyph metrics and normalized raster shape measurements. L2-normalized, weighted feature groups. Specimen Vision embeddings use identical copy, placement and image preprocessing across fonts. These are font similarity descriptors, not a trained historical-style classifier or automatic font identification. Fonts remain OFL assets, registered only in the app process."
}

public final class FontLibrary:Sendable {
    public static let shared=FontLibrary()
    public let manifest:FontAssetManifest
    public let profiles:[FontStyleProfile]
    public let directory:URL?
    public let verifiedAssets:Set<String>
    private init() {
        let url=PosterResources.bundle.url(forResource:"manifest",withExtension:"json",subdirectory:"Resources/Fonts")
        directory=url?.deletingLastPathComponent()
        var loaded=(url.flatMap{try? Data(contentsOf:$0)}).flatMap{try? JSONDecoder().decode(FontAssetManifest.self,from:$0)} ?? FontAssetManifest(version:1,provider:"Google Fonts",revision:"missing",families:[])
        var verified:Set<String>=[]
        if let directory {
            for familyIndex in loaded.families.indices {for faceIndex in loaded.families[familyIndex].faces.indices {
                let face=loaded.families[familyIndex].faces[faceIndex]
                let assetURL=directory.appending(path:face.filename)
                if let data=try? Data(contentsOf:assetURL),SHA256.hash(data:data).map({String(format:"%02x",$0)}).joined()==face.sha256 {
                    verified.insert(face.filename)
                    CTFontManagerRegisterFontsForURL(assetURL as CFURL,.process,nil)
                    // Google metadata may name a variable font's named instance rather
                    // than its default face. Resolve the actual file descriptor, never
                    // substitute a similarly named system face.
                    if let descriptors=CTFontManagerCreateFontDescriptorsFromURL(assetURL as CFURL) as? [CTFontDescriptor],let descriptor=descriptors.first(where:{CTFontCopyPostScriptName(CTFontCreateWithFontDescriptor($0,100,nil)) as String==face.postscriptName}) ?? descriptors.first {
                        loaded.families[familyIndex].faces[faceIndex].postscriptName=CTFontCopyPostScriptName(CTFontCreateWithFontDescriptor(descriptor,100,nil)) as String
                    }
                }
            }}
        }
        manifest=loaded
        verifiedAssets=verified
        let indexURL=directory?.appending(path:"profiles.json")
        profiles=indexURL.flatMap{try? Data(contentsOf:$0)}.flatMap{try? JSONDecoder().decode(FontProfileIndex.self,from:$0).profiles} ?? []
    }
    static func axisID(_ tag:String)->UInt32 {tag.utf8.prefix(4).reduce(UInt32(0)){($0<<8)|UInt32($1)}}
    static func tag(_ id:UInt32)->String {String(bytes:[24,16,8,0].map{UInt8((id>>$0)&255)},encoding:.ascii) ?? "????"}
    public static func font(name:String,size:Double=100,variations:[String:Double]?=nil)->CTFont {
        let library=shared
        var descriptor:CTFontDescriptor
        if let asset=library.manifest.families.flatMap(\.faces).first(where:{$0.postscriptName==name}),library.verifiedAssets.contains(asset.filename),let directory=library.directory,
           let descriptors=CTFontManagerCreateFontDescriptorsFromURL(directory.appending(path:asset.filename) as CFURL) as? [CTFontDescriptor],let exact=descriptors.first(where:{CTFontCopyPostScriptName(CTFontCreateWithFontDescriptor($0,100,nil)) as String==name}) ?? descriptors.first {
            descriptor=exact
        }else{descriptor=CTFontCopyFontDescriptor(CTFontCreateWithName(name as CFString,size,nil))}
        if let variations,!variations.isEmpty {
            let values=Dictionary(uniqueKeysWithValues:variations.map{(NSNumber(value:axisID($0.key)),NSNumber(value:$0.value))})
            var attributes:[String:Any]=[kCTFontVariationAttribute as String:values]
            if let optical=variations["opsz"]{attributes[kCTFontOpticalSizeAttribute as String]=NSNumber(value:optical)}
            descriptor=CTFontDescriptorCreateCopyWithAttributes(descriptor,attributes as CFDictionary)
        }
        return CTFontCreateWithFontDescriptor(descriptor,size,nil)
    }

    public func profile(_ id:String)->FontStyleProfile? {profiles.first{$0.id==id}}
    public func nearest(to profile:FontStyleProfile,limit:Int=8,otherFamilies:Bool=false)->[(FontStyleProfile,Double)] {
        var matches:[(FontStyleProfile,Double)]=[]
        for candidate in profiles where candidate.id != profile.id && (!otherFamilies || candidate.familyID != profile.familyID) {
            var squared=0.0
            for (x,y) in zip(candidate.embedding,profile.embedding){let delta=x-y;squared += delta*delta}
            matches.append((candidate,sqrt(squared)))
        }
        matches.sort{a,b in a.1==b.1 ? a.0.id<b.0.id:a.1<b.1}
        return Array(matches.prefix(limit))
    }

    public func choose(category:String,seed:UInt64)->FontStyleProfile? {
        let routes:[String:[String]]=[
            "kinetic":["archivo","anton","barlowcondensed","bebasneue","chivo"],
            "expressive":["syne","bricolagegrotesque","fraunces","unbounded","archivoblack"],
            "editorial":["newsreader","cormorantgaramond","bodonimoda","dmserifdisplay","librecaslondisplay"],
            "guilloche":["bodonimoda","fraunces","cormorantgaramond","librecaslondisplay"],
            "typographic-collage":["unbounded","syne","rubikmonoone","bricolagegrotesque","archivoblack"],
            "optical":["monoton","spacegrotesk","archivo","ibmplexmono"],
            "brutalist":["archivoblack","anton","unbounded","chivo","archivo"],
            "minimal":["spacegrotesk","newsreader","chivo","archivo","ibmplexmono"],
            "bauhaus":["rubikmonoone","unbounded","archivo","spacegrotesk"]]
        let pool=profiles.filter{(routes[category] ?? ["archivo","chivo","spacegrotesk","robotoflex","bricolagegrotesque"]).contains($0.familyID) && !$0.italic && (category=="minimal" || category=="editorial" || category=="guilloche" || $0.weight>=500 || ["anton","archivoblack","bebasneue","rubikmonoone","monoton"].contains($0.familyID))}
        guard !pool.isEmpty else{return nil}
        var rng=SeededRandom(seed:seed ^ 0x464f4e5453)
        let prototype=pool[rng.int(pool.count)]
        // Explore an embedding neighborhood, preserving the chosen category and axis vocabulary.
        let neighborhood=nearest(to:prototype,limit:12).map(\.0).filter{p in pool.contains{$0.id==p.id}}
        let choices=[prototype]+neighborhood
        return choices[rng.int(choices.count)]
    }
    public static func apply(_ profile:FontStyleProfile,to genome:inout StyleGenome) {
        let display=genome.elements.filter{$0.kind=="text" && $0.sourceAnchor != nil}
        if !display.isEmpty && display.allSatisfy({$0.fontProfileID==profile.id}){return}
        for i in genome.elements.indices where genome.elements[i].kind=="text" && genome.elements[i].sourceAnchor != nil {
            genome.elements[i].fontName=profile.postscriptName
            genome.elements[i].fontVariations=profile.variations
            genome.elements[i].fontProfileID=profile.id
            genome.elements[i].fontAssetID=profile.assetID
            genome.elements[i].fontAssetSHA256=profile.assetSHA256
        }
        TypeSystemEngine.refitEm(&genome)
        genome.layoutInheritance?.operations.append("Google Fonts profile \(profile.id): \(profile.label); axes \(profile.variations.sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined(separator:", ")).")
    }
    public static func validate(_ genome:StyleGenome)throws {
        var checked:Set<String>=[]
        for e in genome.elements where e.fontAssetID != nil {
            let key=(e.fontAssetID ?? "")+(e.fontName ?? "")+(e.fontVariations ?? [:]).sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined()
            if checked.contains(key){continue};checked.insert(key)
            guard let family=shared.manifest.families.first(where:{$0.faces.contains{$0.filename==e.fontAssetID}}),let asset=family.faces.first(where:{$0.filename==e.fontAssetID}),asset.sha256==e.fontAssetSHA256,shared.verifiedAssets.contains(asset.filename) else{throw PosterError.invalid("Missing or changed local font asset: \(e.fontAssetID ?? "unknown"). Re-fetch the pinned font manifest before reproducing this scene.")}
            let base=font(name:e.fontName ?? genome.font)
            let axes=(CTFontCopyVariationAxes(base) as? [[String:Any]]) ?? []
            for (tag,value) in e.fontVariations ?? [:] {
                guard value.isFinite,let row=axes.first(where:{($0[kCTFontVariationAxisIdentifierKey as String] as? NSNumber)?.uint32Value==axisID(tag)}),let low=row[kCTFontVariationAxisMinimumValueKey as String] as? Double,let high=row[kCTFontVariationAxisMaximumValueKey as String] as? Double,(low...high).contains(value) else{throw PosterError.invalid("Invalid font variation axis: \(tag)")}
            }
            let resolved=font(name:e.fontName ?? genome.font,variations:e.fontVariations)
            guard let fontURL=CTFontCopyAttribute(resolved,kCTFontURLAttribute) as? URL,
                  fontURL.resolvingSymlinksInPath()==shared.directory?.appending(path:asset.filename).resolvingSymlinksInPath() else{throw PosterError.invalid("Core Text substituted a different font file: \(asset.postscriptName)")}
            let actual=(CTFontCopyVariation(resolved) as? [NSNumber:NSNumber]) ?? [:]
            for (tag,value) in e.fontVariations ?? [:] {
                let axis=axes.first{($0[kCTFontVariationAxisIdentifierKey as String] as? NSNumber)?.uint32Value==axisID(tag)}
                let defaultValue=axis?[kCTFontVariationAxisDefaultValueKey as String] as? Double
                let measured=actual[NSNumber(value:axisID(tag))]?.doubleValue ?? defaultValue
                guard let measured,abs(measured-value)<0.01 else{throw PosterError.invalid("Core Text ignored font axis \(tag).")}
            }
        }
    }
    private static func specimen(_ font:CTFont,width:Int=1024)throws->CGImage {
        let height=512
        guard let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
        ctx.setFillColor(CGColor(gray:0.97,alpha:1));ctx.fill(CGRect(x:0,y:0,width:width,height:height));ctx.setFillColor(CGColor(gray:0.04,alpha:1))
        let rows=["VISUAL","Hamburgefontsiv","0123456789 & Rga"]
        for (i,text) in rows.enumerated() {
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[.font:font]))
            let box=CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
            let scale=min(Double(width-64)/max(1,Double(box.width)),118.0/max(1,Double(box.height)))
            ctx.saveGState();ctx.translateBy(x:32,y:Double(height-40-i*155)-box.height*scale);ctx.scaleBy(x:scale,y:scale);ctx.translateBy(x:-box.minX,y:-box.minY);ctx.textMatrix = .identity;ctx.textPosition = .zero;CTLineDraw(line,ctx);ctx.restoreGState()
        }
        guard let image=ctx.makeImage() else{throw PosterError.render};return image
    }
    public static func specimen(_ profile:FontStyleProfile,width:Int=1024)throws->CGImage {try specimen(font(name:profile.postscriptName,variations:profile.variations),width:width)}
    private static func features(_ font:CTFont,family:FontFamilyRecord,weight:Double,width:Double,italic:Bool,image:CGImage)throws->([String],[Double]) {
        var names=["weight","width","italic","serif","sans-serif","display","monospace","handwriting"],values=[weight/1000,width/150,italic ? 1.0:0.0]
        values += ["serif","sans-serif","display","monospace","handwriting"].map{family.category==$0 ? 1.0:0.0}
        let cap=max(1,CTFontGetCapHeight(font))
        names += ["x-height/caps","ascender/caps","descender/caps"]
        values += [CTFontGetXHeight(font)/cap,CTFontGetAscent(font)/cap,CTFontGetDescent(font)/cap]
        for character in "AaHhOoMWIinrsgRe0128&".utf16 {
            var c=character,g=CGGlyph()
            CTFontGetGlyphsForCharacters(font,&c,&g,1)
            var advance=CGSize.zero
            CTFontGetAdvancesForGlyphs(font,.horizontal,&g,&advance,1)
            names.append("advance-\(character)/caps");values.append(advance.width/cap)
            let bounds=CTFontGetBoundingRectsForGlyphs(font,.horizontal,&g,nil,1)
            names.append("inkwidth-\(character)/caps");values.append(bounds.width/cap)
        }
        // Normalize raster density by rows/columns on identical copy; counters, terminals,
        // width and stroke mass contribute without using poster palette/background content.
        let w=128,h=64
        var pixels=[UInt8](repeating:255,count:w*h*4)
        pixels.withUnsafeMutableBytes{p in
            let ctx=CGContext(data:p.baseAddress,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            ctx.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
        }
        for band in 0..<16 {
            var ink=0.0
            for y in band*4..<(band+1)*4 {for x in 0..<w {ink += 1-Double(pixels[(y*w+x)*4])/255}}
            names.append("specimen-row-\(band)");values.append(ink/Double(w*4))
        }
        for band in 0..<16 {
            var ink=0.0
            for x in band*8..<(band+1)*8 {for y in 0..<h {ink += 1-Double(pixels[(y*w+x)*4])/255}}
            names.append("specimen-column-\(band)");values.append(ink/Double(h*8))
        }
        return(names,values)
    }
    public static func index(to directory:URL,progress:(String)->Void={_ in})throws->FontProfileIndex {
        guard !shared.manifest.families.isEmpty else{throw PosterError.invalid("Fetch Google Fonts assets with scripts/fetch-google-fonts.py, then rebuild.")}
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        guard !FileManager.default.fileExists(atPath:directory.appending(path:"profiles.json").path) else{throw PosterError.invalid("Font profile output exists; choose a new directory.")}
        let embedder=LibraryVisualEmbedder()
        var profiles:[FontStyleProfile]=[],names:[String]=[]
        for family in shared.manifest.families {
            for asset in family.faces {
                guard shared.verifiedAssets.contains(asset.filename) else{throw PosterError.invalid("Font checksum mismatch: \(asset.filename)")}
                let base=font(name:asset.postscriptName)
                guard CTFontCopyPostScriptName(base) as String==asset.postscriptName else{throw PosterError.invalid("Font registration failed: \(asset.postscriptName)")}
                var axis:[String:(Double,Double,Double)]=[:]
                for row in (CTFontCopyVariationAxes(base) as? [[String:Any]]) ?? [] {
                    guard let id=row[kCTFontVariationAxisIdentifierKey as String] as? NSNumber,let low=row[kCTFontVariationAxisMinimumValueKey as String] as? Double,let high=row[kCTFontVariationAxisMaximumValueKey as String] as? Double,let value=row[kCTFontVariationAxisDefaultValueKey as String] as? Double else{continue}
                    axis[tag(id.uint32Value)]=(low,high,value)
                }
                let weights=axis["wght"].map{a in [300.0,400,600,800].filter{($0>=a.0 && $0<=a.1)}} ?? [Double(asset.weight)]
                for weight in weights {
                    var widths=[axis["wdth"]?.2 ?? 100]
                    if let a=axis["wdth"],weight>=500,a.0<90 {widths.append(max(a.0,75))}
                    for width in widths {
                        var variations=axis.mapValues{$0.2}
                        if axis["wght"] != nil{variations["wght"]=weight};if axis["wdth"] != nil{variations["wdth"]=width}
                        let face=font(name:asset.postscriptName,variations:variations)
                        let image=try specimen(face)
                        let (featureNames,values)=try features(face,family:family,weight:weight,width:width,italic:asset.style=="italic",image:image)
                        names=featureNames
                        var vector=values.enumerated().map{i,v in v*(i<8 ? 1.8:i<53 ? 0.45:1.2)}
                        let norm=sqrt(vector.reduce(0){$0+$1*$1});vector=vector.map{$0/max(1e-9,norm)}
                        let id=family.id+"-"+asset.postscriptName+"-w\(Int(weight))-d\(Int(width))"
                        let url=directory.appending(path:id+".png")
                        try PosterRenderer.png(image,to:url)
                        let embedding=try embedder.embed(PosterRenderer.load(url))
                        profiles.append(FontStyleProfile(id:id,familyID:family.id,family:family.family,category:family.category,postscriptName:asset.postscriptName,assetID:asset.filename,assetSHA256:asset.sha256,variations:variations,weight:weight,width:width,italic:asset.style=="italic",featureValues:values,embedding:vector,specimenEmbedding:embedding))
                    }
                }
            }
            progress("\(family.family): \(profiles.filter{$0.familyID==family.id}.count) axis/style profiles")
        }
        let result=FontProfileIndex(sourceRevision:shared.manifest.revision,featureNames:names,dimensions:names.count,profiles:profiles)
        try LibraryRaster.write(result,to:directory.appending(path:"profiles.json"))
        var familyVectors:[[String:Any]]=[]
        for family in shared.manifest.families {
            let members=profiles.filter{$0.familyID==family.id}
            var vector=(0..<names.count).map{i in members.reduce(0.0){$0+$1.embedding[i]}/Double(members.count)}
            let norm=sqrt(vector.reduce(0){$0+$1*$1});vector=vector.map{$0/max(1e-9,norm)}
            familyVectors.append(["familyID":family.id,"family":family.family,"profileCount":members.count,"embedding":vector])
        }
        try JSONSerialization.data(withJSONObject:["model":"font-style-family-centroid-v1","dimensions":names.count,"families":familyVectors],options:[.prettyPrinted,.sortedKeys]).write(to:directory.appending(path:"family-embeddings.json"))
        return result
    }
}
