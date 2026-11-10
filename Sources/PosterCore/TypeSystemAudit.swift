import Foundation
import CoreGraphics

public struct TypeAuditEntry:Codable,Sendable {
    public var id:String;public var systemID:String;public var operation:String;public var sourcePosterID:String
    public var kind:String;public var input:String;public var fontID:String?;public var overrides:[String:Double]
    public var image:String?;public var digest:String?;public var steps:Int;public var inkPixels:Int
    public var issues:[String];public var diagnostics:[String];public var error:String?
}
public struct TypeAuditControl:Codable,Sendable {
    public var systemID:String;public var operation:String;public var parameter:String
    public var low:Double;public var high:Double;public var changesPixels:Bool;public var errors:[String]
}
public struct TypeAuditReport:Codable,Sendable {
    public var version="type-system-audit-v1";public var sourceSystems:Int;public var distinctSystems:Int
    public var operations:[String];public var entries:[TypeAuditEntry];public var controls:[TypeAuditControl]
    public var note="Technical audit of native renders and traces. Overlaps, crops, rotations, duplication and pale palettes are artistic choices; diagnostic flags are review prompts, not aesthetic failures. Sources, source crops, semantic vectors, model files and library records are read-only."
}
public enum TypeSystemAudit {
    public static func example(_ operation:String)->String {
        ["grapheme-migration":"horizons","compensated-erosion":"around|the|sound","paired-columns":"TYPE | SPACE","reflection":"PLAY | WITH | TYPE","word-reflow":"A NEW SPACE FOR UNEXPECTED IDEAS","tittle-substitution":"Intuition","suffix-cycle":"re|mix|frame|write","glyph-grid":"OPENFORMS","glyph-arc":"SPACES & FORMS","scale-ramp":"VOICE"][operation] ?? "SHIFT & SPACE"
    }
    private static func pixels(_ image:CGImage)throws->[UInt8] {
        var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        let ok=bytes.withUnsafeMutableBytes{ptr->Bool in guard let ctx=CGContext(data:ptr.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return false};ctx.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height));return true}
        guard ok else{throw PosterError.render};return bytes
    }
    public static func run(output:URL,progress:(String)->Void={_ in})throws {
        guard !FileManager.default.fileExists(atPath:output.path) else{throw PosterError.invalid("Audit output exists; choose a new directory.")}
        let bank=TypeSystemLibrary.shared,systems=bank.systems
        guard !systems.isEmpty else{throw PosterError.invalid("Type system catalog is unavailable.")}
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        let operations=Set(systems.map(\.operation)).sorted()
        var entries:[TypeAuditEntry]=[],controls:[TypeAuditControl]=[]
        func render(_ system:TypeSystemGenome,_ input:String,_ kind:String,_ font:String?=nil,_ overrides:[String:Double]=[:],supplied:StyleGenome?=nil)throws->TypeAuditEntry {
            autoreleasepool {
                let id=String(format:"%05d",entries.count)+"-"+kind
                let relative=system.operation+"/"+id
                let folder=output.appending(path:relative)
                var item=TypeAuditEntry(id:id,systemID:system.id,operation:system.operation,sourcePosterID:system.sourcePosterID,kind:kind,input:input,fontID:font,overrides:overrides,image:nil,digest:nil,steps:0,inkPixels:0,issues:[],diagnostics:[],error:nil)
                do {
                    let scene:StyleGenome
                    if let supplied{scene=supplied}else{scene=try TypeSystemEngine.scene(system,input:input,profileID:font,overrides:overrides)}
                    let application=scene.appliedTypeSystems?.first{$0.genomeID==system.id}
                    let steps=application?.steps ?? []
                    let actualInput=application?.input ?? input
                    item.input=actualInput
                    if supplied != nil && application==nil{item.issues.append("requested-system-not-applied")}
                    if kind.hasPrefix("poster") && ["reflection","paired-columns"].contains(system.operation) && steps.contains(where:{$0.text.isEmpty}){item.issues.append("empty-transplanted-label")}
                    item.steps=steps.count
                    if steps.isEmpty{item.issues.append("empty-trace")}
                    if Set(steps.map(\.index)).count != steps.count{item.issues.append("duplicate-step-index")}
                    let original=Array(actualInput.precomposedStringWithCanonicalMapping)
                    for step in steps {
                        if ![step.bounds.x,step.bounds.y,step.bounds.width,step.bounds.height,step.rotation].allSatisfy(\.isFinite) || step.bounds.width<=0 || step.bounds.height<=0{item.issues.append("invalid-step-geometry")}
                        if step.indexMap.count != step.text.count{item.issues.append("map-length-mismatch")}
                        if step.indexMap.contains(where:{$0 < -1 || $0>=original.count}){item.issues.append("map-index-out-of-range")}
                        if step.indexMap.count==step.text.count {
                            let actual=Array(step.text)
                            for (i,index) in step.indexMap.enumerated() where index>=0 && index<original.count {
                                if String(actual[i]).lowercased() != String(original[index]).lowercased(){item.issues.append("map-does-not-describe-output");break}
                            }
                        }
                    }
                    if scene.elements.contains(where:{e in e.typeEmSize.map{!$0.isFinite || $0<=0} ?? false}){item.issues.append("invalid-em-size")}
                    let boxes=scene.elements.filter{$0.kind=="text" && !($0.text ?? "").trimmingCharacters(in:.whitespacesAndNewlines).isEmpty}.map{CompositionJudges.inkBounds($0,genome:scene)}
                    let offPaper=boxes.filter{!$0.rect.intersects(UnitBox.full.rect)}.count
                    if offPaper>0{item.diagnostics.append("\(offPaper)-fully-off-paper-elements")}
                    let clipped=boxes.filter{!UnitBox.full.rect.contains($0.rect)}.count
                    if clipped>0{item.diagnostics.append("\(clipped)-clipped-elements")}
                    let image=try LibrarySceneRenderer.render(scene,width:360)
                    let rgba=try pixels(image),background=LibrarySceneRenderer.color(scene.background).components!
                    let rgb=background.prefix(3).map{Int(($0*255).rounded())}
                    var ink=0
                    for i in stride(from:0,to:rgba.count,by:4){let d0=abs(Int(rgba[i])-rgb[0]),d1=abs(Int(rgba[i+1])-rgb[1]),d2=abs(Int(rgba[i+2])-rgb[2]);if d0+d1+d2>6{ink+=1}}
                    item.inkPixels=ink
                    if ink==0{item.issues.append("empty-raster")}
                    item.digest=LibraryRaster.hash(Data(rgba))
                    try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                    try PosterRenderer.png(image,to:folder.appending(path:"poster.png"))
                    try LibraryRaster.write(scene,to:folder.appending(path:"genome.json"))
                    try LibraryRaster.write(steps,to:folder.appending(path:"trace.json"))
                    item.image=relative+"/poster.png"
                    if kind=="family"{try LibrarySceneRenderer.pdf(scene,to:folder.appending(path:"poster.pdf"))}
                    if kind=="family" || kind=="unicode" {
                        let variant=TypeSystemVariant(system:system,input:input,overrides:overrides,fontProfileID:font,foreground:"#191c22",accent:"#3d52b6",background:"#f0eee7",scene:scene)
                        let copy=try JSONDecoder().decode(TypeSystemVariant.self,from:JSONEncoder().encode(variant))
                        let replay=try pixels(LibrarySceneRenderer.render(copy.replay(),width:360))
                        if replay != rgba{item.issues.append("preset-replay-differs")}
                    }
                }catch{item.error=error.localizedDescription;item.issues.append("render-error")}
                item.issues=Array(Set(item.issues)).sorted();entries.append(item);return item
            }
        }
        for (i,system) in systems.enumerated() {
            _ = try render(system,system.textParameters["sourceInput"] ?? example(system.operation),"source")
            _ = try render(system,example(system.operation),"adapted")
            if (i+1)%50==0{progress("Rendered \(i+1)/\(systems.count) source variants")}
        }
        let fonts=FontLibrary.shared.profiles
        let stressFonts=["ibmplexmono","newsreader","barlowcondensed"].compactMap{id in fonts.first{$0.familyID==id && $0.weight>=400 && !$0.italic}}
        for operation in operations {
            let system=systems.filter{$0.operation==operation}.sorted{$0.representativeScore==$1.representativeScore ? $0.id<$1.id:$0.representativeScore>$1.representativeScore}.first!
            let input=example(operation)
            let baseline=try render(system,input,"family")
            let replay=try render(system,input,"repeat")
            if baseline.digest != replay.digest{entries[entries.count-1].issues.append("a-b-a-repeat-differs")}
            var unicode="ÉTÉ À ZÜRICH"
            if operation=="tittle-substitution"{unicode="jijé"}
            if operation=="suffix-cycle"{unicode="ré|crire|inventer|jouer"}
            if operation=="paired-columns" || operation=="reflection"{unicode="ÉTÉ | RÊVES"}
            if operation=="compensated-erosion"{unicode="café|du|rêve"}
            _ = try render(system,unicode,"unicode")
            var short="i"
            if operation=="compensated-erosion"{short="a|b|c"}
            if operation=="suffix-cycle"{short="a|x|y"}
            if operation=="paired-columns" || operation=="reflection"{short="I | II"}
            _ = try render(system,short,"short")
            let long=operation=="tittle-substitution" ? "Infinite possibilities in imaginary cities":operation=="compensated-erosion" ? "possibilities|in|unfamiliarplaces":operation=="suffix-cycle" ? "inter|disciplinary|national|connected":"INFINITE POSSIBILITIES ACROSS THE CITY AND THROUGH UNEXPECTED SPACES"
            for font in stressFonts{_ = try render(system,long,"long-font",font.id)}
            var probes:[String:(Double,Double)]=["pitch":(0.65,1.3),"fontScale":(0.7,1.4),"angle":(-12,12)]
            if !["glyph-grid","glyph-arc"].contains(operation){probes["tracking"]=(-2,8)}
            if ["repeat-field","rotation-field","staircase","scale-ramp","alternating-ink"].contains(operation){probes["count"]=(3,11)}
            if operation=="word-reflow"{probes["wordsPerLine"]=(1,3)}
            if operation=="tittle-substitution"{probes["heartScale"]=(1,2.3)}
            if operation=="glyph-grid"{probes["columns"]=(2,5);probes["shear"]=(0,0.5);probes["quarterTurn"]=(0,90)}
            if operation=="glyph-arc"{probes["radius"]=(0.18,0.4);probes["sweep"]=(120,330)}
            for key in probes.keys.sorted(){let pair=probes[key]!,a=try render(system,input,"control-\(key)-low",nil,[key:pair.0]),b=try render(system,input,"control-\(key)-high",nil,[key:pair.1]);controls.append(TypeAuditControl(systemID:system.id,operation:operation,parameter:key,low:pair.0,high:pair.1,changesPixels:a.digest != nil && a.digest != b.digest,errors:[a.error,b.error].compactMap{$0}))}
            progress("Audited \(operation) stress cases and controls")
        }
        let pairs=[["d9a398555e3880f1678ef904-p0","762bb7e4c82bd391f75c2b51-p0"],["d9a398555e3880f1678ef904-p0","369f54e84a135558d824d18e-p0"]]
        for (pairIndex,ids) in pairs.enumerated() {
            let urls=ids.map{URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appending(path:"library/posters/"+$0+"/record.json")}
            guard urls.allSatisfy({FileManager.default.fileExists(atPath:$0.path)}) else{continue}
            let records=try urls.map{try JSONDecoder().decode(PosterRecord.self,from:Data(contentsOf:$0))}
            for (opIndex,operation) in operations.enumerated() {
                let system=systems.filter{$0.operation==operation}.sorted{$0.representativeScore==$1.representativeScore ? $0.id<$1.id:$0.representativeScore>$1.representativeScore}.first!
                let base=try TypeSystemEngine.scene(system,input:example(operation))
                let variant=TypeSystemVariant(system:system,input:example(operation),overrides:[:],fontProfileID:nil,foreground:"#191c22",accent:"#3d52b6",background:"#f0eee7",scene:base)
                for (wordIndex,title) in ["ECHO","OPEN\nFORMS","A FIELD OF VOICES"].enumerated() {
                    let copy=PosterCopy(title:title,subtitle:"Print, sound and experimental publishing",institution:"Museum für Gestaltung · Zürich",footer:"18—21.06.2027 · Concept programme")
                    let scene=SourceLayoutDNA.make(records[0],records[1],category:pairIndex==0 ? "color-field":"guilloche",seed:UInt64(9100+pairIndex*1000+opIndex*13+wordIndex),copy:copy,id:"type-audit-poster",typeSystem:variant)
                    _ = try render(system,title,"poster-\(pairIndex)-\(wordIndex)",supplied:scene)
                }
            }
        }
        let report=TypeAuditReport(sourceSystems:systems.count,distinctSystems:bank.distinctSystems.count,operations:operations,entries:entries,controls:controls)
        try LibraryRaster.write(report,to:output.appending(path:"audit.json"))
        try LibraryRaster.write(bank.catalog,to:output.appending(path:"catalog-snapshot.json"))
        progress("Saved \(entries.count) renders, \(controls.count) control pairs, \(entries.filter{!$0.issues.isEmpty}.count) cases requiring technical review.")
    }
}
