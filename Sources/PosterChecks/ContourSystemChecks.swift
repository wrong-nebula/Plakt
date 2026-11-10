import Foundation
import CoreGraphics
import CoreText
import PosterCore

extension PosterChecks {
    static func checkContourSystems()throws {
        let frame=CGRect(x:0,y:0,width:1000,height:1000)
        let square=CGPath(rect:CGRect(x:100,y:100,width:800,height:800),transform:nil)
        let inner=ContourVectorEngine.offset(square,by:-40,rounded:false).boundingBoxOfPath
        let outer=ContourVectorEngine.offset(square,by:40,rounded:false).boundingBoxOfPath
        try require(abs(inner.minX-140)<0.01 && abs(inner.width-720)<0.01 && abs(outer.minX-60)<0.01 && abs(outer.width-880)<0.01,"Vector offsets do not preserve constant pitch")
        let ring=CGMutablePath();ring.addPath(square);ring.addEllipse(in:CGRect(x:350,y:350,width:300,height:300))
        let counters=ContourVectorEngine.counters(ring,within:frame)
        try require(counters.count==1 && counters[0].contains(CGPoint(x:500,y:500)),"Bounded counter extraction failed")
        let bands=ContourVectorEngine.channels(square,count:3,spacing:50,duty:0.5,expansion:0,rounded:false)
        try require(bands.count==3 && bands[0].path.contains(CGPoint(x:110,y:500)) && !bands[0].path.contains(CGPoint(x:140,y:500)) && bands[1].path.contains(CGPoint(x:160,y:500)),"Parallel channels have wrong band/gap intervals")
        let outline=ContourOutline(path:ring,in:frame),copy=try JSONDecoder().decode(ContourOutline.self,from:JSONEncoder().encode(outline))
        try copy.validate();let restoredPath=try copy.path();try require(copy.commands.contains{$0.kind=="C"} && restoredPath.contains(CGPoint(x:0.12,y:0.12),using:.evenOdd),"Bézier outline roundtrip failed")
        var invalid=outline;invalid.aspect = .nan;try require(rejected{try invalid.validate()},"Nonfinite outline accepted")
        try require(rejected{try ContourCustomization(text:" ").validate()} && rejected{try ContourCustomization(secondaryInk:"blue").validate()},"Invalid contour customization accepted")
        func pixels(_ p:PosterShapePreset)throws->Data{Data(try rgba(LibrarySceneRenderer.render(PosterShapeLibrary.scene(p),width:280)))}
        let type=PosterShapeLibrary.recipe(ContourSystems.typeID)!,profile=PosterShapeLibrary.recipe(ContourSystems.profileID)!
        var p=PosterShapePreset(recipe:type,seed:817,parameters:["expansion":0.12]);p.contour=ContourCustomization(outline:outline,secondaryInk:"#e78e65")
        let a=try pixels(p),replay=try JSONDecoder().decode(PosterShapePreset.self,from:JSONEncoder().encode(p))
        let replayPixels=try pixels(replay);try require(a == replayPixels,"Contour preset replay changed pixels")
        p.parameters["preserveCounters"]=0;let unprotected=try pixels(p);try require(a != unprotected,"Outward contours ignore counter protection")
        p=PosterShapePreset(recipe:type,seed:817,parameters:["construction":0,"layout":1]);p.contour=ContourCustomization(text:"B8O")
        let letters=try pixels(p);p.contour?.text="FORM";let word=try pixels(p);p.contour?.text="B8O"
        let again=try pixels(p);try require(letters != word && letters == again,"Editable contour text or A/B/A cache failed")
        p.contour?.text="DARK CURRENTS";p.parameters=["layout":0,"construction":1]
        let ordinary=try pixels(p);p.parameters["construction"]=0
        let fontOnly=try pixels(p);try require(ordinary==fontOnly,"RKC-specific glyph blocks leaked into ordinary titles")
        var editable=try PosterShapeLibrary.scene(p);editable.posterCopy=PosterCopy(title:"DIFFERENT TITLE")
        PosterShapeLibrary.resolveSurveyContent(in:&editable)
        try require(editable.elements[0].text=="DARK CURRENTS","Explicit contour text override lost to a brief")
        editable.elements[0].contour=nil;PosterShapeLibrary.resolveSurveyContent(in:&editable)
        try require(editable.elements[0].text=="DIFFERENT TITLE","Blank contour text ignores the actual brief")
        let originalFont=try rgba(LibrarySceneRenderer.render(editable,width:280))
        editable.elements[0].fontName="Georgia-Bold";editable.elements[0].fontVariations=nil;editable.elements[0].fontProfileID=nil;editable.elements[0].fontAssetID=nil;editable.elements[0].fontAssetSHA256=nil
        let serifFont=try rgba(LibrarySceneRenderer.render(editable,width:280))
        try require(originalFont != serifFont,"Contour type ignores font outlines")
        var q=PosterShapePreset(recipe:profile,seed:817);let nested=try pixels(q);q.parameters["mode"]=0
        let parallel=try pixels(q);try require(nested != parallel,"Source scaling and constant offsets render identically")
        let scene=try PosterShapeLibrary.scene(replay),sceneReplay=try JSONDecoder().decode(StyleGenome.self,from:JSONEncoder().encode(scene))
        try require(sceneReplay.elements.contains{$0.contour?.outline != nil},"Reusable outline missing from scene genome")
        try checkContourRefinements(type:type,profile:profile)
        print("PASS: native vector pitch/gaps, preserved counters, cubic outline and preset/genome replay, editable glyphs/fonts, actual-title and source-glyph isolation, A/B/A cache, distinct affine/parallel modes")
    }

    private static func checkContourRefinements(type:PosterShapeRecipe,profile:PosterShapeRecipe)throws {
        func build(_ p:PosterShapePreset,aspect:Double=1.3)throws->ContourConstruction{ContourSystems.construction(try PosterShapeLibrary.scene(p).elements[0],aspect:aspect)}
        func band(_ bands:[ContourVectorBand],_ p:CGPoint)->Int?{bands.first{$0.path.contains(p)}?.index}
        // Expansion with protected counters moves only the exterior; rings stay anchored to the counter edge.
        let ring=CGMutablePath();ring.addRect(CGRect(x:100,y:100,width:800,height:800));ring.addEllipse(in:CGRect(x:350,y:350,width:300,height:300))
        let anchored=ContourVectorEngine.channels(ring,count:4,spacing:50,duty:0.5,expansion:40,rounded:true,protecting:CGPath(ellipseIn:CGRect(x:350,y:350,width:300,height:300),transform:nil))
        try require(band(anchored,CGPoint(x:500,y:340))==0 && band(anchored,CGPoint(x:500,y:360))==nil && band(anchored,CGPoint(x:500,y:500))==nil && band(anchored,CGPoint(x:70,y:500))==0 && band(anchored,CGPoint(x:90,y:500))==nil,"Protected counters do not anchor expanded channels")
        // Overlapping contours are ink under nonzero filling; legacy even-odd outlines keep their holes.
        let stacked=CGMutablePath();stacked.addRect(CGRect(x:0,y:0,width:600,height:900));stacked.addRect(CGRect(x:200,y:300,width:200,height:300))
        var overlap=ContourOutline(path:stacked,in:CGRect(x:0,y:0,width:600,height:900));overlap.fillRule="nonzero"
        var custom=PosterShapePreset(recipe:type,seed:817,parameters:["expansion":0.08]);custom.contour=ContourCustomization(outline:overlap)
        let nonzeroCounters=try build(custom).counters.count
        overlap.fillRule=nil;custom.contour=ContourCustomization(outline:overlap)
        let legacyCounters=try build(custom).counters.count
        try require(nonzeroCounters==0 && legacyCounters==1,"Outline fill rule ignored: \(nonzeroCounters) nonzero counters (want 0), \(legacyCounters) legacy even-odd counters (want 1)")
        // Variable fonts overlap contours at stem joins; those overlaps must stay ink.
        for (font,text) in [("unbounded-Unbounded-Regular-w600-d100","EFH"),("syne-Syne-Regular-w800-d100","HXZ")] {
            var glyphs=PosterShapePreset(recipe:type,seed:817,parameters:["construction":0,"layout":1],fontProfileID:font);glyphs.contour=ContourCustomization(text:text)
            let source=try build(glyphs).sources[0],face=FontLibrary.shared.profile(font)!
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[.font:FontLibrary.font(name:face.postscriptName,variations:face.variations)]))
            let raw=CGMutablePath()
            for run in CTLineGetGlyphRuns(line) as! [CTRun] {
                let n=CTRunGetGlyphCount(run);var ids=[CGGlyph](repeating:0,count:n),at=[CGPoint](repeating:.zero,count:n)
                CTRunGetGlyphs(run,CFRange(location:0,length:n),&ids);CTRunGetPositions(run,CFRange(location:0,length:n),&at)
                let runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
                for i in 0..<n{if let g=CTFontCreatePathForGlyph(runFont,ids[i],nil){raw.addPath(g,transform:CGAffineTransform(a:1,b:0,c:0,d:-1,tx:at[i].x,ty:-at[i].y))}}
            }
            let r=raw.boundingBoxOfPath,s=source.boundingBoxOfPath,scale=s.width/r.width;var overlaps=0,kept=0
            for i in 0..<160{for j in 0..<60{let p=CGPoint(x:r.minX+(Double(i)+0.5)/160*r.width,y:r.minY+(Double(j)+0.5)/60*r.height)
                guard raw.contains(p,using:.winding),!raw.contains(p,using:.evenOdd) else{continue}
                overlaps+=1;if source.contains(CGPoint(x:s.minX+(p.x-r.minX)*scale,y:s.minY+(p.y-r.minY)*scale)){kept+=1}}}
            try require(overlaps>0 && Double(kept)>=Double(overlaps)*0.95,"Overlapping variable-font contours are punched out: \(kept)/\(overlaps) overlap samples inked for \(font)")
        }
        // All glyphs form one distance field: expanded channels never overprint a neighbour's.
        var field=PosterShapePreset(recipe:type,seed:817,parameters:["construction":0,"layout":2,"expansion":0.08]);field.contour=ContourCustomization(text:"B8O")
        let fieldBands=try build(field).bands
        var inked=0,doubled=0
        for i in 0..<100{for j in 0..<130{let n=fieldBands.filter{$0.path.contains(CGPoint(x:(Double(i)+0.5)*10,y:(Double(j)+0.5)*10))}.count;if n>0{inked+=1};if n>1{doubled+=1}}}
        try require(inked>400 && doubled==0,"Expanded glyph channels overprint each other")
        var art=PosterShapePreset(recipe:type,seed:817,parameters:["construction":0,"layout":0]);art.contour=ContourCustomization(text:"ART")
        let artSources=try build(art).sources.count,referenceSources=try build(PosterShapePreset(recipe:type,seed:817)).sources.count
        try require(artSources==1 && referenceSources==3,"Three-letter titles borrow the RKC arrangement")
        // Facing pairs mirror the right-hand silhouette.
        func mirrored(_ facing:Double)throws->Bool {
            let s=try build(PosterShapePreset(recipe:profile,seed:817,parameters:["copies":2,"satellites":0,"facing":facing])).sources
            let a=s[0].boundingBoxOfPath,b=s[1].boundingBoxOfPath;var same=0,flipped=0
            for i in 0..<24{for j in 0..<24{let u=(Double(i)+0.5)/24,v=(Double(j)+0.5)/24,inside=s[0].contains(CGPoint(x:a.minX+u*a.width,y:a.minY+v*a.height))
                if inside==s[1].contains(CGPoint(x:b.minX+u*b.width,y:b.minY+v*b.height)){same+=1};if inside==s[1].contains(CGPoint(x:b.maxX-u*b.width,y:b.minY+v*b.height)){flipped+=1}}}
            return flipped>same
        }
        let facingPair=try mirrored(1),sameDirection=try mirrored(0)
        try require(facingPair && !sameDirection,"Facing pairs do not mirror silhouettes")
        // Nested copies of an outline that is not star-shaped stay inside their parents, converging inside the ink.
        let arch=CGMutablePath();arch.addLines(between:[CGPoint(x:0,y:0),CGPoint(x:1,y:0),CGPoint(x:1,y:1),CGPoint(x:0.7,y:1),CGPoint(x:0.7,y:0.3),CGPoint(x:0.3,y:0.3),CGPoint(x:0.3,y:1),CGPoint(x:0,y:1)]);arch.closeSubpath()
        var nested=PosterShapePreset(recipe:profile,seed:817,parameters:["copies":1,"satellites":0,"mode":1,"count":10]);nested.contour=ContourCustomization(outline:ContourOutline(path:arch,in:CGRect(x:0,y:0,width:1,height:1)))
        let copies=try build(nested)
        // Bands are the painted layers; an unclipped smaller copy would show outside the outline.
        // Clipped copies share edges with their parents, so measure spilled area, not sliver bounds.
        for layer in copies.bands {
            let b=layer.path.boundingBoxOfPath;var inside=0,spilled=0
            for i in 0..<60{for j in 0..<60{let p=CGPoint(x:b.minX+(Double(i)+0.5)/60*b.width,y:b.minY+(Double(j)+0.5)/60*b.height);if layer.path.contains(p){inside+=1;if !copies.sources[0].contains(p){spilled+=1}}}}
            try require(Double(spilled)<=Double(inside)*0.003,"Nested copy \(layer.index) spills \(spilled)/\(inside) samples outside the outline")
        }
        let last=copies.bands.last!.path.boundingBoxOfPath
        try require(copies.bands.count>4 && copies.sources[0].contains(CGPoint(x:last.midX,y:last.midY)),"Nested copies converge outside the outline")
        // Counters follow the copies: each copy's scaled counter opens a window through it and every
        // smaller copy stacked on it, so counters stay open rather than being covered by the next layer.
        let annulus=CGMutablePath();annulus.addRect(CGRect(x:0,y:0,width:1,height:1));annulus.addEllipse(in:CGRect(x:0.25,y:0.25,width:0.5,height:0.5))
        func tunnel(_ anchorY:Double)throws->(bands:[ContourVectorBand],square:CGRect) {
            var p=PosterShapePreset(recipe:profile,seed:817,parameters:["copies":1,"satellites":0,"mode":1,"anchorY":anchorY]);p.contour=ContourCustomization(outline:ContourOutline(path:annulus,in:CGRect(x:0,y:0,width:1,height:1)))
            let c=try build(p);return (c.bands,c.sources[0].boundingBoxOfPath)
        }
        let concentric=try tunnel(0.5),inner=CGPoint(x:concentric.square.midX+concentric.square.width*0.225,y:concentric.square.midY)
        // Off-centre: (0.5, 0.76) lies outside the original counter but inside copy 1's counter (centre 0.556, radius 0.215),
        // so copy 0 shows through; unwindowed copies 11 and 12 would otherwise also cover that point.
        let offset=try tunnel(0.9),q=CGPoint(x:offset.square.midX,y:offset.square.minY+offset.square.height*0.76),hits=offset.bands.filter{$0.path.contains(q)}.map(\.index)
        try require(band(concentric.bands,inner)==nil && band(concentric.bands,CGPoint(x:concentric.square.midX,y:concentric.square.midY))==nil && hits==[0],"Nested counters do not follow the scaled copies: \(hits) at the probe")
        // Line breaks: typed lines become rows; a single-line layout sets every line at one size; a grid row per line.
        func lines(_ text:String,_ layout:Double)throws->[CGRect] {
            var p=PosterShapePreset(recipe:type,seed:817,parameters:["construction":0,"layout":layout]);p.contour=ContourCustomization(text:text)
            return try build(p).sources.map(\.boundingBoxOfPath)
        }
        let typedRows=try lines("DARK\nCURRENTS NOW",0),wordRows=try lines("DARK CURRENTS NOW",0),block=try lines("FORM\nAND SPACE",1),grid=try lines("AB\nCDE",2)
        try require(typedRows.count==2 && wordRows.count==3,"Typed line breaks do not set contour rows")
        try require(block.count==2 && block[0].width<block[1].width*0.8 && abs(block[0].height-block[1].height)<block[1].height*0.08 && block[0].maxY<block[1].minY,"Line-broken single layout does not share one type size")
        try require(grid.count==5 && abs(grid[0].midY-grid[1].midY)<1 && grid[1].maxY<grid[2].minY && abs(grid[2].midY-grid[4].midY)<1,"Letter grid ignores typed line breaks")
        var titled=try PosterShapeLibrary.scene(PosterShapePreset(recipe:type,seed:817));titled.elements[0].contour=nil;titled.posterCopy=PosterCopy(title:"NEUE\nRÄUME")
        PosterShapeLibrary.resolveSurveyContent(in:&titled)
        try require(titled.elements[0].text=="NEUE\nRÄUME","Poster title line breaks are flattened for contour type")
        // Imported outlines get border slots in their own proportions instead of the profile's narrow ones.
        var wide=PosterShapePreset(recipe:profile,seed:817,parameters:["copies":2,"satellites":8]);wide.contour=ContourCustomization(outline:ContourOutline(path:CGPath(ellipseIn:CGRect(x:0,y:0,width:2,height:1),transform:nil),in:CGRect(x:0,y:0,width:2,height:1)))
        let slots=try build(wide).sources.map(\.boundingBoxOfPath)
        try require(slots.count==10 && slots[2].width>=100 && slots[2].maxX<slots[0].minX && slots[3].minX>slots[1].maxX,"Imported outlines are cramped in the border slots: \(Int(slots[2].width)) units wide")
        // Parallel channels run off a straight cut edge instead of turning along it.
        func cutEdge(_ open:Double)throws->(across:Bool,below:Bool) {
            let c=try build(PosterShapePreset(recipe:profile,seed:817,parameters:["copies":1,"satellites":0,"mode":0,"count":10,"openEdge":open,"facing":0]))
            let b=c.sources[0].boundingBoxOfPath,x=b.minX+b.width*0.46
            return (band(c.bands,CGPoint(x:x,y:b.maxY-3)) != nil,c.bands.contains{$0.path.boundingBoxOfPath.maxY>b.maxY+1})
        }
        let closed=try cutEdge(0),open=try cutEdge(1)
        try require(closed.across && !open.across && !open.below,"Parallel channels turn along the cut edge")
        let flatBase=CGMutablePath();flatBase.addEllipse(in:CGRect(x:0,y:0,width:400,height:300));flatBase.addRect(CGRect(x:100,y:150,width:200,height:450))
        try require(ContourVectorEngine.openEdge(CGPath(ellipseIn:CGRect(x:0,y:0,width:400,height:600),transform:nil),reach:100)==nil && ContourVectorEngine.openEdge(flatBase,reach:100)?.y==600,"Cut-edge detection confuses curved and straight bases")
        // SVG import: transforms, arcs, fill rules, unfilled elements and malformed data.
        let svg="""
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g transform="translate(10 0)"><path fill-rule="evenodd" d="M0 0h80v80H0z M20 40a20 20 0 1 0 40 0a20 20 0 1 0-40 0z"/></g>
        <rect x="100" y="0" width="80" height="80" rx="10" fill="none"/><polygon points="100,0 180,0 140,100"/></svg>
        """
        let imported=try ContourOutline(svg:Data(svg.utf8)),shape=try imported.path()
        func at(_ x:Double,_ y:Double)->Bool{shape.contains(CGPoint(x:(x-10)/170,y:y/100),using:imported.pathFillRule)}
        try require(abs(imported.aspect-100.0/170)<0.001 && at(15,5) && !at(50,40) && at(140,30) && !at(105,70),"SVG outline import lost geometry, transforms, fill rules or unfilled elements")
        let disc=try ContourOutline(svg:Data("<svg><path d='M0 50a50 50 0 1 0 100 0A50 50 0 1 0 0 50z'/></svg>".utf8)),discPath=try disc.path()
        try require(abs(disc.aspect-1)<0.001 && disc.fillRule=="nonzero" && disc.commands.filter{$0.kind=="C"}.count==4 && discPath.contains(CGPoint(x:0.5,y:0.5)) && !discPath.contains(CGPoint(x:0.06,y:0.06)),"SVG arcs are not converted to curves")
        try require(rejected{_ = try ContourOutline(svg:Data("<svg><path d='M0 0 L'/></svg>".utf8))} && rejected{_ = try ContourOutline(svg:Data("<svg><text>A</text></svg>".utf8))},"Malformed SVG outline accepted")
        print("PASS: counter-anchored expansion, nonzero glyph fill, one glyph field, RKC-only arrangement, facing pairs, contained nesting, counters that follow nested copies, typed and title line breaks, proportional border slots, open cut edges, SVG outline import")
    }
}
