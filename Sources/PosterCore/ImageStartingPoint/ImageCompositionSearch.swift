import Foundation

public enum ImageCompositionDirection:String,CaseIterable,Codable,Sendable {
    case imageLed="image-led",typeLed="type-led",interaction="interaction"
    public var label:String{switch self{case .imageLed:"Image-led";case .typeLed:"Type-led";case .interaction:"Image / type interaction"}}
}
public enum ImageCompositionSearch {
    /// `repetition` nil keeps image-study behaviour (phrases cycle through spare anchors).
    /// false places each phrase once and leaves spare anchors out; true repeats the
    /// title through them on purpose, as an echo.
    public static func allocate(_ base:StyleGenome,copy:PosterCopy,direction:ImageCompositionDirection,seed:UInt64,repetition:Bool?=nil)->StyleGenome {
        var scene=base
        let indices=scene.elements.indices.filter{scene.elements[$0].kind=="text" && scene.elements[$0].sourceAnchor != nil && scene.elements[$0].typeSystemID==nil}
        guard !indices.isEmpty else{return scene}
        // Source emphasis is an explicit option, including a prominent THE.
        let sourceEmphasis=direction == .typeLed && seed%2==0 || direction == .interaction
        if sourceEmphasis{scene.layoutInheritance?.operations.append("Keep source word emphasis, including articles, as an artistic option.");return scene}
        let hero=indices.max{scene.elements[$0].bounds.area<scene.elements[$1].bounds.area}!
        scene.elements[hero].text=copy.title.replacingOccurrences(of:"\n",with:" ");scene.elements[hero].graphemeIndexMap=nil
        let title=copy.title.replacingOccurrences(of:"\n",with:" ")
        let phrases=copy.displayPhrases ?? copy.words
        let others=indices.filter{$0 != hero}
        if let repetition {
            let distinct=phrases.filter{$0.replacingOccurrences(of:"\n",with:" ").uppercased() != title.uppercased()}.reduce(into:[String]()){if !$0.contains($1){$0.append($1)}}
            var surplus:[Int]=[]
            for (n,index) in others.enumerated() {
                if n<distinct.count{scene.elements[index].text=distinct[n]}
                else if repetition{scene.elements[index].text=title}
                else{surplus.append(index)}
                scene.elements[index].graphemeIndexMap=nil
            }
            for index in surplus.sorted(by:>){scene.elements.remove(at:index)}
            scene.layoutInheritance?.operations.append(repetition ? "Repeat the whole title through spare inherited anchors as a deliberate echo.":"Place each display phrase once; leave \(surplus.count) spare inherited anchors out.")
            return scene
        }
        for (n,index) in others.enumerated(){scene.elements[index].text=phrases.isEmpty ? copy.title:phrases[n%phrases.count]}
        scene.layoutInheritance?.operations.append("Whole-title emphasis in the largest inherited plain-type anchor; preserve traced type systems and retain a source-emphasis search direction.")
        return scene
    }
    public static func withoutDecorativeShapes(_ genome:StyleGenome)->[SceneElement]{genome.elements.filter{PosterShapeLibrary.recipeID($0)==nil}}
    public static func invariantDigest(_ genome:StyleGenome)throws->String {
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        struct Fixed:Encodable{var background:String;var aspect:Double;var font:String;var elements:[SceneElement]}
        return LibraryRaster.hash(try encoder.encode(Fixed(background:genome.background,aspect:genome.aspect,font:genome.font,elements:withoutDecorativeShapes(genome))))
    }
    public static func matched(_ base:StyleGenome,profile:ImageInfluenceProfile,settings:ImageInfluenceSettings,direction:ImageCompositionDirection?,seed:UInt64,copy:PosterCopy,donorIDs:[String],shapePreset:PosterShapePreset?,third:String)throws->[(String,StyleGenome)] {
        var noneSettings=settings;noneSettings.shapeFrequency=0
        let none=try ImagePosterComposer.compose(base,profile:profile,settings:noneSettings,seed:seed,copy:copy,donorIDs:donorIDs,shapePreset:shapePreset,direction:direction)
        var shapeSettings=settings;shapeSettings.shapes=max(0.1,settings.shapes);shapeSettings.shapeFrequency=1
        let large=try ImagePosterComposer.compose(base,profile:profile,settings:shapeSettings,seed:seed,copy:copy,donorIDs:donorIDs,shapePreset:shapePreset,direction:direction)
        guard try invariantDigest(none)==invariantDigest(large) else{throw PosterError.invalid("Matched shape controls changed the fixed composition.")}
        guard large.elements.contains(where:{PosterShapeLibrary.recipeID($0) != nil}) else{return [("none",none)]}
        var alternate=large
        for i in alternate.elements.indices where PosterShapeLibrary.recipeID(alternate.elements[i]) != nil {
            var b=alternate.elements[i].bounds
            if third=="zoom"{let w=min(1.4,b.width*1.22),ratio=w/b.width;b.x-=(w-b.width)/2;b.y-=b.height*(ratio-1)/2;b.width=w;b.height*=ratio}
            else{b.x += seed%2==0 ? 0.20:-0.20;b.y += seed%2==0 ? -0.12:0.12}
            alternate.elements[i].bounds=b;alternate.elements[i].clipBounds = .full;alternate.elements[i].allowsBleed=true
        }
        alternate.imageInfluence?.operations.append(third=="zoom" ? "Matched control: enlarge only the same shape around its center.":"Matched control: offset only the same shape; keep image, type, color and size fixed.")
        alternate.composition=CompositionPlan.scene(alternate,origin:"matched-shape-control",style:alternate.styleCategory)
        guard try invariantDigest(large)==invariantDigest(alternate) else{throw PosterError.invalid("Matched control altered fixed elements.")}
        return [("none",none),("large",large),(third,alternate)]
    }
    public static func descriptor(_ scene:StyleGenome)->[Double] {
        let frame=scene.imageInfluence?.imageFrame ?? .full
        var bins=[Double](repeating:0,count:12)
        let display=scene.elements.filter{$0.kind=="text" && !$0.sourceElementID.hasPrefix("meta:")}
        for e in display{let b=CompositionJudges.inkBounds(e,genome:scene);let x=min(2,max(0,Int((b.x+b.width/2)*3))),y=min(3,max(0,Int((b.y+b.height/2)*4)));bins[y*3+x]+=min(0.5,b.area)*2}
        var result:[Double]=[frame.x,frame.y,frame.width,frame.height]
        result.append(contentsOf:bins)
        let count=Double(max(1,display.count))
        let rotated=Double(display.filter{abs($0.rotation)>15}.count)/count
        let outlined=Double(display.filter{$0.outline}.count)/count
        result.append(rotated);result.append(outlined)
        return result
    }
    public static func distance(_ a:ImagePosterCandidate,_ b:ImagePosterCandidate)->Double {
        let x=descriptor(a.genome),y=descriptor(b.genome)
        let layout=sqrt(zip(x,y).reduce(0.0){$0+pow($1.0-$1.1,2)}/Double(x.count))
        let vision=a.visualEmbedding.flatMap{x in b.visualEmbedding.flatMap{try? x.distance(to:$0)}} ?? layout
        return min(1,layout*2.5)*0.55+min(1,vision)*0.45
    }
    public static func finalists(_ candidates:[ImagePosterCandidate],ranking:[Candidate])->[String] {
        let ranks=Dictionary(uniqueKeysWithValues:ranking.map{($0.id,$0.rank)})
        var selected:[ImagePosterCandidate]=[]
        let directions=candidates.contains{$0.hypothesis=="free"} ? ["free","free","free"]:ImageCompositionDirection.allCases.map(\.rawValue)
        for direction in directions {
            let pool=candidates.filter{candidate in candidate.hypothesis==direction && !selected.contains(where:{$0.id==candidate.id})}
            let chosen=pool.max{a,b in
                func merit(_ c:ImagePosterCandidate)->Double {
                    let quality=1-Double((ranks[c.id] ?? candidates.count)-1)/Double(max(1,candidates.count-1))
                    let novelty=selected.map{distance(c,$0)}.min() ?? 1
                    return quality*0.7+novelty*0.3
                }
                let x=merit(a),y=merit(b);return x==y ? a.id>b.id:x<y
            }
            if let chosen{selected.append(chosen)}
        }
        return selected.map(\.id)
    }
}
