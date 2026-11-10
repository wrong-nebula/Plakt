import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

/// Side-by-side renders of the same inherited layouts before placement and in each placement mode.
public enum TypePlacementProof {
    public static let recipeIDs=["survey-faceted-spire","survey-sliced-orb","survey-gravity-drips","survey-bilateral-soft-cross","survey-portal-type","survey-module-substitution"]
    /// `parameters` overrides recipe values wherever a recipe has that control, so variants and type modes can be proofed on real layouts.
    public static func run(records:[PosterRecord],output:URL,recipeIDs:[String]=recipeIDs,samples:Int=3,seed:UInt64=20261108,contrast:String="auto",parameters:[String:Double]=[:],progress:(String)->Void={_ in})throws {
        guard !FileManager.default.fileExists(atPath:output.path),(1...8).contains(samples) else{throw PosterError.invalid("Choose a new proof directory and 1–8 samples.")}
        try TypePlacementSettings(contrast:contrast).validate()
        let sources=records.filter{$0.reviewStatus != "rejected" && (0.6...1.8).contains($0.genome.aspect) && $0.elements.filter{$0.kind=="text-line" && $0.reviewStatus != "rejected"}.count>=3}.sorted{$0.id<$1.id}
        guard sources.count>=2 else{throw PosterError.invalid("Need source compositions from the poster library.")}
        let variants:[(String,TypePlacementSettings?)]=[("before",nil),("anchored",TypePlacementSettings(mode:"anchored",contrast:contrast)),("mixed",TypePlacementSettings(mode:"mixed",contrast:contrast)),("free",TypePlacementSettings(mode:"free",contrast:contrast))]
        let categories=["abstract","optical","color-field","swiss","expressive","minimal"]
        var html=["<!doctype html><meta charset=utf-8><title>Type placement proof</title><style>body{font:13px -apple-system,sans-serif;margin:24px;background:#f3f1ec;color:#1c1c1c}h2{margin:36px 0 8px}.row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}figure{margin:0}img{width:100%;display:block;background:#fff}figcaption{padding:4px 0;color:#555}</style>","<h1>Type placement proof</h1><p>Same inherited layout and shape per row. <b>before</b>: no placement or contrast. <b>anchored</b>: every block in a system anchor. <b>mixed</b>: headline and information anchored. <b>free</b>: layout positions kept, overlap contrast \(contrast). Anchor overlay: magenta title, blue display, green information, grey measured quiet zone; solid = occupied.</p>"]
        for (recipeIndex,id) in recipeIDs.enumerated() {
            guard let recipe=PosterShapeLibrary.recipe(id) else{throw PosterError.invalid("Unknown recipe \(id).")}
            let semantic=["survey-portal-type","survey-module-substitution","survey-scalloped-frame"].contains(id)
            html.append("<h2>\(recipe.name)</h2>")
            var sheet:[[CGImage]]=[]
            for sample in 0..<samples {
                let childSeed=seed &+ UInt64(recipeIndex*1000+sample*31),category=categories[(recipeIndex+sample)%categories.count]
                let a=sources[Int(childSeed%UInt64(sources.count))],b=sources[Int((childSeed &+ 7919)%UInt64(sources.count))]
                let font=FontLibrary.shared.choose(category:category,seed:childSeed)
                let base=SourceLayoutDNA.make(a,b,category:category,seed:childSeed,copy:ContentBriefLibrary.copy(seed:seed,offset:recipeIndex*3+sample),id:id+"-\(sample)",fontProfileID:font?.id)
                let mode=sample%2==1 && !semantic ? "source-dominant":"source-region"
                let folder=output.appending(path:id+"/sample-\(sample)")
                try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                var row:[CGImage]=[],cells:[String]=[]
                for (name,placement) in variants {
                    var preset=PosterShapePreset(recipe:recipe,seed:childSeed,parameters:parameters.filter{key,_ in recipe.parameters.contains{$0.id==key}},fontProfileID:font?.id);preset.placement=placement
                    let scene=try SurveySystemStudy.place(preset,in:base,mode:mode)
                    let image=try LibrarySceneRenderer.render(scene,width:560)
                    try jpeg(image,to:folder.appending(path:name+".jpg"));try LibraryRaster.write(scene,to:folder.appending(path:name+"-genome.json"))
                    row.append(image);cells.append("<figure><img src='\(id)/sample-\(sample)/\(name).jpg'><figcaption>\(name)\(name=="before" ? " · \(mode)":"")</figcaption></figure>")
                    if name=="anchored" {
                        let overlay=try ShapeTypePlacement.anchorOverlay(scene,width:560)
                        try jpeg(overlay,to:folder.appending(path:"anchors.jpg"));row.append(overlay)
                        let used=scene.elements.compactMap(\.typeAnchorID).count
                        cells.append("<figure><img src='\(id)/sample-\(sample)/anchors.jpg'><figcaption>anchors · \(scene.typeAnchors?.count ?? 0) found, \(used) text elements placed</figcaption></figure>")
                    }
                }
                sheet.append(row);html.append("<div class=row>"+cells.joined()+"</div>")
                progress("\(id) sample \(sample+1)/\(samples) · \(mode)")
            }
            try jpeg(contact(sheet),to:output.appending(path:"contact-\(id).jpg"))
        }
        try html.joined(separator:"\n").write(to:output.appending(path:"index.html"),atomically:true,encoding:.utf8)
    }
    static func contact(_ rows:[[CGImage]])throws->CGImage {
        let cell=360,gap=12,columns=rows.map(\.count).max() ?? 1
        let heights=rows.map{row in row.map{Int(Double($0.height)*Double(cell)/Double($0.width))}.max() ?? cell}
        let width=columns*cell+(columns+1)*gap,height=heights.reduce(0,+)+(rows.count+1)*gap
        guard let ctx=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{throw PosterError.render}
        ctx.setFillColor(LibrarySceneRenderer.color("#d9d6cf"));ctx.fill(CGRect(x:0,y:0,width:width,height:height))
        var top=gap
        for (r,row) in rows.enumerated() {
            for (c,image) in row.enumerated() {
                let h=Int(Double(image.height)*Double(cell)/Double(image.width))
                ctx.draw(image,in:CGRect(x:gap+c*(cell+gap),y:height-top-h,width:cell,height:h))
            }
            top += heights[r]+gap
        }
        guard let image=ctx.makeImage() else{throw PosterError.render};return image
    }
    static func jpeg(_ image:CGImage,to url:URL)throws {
        guard let target=CGImageDestinationCreateWithURL(url as CFURL,UTType.jpeg.identifier as CFString,1,nil) else{throw PosterError.render}
        CGImageDestinationAddImage(target,image,[kCGImageDestinationLossyCompressionQuality:0.9] as CFDictionary)
        guard CGImageDestinationFinalize(target) else{throw PosterError.render}
    }
}
