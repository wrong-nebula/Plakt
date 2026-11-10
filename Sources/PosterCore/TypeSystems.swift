import Foundation
import CoreText
import CoreGraphics

public struct TypeSystemObservation:Codable,Sendable {
    public var elementID:String;public var text:String;public var bounds:UnitBox;public var rotation:Double;public var confidence:Double
}
public struct TypeSystemFrame:Codable,Sendable {public var sourceElementID:String;public var bounds:UnitBox;public var rotation:Double}
public struct TypeSystemGenome:Codable,Identifiable,Sendable {
    public var version:String;public var id:String;public var name:String;public var operation:String;public var tags:[String]
    public var parameters:[String:Double];public var textParameters:[String:String]
    public var sourcePosterID:String;public var sourceElementIDs:[String];public var sourceImageURL:URL
    public var sourceAspect:Double;public var sourceBounds:UnitBox
    public var sourceEmbedding:VisualEmbedding?;public var cropURL:URL?;public var semanticEmbedding:[Double]
    public var confidence:Double;public var status:String;public var fitError:Double
    public var invariants:[String];public var explanation:String
    public var observations:[TypeSystemObservation];public var frames:[TypeSystemFrame];public var indexSchedules:[[Int]]?
    public var representativeScore:Double {
        let heights=frames.map(\.bounds.height).sorted(),median=heights.isEmpty ? 0:heights[heights.count/2]
        let horizontal=frames.allSatisfy{abs($0.rotation)<15}
        let widths=frames.map(\.bounds.width).sorted(),medianWidth=widths.isEmpty ? 0:widths[widths.count/2]
        let textLength=textParameters["sourceInput"]?.count ?? 0
        let needsRows=["repeat-field","staircase","word-reflow"].contains(operation)
        let separated=zip(frames,frames.dropFirst()).allSatisfy{pair in pair.1.bounds.y-pair.0.bounds.y>pair.0.bounds.height*0.7}
        let usable = needsRows ? (horizontal && medianWidth>0.45 && median<0.56 && textLength>=4 && frames.count>=2):(operation=="scale-ramp" ? horizontal && separated:true)
        return (usable ? 4:0)+confidence+(status=="fitted" ? 0.1:status=="visual-annotated" ? 0.08:0)+min(0.5,median)*min(1,Double(frames.count)/4)+medianWidth*0.2
    }
}
public struct TypeSystemScanSummary:Codable,Sendable {
    public var scannedPosters:Int;public var scannedElements:Int;public var analyzedLines:Int;public var analyzedWords:Int
    public var systems:Int;public var exactFits:Int;public var inferred:Int;public var visualAnnotations:Int;public var operatorCounts:[String:Int]
}
public struct TypeSystemCatalog:Codable,Sendable {
    public var version:String;public var createdAt:String;public var featureNames:[String];public var systems:[TypeSystemGenome]
    public var summary:TypeSystemScanSummary;public var note:String
}
public struct TypeSystemStep:Codable,Sendable {
    public var index:Int;public var text:String;public var indexMap:[Int]
    public var bounds:UnitBox;public var rotation:Double;public var typeTransform:[String:Double]? = nil
    public var variables:[String:Double]
}
public struct TypeSystemApplication:Codable,Sendable {
    public var genomeID:String;public var sourcePosterID:String;public var operation:String
    public var input:String;public var field:UnitBox;public var parameters:[String:Double]
    public var steps:[TypeSystemStep];public var invariants:[String]
}

/// A portable variation contains the rule, inputs, controls and its vector scene.
public struct TypeSystemVariant:Codable,Sendable {
    public var version:String;public var system:TypeSystemGenome;public var input:String
    public var overrides:[String:Double];public var fontProfileID:String?
    public var foreground:String;public var accent:String;public var background:String;public var scene:StyleGenome
    public init(version:String="type-system-variant-v1",system:TypeSystemGenome,input:String,overrides:[String:Double],fontProfileID:String?,foreground:String,accent:String,background:String,scene:StyleGenome){self.version=version;self.system=system;self.input=input;self.overrides=overrides;self.fontProfileID=fontProfileID;self.foreground=foreground;self.accent=accent;self.background=background;self.scene=scene}
    public func replay()throws->StyleGenome {try TypeSystemEngine.scene(system,input:input,profileID:fontProfileID,overrides:overrides,foreground:foreground,accent:accent,background:background)}
}

public enum TypeSystemEngine {
    static func normalized(_ value:String)->String {value.precomposedStringWithCanonicalMapping.lowercased().filter{$0.isLetter || $0.isNumber}}
    static func sampleFrame(_ genome:TypeSystemGenome,index:Int,count:Int)->TypeSystemFrame {
        guard !genome.frames.isEmpty else{return TypeSystemFrame(sourceElementID:"generated",bounds:.full,rotation:0)}
        if count==genome.frames.count{return genome.frames[min(index,genome.frames.count-1)]}
        let position=Double(index)/Double(max(1,count-1))*Double(genome.frames.count-1)
        let low=Int(position),high=min(genome.frames.count-1,low+1),t=position-Double(low)
        let a=genome.frames[low],b=genome.frames[high]
        func blend(_ x:Double,_ y:Double)->Double{x*(1-t)+y*t}
        return TypeSystemFrame(sourceElementID:a.sourceElementID,bounds:UnitBox(x:blend(a.bounds.x,b.bounds.x),y:blend(a.bounds.y,b.bounds.y),width:blend(a.bounds.width,b.bounds.width),height:blend(a.bounds.height,b.bounds.height)),rotation:genome.operation=="rotation-field" ? (t<0.5 ? a.rotation:b.rotation):blend(a.rotation,b.rotation))
    }
    private static func indexedParts(_ input:String,separator:Character)->[(text:String,map:[Int])] {
        let characters=Array(input.precomposedStringWithCanonicalMapping)
        var groups:[[(Character,Int)]]=[[]]
        for (i,c) in characters.enumerated(){if c==separator{groups.append([])}else{groups[groups.count-1].append((c,i))}}
        return groups.map{group in var g=group;while g.first?.0.isWhitespace==true{g.removeFirst()};while g.last?.0.isWhitespace==true{g.removeLast()};return (String(g.map{$0.0}),g.map{$0.1})}
    }
    private static func indexedWords(_ input:String)->[(text:String,map:[Int])] {
        let characters=Array(input.precomposedStringWithCanonicalMapping)
        var groups:[[(Character,Int)]]=[]
        for (i,c) in characters.enumerated(){if c.isWhitespace{if groups.last?.isEmpty==false{groups.append([])}}else{if groups.isEmpty{groups.append([])};groups[groups.count-1].append((c,i))}}
        return groups.filter{!$0.isEmpty}.map{(String($0.map{$0.0}),$0.map{$0.1})}
    }
    private static func joined(_ words:[(text:String,map:[Int])])->(text:String,map:[Int]) {
        var text="",map:[Int]=[]
        for word in words{if !text.isEmpty{text += " ";map.append(-1)};text += word.text;map += word.map}
        return (text,map)
    }
    private static func normalizedPart(_ part:(text:String,map:[Int]))->(text:String,map:[Int]) {
        var text="",map:[Int]=[]
        for (i,c) in Array(part.text).enumerated() where c.isLetter || c.isNumber{let value=String(c).lowercased();text += value;map += Array(repeating:part.map[i],count:value.count)}
        return (text,map)
    }
    private static func usesCommonEm(_ operation:String)->Bool{!["scale-ramp","reflection","alternating-ink"].contains(operation)}
    public static func steps(_ genome:TypeSystemGenome,input:String,overrides:[String:Double]=[:])throws->[TypeSystemStep] {
        guard !input.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,input.count<=160,(genome.parameters.merging(overrides){_,b in b}).values.allSatisfy({$0.isFinite && abs($0)<=1_000_000}) else{throw PosterError.invalid("Invalid type-system input or parameters.")}
        let p=genome.parameters.merging(overrides){_,b in b}
        let value=genome.textParameters["caseMode"]=="lowercase" ? input.lowercased():input
        let graphemes=Array(value.precomposedStringWithCanonicalMapping)
        var text:[String]=[],maps:[[Int]]=[],variables:[[String:Double]]=[]
        switch genome.operation {
        case "suffix-cycle":
            let parts=input.split(separator:"|",omittingEmptySubsequences:false).map(String.init)
            let prefix=parts.count>1 ? parts[0]:String(graphemes)
            let suffixes=parts.count>1 ? Array(parts.dropFirst()):(genome.textParameters["suffixes"] ?? "m|r|s").split(separator:"|",omittingEmptySubsequences:false).map(String.init)
            guard !prefix.isEmpty,!suffixes.isEmpty,suffixes.count<=24 else{throw PosterError.invalid("Use prefix|suffix|suffix for a suffix cycle.")}
            for (i,suffix) in suffixes.enumerated(){let s=prefix+suffix;text.append(s);maps.append(Array(0..<prefix.count)+Array(repeating:-1,count:suffix.count));variables.append(["suffixIndex":Double(i),"protectedPrefix":Double(prefix.count)])}
        case "glyph-arc":
            let count=graphemes.count
            let aspect=max(0.35,min(3.7,genome.sourceAspect*genome.sourceBounds.height/genome.sourceBounds.width))
            let rx=max(0.12,min(0.42,p["radius"] ?? 0.34))*min(1,aspect),ry=rx/aspect
            let start=p["startAngle"] ?? -100,sweep=max(30,min(360,p["sweep"] ?? 330))
            let intervals=sweep>=359.999 ? max(1,count):max(1,count-1)
            let arcLength=rx*sweep*Double.pi/180
            let size=min(0.22,max(0.002,arcLength/Double(max(1,count))*0.78))
            let result=graphemes.indices.map{i -> TypeSystemStep in
                let angle=(start+Double(i)/Double(intervals)*sweep)*Double.pi/180
                let x=0.5+rx*cos(angle),y=0.5+ry*sin(angle),rotation=atan2(ry*aspect*cos(angle),-rx*sin(angle))*180/Double.pi
                return TypeSystemStep(index:i,text:String(graphemes[i]),indexMap:[i],bounds:UnitBox(x:x-size/2,y:y-size/(2*aspect),width:size,height:size/aspect),rotation:rotation,variables:["angle":angle*180/Double.pi])
            }
            return adjusted(result,overrides:overrides)
        case "glyph-grid":
            let diagonal=p["diagonalCycle"]==1,columns=max(1,min(12,Int(p["columns"] ?? 4)))
            let rows=diagonal ? graphemes.count:max(1,min(12,Int(p["rows"] ?? 4)))
            let total=diagonal ? rows:rows*columns
            let result=(0..<total).map{i -> TypeSystemStep in
                let row=diagonal ? i:i/columns,column=diagonal ? (i+1)%columns:i%columns,index=i%graphemes.count
                let rotation=Double((row+column)%4)*(p["quarterTurn"] ?? 90)
                let box=UnitBox(x:Double(column)/Double(columns)+0.02/Double(columns),y:Double(row)/Double(rows)+0.02/Double(rows),width:0.96/Double(columns),height:0.96/Double(rows))
                return TypeSystemStep(index:i,text:String(graphemes[index]),indexMap:[index],bounds:box,rotation:rotation,typeTransform:["shear":p["shear"] ?? 0,"scaleY":p["scaleY"] ?? 1],variables:["row":Double(row),"column":Double(column),"inkIndex":p["alternateInk"]==1 ? Double((row+column)%2):0])
            }
            return adjusted(result,overrides:overrides)
        case "grapheme-migration":
            let oldLength=max(1,Int(p["sourceLength"] ?? Double(graphemes.count))),oldIndex=p["movingIndex"] ?? 0
            let mapped=overrides["movingIndex"] ?? (oldIndex/Double(max(1,oldLength-1))*Double(graphemes.count-1))
            let index=max(0,min(graphemes.count-1,Int(mapped.rounded())))
            let direction=(p["direction"] ?? 1)>=0 ? 1:-1
            let destinations=direction>0 ? Array(index..<graphemes.count):Array((0...index).reversed())
            for destination in destinations.prefix(max(1,min(32,Int(p["maxRows"] ?? 32)))) {
                var order=Array(graphemes.indices);let moved=order.remove(at:index);order.insert(moved,at:destination)
                text.append(String(order.map{graphemes[$0]}));maps.append(order);variables.append(["movingIndex":Double(index),"destination":Double(destination)])
            }
        case "permutation-sequence":
            let schedules=genome.indexSchedules ?? [Array(graphemes.indices)]
            for schedule in schedules.prefix(32) {
                guard !schedule.isEmpty else{continue}
                let order=graphemes.indices.sorted{a,b in
                    func rank(_ i:Int)->Double {let bucket=min(schedule.count-1,Int(Double(i)*Double(schedule.count)/Double(graphemes.count)));return Double(schedule.firstIndex(of:bucket) ?? bucket)+Double(i)/Double(max(1,graphemes.count))*0.01}
                    return rank(a)<rank(b)
                }
                text.append(String(order.map{graphemes[$0]}));maps.append(order);variables.append([:])
            }
        case "compensated-erosion":
            let parts=indexedParts(input,separator:"|")
            let source=normalized(genome.textParameters["sourceInput"] ?? "")
            let prefix:(text:String,map:[Int]),pattern:(text:String,map:[Int]),suffix:(text:String,map:[Int])
            if parts.count==3{prefix=normalizedPart(parts[0]);pattern=normalizedPart(parts[1]);suffix=normalizedPart(parts[2])}
            else {
                let normalizedInput=normalizedPart((input,Array(0..<input.count)))
                let characters=Array(normalizedInput.text)
                if normalized(input)==source {
                    let k=(genome.textParameters["prefix"] ?? "").count,q=(genome.textParameters["pattern"] ?? "").count
                    guard k>0,q>0,k+q<characters.count else{throw PosterError.invalid("Invalid source erosion partition.")}
                    prefix=(String(characters.prefix(k)),Array(normalizedInput.map.prefix(k)))
                    pattern=(String(characters.dropFirst(k).prefix(q)),Array(normalizedInput.map.dropFirst(k).prefix(q)))
                    suffix=(String(characters.dropFirst(k+q)),Array(normalizedInput.map.dropFirst(k+q)))
                }else {
                    let words=indexedWords(input)
                    if words.count>=3{prefix=normalizedPart(words[0]);pattern=normalizedPart(words[1]);suffix=normalizedPart(joined(Array(words.dropFirst(2))))}
                    else {
                        let n=characters.count;guard n>=4 else{throw PosterError.invalid("Compensated erosion needs at least four graphemes or prefix|pattern|suffix.")}
                        let k=max(1,min(8,n/2)),q=min(2,n-k-1)
                        prefix=(String(characters.prefix(k)),Array(normalizedInput.map.prefix(k)))
                        pattern=(String(characters.dropFirst(k).prefix(q)),Array(normalizedInput.map.dropFirst(k).prefix(q)))
                        suffix=(String(characters.dropFirst(k+q)),Array(normalizedInput.map.dropFirst(k+q)))
                    }
                }
            }
            let a=Array(prefix.text),b=Array(pattern.text),c=Array(suffix.text)
            guard !a.isEmpty,!b.isEmpty,!c.isEmpty else{throw PosterError.invalid("Erosion needs nonempty prefix, pattern and suffix.")}
            let count=min(24,a.count+1,Int(p["count"] ?? Double(a.count+1)))
            for i in 0..<max(1,count) {
                let inserted=(0..<(b.count+i)).map{b[$0%b.count]}
                text.append(String(Array(a.dropFirst(i))+inserted+c))
                maps.append(Array(prefix.map.dropFirst(i))+(0..<(b.count+i)).map{pattern.map[$0%b.count]}+suffix.map)
                variables.append(["removedPrefix":Double(i),"patternLength":Double(inserted.count),"totalGraphemes":Double(a.count+b.count+c.count)])
            }
        case "paired-columns":
            let parts=indexedParts(input,separator:"|"),words=indexedWords(input)
            let left=parts.count>=2 ? parts[0]:words.first ?? (input,Array(0..<input.count))
            let right=parts.count>=2 ? joined(Array(parts.dropFirst())):joined(Array(words.dropFirst()))
            let sourceLeft=normalized(genome.textParameters["leftText"] ?? "")
            for observation in genome.observations {
                let isLeft=normalized(observation.text)==sourceLeft
                let output=isLeft || right.text.isEmpty ? left:right
                text.append(output.text);maps.append(output.map);variables.append(["column":isLeft ? 0:1])
            }
        case "word-reflow":
            let words=indexedWords(input)
            let sourceCounts=(genome.textParameters["lineWordCounts"] ?? "1,1,1").split(separator:",").compactMap{Int($0)}.map{max(1,$0)}
            let rhythm=overrides["wordsPerLine"].map{[max(1,Int($0))]} ?? (sourceCounts.isEmpty ? [1]:sourceCounts)
            var cursor=0,row=0
            while cursor<words.count {
                let count=row==31 ? words.count-cursor:rhythm[row%rhythm.count]
                let next=min(words.count,cursor+count),output=joined(Array(words[cursor..<next]))
                text.append(output.text);maps.append(output.map);variables.append(["wordStart":Double(cursor),"wordEnd":Double(next)])
                cursor=next;row+=1
            }
        case "tittle-substitution":
            let candidate=input==input.uppercased() ? input.lowercased().capitalized:input
            guard candidate.contains("i") || candidate.contains("j") else{throw PosterError.invalid("Tittle substitution needs a lowercase i or j.")}
            text=[candidate];maps=[Array(0..<candidate.count)];variables=[["heartScale":p["heartScale"] ?? 1.5]]
        case "reflection":
            let words=indexedParts(input,separator:"|")
            let upper=genome.frames.filter{$0.bounds.y<0.48}
            let count=max(1,min(6,upper.count))
            var result:[TypeSystemStep]=[]
            for i in 0..<count {
                let f=upper.isEmpty ? sampleFrame(genome,index:i,count:count):upper[i]
                let output=words.count>1 ? words[i%words.count]:(text:value,map:Array(0..<value.count))
                let s=output.text
                result.append(TypeSystemStep(index:i,text:s,indexMap:output.map,bounds:f.bounds,rotation:f.rotation,variables:["reflection":0]))
                let reflected=UnitBox(x:f.bounds.x,y:1-f.bounds.y-f.bounds.height,width:f.bounds.width,height:f.bounds.height)
                result.append(TypeSystemStep(index:count+i,text:s,indexMap:output.map,bounds:reflected,rotation:-f.rotation,typeTransform:["scaleY":-1],variables:["reflection":1]))
            }
            return adjusted(result,overrides:overrides)
        default:
            guard ["repeat-field","staircase","scale-ramp","rotation-field","radial-fan","curved-baseline","alternating-ink"].contains(genome.operation) else{throw PosterError.invalid("Unsupported type-system operation: \(genome.operation)")}
            let count=min(32,max(1,Int(p["count"] ?? Double(genome.frames.count))))
            for i in 0..<count {text.append(value);maps.append(Array(graphemes.indices));variables.append(["inkIndex":genome.operation=="alternating-ink" ? Double(i%max(1,Int(p["inkPeriod"] ?? 2))):0])}
        }
        var result=text.indices.map{i in let f=sampleFrame(genome,index:i,count:text.count);return TypeSystemStep(index:i,text:text[i],indexMap:maps[i],bounds:f.bounds,rotation:f.rotation,variables:variables[i])}
        if ["grapheme-migration","permutation-sequence","compensated-erosion","word-reflow","staircase"].contains(genome.operation),result.count>1 {
            let heights=result.map{$0.bounds.height}.sorted(),median=heights[heights.count/2]
            let pitch=abs(result.last!.bounds.y-result.first!.bounds.y)/Double(result.count-1)
            for i in result.indices{result[i].bounds.height=min(median,pitch>0 ? pitch*0.88:median)}
        }
        if genome.operation=="rotation-field" {
            // Photograph/OCR angles and overlapping AABBs are observations, not a baseline grid.
            // Keep the source order and direction, then fit disjoint reading lanes.
            let vertical=result.filter{abs(sin($0.rotation * .pi/180))>0.9}.count>result.count/2
            let gap=max(0.008,min(0.15,overrides["laneGap"] ?? 0.035))
            for i in result.indices {
                let nearest=(result[i].rotation/90).rounded()*90
                if abs(nearest-result[i].rotation)<14{result[i].rotation=nearest}
            }
            let sorted=result.indices.sorted{vertical ? result[$0].bounds.x+result[$0].bounds.width/2<result[$1].bounds.x+result[$1].bounds.width/2:result[$0].bounds.y+result[$0].bounds.height/2<result[$1].bounds.y+result[$1].bounds.height/2}
            let centers=sorted.map{vertical ? result[$0].bounds.x+result[$0].bounds.width/2:result[$0].bounds.y+result[$0].bounds.height/2}
            for (position,index) in sorted.enumerated() {
                let center=centers[position]
                let previous=position>0 ? centers[position-1]:-center
                let next=position+1<centers.count ? centers[position+1]:2-center
                let extent=max(0.008,min(center-previous,next-center)-gap)
                if vertical{result[index].bounds.width=min(result[index].bounds.width,extent);result[index].bounds.x=center-result[index].bounds.width/2}
                else{result[index].bounds.height=min(result[index].bounds.height,extent);result[index].bounds.y=center-result[index].bounds.height/2}
                result[index].variables["laneGap"]=gap;result[index].variables["regularizedBaseline"]=1
            }
        }
        let columnPitch=genome.operation=="rotation-field" && result.filter{abs(sin($0.rotation * .pi/180))>0.9}.count>result.count/2
        return adjusted(result,overrides:overrides,columns:columnPitch)
    }
    private static func adjusted(_ steps:[TypeSystemStep],overrides:[String:Double],columns:Bool=false)->[TypeSystemStep] {
        var result=steps
        let pitch=overrides["pitch"] ?? 1,angle=overrides["angle"] ?? 0
        for i in result.indices {
            if columns {
                result[i].bounds.x=0.5+(result[i].bounds.x-0.5)*pitch
                if pitch<1{result[i].bounds.width *= max(0.25,pitch)}
            }else{
                result[i].bounds.y=0.5+(result[i].bounds.y-0.5)*pitch
                if pitch<1{result[i].bounds.height *= max(0.25,pitch)}
            }
            result[i].rotation += angle
        }
        return result
    }

    /// `kerning` is what the scene the line goes into uses: type systems build lines for new posters unless refitting a scene.
    static func fontBounds(_ e:SceneElement,genomeFont:String,kerning:TextKerning?=TextKerning.newPosters)->CGRect {
        let face=FontLibrary.font(name:e.fontName ?? genomeFont,variations:e.fontVariations)
        if let kerning=e.kerning ?? kerning {return KerningSystem.layout(e.text ?? "",font:face,tracking:e.tracking ?? 0,kerning:kerning).path.boundingBoxOfPath}
        let line=CTLineCreateWithAttributedString(NSAttributedString(string:e.text ?? "",attributes:[.font:face,.kern:e.tracking ?? 0]))
        return CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
    }
    static func fitCommonEm(_ elements:inout [SceneElement],aspect:Double,kerning:TextKerning?=TextKerning.newPosters) {
        guard !elements.isEmpty else{return}
        var em=Double.infinity
        for e in elements {let b=fontBounds(e,genomeFont:"HelveticaNeue-Bold",kerning:kerning);if b.width>0 && b.height>0 {let scale=min(e.bounds.width*1000/Double(b.width),e.bounds.height*1000*aspect/Double(b.height));em=min(em,scale*100/(1000*aspect))}}
        if em.isFinite && em>0 {for i in elements.indices{elements[i].typeEmSize=em}}
    }
    static func fitRampEm(_ elements:inout [SceneElement],aspect:Double,kerning:TextKerning?=TextKerning.newPosters) {
        let height=elements.map{$0.bounds.height}.max() ?? 1
        var base=Double.infinity
        for e in elements {
            let b=fontBounds(e,genomeFont:"HelveticaNeue-Bold",kerning:kerning),weight=max(0.0001,e.bounds.height/max(0.0001,height))
            if b.width>0 && b.height>0{let fit=min(e.bounds.width*1000/b.width,e.bounds.height*1000*aspect/b.height);base=min(base,fit/weight)}
        }
        if base.isFinite && base>0{for i in elements.indices{let weight=elements[i].bounds.height/max(0.0001,height);elements[i].typeEmSize=base*weight*100/(1000*aspect)}}
    }
    public static func refitEm(_ genome:inout StyleGenome) {
        let ids=Set(genome.elements.filter{$0.typeEmSize != nil}.compactMap(\.typeSystemID))
        for id in ids {
            let indexes=genome.elements.indices.filter{genome.elements[$0].typeSystemID==id}
            var group=indexes.map{genome.elements[$0]}
            let operation=genome.appliedTypeSystems?.first{$0.genomeID==id}?.operation ?? ""
            if operation=="scale-ramp"{fitRampEm(&group,aspect:genome.aspect,kerning:genome.kerning)}else if usesCommonEm(operation){fitCommonEm(&group,aspect:genome.aspect,kerning:genome.kerning)}else{for i in group.indices{var single=[group[i]];fitCommonEm(&single,aspect:genome.aspect,kerning:genome.kerning);group[i]=single[0]}}
            let scale=genome.appliedTypeSystems?.first{$0.genomeID==id}?.parameters["fontScale"] ?? 1
            for (i,index) in indexes.enumerated(){genome.elements[index].typeEmSize=group[i].typeEmSize.map{$0*max(0.25,min(2,scale))}}
        }
    }
    public static func elements(_ system:TypeSystemGenome,input:String,field:UnitBox,aspect:Double,profile:FontStyleProfile?,foreground:String,accent:String,overrides:[String:Double]=[:])throws->([SceneElement],TypeSystemApplication) {
        let steps=try steps(system,input:input,overrides:overrides)
        var result:[SceneElement]=[]
        for (i,step) in steps.enumerated() {
            let observed=UnitBox(x:field.x+step.bounds.x*field.width,y:field.y+step.bounds.y*field.height,width:step.bounds.width*field.width,height:step.bounds.height*field.height)
            let box=SourceLayoutDNA.localBox(observed,rotation:step.rotation,aspect:aspect)
            let ink=(step.variables["inkIndex"] ?? step.variables["reflection"] ?? 0)>0 ? accent:foreground
            var e=SceneElement(sourceElementID:"art:type-system:\(system.id):\(i)",kind:"text",bounds:box,rotation:step.rotation,text:step.text,color:ink,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:profile?.postscriptName ?? "HelveticaNeue-Bold",textAlignment:"left",minimumStage:i<2 ? 1:2,textTreatment:"type-system",clipBounds:.full)
            e.tracking=overrides["tracking"] ?? 0
            e.typeTransform=step.typeTransform;e.typeSystemID=system.id;e.typeSystemStep=step.index;e.graphemeIndexMap=step.indexMap
            e.allowsBleed=true;e.zIndex=20+i;e.sourcePosterID=system.sourcePosterID
            if let frame=system.frames.min(by:{abs($0.bounds.y-step.bounds.y)<abs($1.bounds.y-step.bounds.y)}),let original=system.observations.first(where:{$0.elementID==frame.sourceElementID}){e.sourceAnchor=original.bounds}
            if let profile{e.fontProfileID=profile.id;e.fontAssetID=profile.assetID;e.fontAssetSHA256=profile.assetSHA256;e.fontVariations=profile.variations}
            if system.operation=="tittle-substitution" {
                let face=FontLibrary.font(name:e.fontName ?? "HelveticaNeue-Bold",variations:e.fontVariations)
                guard TypeGlyphs.supportsTittle(font:face) else{throw PosterError.invalid("The selected face has no separate lowercase i tittle to replace.")}
                e.glyphTreatment="heart-tittle"
                if let index=step.text.indices.last(where:{step.text[$0]=="i" || step.text[$0]=="j"}){e.glyphIndex=step.text[..<index].utf16.count}
                e.geometry=["heartScale":overrides["heartScale"] ?? system.parameters["heartScale"] ?? 1.5]
            }
            result.append(e)
        }
        if system.operation=="scale-ramp"{fitRampEm(&result,aspect:aspect)}else if usesCommonEm(system.operation){fitCommonEm(&result,aspect:aspect)}
        if let size=overrides["fontScale"],size != 1 {
            for i in result.indices {
                if result[i].typeEmSize==nil{var single=[result[i]];fitCommonEm(&single,aspect:aspect);result[i]=single[0]}
                result[i].typeEmSize=(result[i].typeEmSize ?? 0)*max(0.25,min(2,size))
            }
        }
        var parameters=system.parameters.merging(overrides){_,b in b},invariants=system.invariants
        if system.operation=="scale-ramp"{invariants=["Relative type size follows the measured source row heights.","A single global fit preserves that progression with new text, fonts and type-scale changes."]}
        if system.operation=="rotation-field" {
            parameters["laneGap"]=overrides["laneGap"] ?? 0.035;parameters["baselineSnapTolerance"]=14;parameters["regularizedLanes"]=1
            invariants=["Source lane order and opposed reading directions survive.","Near-orthogonal OCR angles snap to canonical 90° baselines.","Lane widths reserve an explicit gap; all lanes share one em size."]
        }
        return(result,TypeSystemApplication(genomeID:system.id,sourcePosterID:system.sourcePosterID,operation:system.operation,input:input,field:field,parameters:parameters,steps:steps,invariants:invariants))
    }
    public static func scene(_ system:TypeSystemGenome,input:String,profileID:String?=nil,overrides:[String:Double]=[:],foreground:String="#191c22",accent:String="#3d52b6",background:String="#f0eee7")throws->StyleGenome {
        if let profileID,FontLibrary.shared.profile(profileID)==nil{throw PosterError.invalid("Unknown type-system font profile.")}
        let aspect=max(0.35,min(3.7,system.sourceAspect*system.sourceBounds.height/system.sourceBounds.width))
        let profile=profileID.flatMap{FontLibrary.shared.profile($0)} ?? FontLibrary.shared.profiles.first{$0.familyID==(system.operation=="compensated-erosion" || system.operation=="tittle-substitution" ? "newsreader":"chivo") && $0.weight==400 && !$0.italic}
        let field=UnitBox(x:0.055,y:0.045,width:0.89,height:0.91)
        let (elements,application)=try Self.elements(system,input:input,field:field,aspect:aspect,profile:profile,foreground:foreground,accent:accent,overrides:overrides)
        var g=StyleGenome(version:"type-system-scene-v1",posterID:system.id+"-application",aspect:aspect,background:background,font:profile?.postscriptName ?? "HelveticaNeue-Bold",textScale:1,tracking:0,elements:elements,score:nil,fittingStatus:"Reusable source-fitted type system; input and every intermediate step are stored.",sourceEmbeddingModel:"Apple-Vision-r2")
        g.appliedTypeSystems=[application];g.typeSystemIDs=[system.id]
        g.composition=CompositionPlan.scene(g,origin:"declared-type-system")
        g.composition?.description=system.name+" — "+system.explanation+" Input: "+input+". "+system.invariants.joined(separator:" ")
        return g
    }
}

public final class TypeSystemLibrary:Sendable {
    public static let shared=TypeSystemLibrary()
    public let catalog:TypeSystemCatalog?
    public let curation:TypeSystemCuration?
    public let semanticIndex:TypeSystemSemanticIndex?
    private let visualVectors:[String:[Float]]
    public var systems:[TypeSystemGenome]{catalog?.systems ?? []}
    public var distinctSystems:[TypeSystemGenome]{systems.filter{curation?.aliases[$0.id]==nil}}
    private init(){
        func data(_ name:String)->Data?{PosterResources.bundle.url(forResource:name,withExtension:"json",subdirectory:"Resources/TypeSystems").flatMap{try? Data(contentsOf:$0)}}
        let catalog=data("catalog").flatMap{try? JSONDecoder().decode(TypeSystemCatalog.self,from:$0)}
        self.catalog=catalog
        let semantic=data("semantic").flatMap{try? JSONDecoder().decode(TypeSystemSemanticIndex.self,from:$0)}
        semanticIndex=semantic
        let curation=data("curation").flatMap{try? JSONDecoder().decode(TypeSystemCuration.self,from:$0)}
        let ids=Set(catalog?.systems.map(\.id) ?? [])
        self.curation=curation.flatMap{value in
            guard value.version=="type-system-curation-v1",value.modelFingerprint==semantic?.model.fingerprint,
                  value.aliases.allSatisfy({ids.contains($0.key) && ids.contains($0.value) && value.aliases[$0.value]==nil}) else{return nil}
            return value
        }
        var vectors:[String:[Float]]=[:]
        for profile in semantic?.profiles ?? [] {
            guard profile.probes.count==2,let a=try? profile.probes[0].values(),let b=try? profile.probes[1].values(),a.count==768,b.count==768 else{continue}
            let mean=zip(a,b).map{($0+$1)/2}
            if let unit=try? SigLIPEncoder.unitVector(mean){vectors[profile.id]=unit}
        }
        visualVectors=vectors
    }
    public func system(_ id:String)->TypeSystemGenome?{systems.first{$0.id==id}}
    public func groupedSources(_ id:String)->[TypeSystemGenome] {
        let canonical=curation?.aliases[id] ?? id
        let ids=Set(curation?.groups.first{$0.canonicalID==canonical}?.memberIDs ?? [id])
        return systems.filter{ids.contains($0.id)}
    }
    public func nearest(_ system:TypeSystemGenome,limit:Int=6)->[(TypeSystemGenome,Double)] {
        var result:[(TypeSystemGenome,Double)]=[]
        for other in distinctSystems where other.id != system.id && other.sourcePosterID != system.sourcePosterID && other.semanticEmbedding.count==system.semanticEmbedding.count {
            let squared=zip(other.semanticEmbedding,system.semanticEmbedding).reduce(0.0){v,pair in let d=pair.0-pair.1;return v+d*d}
            let structural=min(1,sqrt(squared)/2)
            if let a=visualVectors[system.id],let b=visualVectors[other.id] {
                let cosine=zip(a,b).reduce(0.0){$0+Double($1.0)*Double($1.1)}
                result.append((other,0.6*structural+0.4*min(1,max(0,(1-cosine)*4))))
            }else{result.append((other,structural))}
        }
        return Array(result.sorted{$0.1==$1.1 ? $0.0.id<$1.0.id:$0.1<$1.1}.prefix(limit))
    }
    public func recombine(_ elements:inout [SceneElement],a:PosterRecord,b:PosterRecord,copy:PosterCopy,profile:FontStyleProfile?,seed:UInt64)->[TypeSystemApplication] {
        let rank=["grapheme-migration":0,"compensated-erosion":1,"paired-columns":2,"reflection":3,"word-reflow":4,"rotation-field":5,"staircase":6,"repeat-field":7,"scale-ramp":8,"alternating-ink":9,"tittle-substitution":10]
        let candidates=systems.filter{g in
            guard [a.id,b.id].contains(g.sourcePosterID),g.confidence>=0.89,g.sourceBounds.area>0.025 else{return false}
            let record=g.sourcePosterID==a.id ? a:b
            return !record.elements.contains{e in g.sourceElementIDs.contains(e.id) && e.tags.contains{g.tags.contains($0.name) && $0.state=="rejected"}}
        }.sorted{x,y in let a=rank[x.operation] ?? 99,b=rank[y.operation] ?? 99;return a==b ? x.confidence==y.confidence ? x.id<y.id:x.confidence>y.confidence:a<b}
        var applications:[TypeSystemApplication]=[],used:Set<String>=[]
        for system in candidates {
            let indexes=elements.indices.filter{i in elements[i].sourcePosterID==system.sourcePosterID && system.sourceElementIDs.contains{elements[i].sourceElementID.hasSuffix($0)}}
            guard indexes.count>=max(1,Int(ceil(Double(system.sourceElementIDs.count)*0.65))),!indexes.contains(where:{used.contains(elements[$0].sourceElementID)}) else{continue}
            if applications.count>=3{break}
            // Avoid replacing the same source field with two competing explanations.
            let input:String
            switch system.operation {
            case "grapheme-migration","permutation-sequence":
                let words=copy.words.filter{$0.filter(\.isLetter).count>=3 && $0.count<=16}.sorted{$0.count>$1.count}
                input=words.first ?? copy.words.first ?? copy.title
            case "compensated-erosion":input=copy.title.replacingOccurrences(of:"\n",with:" ")
            case "paired-columns","reflection":
                let words=copy.words,cut=max(1,words.count/2)
                input=words.prefix(cut).joined(separator:" ")+" | "+(words.count>cut ? words.dropFirst(cut).joined(separator:" "):copy.subtitle.split(separator:" ").prefix(2).joined(separator:" "))
            case "tittle-substitution":input=elements[indexes[0]].text ?? copy.title
            default:input=copy.displayPhrases?.first ?? copy.title.replacingOccurrences(of:"\n",with:" ")
            }
            let rect=indexes.reduce(CGRect.null){value,index in
                var e=elements[index];e.preserveTypeProportions=false
                return value.union(CompositionJudges.inkBounds(e,genome:StyleGenome(posterID:"field",aspect:a.genome.aspect,background:a.genome.background,font:a.genome.font,textScale:1,tracking:0,elements:[],score:nil,fittingStatus:"",sourceEmbeddingModel:"")).rect)
            }
            let field=UnitBox(x:max(0,rect.minX),y:max(0,rect.minY),width:min(1,rect.maxX)-max(0,rect.minX),height:min(1,rect.maxY)-max(0,rect.minY))
            guard field.valid else{continue}
            let foreground=elements[indexes[0]].color,accent=elements.first{$0.kind=="text" && $0.color != foreground}?.color ?? foreground
            guard let (replacement,application)=try? TypeSystemEngine.elements(system,input:input,field:field,aspect:a.genome.aspect,profile:profile,foreground:foreground,accent:accent),!replacement.isEmpty else{continue}
            let removed=Set(indexes.map{elements[$0].sourceElementID});used.formUnion(removed)
            elements=elements.filter{!removed.contains($0.sourceElementID)}+replacement
            applications.append(application)
        }
        return applications
    }
    public func transplant(_ variant:TypeSystemVariant,into elements:inout [SceneElement],aspect:Double,profile:FontStyleProfile?,copy:PosterCopy)throws->TypeSystemApplication {
        let display=elements.indices.filter{elements[$0].kind=="text" && elements[$0].sourceAnchor != nil}
        guard let largest=display.max(by:{elements[$0].bounds.area<elements[$1].bounds.area}) else{throw PosterError.invalid("No source display field for this type system.")}
        let anchor=elements[largest].bounds
        let clustered=display.filter{i in let box=elements[i].bounds;return abs(box.x-anchor.x)<0.18 && abs(box.y-anchor.y)<0.4}
        let rect=clustered.reduce(CGRect.null){$0.union(elements[$1].bounds.rect)}
        let desired=max(0.35,min(3.7,variant.system.sourceAspect*variant.system.sourceBounds.height/variant.system.sourceBounds.width))
        var width=max(0.12,min(0.88,rect.width)),height=max(0.12,min(0.78,rect.height))
        if height*aspect/width<desired{height=min(0.78,width*desired/aspect);width=min(width,height*aspect/desired)}
        else{width=min(0.88,height*aspect/desired);height=min(height,width*desired/aspect)}
        let x=max(0.03,min(0.97-width,rect.midX-width/2)),y=max(0.03,min(0.97-height,rect.midY-height/2))
        let field=UnitBox(x:x,y:y,width:width,height:height)
        // The user chooses the operator and controls; each poster supplies fresh brief text.
        let words=copy.words.filter{$0.count>=3}.sorted{$0.count>$1.count}
        let input:String
        switch variant.system.operation {
        case "grapheme-migration","permutation-sequence":input=words.first ?? copy.title
        case "paired-columns","reflection":
            let cut=max(1,copy.words.count/2),left=copy.words.prefix(cut).joined(separator:" ")
            let tail=copy.words.dropFirst(cut).joined(separator:" ")
            let right=tail.isEmpty ? copy.subtitle.split(separator:" ").prefix(2).joined(separator:" "):tail
            input=left+" | "+(right.isEmpty ? left:right)
        case "tittle-substitution":input=words.first{$0.lowercased().contains("i") || $0.lowercased().contains("j")} ?? "Edition"
        default:input=copy.title.replacingOccurrences(of:"\n",with:" ")
        }
        let foreground=elements[largest].color,accent=elements.first{$0.kind=="text" && $0.color != foreground}?.color ?? foreground
        let chosen=variant.fontProfileID.flatMap{FontLibrary.shared.profile($0)} ?? profile
        let (replacement,application)=try TypeSystemEngine.elements(variant.system,input:input,field:field,aspect:aspect,profile:chosen,foreground:foreground,accent:accent,overrides:variant.overrides)
        // Reserve the mapped field as a complete unit. Unrelated display labels must
        // not cross the new reading lanes; full supporting copy is added afterwards.
        let removed=elements.indices.filter{elements[$0].kind=="text" && (clustered.contains($0) || elements[$0].bounds.overlap(field)>0.18)}
        let remove=Set(removed);elements=elements.enumerated().filter{!remove.contains($0.offset)}.map(\.element)+replacement
        return application
    }
    public static func embed(_ draft:TypeSystemCatalog,to output:URL,progress:(String)->Void={_ in})throws->TypeSystemCatalog {
        try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
        var catalog=draft
        let embedder=LibraryVisualEmbedder();var loadedID="",loadedImage:CGImage?
        for i in catalog.systems.indices {
            try Task.checkCancellation()
            let system=catalog.systems[i]
            let savedURL=output.appending(path:system.id+"/genome.json")
            if let data=try? Data(contentsOf:savedURL),let saved=try? JSONDecoder().decode(TypeSystemGenome.self,from:data),saved.sourceBounds==system.sourceBounds,let crop=saved.cropURL,FileManager.default.fileExists(atPath:crop.path),saved.sourceEmbedding?.dimensions==768 {
                catalog.systems[i].cropURL=crop;catalog.systems[i].sourceEmbedding=saved.sourceEmbedding;continue
            }
            if loadedID != system.sourcePosterID {loadedImage=try LibraryRaster.oriented(system.sourceImageURL,maxSize:1800);loadedID=system.sourcePosterID}
            let folder=output.appending(path:system.id)
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
            let url=folder.appending(path:"source.jpg")
            let embedding=try autoreleasepool {()->VisualEmbedding in
                let image=try LibraryRaster.crop(loadedImage!,system.sourceBounds)
                try LibraryAnalyzer.jpeg(image,to:url,maxDimension:1000,quality:0.9)
                return try embedder.embed(PosterRenderer.load(url))
            }
            catalog.systems[i].cropURL=url
            catalog.systems[i].sourceEmbedding=embedding
            try LibraryRaster.write(catalog.systems[i],to:folder.appending(path:"genome.json"))
            if (i+1)%100==0{progress("Embedded \(i+1)/\(catalog.systems.count) type-system elements")}
        }
        try LibraryRaster.write(catalog,to:output.appending(path:"catalog.json"))
        return catalog
    }
}
