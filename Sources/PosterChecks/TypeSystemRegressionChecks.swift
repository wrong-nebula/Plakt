import Foundation
import PosterCore

extension PosterChecks {
    static func checkTypeSystemRegressions()throws {
        let systems=TypeSystemLibrary.shared.systems
        func system(_ op:String)throws->TypeSystemGenome{guard let s=systems.filter({$0.operation==op}).sorted(by:{$0.representativeScore>$1.representativeScore}).first else{throw CheckFailure("Missing \(op)")};return s}
        for op in ["compensated-erosion","paired-columns","reflection","word-reflow"] {
            let s=try system(op)
            var inputs=[TypeSystemAudit.example(op)]
            if op=="compensated-erosion"{inputs += ["café|du|rêve","AROUND THE SOUND"]}
            else if op=="paired-columns" || op=="reflection"{inputs += [" ÉTÉ | RÊVES ","TWO WORDS | MANY MORE WORDS"]}
            else{inputs += ["A  NEW\nFIELD\tOF POSSIBILITIES","ÉTÉ À ZÜRICH"]}
            for input in inputs {
                let original=Array(input.precomposedStringWithCanonicalMapping)
                let steps=try TypeSystemEngine.steps(s,input:input)
                for step in steps {
                    let out=Array(step.text)
                    try require(out.count==step.indexMap.count,"Character trace length differs for \(op)")
                    for (i,index) in step.indexMap.enumerated() {
                        try require(index>=(-1) && index<original.count,"Invalid source index for \(op)")
                        if index>=0{try require(String(out[i]).lowercased()==String(original[index]).lowercased(),"Character trace points at the wrong input glyph for \(op)")}
                    }
                }
            }
        }
        let reflow=try system("word-reflow"),input="A NEW FIELD OF UNEXPECTED POSSIBILITIES"
        var rhythm=reflow;rhythm.textParameters["lineWordCounts"]="1,2"
        let reflowSteps=try TypeSystemEngine.steps(rhythm,input:input)
        try require(reflowSteps.map(\.text)==["A","NEW FIELD","OF","UNEXPECTED POSSIBILITIES"],"Reflow did not repeat its source word-group rhythm")
        try require(reflowSteps.map(\.text).joined(separator:" ")==input,"Reflow lost or duplicated words")
        let reflection=try system("reflection")
        let reflectionScene=try TypeSystemEngine.scene(reflection,input:"PLAY | WITH")
        let variant=TypeSystemVariant(system:reflection,input:"PLAY | WITH",overrides:[:],fontProfileID:nil,foreground:"#191c22",accent:"#3d52b6",background:"#f0eee7",scene:reflectionScene)
        var target=try TypeSystemEngine.scene(system("repeat-field"),input:"TARGET")
        let app=try TypeSystemLibrary.shared.transplant(variant,into:&target.elements,aspect:target.aspect,profile:nil,copy:PosterCopy(title:"ECHO",subtitle:"Art and sound"))
        try require(app.steps.allSatisfy{!$0.text.isEmpty},"A one-word brief creates blank reflected labels")
        let heart=try system("tittle-substitution")
        let small=try TypeSystemEngine.scene(heart,input:"Intuition",overrides:["heartScale":1])
        let large=try TypeSystemEngine.scene(heart,input:"Intuition",overrides:["heartScale":2.3])
        let smallPixels=try rgba(LibrarySceneRenderer.render(small,width:500)),largePixels=try rgba(LibrarySceneRenderer.render(large,width:500))
        try require(smallPixels != largePixels,"Heart scale control is visually inactive")
        let ramp=try system("scale-ramp")
        let baseline=try TypeSystemEngine.scene(ramp,input:"VOICE")
        func relativeHeights(_ scene:StyleGenome)->[Double]{let heights=scene.elements.map{item in var e=item;e.rotation=0;return CompositionJudges.inkBounds(e,genome:scene).height};return heights.map{$0/max(0.00001,heights[0])}}
        let ratios=relativeHeights(baseline)
        try require((ratios.max() ?? 1)-(ratios.min() ?? 1)>0.15,"Scale ramp has no size progression")
        for text in ["VOICE","A MUCH LONGER TITLE FOR THE SAME RAMP"] {
            for scale in [0.7,1.3] {
                var resized=try TypeSystemEngine.scene(ramp,input:text,overrides:["fontScale":scale])
                let actual=relativeHeights(resized)
                try require(zip(ratios,actual).allSatisfy{abs($0-$1)<0.001},"Type-scale change flattened the ramp")
                if let profile=FontLibrary.shared.profiles.first(where:{$0.familyID=="ibmplexmono" && $0.weight==400 && !$0.italic}){FontLibrary.apply(profile,to:&resized);let afterFont=relativeHeights(resized);try require(zip(ratios,afterFont).allSatisfy{abs($0-$1)<0.001},"Font change flattened the ramp")}
            }
        }
        let arc=try system("glyph-arc")
        let open=try TypeSystemEngine.steps(arc,input:"OPENFORMS",overrides:["startAngle":-110,"sweep":200])
        try require(abs((open.last!.variables["angle"] ?? 0)-(open.first!.variables["angle"] ?? 0)-200)<0.0001,"Open arc misses its declared endpoint")
        let closed=try TypeSystemEngine.steps(arc,input:"OPENFORMS",overrides:["sweep":360])
        try require(closed.first!.variables["angle"] != closed.last!.variables["angle"],"Closed circle duplicates its first glyph position")
        let long=try TypeSystemEngine.steps(arc,input:String(repeating:"A",count:96))
        try require(long[0].bounds.width<open[0].bounds.width/5,"Long arc forces oversized overlapping glyph slots")
        var wide=arc;wide.sourceAspect=0.5;wide.sourceBounds = .full
        let wideSteps=try TypeSystemEngine.steps(wide,input:"CIRCLE")
        try require(wideSteps.allSatisfy{$0.bounds.valid},"Circle does not fit a wide type field")
        for op in Set(systems.map(\.operation)) {
            let s=try system(op)
            try require(rejected{_ = try TypeSystemEngine.steps(s,input:"   ")},"Whitespace-only input accepted")
            try require(rejected{_ = try TypeSystemEngine.steps(s,input:"WORDS",overrides:["count":Double.greatestFiniteMagnitude])},"Unsafe integer conversion is reachable")
        }
        try require(rejected{_ = try TypeSystemEngine.scene(arc,input:"WORDS",profileID:"missing-font")},"Unknown pinned font silently substituted")
        // Exercise implemented operators that currently have no source-catalog record.
        for op in ["permutation-sequence","radial-fan","curved-baseline"] {
            var fixture=try system("grapheme-migration");fixture.id="audit-fixture-"+op;fixture.operation=op;fixture.sourceBounds = .full;fixture.sourceAspect=1.4;fixture.textParameters=[:]
            fixture.parameters=["count":3];fixture.indexSchedules=[[0,1,2,3],[3,2,1,0],[1,3,0,2]]
            let scene=try TypeSystemEngine.scene(fixture,input:"TYPE")
            try require(!scene.elements.isEmpty,"Implemented \(op) branch is empty")
            _ = try LibrarySceneRenderer.render(scene,width:300)
            if op=="permutation-sequence"{try require(scene.appliedTypeSystems!.first!.steps.map(\.text)==["TYPE","EPYT","YETP"],"Permutation schedules are wrong")}
        }
        print("PASS: grapheme-accurate multi-part traces, cyclic reflow, live heart size, scale-ramp preservation under font/type-size/text changes, open/closed/long arcs, safe inputs and three uncataloged operator branches")
    }
}
