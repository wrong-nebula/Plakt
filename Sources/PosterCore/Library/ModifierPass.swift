import Foundation
import JavaScriptCore
import Vision

/// Applies effector modifiers (the shared engine in geometry-bench/effector-system, bundled
/// as Resources/Effectors/effectors-engine.js) to a scene's display type, headless in
/// JavaScriptCore. Information type, forms and paper are never modified. One instance per
/// study run; JSContext is not thread-safe.
public final class ModifierPass {
    /// Modifiers that held up in the modifier studies on real posters. Layout-breaking ones
    /// (repeat, kaleido, mirror, polar, melt) are left out.
    public static let types=["weight","outline","round","inline","shadow","echo","slice","burst","tiles","screen","shear","wave","bend","perspective","roughen","zigzag","envelope","fold"]
    private let context:JSContext

    public init() throws {
        guard let url=PosterResources.bundle.url(forResource:"effectors-engine",withExtension:"js",subdirectory:"Resources/Effectors"),
              let source=try? String(contentsOf:url,encoding:.utf8),let context=JSContext() else{throw PosterError.invalid("The effector engine bundle is missing.")}
        var failure:String?
        context.exceptionHandler={_,value in failure=value?.toString()}
        context.evaluateScript(source);context.evaluateScript(Self.shim)
        if let failure{throw PosterError.invalid("The effector engine failed to load: \(failure)")}
        self.context=context
    }

    // Gentle parameter variation around each modifier's defaults; still field, no pointer.
    private static let shim="""
    function studyStack(seed,typesJSON){const E=Effectors,r=E.rng(seed),types=JSON.parse(typesJSON);
     return JSON.stringify(types.map(t=>{const o={type:t};for(const p of E.MODIFIERS[t].params){if(p.type==='range'){const span=p.max-p.min;o[p.id]=Math.min(p.max,Math.max(p.min,p.def+(r()-.5)*span*.3));}}
      o.field={shape:'all',follow:false,drive:'static'};return o;}));}
    function studyRender(svg,colors,stackJSON){const r=Effectors.render({recipe:'custom',format:'poster',colors,
      layers:[{id:'L1',type:'artwork',svg,split:'shapes',colors:'original',ground:false,size:1,area:'bleed'}],effectors:[],modifiers:JSON.parse(stackJSON),colours:[]},{t:0});
     return r.svg.replace(/<rect width="[^"]+" height="[^"]+" fill="[^"]+"\\/>/,'');}
    """

    private static func read(_ genome:StyleGenome,words:Set<String>)throws->Int {
        let image=try LibrarySceneRenderer.render(genome,width:900,seed:0)
        let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection=false
        try VNImageRequestHandler(cgImage:image,options:[:]).perform([request])
        let found=Set((request.results ?? []).compactMap{$0.topCandidates(1).first?.string.uppercased()}.flatMap{$0.split(whereSeparator:{!$0.isLetter && !$0.isNumber})}.map(String.init))
        return words.intersection(found).count
    }
    /// Runs an explicit stack (each item `{type, strength, field}` as the engine takes it) on the
    /// elements named in `displayIDs`, for the poster editor. No legibility gate: the person decides.
    public func applyStack(_ genome:StyleGenome,stackJSON:String,displayIDs:Set<String>,seed:UInt64,to pdfURL:URL)throws->StyleGenome {
        let display=genome.elements.indices.filter{displayIDs.contains(genome.elements[$0].sourceElementID) && (genome.elements[$0].minimumStage ?? 0)<99}
        guard !display.isEmpty else{return genome}
        var typeOnly=genome;typeOnly.elements=display.map{genome.elements[$0]}
        let source=pdfURL.deletingPathExtension().appendingPathExtension("source.pdf")
        try LibrarySceneRenderer.pdf(typeOnly,to:source,seed:seed)
        defer{try? FileManager.default.removeItem(at:source)}
        var svg=try PosterVectors.svg(pdfAt:source).svg
        if let first=svg.range(of:#"<path [^>]*/>"#,options:.regularExpression){svg.removeSubrange(first)}
        let ink=genome.elements[display[0]].color
        let tone=ImagePosterComposer.mix(ink,genome.background,0.55)
        guard let output=context.objectForKeyedSubscript("studyRender").call(withArguments:[svg,[genome.background,ink,tone],stackJSON])?.toString(),
              output.hasPrefix("<svg") else{throw PosterError.invalid("The effector engine returned no SVG.")}
        try PosterVectors.pdf(fromSVG:output).write(to:pdfURL,options:.atomic)
        var scene=genome
        for i in display {scene.elements[i].minimumStage=99}
        var layer=SceneElement(sourceElementID:"type:modified",kind:"vector",bounds:.full,rotation:0,text:nil,color:ink,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        layer.rasterAsset = .init(url:pdfURL,sha256:LibraryRaster.hash(try Data(contentsOf:pdfURL)));layer.zIndex=100;layer.minimumStage=1
        scene.elements.append(layer)
        return scene
    }
    /// Returns the scene with its display type redrawn through 1–2 modifiers as one vector layer
    /// (written to `pdfURL`), plus the modifier names. The original type elements stay in the
    /// genome for measurement but are hidden from rendering.
    public func apply(_ genome:StyleGenome,seed:UInt64,accent:String?,to pdfURL:URL,types requested:[String]?=nil,requireLegible:Bool=true)throws->(StyleGenome,[String]) {
        let display=genome.elements.indices.filter{genome.elements[$0].kind=="text" && genome.elements[$0].sourceAnchor != nil}
        guard !display.isEmpty else{return (genome,[])}
        var typeOnly=genome;typeOnly.elements=display.map{genome.elements[$0]}
        let source=pdfURL.deletingPathExtension().appendingPathExtension("source.pdf")
        try LibrarySceneRenderer.pdf(typeOnly,to:source,seed:seed)
        defer{try? FileManager.default.removeItem(at:source)}
        // The renderer paints the page first; dropping that first path leaves only the type outlines.
        var svg=try PosterVectors.svg(pdfAt:source).svg
        if let first=svg.range(of:#"<path [^>]*/>"#,options:.regularExpression){svg.removeSubrange(first)}
        var rng=SeededRandom(seed:seed ^ 0x4d4f44)
        var chosen=[Self.types[rng.int(Self.types.count)]]
        if rng.unit()<0.4 {let second=Self.types.filter{$0 != chosen[0]};chosen.append(second[rng.int(second.count)])}
        if let requested,!requested.isEmpty{chosen=requested.filter{Self.types.contains($0)}}
        let ink=genome.elements[display[0]].color
        let tone=accent ?? ImagePosterComposer.mix(ink,genome.background,0.55)
        let typesJSON=String(data:try JSONEncoder().encode(chosen),encoding:.utf8)!
        guard let stack=context.objectForKeyedSubscript("studyStack").call(withArguments:[Int(seed%999_983),typesJSON])?.toString(),
              let output=context.objectForKeyedSubscript("studyRender").call(withArguments:[svg,[genome.background,ink,tone],stack])?.toString(),
              output.hasPrefix("<svg") else{throw PosterError.invalid("The effector engine returned no SVG.")}
        try PosterVectors.pdf(fromSVG:output).write(to:pdfURL,options:.atomic)
        var scene=genome
        for i in display {scene.elements[i].minimumStage=99}
        var layer=SceneElement(sourceElementID:"type:modified",kind:"vector",bounds:.full,rotation:0,text:nil,color:ink,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        layer.rasterAsset = .init(url:pdfURL,sha256:LibraryRaster.hash(try Data(contentsOf:pdfURL)));layer.zIndex=100;layer.minimumStage=1
        scene.elements.append(layer)
        // The jury measures type from the scene's elements, which the modified layer replaces in
        // the render; so modified type must still read: keep it only if OCR finds at least three
        // quarters of the display words it finds in the plain version.
        let words=Set(display.compactMap{genome.elements[$0].text}.flatMap{$0.uppercased().split(whereSeparator:{!$0.isLetter && !$0.isNumber})}.map(String.init).filter{$0.count>1})
        let plainRead=requireLegible ? try Self.read(genome,words:words):0,modifiedRead=requireLegible ? try Self.read(scene,words:words):0
        guard !requireLegible || Double(modifiedRead)>=Double(plainRead)*0.75 else{return (genome,[])}
        scene.layoutInheritance?.operations.append("Modifiers on display type: \(chosen.joined(separator:" + ")) (effector engine \(stack.count) B stack); information type, forms and paper unmodified.")
        return (scene,chosen)
    }
}
