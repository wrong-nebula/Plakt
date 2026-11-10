import Foundation

public struct LayoutRegion:Codable,Identifiable,Sendable {
    public var id:String;public var role:String;public var kind:String
    public var bounds:UnitBox;public var rotation:Double;public var readingOrder:Int
    public var zIndex:Int;public var font:String?;public var text:String?
    public var color:String?;public var preserveTypeProportions:Bool?
    public var textAlignment:String? = nil
    public var minimumStage:Int? = nil
    public var textTreatment:String? = nil
    public var outlineWidth:Double? = nil
    public var clipBounds:UnitBox? = nil
    public var geometry:[String:Double]? = nil
    public var blendMode:String? = nil
    public var shape:String? = nil
    public var sourcePosterID:String? = nil
    public var sourceAnchor:UnitBox? = nil
    public var typeTransform:[String:Double]? = nil
    public var tracking:Double? = nil
    public var allowsBleed:Bool? = nil
    public var typeSystemID:String? = nil
    public var typeSystemStep:Int? = nil
    public var graphemeIndexMap:[Int]? = nil
    public var typeEmSize:Double? = nil
    public var glyphTreatment:String? = nil
    public var glyphIndex:Int? = nil
    public var fontProfileID:String? = nil
    public var fontAssetID:String? = nil
    public var fontAssetSHA256:String? = nil
    public var fontVariations:[String:Double]? = nil
}
public struct LayoutConstraint:Codable,Sendable {
    public var type:String;public var targets:[String];public var values:[String:Double];public var reason:String
    public init(type:String,targets:[String],values:[String:Double],reason:String) {
        self.type=type;self.targets=targets;self.values=values;self.reason=reason
    }
}
public struct LayoutGrid:Codable,Sendable {
    public var type:String;public var columns:Int?;public var horizontalAnchors:[Double]
    public var margins:[String:Double];public var gutter:Double?
}
public struct CompositionPlan:Codable,Sendable {
    public var version="composition-plan-v1"
    public var origin:String
    public var description:String
    public var aspect:Double
    public var coordinateSystem="normalized top-left; clockwise degrees; declared bleed may extend local bounds beyond the canvas"
    public var grid:LayoutGrid
    public var hierarchy:[String]
    public var regions:[LayoutRegion]
    public var constraints:[LayoutConstraint]
    public var estimatedWhitespace:Double
    public var note:String

    public static func scene(_ genome:StyleGenome,origin:String="inferred-from-source",style:String?=nil)->Self {
        let items=genome.elements
        let source=origin.hasPrefix("inferred") || origin=="observed-source-topology"
        let titleIDs=items.filter{$0.sourceElementID.hasPrefix("title:")}.map(\.sourceElementID)
        let textByArea=items.filter{$0.kind=="text"}.sorted{$0.bounds.area>$1.bounds.area}
        let hierarchy=titleIDs.isEmpty ? Array(textByArea.prefix(3).map(\.sourceElementID)):titleIDs
        let allX=items.filter{$0.kind=="text"}.map{$0.bounds.x}.sorted()
        var anchors:[Double]=[]
        for x in allX where !anchors.contains(where:{abs($0-x)<0.018}){anchors.append(x)}
        let minX=items.map{$0.bounds.x}.min() ?? 0,minY=items.map{$0.bounds.y}.min() ?? 0
        let right=1-(items.map{$0.bounds.x+$0.bounds.width}.max() ?? 1),bottom=1-(items.map{$0.bounds.y+$0.bounds.height}.max() ?? 1)
        let margins=["left":minX,"top":minY,"right":max(0,right),"bottom":max(0,bottom)]
        let reading=items.indices.sorted {a,b in
            let x=items[a].bounds,y=items[b].bounds
            return abs(x.y-y.y)>0.018 ? x.y<y.y:x.x<y.x
        }
        let regions=items.enumerated().map {i,e in LayoutRegion(id:e.sourceElementID,role:role(e,primary:hierarchy),kind:e.kind,bounds:e.bounds,rotation:e.rotation,readingOrder:reading.firstIndex(of:i) ?? i,zIndex:e.zIndex ?? (e.kind=="text" ? items.count+i:i),font:e.kind=="text" ? e.fontName ?? genome.font:nil,text:e.text,color:e.color,preserveTypeProportions:e.preserveTypeProportions,textAlignment:e.textAlignment,minimumStage:e.minimumStage,textTreatment:e.textTreatment,outlineWidth:e.outlineWidth,clipBounds:e.clipBounds,geometry:e.geometry,blendMode:e.blendMode,shape:e.kind=="text" ? nil:e.shape,sourcePosterID:e.sourcePosterID,sourceAnchor:e.sourceAnchor,typeTransform:e.typeTransform,tracking:e.tracking,allowsBleed:e.allowsBleed,typeSystemID:e.typeSystemID,typeSystemStep:e.typeSystemStep,graphemeIndexMap:e.graphemeIndexMap,typeEmSize:e.typeEmSize,glyphTreatment:e.glyphTreatment,glyphIndex:e.glyphIndex,fontProfileID:e.fontProfileID,fontAssetID:e.fontAssetID,fontAssetSHA256:e.fontAssetSHA256,fontVariations:e.fontVariations)}
        let shapeCount=items.filter{$0.kind != "text"}.count
        let columns=source ? nil:(style=="swiss" ? 4:style=="bauhaus" ? 2:1)
        let grid=LayoutGrid(type:source ? "inferred-alignment-anchors":"declared-modular-grid",columns:columns,horizontalAnchors:anchors,margins:margins,gutter:source ? nil:0.025)
        var constraints=[LayoutConstraint(type:"canvas-bounds",targets:items.map(\.sourceElementID),values:["minimumX":0,"minimumY":0,"maximumX":1,"maximumY":1],reason:"Store explicit normalized placement for deterministic rendering."),LayoutConstraint(type:"reading-order",targets:regions.sorted{$0.readingOrder<$1.readingOrder}.map(\.id),values:[:],reason:source ? "Proposed spatial reading order; not semantic ground truth.":"Declared order of title, supporting copy and metadata.")]
        if !source {
            constraints.append(LayoutConstraint(type:"natural-glyph-proportions",targets:items.filter{$0.kind=="text"}.map(\.sourceElementID),values:["stretchXOverY":1],reason:"Fit text uniformly in physical canvas units; preserve letterforms."))
            constraints.append(LayoutConstraint(type:"minimum-metadata-height",targets:items.filter{$0.sourceElementID.hasPrefix("meta:")}.map(\.sourceElementID),values:["normalizedHeight":0.013],reason:"Keep supporting copy legible at preview and print sizes."))
            constraints.append(LayoutConstraint(type:"protect-title-and-metadata",targets:hierarchy,values:["unintentionalTextOverlap":0],reason:"Overlays belong to declared graphic/ring roles; body copy stays separated."))
        }
        let knockoutElements=items.filter{$0.textTreatment=="knockout-outline"}
        let knockouts=knockoutElements.map(\.sourceElementID)
        if !knockouts.isEmpty {constraints.append(LayoutConstraint(type:"figure-ground-knockout",targets:knockouts,values:Dictionary(uniqueKeysWithValues:knockoutElements.map{($0.sourceElementID,$0.outlineWidth ?? 1.15)}),reason:"Declared negative-space interlock: fill the later glyph with the canvas color before drawing its outline."))}
        let procedural=items.filter{$0.geometry != nil}
        if !procedural.isEmpty {constraints.append(LayoutConstraint(type:"procedural-vector-geometry",targets:procedural.map(\.sourceElementID),values:[:],reason:"Shape operator and all numeric geometry parameters are stored per region; the vector renderer evaluates those declared rules."))}
        let overprints=items.filter{$0.blendMode != nil}
        if !overprints.isEmpty {constraints.append(LayoutConstraint(type:"declared-overprint",targets:overprints.map(\.sourceElementID),values:[:],reason:"Explicit blend modes create overlapping ink relationships; measured output colors include the composite result."))}
        let clipped=items.filter{$0.clipBounds != nil}
        if !clipped.isEmpty {constraints.append(LayoutConstraint(type:"declared-strip-clipping",targets:clipped.map(\.sourceElementID),values:["canvasSpace":1],reason:"Clip each natural glyph path to its declared canvas-space strip before applying the strip displacement. This is an intentional graphic treatment, not a distorted font."))}
        if let placement=genome.typePlacement {
            let anchored=items.filter{$0.typeAnchorID != nil}
            constraints.append(LayoutConstraint(type:"shape-type-anchors",targets:anchored.map(\.sourceElementID),values:["anchors":Double(genome.typeAnchors?.count ?? 0),"anchoredElements":Double(anchored.count),"mode":Double(TypePlacementSettings.modes.firstIndex(of:placement.mode) ?? 0)],reason:"Type placement \(placement.mode) (anchored=0, mixed=1, free=2). Each anchored element names its anchor in genome.typeAnchors; anchors come from the shape's own parameters or measured empty space, and one em size is shared per block."))
            let contrasted=items.filter{$0.overlapContrast != nil}
            if !contrasted.isEmpty {constraints.append(LayoutConstraint(type:"overlap-contrast",targets:contrasted.map(\.sourceElementID),values:["interlocked":Double(contrasted.filter{$0.overlapContrast?.layer=="top"}.count)],reason:"Contrast \(placement.contrast): where type crosses a similar-colored shape, the same glyphs are repainted in the declared ink inside that shape's ink only."))}
        }
        for application in genome.appliedTypeSystems ?? [] {
            constraints.append(LayoutConstraint(type:"reusable-type-system",targets:[application.genomeID],values:application.parameters,reason:application.operation+": "+application.invariants.joined(separator:" ")+" Every output and grapheme index map is stored in appliedTypeSystems."))
        }
        let whitespace=occupancy(items)
        let title=style.map{styleID in StyleCatalog.categories.first{$0.id==styleID}?.name ?? styleID} ?? "Source-derived"
        let description="\(title) composition: \(textByArea.count) text regions and \(shapeCount) graphic regions. \(hierarchy.count) primary hierarchy roles; \(anchors.count) horizontal alignment anchors. Approximate box whitespace \(Int(whitespace*100))%. \(source ? "Placements are measured proposals requiring review.":"Title and metadata use natural letter proportions; graphic layers sit behind type.")"
        return Self(origin:origin,description:description,aspect:genome.aspect,grid:grid,hierarchy:hierarchy,regions:regions,constraints:constraints,estimatedWhitespace:whitespace,note:source ? "OCR/contour boxes describe observed placement, not recovered designer layers. Whitespace estimates box occupancy rather than actual printed ink. Border and region review can change this plan.":"The elements array is the rendering source of truth; this plan is derived from it. Semantic roles, positions and drawing rules are declared generator data. Whitespace is estimated from bounding boxes, not actual glyph coverage.")
    }
    private static func role(_ e:SceneElement,primary:[String])->String {
        if e.sourceElementID.hasPrefix("title:"){return "primary-title"}
        if e.sourceElementID.hasPrefix("meta:"){return "supporting-copy"}
        if e.sourceElementID.hasPrefix("ring:"){return "intentional-circular-type"}
        if e.sourceElementID.hasPrefix("art:"){return "graphic-anchor"}
        if primary.contains(e.sourceElementID){return "inferred-primary-type"}
        return e.kind=="text" ? "inferred-supporting-type":"unresolved-graphic-region"
    }
    private static func occupancy(_ items:[SceneElement])->Double {
        let size=64;var occupied=0
        for y in 0..<size{for x in 0..<size{
            let px=(Double(x)+0.5)/Double(size),py=(Double(y)+0.5)/Double(size)
            if items.contains(where:{ e in let visible=e.clipBounds.map{$0.rect.intersection(e.bounds.rect)} ?? e.bounds.rect;return visible.contains(CGPoint(x:px,y:py))}){occupied+=1}
        }}
        return 1-Double(occupied)/Double(size*size)
    }
    public static func procedural(_ genome:Genome)->Self {
        if genome.renderStyle != nil {
            let scene=SourceComposition.recipe(genome,copy:PosterCopy())
            return scene.composition ?? Self.scene(scene,origin:"declared-procedural-recipe",style:genome.renderStyle)
        }
        let plan=BlockoutPlan.make(genome),split=435+plan.scale*115,top=330+plan.distortion*60,midY=68+top,midH=440+plan.scale*65,bandY=midY+midH+10
        let bottomY=bandY+103+genome.density*30,bottomH=1370-bottomY,cut=330+plan.scale*90
        let first=genome.layout%2==0 ? [UnitBox(x:14/1000,y:58/1414,width:(split-22)/1000,height:top/1414),UnitBox(x:split/1000,y:58/1414,width:(986-split)/1000,height:top/1414)]:[UnitBox(x:14/1000,y:58/1414,width:576/1000,height:top/1414),UnitBox(x:602/1000,y:58/1414,width:384/1000,height:top/1414)]
        let boxes=first+[
            UnitBox(x:0.014,y:midY/1414,width:0.462,height:midH/1414),UnitBox(x:0.488,y:midY/1414,width:0.242,height:midH*0.61/1414),UnitBox(x:0.742,y:midY/1414,width:0.244,height:midH/1414),UnitBox(x:0.488,y:(midY+midH*0.61+8)/1414,width:0.242,height:(midH*0.39-8)/1414),UnitBox(x:0.014,y:bandY/1414,width:0.972,height:(91+genome.density*30)/1414),UnitBox(x:0.014,y:bottomY/1414,width:(cut-20)/1000,height:bottomH/1414),UnitBox(x:(cut+6)/1000,y:bottomY/1414,width:0.36,height:bottomH/1414),UnitBox(x:(cut+378)/1000,y:bottomY/1414,width:(608-cut)/1000,height:bottomH*0.57/1414),UnitBox(x:(cut+378)/1000,y:(bottomY+bottomH*0.57+8)/1414,width:(608-cut)/1000,height:(bottomH*0.43-8)/1414)]
        let regions=boxes.enumerated().map{i,box in LayoutRegion(id:"zone-\(i)",role:i<2 ? "primary-type":i==6 ? "rhythm-band":"secondary-motif",kind:"motif",bounds:box,rotation:0,readingOrder:i,zIndex:i,font:nil,text:nil,color:nil,preserveTypeProportions:nil)}
        return Self(origin:"declared-procedural-layout",description:"Dense modular typographic field: two upper anchors, an asymmetric four-region middle, a horizontal rhythm band, and four lower regions. Large glyphs establish hierarchy; circles, capsules, repeated discs and small type fill secondary zones.",aspect:1.414,grid:LayoutGrid(type:"asymmetric-modular-zones",columns:nil,horizontalAnchors:[0.014,0.488,0.742],margins:["left":0.014,"right":0.014,"top":0.041,"bottom":0.031],gutter:0.012),hierarchy:["zone-0","zone-1","zone-2","zone-6"],regions:regions,constraints:[LayoutConstraint(type:"zone-clipping",targets:regions.map(\.id),values:[:],reason:"Each motif is clipped to its codified rectangle; intended internal overlaps remain local."),LayoutConstraint(type:"construction-order",targets:["blockout","primary","secondary","finished"],values:["staged":genome.usesStagedConstruction ? 1:0],reason:"A separate seeded coin chooses staged or direct construction.")],estimatedWhitespace:max(0,1-boxes.reduce(0){$0+$1.area}),note:"Exact motif IDs, seed and continuous traits remain in the genome. Region coordinates reproduce the renderer's selected blockout plan.")
    }
    public func write(to directory:URL,stem:String="composition")throws {
        try LibraryRaster.write(self,to:directory.appending(path:stem+".json"))
        func cell(_ s:String)->String{s.replacingOccurrences(of:"|",with:"\\|").replacingOccurrences(of:"\n",with:" ")}
        var lines=["# Composition & layout", "",description,"", "Origin: "+origin,"", "Grid: "+grid.type,"", "Coordinates: "+coordinateSystem,"", "Hierarchy: "+hierarchy.joined(separator:" → "),"", "| Region | Role | x | y | Width | Height | Rotation | Reading order |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
        for r in regions {lines.append("| "+cell(r.id)+" | "+cell(r.role)+" | "+[r.bounds.x,r.bounds.y,r.bounds.width,r.bounds.height,r.rotation].map{String(format:"%.4f",$0)}.joined(separator:" | ")+" | \(r.readingOrder) |")}
        lines += ["","## Constraints",""]
        for rule in constraints{lines.append("- **"+rule.type+"** — "+rule.reason+" Targets: "+rule.targets.joined(separator:", ")+". Values: "+rule.values.map{"\($0.key)=\($0.value)"}.sorted().joined(separator:", "))}
        lines += ["",note,""]
        try lines.joined(separator:"\n").write(to:directory.appending(path:stem+".md"),atomically:true,encoding:.utf8)
    }

}
