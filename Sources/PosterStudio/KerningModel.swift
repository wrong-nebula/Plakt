import SwiftUI
import PosterCore
import UniformTypeIdentifiers

/// One opening of the kerning sheet; without a source it opens on a proof line.
struct KerningRequest:Identifiable {let id=UUID();var source:KerningSource?}

/// What the kerning sheet edits: a scene (with the type it was opened as, so saving keeps it), or a free proof line.
struct KerningSource {
    var name:String
    var genome:StyleGenome
    var seed:UInt64=0
    var hybrid:HybridScene?=nil
    /// A source-study candidate, a saved genome.json or a type-system variation.
    static func load(_ url:URL)throws->KerningSource {
        let data=try Data(contentsOf:url),decoder=JSONDecoder()
        if let hybrid=try? decoder.decode(HybridScene.self,from:data) {return KerningSource(name:url.lastPathComponent,genome:hybrid.genome,seed:hybrid.seed,hybrid:hybrid)}
        if let variation=try? decoder.decode(TypeSystemVariant.self,from:data) {return KerningSource(name:url.lastPathComponent,genome:try variation.replay())}
        return KerningSource(name:url.lastPathComponent,genome:try decoder.decode(StyleGenome.self,from:data))
    }
}

@MainActor @Observable
final class KerningModel {
    var name="Proof"
    var original:StyleGenome?
    var scene:StyleGenome?
    var hybrid:HybridScene?
    var seed:UInt64=0
    var lineID:String?
    // Proof mode: a free line in any font, kerned with `proofKerning`.
    var proofText="AVATAR WAVY To Ye"
    var proofFont="HelveticaNeue-Bold"
    var proofKerning=TextKerning(mode:.optical)
    var gap:Int?
    /// Nudges change this one gap, or every occurrence of its pair.
    var everyPair=false
    var showWhite=true
    var showBefore=false
    private(set) var layout:KerningSystem.Layout?
    /// The line's plain width, so the proof keeps its scale while you kern.
    private(set) var referenceWidth=1.0
    var preview:NSImage?
    var beforeImage:NSImage?
    var tableFonts:[String]=[]
    var status=""
    var error:String?
    let store:KerningTableStore
    private var rendering:Task<Void,Never>?

    init(source:KerningSource?) {
        // Font tables live beside taste/: next to the library the studio works in, else in the project root a build
        // names, else in Documents/PosterLab/Kerning.
        let root=UserDefaults.standard.string(forKey:"posterlab-library-directory").map{URL(fileURLWithPath:$0).deletingLastPathComponent()}
            ?? (Bundle.main.object(forInfoDictionaryKey:"PosterLabProjectRoot") as? String).map{URL(fileURLWithPath:$0)}
        store=KerningTableStore.standard(projectRoot:root)
        if let source {load(source)}else{refresh()}
        tableFonts=store.fonts()
    }
    func load(_ source:KerningSource) {
        name=source.name;original=source.genome;scene=source.genome;hybrid=source.hybrid;seed=source.seed
        lineID=KerningSystem.lines(source.genome).first?.sourceElementID;gap=nil;beforeImage=nil
        refresh();render()
    }
    var lines:[SceneElement] {scene.map{KerningSystem.lines($0)} ?? []}
    var element:SceneElement? {lines.first{$0.sourceElementID==lineID}}
    var text:String {element?.text ?? proofText}
    var fontName:String {element.map{$0.fontName ?? scene!.font} ?? proofFont}
    /// The line's settings. A line without settings shows how it has always been set, and adopts that the moment you change it.
    var kerning:TextKerning {
        get {if let e=element,let scene {return KerningSystem.settings(e,genome:scene)};return proofKerning}
        set {
            if let id=lineID,let i=scene?.elements.firstIndex(where:{$0.sourceElementID==id}) {scene?.elements[i].kerning=newValue}else{proofKerning=newValue}
            refresh();render()
        }
    }
    /// False for a line of a scene saved before kerning existed, still drawn as it always was.
    var adopted:Bool {if let e=element,let scene {return KerningSystem.isKerned(e,genome:scene)};return true}
    /// How a line is set, for the line list.
    func label(_ line:SceneElement)->String {line.kerning?.mode.label ?? scene?.kerning.map{$0.mode.label+" · poster"} ?? "Original"}
    /// The line's tracking in thousandths of an em (scenes store it in points at a 100-point font).
    var tracking:Double {
        get {element.map{($0.tracking ?? scene!.tracking)*10} ?? 0}
        set {
            guard let id=lineID,let i=scene?.elements.firstIndex(where:{$0.sourceElementID==id}) else{return}
            if scene?.elements[i].kerning==nil {scene?.elements[i].kerning=kerning}
            scene?.elements[i].tracking=(newValue/10*100).rounded()/100;refresh();render()
        }
    }
    func select(_ id:String) {lineID=id;gap=nil;refresh()}
    func refresh() {
        if let e=element,let scene {
            layout=KerningSystem.layout(e,string:e.text ?? "",genome:scene,measure:true)
            var plain=e;plain.kerning=TextKerning(mode:.none)
            referenceWidth=max(1,Double(KerningSystem.layout(plain,string:e.text ?? "",genome:scene).path.boundingBoxOfPath.width))
        }else{
            let font=FontLibrary.font(name:proofFont)
            layout=KerningSystem.layout(proofText,font:font,tracking:0,kerning:proofKerning,measure:true)
            referenceWidth=max(1,Double(KerningSystem.layout(proofText,font:font,tracking:0,kerning:TextKerning(mode:.none)).path.boundingBoxOfPath.width))
        }
        if let g=gap,!(layout?.gaps.indices.contains(g) ?? false) {gap=nil}
    }
    var selectedGap:KerningSystem.Gap? {gap.flatMap{g in layout?.gaps.first{$0.index==g}}}
    /// Gaps you can kern. Word spaces have their own control.
    var editableGaps:[KerningSystem.Gap] {
        guard let layout else{return []}
        return layout.gaps.filter{$0.adjustable && !layout.characters[$0.index].allSatisfy(\.isWhitespace) && !layout.characters[$0.index+1].allSatisfy(\.isWhitespace)}
    }
    func step(_ direction:Int) {
        let gaps=editableGaps.map(\.index);guard !gaps.isEmpty else{return}
        guard let g=gap,let i=gaps.firstIndex(of:g) else{gap=direction>0 ? gaps.first:gaps.last;return}
        gap=gaps[max(0,min(gaps.count-1,i+direction))]
    }
    func nudge(_ delta:Double) {
        guard let g=selectedGap,g.adjustable else{return}
        var k=kerning
        if everyPair {k.setPair(g.pair,to:(k.pairs[g.pair] ?? 0)+delta)}else{k.setGap(g.index,in:text,to:k.gap(g.index,in:text)+delta)}
        kerning=k
    }
    /// Takes the optical value for the selected gap (or every gap) as your own, so you can refine it in Metrics mode.
    func clearGap() {guard let g=selectedGap else{return};var k=kerning;k.setGap(g.index,in:text,to:0);if everyPair {k.setPair(g.pair,to:0)};kerning=k}
    func removePair(_ pair:String) {var k=kerning;k.setPair(pair,to:0);kerning=k}
    func applyToAll() {
        guard let scene else{return}
        var k=kerning;k.gaps=[:];k.gapsText=nil
        self.scene=KerningSystem.apply(k,to:scene);refresh();render()
        status="\(k.mode.label) kerning with \(k.pairs.count) pairs on every line."
    }
    func resetLine() {
        if let id=lineID,let i=scene?.elements.firstIndex(where:{$0.sourceElementID==id}),let original {
            scene?.elements[i].kerning=nil;scene?.elements[i].tracking=original.elements.first{$0.sourceElementID==id}?.tracking
        }else{proofKerning=TextKerning(mode:.optical)}
        refresh();render()
    }
    func resetAll() {guard let original else{return};scene=original;refresh();render();status="Every line is back to its original setting."}
    // Font tables
    var table:KerningTable? {store.load(fontName)}
    func saveTable() {
        do {let t=try store.save(font:fontName,pairs:kerning.pairs);tableFonts=store.fonts();status="Saved \(t.pairs.count) pairs as the \(fontName) table."}catch{self.error=error.localizedDescription}
    }
    /// Adds the font's table to this line's pairs (the table wins where both have a pair), or to every line in this font.
    func useTable(everyLine:Bool) {
        guard let t=table else{return}
        if everyLine,var scene {
            for i in scene.elements.indices where scene.elements[i].kind=="text" && (scene.elements[i].fontName ?? scene.font)==fontName {
                var k=KerningSystem.settings(scene.elements[i],genome:scene);k.pairs.merge(t.pairs){$1};scene.elements[i].kerning=k
            }
            self.scene=scene;refresh();render()
        }else{var k=kerning;k.pairs.merge(t.pairs){$1};kerning=k}
        status="Using \(t.pairs.count) pairs from the \(fontName) table."
    }
    // Rendering
    func render() {
        guard let scene,let original else{preview=nil;return}
        rendering?.cancel()
        let seed=seed,needsBefore=beforeImage==nil
        rendering=Task {
            try? await Task.sleep(for:.milliseconds(90));guard !Task.isCancelled else{return}
            do {
                preview=NSImage(cgImage:try LibrarySceneRenderer.render(scene,width:760,seed:seed),size:.zero)
                if needsBefore {beforeImage=NSImage(cgImage:try LibrarySceneRenderer.render(original,width:760,seed:seed),size:.zero)}
                error=nil
            }catch{self.error=error.localizedDescription}
        }
    }
    // Files
    func open() {
        let panel=NSOpenPanel();panel.allowedContentTypes=[.json];panel.message="Choose a scene: a source-study candidate, a saved genome.json or a type-system variation."
        guard panel.runModal() == .OK,let url=panel.url else{return}
        do {load(try KerningSource.load(url))}catch{self.error="That file is not a PosterLab scene. \(error.localizedDescription)"}
    }
    private func savePanel(_ type:UTType,_ suffix:String)->URL? {
        let panel=NSSavePanel();panel.allowedContentTypes=[type]
        panel.nameFieldStringValue=(name as NSString).deletingPathExtension.replacingOccurrences(of:"/",with:"-")+"-kerned"+suffix
        return panel.runModal() == .OK ? panel.url:nil
    }
    func saveScene() {
        guard let scene,let url=savePanel(.json,".json") else{return}
        do {
            if var hybrid {hybrid.genome=scene;try LibraryRaster.write(hybrid,to:url)}else{try LibraryRaster.write(scene,to:url)}
            status="Saved the kerned scene. Open it again here, or render it with poster scene render."
        }catch{self.error=error.localizedDescription}
    }
    func exportPNG() {
        guard let scene,let url=savePanel(.png,".png") else{return}
        do {try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:3508,seed:seed),to:url);status="Saved a 3508 px PNG."}catch{self.error=error.localizedDescription}
    }
    func exportPDF() {
        guard let scene,let url=savePanel(.pdf,".pdf") else{return}
        do {try LibrarySceneRenderer.pdf(scene,to:url,seed:seed);status="Saved an outlined vector PDF."}catch{self.error=error.localizedDescription}
    }
    func exportProof() {
        guard let url=savePanel(.png,"-proof.png") else{return}
        let variations=element?.fontVariations
        do {
            let rows:[(String,TextKerning)]=[("None",TextKerning(mode:.none)),("Metrics",TextKerning(mode:.metrics)),("Optical",TextKerning(mode:.optical,strength:kerning.strength,tightness:kerning.tightness,minimumGap:kerning.minimumGap)),("This line",kerning)]
            try PosterRenderer.png(KerningProof.render(text,font:fontName,variations:variations,rows:rows,tracking:element.map{$0.tracking ?? scene!.tracking} ?? 0,width:2400),to:url)
            status="Saved a proof of “\(text)”."
        }catch{self.error=error.localizedDescription}
    }
}
