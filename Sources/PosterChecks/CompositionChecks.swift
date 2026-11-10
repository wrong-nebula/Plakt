import Foundation
import PosterCore
import CoreGraphics

extension PosterChecks {
    static func checkComposition()throws {
        for seed:UInt64 in [11,55,101] {
            let genome=Genome.random(seed:seed)
            guard let plan=genome.composition else{throw CheckFailure("Procedural genome has no codified layout")}
            try require(plan.regions.count==11 && plan.regions.allSatisfy{$0.bounds.valid},"Original modular layout is not completely codified")
            for category in StyleCatalog.categories {
                var styled=genome;styled.renderStyle=category.id
                let layout=CompositionPlan.procedural(styled)
                try require(!layout.description.isEmpty && !layout.regions.isEmpty,"Style genome lacks a composition description or regions")
                try require(layout.regions.allSatisfy{$0.bounds.valid},"Declared style region falls outside the canvas")
                try require(Set(layout.regions.map(\.id)).count==layout.regions.count,"Layout region IDs are duplicated")
                let text=layout.regions.filter{$0.kind=="text"}
                try require(text.allSatisfy{$0.preserveTypeProportions==true},"Rebuilt type allows accidental aspect distortion")
                try require(layout.constraints.contains{$0.type=="natural-glyph-proportions"},"Natural type constraint missing")
                let metadata=layout.regions.filter{$0.id.hasPrefix("meta:")}
                try require(metadata.allSatisfy{$0.bounds.height>=0.013},"Metadata is below declared minimum height")
            }
        }
        let scene=try StylePosterRenderer.genome(style:"bauhaus",seed:55)
        let metadata=scene.elements.first{$0.sourceElementID=="meta:institution"}!
        let bodyOnly=Measurements(coverage:0.5,detail:0.5,balance:0.5,contrast:0.5,readability:1,reference:0.5,hierarchy:0.5,repetition:0.5,recognizedWords:3,recognizedText:"VISUAL COMMUNICATION",recognizedLines:[RecognizedLine(text:"VISUAL COMMUNICATION",confidence:1,bounds:metadata.bounds)])
        let scores=CompositionJudges.evaluate(scene,measurements:bodyOnly,copy:PosterCopy(),style:"bauhaus")
        try require((scores["Legibility"] ?? 1)<0.4,"Header OCR incorrectly passed title legibility")
        try require(scores.values.allSatisfy{$0.isFinite && (0...1).contains($0)},"Craft judge returned invalid scores")
        for category in StyleCatalog.categories {
            let scene=try StylePosterRenderer.genome(style:category.id,seed:55)
            let quality=CompositionJudges.evaluate(scene,measurements:bodyOnly,copy:PosterCopy(),style:category.id)
            try require((quality["Spacing"] ?? 0)>0.85,"Protected glyphs collide in \(category.name)")
        }
        var clippedScene:StyleGenome?
        for seed:UInt64 in 1...30 {
            let item=try StylePosterRenderer.genome(style:"optical",seed:seed)
            if item.elements.contains(where:{$0.clipBounds != nil}) {clippedScene=item;break}
        }
        guard var cut=clippedScene else{throw CheckFailure("Sliced glyph grammar is unreachable")}
        let encoded=try JSONEncoder().encode(cut),decoded=try JSONDecoder().decode(StyleGenome.self,from:encoded)
        try require(decoded.elements.compactMap(\.clipBounds).count>=12,"Strip clipping was not preserved in the genome")
        try require(cut.composition?.constraints.contains{$0.type=="declared-strip-clipping"}==true,"Graphic clipping is not codified")
        var invalidClip=cut;invalidClip.elements[0].clipBounds=UnitBox(x:-1,y:0,width:1,height:1)
        try require(CompositionJudges.preflight(invalidClip,copy:PosterCopy()).contains("invalid graphic clip bounds"),"Invalid clip passed source-study preflight")
        let sliced=try rgba(LibrarySceneRenderer.render(cut,width:400))
        for i in cut.elements.indices {cut.elements[i].clipBounds=nil}
        let uncut=try rgba(LibrarySceneRenderer.render(cut,width:400))
        try require(sliced != uncut,"Glyph-strip masks do not affect rendered pixels")
        var overprint=try StylePosterRenderer.genome(style:"color-field",seed:31)
        let printed=try rgba(LibrarySceneRenderer.render(overprint,width:350))
        for i in overprint.elements.indices {overprint.elements[i].blendMode=nil}
        let flat=try rgba(LibrarySceneRenderer.render(overprint,width:350))
        try require(printed != flat,"Declared multiply overprinting does not alter actual pixels")
        var tone=try StylePosterRenderer.genome(style:"halftone",seed:32)
        let lit=try rgba(LibrarySceneRenderer.render(tone,width:350))
        let form=tone.elements.firstIndex{$0.geometry?["light"] != nil}!
        tone.elements[form].geometry?["light"]=0.9
        let relit=try rgba(LibrarySceneRenderer.render(tone,width:350))
        try require(lit != relit,"Stored lighting parameters do not change halftone geometry")
        try require(tone.composition?.constraints.contains{$0.type=="procedural-vector-geometry"}==true,"Procedural vector rule is not codified")
        let colorScene=try StylePosterRenderer.genome(style:"color-field",seed:31)
        let pdfURL=URL(fileURLWithPath:NSTemporaryDirectory()).appending(path:"poster-color-edge-"+UUID().uuidString+".pdf")
        defer{try? FileManager.default.removeItem(at:pdfURL)}
        try LibrarySceneRenderer.pdf(colorScene,to:pdfURL)
        guard let document=CGPDFDocument(pdfURL as CFURL),document.numberOfPages==1,let page=document.page(at:1),let ctx=CGContext(data:nil,width:1000,height:1414,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw CheckFailure("Could not rasterize scene PDF")}
        ctx.setFillColor(CGColor(gray:1,alpha:1));ctx.fill(CGRect(x:0,y:0,width:1000,height:1414))
        let media=page.getBoxRect(.mediaBox);ctx.scaleBy(x:1000/media.width,y:1414/media.height);ctx.drawPDFPage(page)
        guard let pdfImage=ctx.makeImage() else{throw CheckFailure("Could not read PDF raster")}
        let pdfPixels=try rgba(pdfImage),pngPixels=try rgba(LibrarySceneRenderer.render(colorScene,width:1000))
        for index in [0,999,1413*1000,1414*1000-1] {for channel in 0..<3 {try require(abs(Int(pdfPixels[index*4+channel])-Int(pngPixels[index*4+channel]))<=3,"Colored PDF has a white rounding gap at its edge")}}
        print("PASS: colored vector PDF fills all page corners and matches the PNG background")
        print("PASS: multiply overprinting and parameter-driven vector halftone shading affect rendered pixels")
        print("PASS: declared strip masks serialize and change actual natural-glyph rendering")
        print("PASS: codified composition descriptions, bounds, role IDs, natural typography and minimum metadata sizes")
    }
}
