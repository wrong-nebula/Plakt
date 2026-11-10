import Foundation
import CoreText

public struct JudgeGroup:Identifiable,Sendable {public var id:String;public var title:String;public var judges:[String]}
public enum JudgeCatalog {
    public static let groups:[JudgeGroup]=[
        .init(id:"type",title:"Typography & information",judges:["Legibility","Type integrity","Hierarchy","Copy completeness","Typography"]),
        .init(id:"layout",title:"Composition & space",judges:["Spacing","Alignment","Margins","Negative space","Optical balance"]),
        .init(id:"color",title:"Color & figure-ground",judges:["Ink contrast","Palette discipline"]),
        .init(id:"technique",title:"Technique & rhythm",judges:["Rhythm"]),
        .init(id:"identity",title:"Source & novelty",judges:["Source structure","Reference","Diversity"]),
        .init(id:"prior",title:"Overall prior",judges:["Composition"])
    ]
    public static func explanation(_ name:String)->String {
        switch name {
        case "Legibility":"Computed: OCR recovery inside primary-title regions plus actual supporting glyph size."
        case "Type integrity":"Computed: natural letter proportions, with intentional treatments declared in the genome."
        case "Hierarchy":"Computed: separation between primary-title and supporting-copy scale."
        case "Copy completeness":"Computed: required editable title, subtitle, institution and footer are represented."
        case "Spacing":"Computed: unwanted overlap between actual title and metadata glyph bounds; intentional graphic type is excluded."
        case "Alignment":"Computed: supporting copy follows the declared column anchors."
        case "Margins":"Computed: supporting glyph bounds remain inside safe print margins."
        case "Negative space":"Computed: box occupancy is compared with a direction-specific whitespace prior; not an aesthetic truth."
        case "Optical balance":"Computed: spatial distribution of graphic and type mass, not symmetry alone."
        case "Ink contrast":"Computed: text contrast against the canvas or enclosing solid rectangle; not a full accessibility audit."
        case "Palette discipline":"Computed: limited distinct inks support a coherent visual system; hue harmony remains descriptive."
        case "Source structure":"Computed: retained source-A layout fields keep their measured centers and extents independently of the chosen font’s natural fit. Requires observed source inheritance; it is not an aesthetic score."
        case "Reference":"Vision model: visual similarity to the chosen reference; source studies average affinity to their two current donors."
        case "Diversity":"Vision model: distance from the nearest candidate in this batch."
        case "Typography":"Vision OCR proxy: recognized text and hierarchy; can favor text-heavy work."
        case "Rhythm":"Computed image-detail, balance and coverage proxy; not a trained technique expert."
        default:"Authored Core ML composition prior. Its weights are not trained on human aesthetic preferences."
        }
    }
}

public enum CompositionJudges {
    public static func inkBounds(_ element:SceneElement,genome:StyleGenome)->UnitBox {
        let box=element.bounds
        guard element.kind=="text" else{return box}
        var w=box.width,h=box.height,x=box.x,y=box.y
        if element.preserveTypeProportions==true,let text=element.text,!text.isEmpty {
            let font=FontLibrary.font(name:element.fontName ?? genome.font,variations:element.fontVariations)
            let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[.font:font,.kern:element.tracking ?? genome.tracking]))
            let bounds=KerningSystem.isKerned(element,genome:genome) ? KerningSystem.layout(element,string:text,genome:genome).path.boundingBoxOfPath:CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
            guard bounds.width>0,bounds.height>0 else{return box}
            let scale=element.typeEmSize.map{$0*1000*genome.aspect/100} ?? min(box.width*1000/bounds.width,box.height*1000*genome.aspect/bounds.height)
            w=bounds.width*scale/1000;h=bounds.height*scale/(1000*genome.aspect)
            x=box.x+(element.textAlignment=="center" ? (box.width-w)/2:element.textAlignment=="right" ? box.width-w:0);y=box.y
        }
        let angle=element.rotation * Double.pi/180,cx=box.x+box.width/2,cy=box.y+box.height/2
        let points=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map{p->[Double] in
            let px=(p[0]-cx)*1000,py=(p[1]-cy)*1000*genome.aspect
            return[cx+(px*cos(angle)-py*sin(angle))/1000,cy+(px*sin(angle)+py*cos(angle))/(1000*genome.aspect)]
        }
        let xs=points.map{$0[0]},ys=points.map{$0[1]}
        return UnitBox(x:xs.min()!,y:ys.min()!,width:xs.max()!-xs.min()!,height:ys.max()!-ys.min()!)
    }
    private static func luminance(_ hex:String)->Double {
        let n=Int(hex.dropFirst(),radix:16) ?? 0
        let channels:[Int]=[(n>>16)&255,(n>>8)&255,n&255]
        let rgb:[Double]=channels.map { channel in
            let value=Double(channel)/255.0
            return value<=0.04045 ? value/12.92:pow((value+0.055)/1.055,2.4)
        }
        return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722
    }
    public static func evaluate(_ genome:StyleGenome,measurements:Measurements,copy:PosterCopy,style:String?=nil)->[String:Double] {
        let type=genome.elements.filter{$0.kind=="text" && !$0.sourceElementID.hasPrefix("ring:") && !$0.sourceElementID.hasPrefix("art:") && !$0.sourceElementID.hasPrefix("glyph:")}
        let body=type.filter{$0.sourceElementID.hasPrefix("meta:")},title=type.filter{$0.sourceElementID.hasPrefix("title:")}
        let boxes=type.map{inkBounds($0,genome:genome)}
        var collisions=0.0
        for i in boxes.indices{for j in boxes.indices where i<j{let r=boxes[i].rect.intersection(boxes[j].rect);if !r.isNull{collisions+=r.width*r.height/max(1e-6,min(boxes[i].area,boxes[j].area))}}}
        let recoveryType=genome.layoutInheritance==nil ? title:genome.elements.filter{$0.kind=="text" && ($0.sourceAnchor != nil || $0.sourceElementID.hasPrefix("title:"))}
        let primary=(measurements.recognizedLines ?? []).filter{line in recoveryType.contains{inkBounds($0,genome:genome).overlap(line.bounds)>0.25}}
        let recovered=primary.map(\.text).joined().uppercased().filter(\.isLetter)
        let wanted=copy.words.map{$0.uppercased().filter(\.isLetter)}
        let recovery=Double(wanted.filter{recovered.contains($0)}.count)/Double(max(1,wanted.count))
        let smallest=body.map{inkBounds($0,genome:genome).height}.min() ?? 0
        let display=genome.layoutInheritance==nil ? title:genome.elements.filter{$0.kind=="text" && $0.sourceAnchor != nil}
        let primaryHeight=display.map{inkBounds($0,genome:genome).height}.max() ?? 0
        let bodyHeight=body.map{inkBounds($0,genome:genome).height}.max() ?? 0.01
        let margin=genome.composition?.grid.margins["left"] ?? 0.06
        let anchors=genome.layoutInheritance==nil ? [margin,margin+(1-margin*2+0.025)/2]:(genome.composition?.grid.horizontalAnchors ?? [margin])
        let aligned=body.map{e in (anchors.map{abs($0-e.bounds.x)}.min() ?? 1)<0.02 ? 1.0:0.0}.reduce(0,+)/Double(max(1,body.count))
        let bodyBoxes:[UnitBox]=body.map{inkBounds($0,genome:genome)}
        let safe=bodyBoxes.filter { box in
            let horizontal=box.x>=0.02 && box.x+box.width<=0.98
            let vertical=box.y>=0.02 && box.y+box.height<=0.985
            return horizontal && vertical
        }.count
        let shape=genome.elements.filter{$0.kind=="shape"}
        var contrast=1.0
        for e in type {
            let actual=inkBounds(e,genome:genome)
            let backdrop=shape.last{$0.shape=="rectangle" && $0.bounds.rect.contains(actual.rect)}?.color ?? genome.background
            let a=luminance(e.color),b=luminance(backdrop),ratio=(max(a,b)+0.05)/(min(a,b)+0.05)
            let target=actual.height>0.025 ? 3.0:4.5
            contrast=min(contrast,min(1,ratio/target))
        }
        let allText=genome.elements.compactMap(\.text).joined().uppercased().filter{$0.isLetter || $0.isNumber}
        let required=([copy.title,copy.subtitle,copy.institution,copy.footer]).map{$0.uppercased().filter{$0.isLetter || $0.isNumber}}
        let represented=Double(required.filter{allText.contains($0)}.count)/Double(required.count)
        let colors=Set(genome.elements.map(\.color)+[genome.background])
        let space=genome.composition?.estimatedWhitespace ?? 0.5
        let targetSpace=style=="minimal" ? 0.73:style=="optical" ? 0.35:0.52
        let weight=genome.elements.reduce(0){$0+$1.bounds.area},cx=genome.elements.reduce(0){$0+($1.bounds.x+$1.bounds.width/2)*$1.bounds.area}/max(0.001,weight),cy=genome.elements.reduce(0){$0+($1.bounds.y+$1.bounds.height/2)*$1.bounds.area}/max(0.001,weight)
        var structure=0.0
        if let dna=genome.layoutInheritance {
            let anchors=genome.elements.filter{$0.sourcePosterID==dna.skeletonPosterID && $0.sourceAnchor != nil}
            structure=anchors.map{e->Double in
                var field=e;field.preserveTypeProportions=false
                let observed=e.sourceAnchor!,actual=inkBounds(field,genome:genome)
                let center=hypot(observed.x+observed.width/2-actual.x-actual.width/2,observed.y+observed.height/2-actual.y-actual.height/2)
                let scale=abs(log(max(0.0001,actual.area)/max(0.0001,observed.area)))
                return exp(-center*5-scale*0.35)
            }.reduce(0,+)/Double(max(1,anchors.count))
        }
        return ["Source structure":structure,"Legibility":recovery*0.7+min(1,smallest/0.013)*0.3,"Type integrity":type.isEmpty ? 0.5:Double(type.filter{$0.preserveTypeProportions==true}.count)/Double(type.count),"Hierarchy":min(1,primaryHeight/max(0.001,bodyHeight)/4),"Spacing":exp(-collisions*12),"Alignment":aligned,"Margins":Double(safe)/Double(max(1,body.count)),"Negative space":exp(-pow((space-targetSpace)/0.3,2)),"Palette discipline":min(1,4/Double(max(1,colors.count))),"Ink contrast":contrast,"Optical balance":max(0,1-abs(cx-0.5)*1.5-abs(cy-0.5)),"Copy completeness":represented]
    }
    public static func preflight(_ genome:StyleGenome,copy:PosterCopy)->[String] {
        let neutral=Measurements(coverage:0,detail:0,balance:0,contrast:0,readability:0,reference:0,hierarchy:0,repetition:0,recognizedWords:0)
        let scores=evaluate(genome,measurements:neutral,copy:copy,style:genome.styleCategory)
        var failures:[String]=[]
        if genome.elements.contains(where:{!($0.geometry ?? [:]).values.allSatisfy(\.isFinite) || !($0.typeTransform ?? [:]).values.allSatisfy(\.isFinite) || !($0.tracking ?? 0).isFinite}){failures.append("invalid procedural geometry parameters")}
        if genome.elements.compactMap(\.clipBounds).contains(where:{!$0.valid}){failures.append("invalid graphic clip bounds")}
        if (scores["Spacing"] ?? 0)<0.85{failures.append("protected glyph collisions")}
        if (scores["Ink contrast"] ?? 0)<0.8{failures.append("insufficient type contrast")}
        if (scores["Margins"] ?? 0)<0.95{failures.append("supporting copy outside safe margins")}
        if (scores["Copy completeness"] ?? 0)<0.99{failures.append("missing required copy")}
        if genome.elements.filter({$0.kind=="text" && $0.sourceElementID.hasPrefix("meta:")}).contains(where:{inkBounds($0,genome:genome).height<0.0105}){failures.append("supporting glyphs too small")}
        return failures
    }

}
