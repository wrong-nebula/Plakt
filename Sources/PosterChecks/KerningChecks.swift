import Foundation
import CoreGraphics
import CoreText
import PosterCore
extension PosterChecks {
    static func checkKerning()throws {
        let helvetica=FontLibrary.font(name:"HelveticaNeue-Bold")
        func core(_ text:String,_ font:CTFont,kern:Double?)->[Double] {
            var attributes:[NSAttributedString.Key:Any]=[NSAttributedString.Key(kCTFontAttributeName as String):font]
            if let kern {attributes[NSAttributedString.Key(kCTKernAttributeName as String)]=kern}
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:attributes))
            return (CTLineGetGlyphRuns(line) as! [CTRun]).flatMap{run->[Double] in
                var p=[CGPoint](repeating:.zero,count:CTRunGetGlyphCount(run));CTRunGetPositions(run,CFRange(location:0,length:p.count),&p);return p.map{Double($0.x)}
            }
        }
        func xs(_ l:KerningSystem.Layout)->[Double] {l.placements.map{Double($0.position.x)}}
        func same(_ a:[Double],_ b:[Double])->Bool {a.count==b.count && zip(a,b).allSatisfy{abs($0-$1)<1e-9}}
        func layout(_ text:String,_ k:TextKerning,tracking:Double=0,font:CTFont?=nil)->KerningSystem.Layout {KerningSystem.layout(text,font:font ?? helvetica,tracking:tracking,kerning:k,measure:true)}

        // Legacy: a zero kern switched the font's pairs off and any other tracking kept them. The legacy settings reproduce both,
        // ligatures included (Core Text tracks once per glyph), and Metrics is exactly Core Text's default setting.
        for text in ["AVATAR WAVY","office","Tôt àé"] {
            try require(same(core(text,helvetica,kern:0),xs(layout(text,.legacy(tracking:0)))),"Legacy zero tracking differs from Core Text for \(text)")
            for t in [3.0,-2.0] {try require(same(core(text,helvetica,kern:t),xs(layout(text,.legacy(tracking:t),tracking:t))),"Legacy tracking \(t) differs from Core Text for \(text)")}
            try require(same(core(text,helvetica,kern:nil),xs(layout(text,TextKerning(mode:.metrics)))),"Metrics differs from Core Text's own kerning for \(text)")
        }
        try require(core("AV",helvetica,kern:0)[1] != core("AV",helvetica,kern:nil)[1],"Core Text no longer switches kerning off at a zero kern: the legacy mapping needs revisiting")
        let office=layout("office",TextKerning(mode:.optical))
        try require(office.gaps.map(\.adjustable)==[true,false,false,true,true],"Gaps inside the ffi ligature should be locked")

        // Optical: classic pairs close, even pairs stay put, in three different designs.
        var fonts=[helvetica,FontLibrary.font(name:"Futura-Bold")]
        let anton=FontLibrary.font(name:"Anton-Regular");if CTFontCopyPostScriptName(anton) as String=="Anton-Regular" {fonts.append(anton)}
        for font in fonts {
            let name=CTFontCopyPostScriptName(font) as String
            for pair in ["AV","To","LT","Yo","P."] {
                let v=layout(pair,TextKerning(mode:.optical),font:font).gaps[0].optical ?? 0
                try require(v < -15,"Optical \(pair) in \(name) should close up, got \(Int(v))")
            }
            for pair in ["HH","nn","oo","HO","no"] {
                let v=layout(pair,TextKerning(mode:.optical),font:font).gaps[0].optical ?? 0
                try require(abs(v)<=20,"Optical \(pair) in \(name) should stay near its advance, got \(Int(v))")
            }
        }
        // Strength scales the correction and tightness shifts every pair; optical is repeatable.
        let av=layout("AV",TextKerning(mode:.optical)).gaps[0].optical!,half=layout("AV",TextKerning(mode:.optical,strength:0.5)).gaps[0].optical!
        try require(abs(half-av/2)<1 && abs((layout("AV",TextKerning(mode:.optical,strength:0)).gaps[0].optical!))<1e-9,"Strength does not scale the optical correction")
        try require(abs(layout("HH",TextKerning(mode:.optical,tightness:-30,minimumGap:nil)).gaps[0].optical!-layout("HH",TextKerning(mode:.optical,minimumGap:nil)).gaps[0].optical!+30)<1e-6,"Tightness does not shift pairs")
        try require(same(xs(layout("AVATAR WAVY",TextKerning(mode:.optical))),xs(layout("AVATAR WAVY",TextKerning(mode:.optical)))),"Optical kerning is not repeatable")
        // Minimum gap: even a crushing tightness never sets two H stems closer than it; without it they overlap.
        func stems(_ k:TextKerning)->Double {let l=layout("HH",k),boxes=l.placements.compactMap{CTFontCreatePathForGlyph($0.font,$0.glyph,nil)?.boundingBoxOfPath.offsetBy(dx:$0.position.x,dy:0)};return Double(boxes[1].minX-boxes[0].maxX)}
        try require(stems(TextKerning(mode:.optical,tightness:-200,minimumGap:20)) >= 2-0.05,"Minimum gap let the letters come closer than 20/1000 em")
        try require(stems(TextKerning(mode:.optical,tightness:-200,minimumGap:nil))<0,"Without a minimum gap, a crushing tightness should overlap the letters")

        // Your kerning: pairs act at every occurrence, gaps at one place while the text is unchanged, word space after spaces.
        let plain=layout("AVAV",TextKerning(mode:.none)),paired=layout("AVAV",TextKerning(mode:.none,pairs:["AV":-50]))
        try require(abs(xs(paired)[1]-xs(plain)[1]+5)<1e-9 && abs(xs(paired)[3]-xs(plain)[3]+10)<1e-9 && abs(xs(paired)[2]-xs(plain)[2]+5)<1e-9,"Pair AV −50 should move each following letter 5 pt at 100 pt")
        var one=TextKerning(mode:.none);one.setGap(1,in:"AVAV",to:100)
        try require(abs(xs(layout("AVAV",one))[2]-xs(plain)[2]-10)<1e-9 && abs(xs(layout("AVAV",one))[1]-xs(plain)[1])<1e-9,"A gap value should move only the letters after that gap")
        try require(same(xs(layout("AVAW",one)),xs(layout("AVAW",TextKerning(mode:.none)))),"A gap value set for other text must be ignored")
        one.setGap(1,in:"AVAV",to:0);try require(one.gaps.isEmpty && one.gapsText==nil,"Clearing the last gap value should clear its text")
        let spaced=layout("TO BE",TextKerning(mode:.none,wordSpace:200)),unspaced=layout("TO BE",TextKerning(mode:.none))
        try require(abs(xs(spaced)[3]-xs(unspaced)[3]-20)<1e-9 && abs(xs(spaced)[2]-xs(unspaced)[2])<1e-9,"Word space should widen only the space")

        // Settings decode with defaults, round-trip, and reject bad values.
        let decoded=try JSONDecoder().decode(TextKerning.self,from:Data(#"{"mode":"optical"}"#.utf8))
        try require(decoded==TextKerning(mode:.optical),"Missing kerning fields should take their defaults")
        var full=TextKerning(mode:.optical,strength:1.3,tightness:-12,minimumGap:nil,wordSpace:40,pairs:["AV":-20]);full.setGap(2,in:"AVATAR",to:-15)
        let reread=try JSONDecoder().decode(TextKerning.self,from:JSONEncoder().encode(full))
        try require(reread==full,"Kerning settings do not round-trip (a cleared minimum gap must stay cleared)")
        try require(rejected{_=try TextKerning(strength:.nan).validated()} && rejected{_=try TextKerning(pairs:["ABC":-10]).validated()} && rejected{_=try TextKerning(gaps:["x":5],gapsText:"AV").validated()} && rejected{_=try TextKerning(gaps:["1":5]).validated()},"Invalid kerning settings were accepted")

        // Scenes: no settings draws exactly as before; legacy settings match it; optical changes the poster, repeatably, in PNG and PDF.
        let json=##"{"version":"kerning-check","posterID":"kerning-check","aspect":1.414,"background":"#f4f2ee","font":"HelveticaNeue-Bold","textScale":1,"tracking":0,"fittingStatus":"check","sourceEmbeddingModel":"none","elements":[{"sourceElementID":"title","kind":"text","bounds":{"x":0.05,"y":0.3,"width":0.9,"height":0.12},"rotation":0,"text":"AVATAR WAVY","color":"#141414","shape":"rectangle","outline":false,"shadow":false,"offsetX":0,"offsetY":0,"copies":1,"preserveTypeProportions":true,"typeEmSize":8},{"sourceElementID":"info","kind":"text","bounds":{"x":0.05,"y":0.6,"width":0.6,"height":0.05},"rotation":0,"text":"Tower Yard LAVA","color":"#141414","shape":"rectangle","outline":false,"shadow":false,"offsetX":0,"offsetY":0,"copies":1,"tracking":3}]}"##
        let scene=try JSONDecoder().decode(StyleGenome.self,from:Data(json.utf8))
        let before=try rgba(LibrarySceneRenderer.render(scene,width:600))
        var legacy=scene;for i in legacy.elements.indices {legacy.elements[i].kerning=KerningSystem.settings(scene.elements[i],genome:scene)}
        let legacyPixels=try rgba(LibrarySceneRenderer.render(legacy,width:600))
        try require(legacyPixels==before,"Legacy kerning settings change the rendered poster")
        let optical=KerningSystem.apply(TextKerning(mode:.optical),to:scene)
        try require(optical.elements.allSatisfy{$0.kerning?.mode == .optical},"Applying kerning skipped a line")
        let after=try rgba(LibrarySceneRenderer.render(optical,width:600)),again=try rgba(LibrarySceneRenderer.render(optical,width:600))
        try require(after != before && after==again,"Optical kerning should change the poster, repeatably")
        try require(CompositionJudges.inkBounds(optical.elements[0],genome:optical).width<CompositionJudges.inkBounds(scene.elements[0],genome:scene).width,"Measured ink should follow the kerned, tighter line")
        try require(KerningSystem.lines(scene).map(\.sourceElementID)==["title","info"] && KerningSystem.reset(optical).elements.allSatisfy{$0.kerning==nil},"Line listing or reset is wrong")
        var gapped=optical;gapped.elements[0].kerning?.setGap(0,in:"AVATAR WAVY",to:80)
        try require(KerningSystem.apply(TextKerning(mode:.metrics),to:gapped).elements[0].kerning?.gap(0,in:"AVATAR WAVY")==80,"Applying settings to every line dropped a line's own gap values")
        let pdf=FileManager.default.temporaryDirectory.appending(path:"posterlab-kerning-\(UUID().uuidString).pdf");defer{try? FileManager.default.removeItem(at:pdf)}
        try LibrarySceneRenderer.pdf(optical,to:pdf)
        try require((CGPDFDocument(pdf as CFURL)?.numberOfPages ?? 0)==1,"Kerned scene PDF did not render")
        var broken=optical;broken.elements[0].kerning?.strength = .infinity
        try require(rejected{_=try LibrarySceneRenderer.render(broken,width:400)},"A scene with invalid kerning rendered")

        // New posters start optical poster-wide; their lines go through the kerning system and the setting survives saving.
        // A saved scene without the field (the check scene above) keeps its original setting.
        try require(scene.kerning==nil && TextKerning.newPosters.mode == .optical,"A scene saved before kerning existed must decode without a poster-wide setting")
        let made=try PosterShapeLibrary.scene(PosterShapePreset(recipe:PosterShapeLibrary.recipes[0],seed:7,parameters:[:],fontProfileID:nil),pairing:true)
        try require(made.kerning==TextKerning.newPosters,"A newly made poster should default to optical kerning")
        let saved=try JSONDecoder().decode(StyleGenome.self,from:JSONEncoder().encode(made))
        try require(saved.kerning==TextKerning.newPosters,"A new poster's kerning was lost on saving")
        if let line=KerningSystem.lines(made).first {
            try require(KerningSystem.isKerned(line,genome:made) && KerningSystem.settings(line,genome:made).mode == .optical,"A new poster's lines should use its optical default")
            var unset=made;unset.kerning=nil
            try require(!KerningSystem.isKerned(line,genome:unset),"Without any setting a line should keep its original setting")
        }
        var poster=scene;poster.kerning=TextKerning.newPosters
        let posterPixels=try rgba(LibrarySceneRenderer.render(poster,width:600)),opticalPixels=try rgba(LibrarySceneRenderer.render(KerningSystem.apply(TextKerning.newPosters,to:scene),width:600))
        try require(posterPixels==opticalPixels,"A poster-wide optical default should draw like optical on every line")
        try require(rejected{var bad=scene;bad.kerning=TextKerning(strength:-1);_=try LibrarySceneRenderer.render(bad,width:400)},"An invalid poster-wide kerning rendered")

        // Font tables: save, reload, list; zero pairs are dropped; invalid pairs refused.
        let folder=FileManager.default.temporaryDirectory.appending(path:"posterlab-kerning-tables-\(UUID().uuidString)");defer{try? FileManager.default.removeItem(at:folder)}
        let store=KerningTableStore(directory:folder)
        _=try store.save(font:"HelveticaNeue-Bold",pairs:["AV":-30,"To":0,"LT":-12])
        try require(store.load("HelveticaNeue-Bold")?.pairs==["AV":-30,"LT":-12] && store.fonts()==["HelveticaNeue-Bold"] && store.load("Futura-Bold")==nil,"Kerning table did not round-trip")
        try require(rejected{_=try store.save(font:"HelveticaNeue-Bold",pairs:["AVA":-3])},"A table with a three-letter pair was saved")

        // Proof sheet: one row per setting at the requested width.
        let proof=try KerningProof.render("AVATAR To",font:"HelveticaNeue-Bold",rows:[("None",TextKerning(mode:.none)),("Optical",TextKerning(mode:.optical))],width:1200)
        try require(proof.width==1200 && proof.height>200,"Kerning proof has the wrong size")
        print("PASS: kerning — legacy and metrics match Core Text (ligatures too), optical closes classic pairs in \(fonts.count) fonts and keeps even pairs, minimum gap, strength, tightness, pairs, gaps, word space, settings round trip and validation, unchanged scenes, kerned PNG/PDF, measured ink, new posters default to optical while saved scenes keep their setting, font tables, proof sheet")
    }
}
