import Foundation
import PosterCore

struct KerningCommand {
    static let usage="""
    poster kerning proof --font HelveticaNeue-Bold --text 'AVATAR WAVY' --out output/kerning-proof [--width 2400]
      [--strength 1] [--tightness 0] [--minimum-gap 12|none] [--pairs AV=-30,To=-20] [--tables kerning]
    poster kerning scene --genome scene.json --out output/kerned [--mode optical|metrics|none] [--strength 1]
      [--tightness 0] [--minimum-gap 12|none] [--word-space 0] [--pairs AV=-30,To=-20] [--tables kerning] [--width 2400]

    Kerning values are thousandths of an em. --tables reads your per-font pair tables (one JSON per font);
    --pairs are added on top. A scene keeps a copy of the pairs it uses.
    """
    static func run(_ args:[String])throws {
        guard let verb=args.first,["proof","scene"].contains(verb),!args.contains("--help") else{print(usage);return}
        let known=["--font","--text","--out","--width","--tables","--genome","--mode","--strength","--tightness","--minimum-gap","--word-space","--pairs"]
        var values:[String:String]=[:],i=1
        while i<args.count {
            guard known.contains(args[i]),i+1<args.count else{throw PosterError.invalid("Unknown kerning option \(args[i]).\n\(usage)")}
            values[args[i]]=args[i+1];i+=2
        }
        func number(_ key:String)throws->Double? {
            guard let v=values[key] else{return nil}
            guard let d=Double(v),d.isFinite else{throw PosterError.invalid("\(key) needs a number.")}
            return d
        }
        guard let out=values["--out"],let width=Int(values["--width"] ?? "2400") else{throw PosterError.invalid("Kerning needs --out and a valid --width.\n\(usage)")}
        var settings=TextKerning(mode:.optical)
        if let m=values["--mode"] {guard let mode=TextKerning.Mode(rawValue:m) else{throw PosterError.invalid("--mode is optical, metrics or none.")};settings.mode=mode}
        if let v=try number("--strength") {settings.strength=v}
        if let v=try number("--tightness") {settings.tightness=v}
        if let v=try number("--word-space") {settings.wordSpace=v}
        if let g=values["--minimum-gap"] {settings.minimumGap=g=="none" ? nil:try number("--minimum-gap")}
        let extra=try parsePairs(values["--pairs"] ?? "")
        _=try settings.validated()
        let store=values["--tables"].map{KerningTableStore(directory:URL(fileURLWithPath:$0))}
        func pairs(for font:String)->[String:Double] {(store?.load(font)?.pairs ?? [:]).merging(extra){$1}}
        let root=URL(fileURLWithPath:out)
        guard !FileManager.default.fileExists(atPath:root.appending(path:verb=="proof" ? "proof.png":"poster.png").path) else{throw PosterError.invalid("Kerning output already exists. Choose a new folder.")}
        if verb=="proof" {
            guard let font=values["--font"] else{throw PosterError.invalid("A proof needs --font (a PostScript name).")}
            let text=values["--text"] ?? "AVATAR WAVY To Ye",yours=pairs(for:font)
            var rows:[(String,TextKerning)]=[("None",TextKerning(mode:.none)),("Metrics",TextKerning(mode:.metrics)),("Optical",settings)]
            if !yours.isEmpty {var mine=settings;mine.pairs=yours;rows.append(("Your pairs",mine))}
            let image=try KerningProof.render(text,font:font,rows:rows,width:width)
            try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
            try PosterRenderer.png(image,to:root.appending(path:"proof.png"))
            let layout=KerningSystem.layout(text,font:FontLibrary.font(name:font),tracking:0,kerning:rows.last!.1,measure:true)
            let gaps=layout.gaps.filter(\.adjustable).map{g in ["after":String(g.index),"pair":g.pair,"font":String(Int(g.font.rounded())),"optical":String(Int((g.optical ?? 0).rounded())),"used":String(Int(g.applied.rounded()))]}
            try LibraryRaster.write(["font":[font],"text":[text],"rows":rows.map(\.0)],to:root.appending(path:"proof.json"))
            try LibraryRaster.write(gaps,to:root.appending(path:"pairs.json"))
            print("Kerning proof of “\(text)” in \(font): \(root.path)")
            return
        }
        guard let input=values["--genome"] else{throw PosterError.invalid("Kerning a scene needs --genome.")}
        let data=try Data(contentsOf:URL(fileURLWithPath:input)),decoder=JSONDecoder()
        let hybrid=try? decoder.decode(HybridScene.self,from:data),variation=try? decoder.decode(TypeSystemVariant.self,from:data)
        let original=try hybrid?.genome ?? variation?.replay() ?? decoder.decode(StyleGenome.self,from:data),seed=hybrid?.seed ?? 0
        var scene=original
        for line in KerningSystem.lines(original) {
            var k=settings;k.pairs=pairs(for:line.fontName ?? original.font)
            scene=KerningSystem.apply(k,to:scene,only:[line.sourceElementID])
        }
        try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
        try PosterRenderer.png(LibrarySceneRenderer.render(original,width:width,seed:seed),to:root.appending(path:"before.png"))
        try PosterRenderer.png(LibrarySceneRenderer.render(scene,width:width,seed:seed),to:root.appending(path:"poster.png"))
        try LibrarySceneRenderer.pdf(scene,to:root.appending(path:"poster.pdf"),seed:seed)
        try LibraryRaster.write(scene,to:root.appending(path:"genome.json"))
        let report=KerningSystem.lines(scene).map{e->[String:String] in
            let layout=KerningSystem.layout(e,string:e.text ?? "",genome:scene)
            return ["element":e.sourceElementID,"text":e.text ?? "","font":e.fontName ?? scene.font,"mode":KerningSystem.settings(e,genome:scene).mode.rawValue,
                    "gaps":layout.gaps.filter(\.adjustable).map{"\($0.pair) \(Int($0.applied.rounded()))"}.joined(separator:" · ")]
        }
        try LibraryRaster.write(report,to:root.appending(path:"kerning.json"))
        print("Kerned \(report.count) lines (\(settings.mode.rawValue)). Before and after PNGs, outlined PDF and the kerned scene: \(root.path)")
    }
    /// "AV=-30,To=-20" → pairs. A pair is exactly two characters.
    static func parsePairs(_ list:String)throws->[String:Double] {
        var out:[String:Double]=[:]
        for item in list.split(separator:",") where !item.isEmpty {
            let parts=item.split(separator:"=",maxSplits:1).map(String.init)
            guard parts.count==2,parts[0].count==2,let v=Double(parts[1]),v.isFinite else{throw PosterError.invalid("Write pairs as AV=-30,To=-20, not “\(item)”.")}
            out[parts[0]]=v
        }
        return out
    }
}
