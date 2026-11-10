import Foundation
import CoreGraphics

public enum PaperReliefSystems {
    public static let recipeID="paper-relief-composition"
    public static let shape="paper-relief"
    public static func make(seed:UInt64,parameters:[String:Double],custom:PaperReliefCustomization?=nil)->PaperReliefGenome {
        if let surfaces=custom?.surfaces{return PaperReliefGenome(surfaces:surfaces,titleOverride:custom?.title)}
        let layout=Int(parameters["layout"] ?? 0)
        var surfaces:[PaperReliefSurface]=[]
        func add(_ kind:String,_ x:Double,_ y:Double,_ w:Double,_ h:Double,_ level:Double=0,_ hinge:Int=0,_ dark:Bool=false,_ role:String="title",_ angle:Double=0){surfaces.append(PaperReliefSurface(id:"p\(surfaces.count)",kind:kind,bounds:UnitBox(x:x/7,y:y/10,width:w/7,height:h/10),level:level,hinge:hinge,dark:dark,role:role,labelRotation:angle))}
        if layout==0 {
            // Seven-by-ten measured module scaffold; merged and overlapping cells
            // reproduce the source relationship rather than a random tile field.
            add("flap",0,0,1,1,0,4,false,"word",-45)
            add("panel",1,0,2,1,0.25,0,false,"title")
            add("panel",3,0,1,2,0.4,0,false,"date",90)
            add("panel",4,0,2,1,0.15,0,false,"month")
            add("disc",4.5,0.3,1.1,1.1,0.9,0,false,"year",-90)
            add("flap",6,0,1,1,0,5,false,"date",45)
            add("panel",0,1,1,0.6,0.45,0,false,"word")
            add("flap",1,1,2,1,0,4,false,"word",25)
            add("panel",4,1,2,1,0.25,0,false,"date")
            add("flap",6,1,1,1,0,4,false,"month",45)
            add("panel",0,1.6,1,1.9,0.25,0,false,"title",-90)
            add("panel",1,2,1,2,0.45,0,false,"date",90)
            add("recess",2,2,2,1,-1,0,true,"none")
            add("panel",4,2,1,1,0.7,0,true,"word")
            add("flap",5,2,2,1,0,4,false,"word",25)
            add("panel",2,2.5,1,2,1.0,0,true,"title",90)
            add("recess",3,3,2,2,-1.5,0,true,"none")
            add("disc",3.5,3.6,1.05,1.05,0.5,0,true,"none")
            add("panel",5,3,0.55,2,0.4,0,false,"year",90)
            add("panel",5.55,3,0.95,0.5,0.7,0,false,"word")
            add("panel",5.55,3.5,0.95,1,0.2,0,false,"word",45)
            add("panel",6.5,3,0.5,2.5,0.3,0,false,"date",90)
            add("panel",0,3.5,1,2,0.5,0,false,"title",90)
            add("panel",1,4.5,1,1,0.7,0,false,"word",-45)
            add("panel",2,4.5,1,2,0.7,0,true,"title",-90)
            add("panel",3,5,1,2,0.2,0,false,"title",90)
            add("panel",4,5,0.55,2,0.4,0,false,"date",90)
            add("panel",4.55,5,1.95,0.5,0.6,0,false,"word")
            add("flap",4.55,5.5,1.95,1,0,5,false,"date",-25)
            add("panel",4.55,6.5,2.0,0.5,0.9,0,false,"month")
            add("panel",6.55,5.5,0.45,2.5,0.25,0,false,"year",90)
            add("panel",0,5.5,2,0.5,0.6,0,false,"venue")
            add("flap",0,6,2,1,0,5,false,"date",-45)
            add("disc",2.5,5.5,1,1,1.0,0,false,"word")
            add("flap",0,7,2,1,0,4,true,"title",25)
            add("panel",2,7,1,1,0.7,0,true,"word")
            add("recess",3,7,2,1,-1.1,0,true,"year")
            add("panel",5,7,1,1,0.2,0,false,"title",45)
            add("panel",0,8,0.5,2,0.2,0,false,"venue",-90)
            add("hole",0.5,8,2,2,0.6,0,false,"month",-90)
            add("flap",2.5,8,1,2,0,5,false,"word",-60)
            add("panel",3.5,8,2,0.5,0.45,0,false,"title")
            add("panel",4.5,8.5,1.5,0.5,0.8,0,false,"word")
            add("panel",3.5,9,2,1,0.25,0,false,"venue")
            add("panel",5.5,9,0.5,1,0.4,0,false,"month",-90)
            add("panel",6,8,1,1,0.2,0,false,"year",90)
            add("flap",6,9,1,1,0,4,false,"year",45)
        }else{
            var rng=SeededRandom(seed:seed ^ 0x5041504552464f4c)
            let rows=layout==1 ? 5:6,columns=layout==1 ? 3:4
            for row in 0..<rows {for col in 0..<columns {
                let index=row*columns+col,kind=["panel","flap","hole","panel","recess","disc"][(index+rng.int(6))%6]
                let w=7/Double(columns),h=10/Double(rows)
                let inset=layout==1 ? 0.08:0.13
                let x=Double(col)*w+inset,y=Double(row)*h+inset
                add(kind,x,y,w-inset*2,h-inset*2,kind=="recess" ? -1:rng.value(0.2,1.5),kind=="flap" ? 4+rng.int(2):rng.int(4),rng.unit()<0.28,["title","word","date","venue"][index%4],index%3==0 ? 90:0)
            }}
        }
        if layout==0,surfaces.count>3{surfaces[3].labelBounds=UnitBox(x:0.12,y:0.02,width:0.76,height:0.16)}
        return PaperReliefGenome(surfaces:surfaces,titleOverride:custom?.title)
    }
    public static func scene(_ preset:PosterShapePreset)throws->StyleGenome {
        try preset.relief?.validate();let values=try preset.recipe.values(preset.parameters)
        let choice=PosterShapeChoice(recipe:preset.recipe,parameters:values,compatibility:PosterShapeLibrary.fontCompatibility(preset.recipe,profile:nil),relief:preset.relief)
        var art=PosterShapeLibrary.element(choice,field:UnitBox(x:0.025,y:0.02,width:0.95,height:0.96),color:"#30343b",seed:preset.seed)
        let font=preset.fontProfileID.flatMap{FontLibrary.shared.profile($0)} ?? FontLibrary.shared.profile("archivo-Archivo-SemiBold-w400-d100") ?? PosterShapeLibrary.suggestedFonts(preset.recipe,limit:1).first?.0
        art.fontName=font?.postscriptName;art.fontVariations=font?.variations;art.fontProfileID=font?.id;art.fontAssetID=font?.assetID;art.fontAssetSHA256=font?.assetSHA256
        var scene=StyleGenome(version:"paper-relief-scene-v1",posterID:preset.recipe.id,aspect:1/preset.recipe.idealAspect,background:"#d9d8d4",font:font?.postscriptName ?? "HelveticaNeue",textScale:1,tracking:0,elements:[art],score:nil,fittingStatus:preset.recipe.basis,sourceEmbeddingModel:"paper-relief-vector-v1")
        resolve(in:&scene);scene.composition=CompositionPlan.scene(scene,origin:"paper-relief-composition");scene.composition?.description=preset.recipe.logic
        return scene
    }
    public static func resolve(in scene:inout StyleGenome) {
        let parents=scene.elements.filter{$0.shape==shape && $0.paperRelief != nil}
        guard !parents.isEmpty else{return}
        let ids=Set(parents.map(\.sourceElementID));scene.elements.removeAll{$0.paperAttachment.map{ids.contains($0.parentID)} ?? false}
        for parent in parents {
            guard let paper=parent.paperRelief else{continue}
            let title=paper.titleOverride ?? scene.posterCopy?.title.replacingOccurrences(of:"\n",with:" ") ?? "Paper relief"
            let words=title.split(separator:" ").map(String.init),density=parent.geometry?["labelDensity"] ?? 0.78
            let date=scene.contentBrief?.dateLabel ?? scene.posterCopy?.footer.components(separatedBy:"·").first?.trimmingCharacters(in:.whitespaces) ?? "STUDY 01"
            let year=date.range(of:"(?:19|20)[0-9]{2}",options:.regularExpression).map{String(date[$0])} ?? "2027"
            for (index,surface) in paper.surfaces.enumerated() {
                if surface.role=="none"{continue}
                let pick=Double((index*37+17)%101)/100
                guard pick<density else{continue}
                let content:String
                switch surface.role {
                case "word":content=words.isEmpty ? title:words[index%words.count]
                case "venue":content=scene.posterCopy?.institution.components(separatedBy:"·").first?.trimmingCharacters(in:.whitespaces) ?? "FORM LAB"
                case "date":content=date
                case "year":content=year
                case "month":content=scene.posterCopy?.subtitle.components(separatedBy:",").first ?? "Surface studies"
                default:content=title
                }
                let isVertical=surface.bounds.height>surface.bounds.width*1.5
                var local=UnitBox(x:0.1,y:0.40,width:0.80,height:0.18)
                if surface.kind=="flap"{local=UnitBox(x:0.12,y:0.56,width:0.55,height:0.16)}
                if surface.kind=="hole"{local=UnitBox(x:0.12,y:0.08,width:0.76,height:0.14)}
                if surface.kind=="disc"{local=UnitBox(x:0.14,y:0.40,width:0.72,height:0.18)}
                let rotation=(parent.geometry?["textFlow"] ?? 0)>0.5 ? 0:surface.labelRotation
                if abs(rotation)==90 {
                    local=isVertical ? UnitBox(x:0.15,y:0.10,width:0.70,height:0.80):UnitBox(x:0.40,y:0.15,width:0.20,height:0.70)
                    if surface.kind=="hole"{local=UnitBox(x:0.07,y:0.15,width:0.16,height:0.70)}
                }
                if let anchor=surface.labelBounds{local=anchor}
                let attachment=PaperSurfaceAttachment(parentID:parent.sourceElementID,surfaceID:surface.id,localBounds:local,rotation:rotation,role:surface.role)
                let bounds=PaperReliefGeometry.annotationBounds(surface,attachment:attachment,parent:parent,aspect:scene.aspect)
                var label=SceneElement(sourceElementID:parent.sourceElementID+":surface-text:"+surface.id,kind:"text",bounds:bounds,rotation:parent.rotation+rotation,text:content,color:surface.dark ? "#ededdf":"#242729",shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:parent.fontName ?? scene.font,textAlignment:"center")
                label.paperAttachment=attachment;label.fontVariations=parent.fontVariations;label.fontProfileID=parent.fontProfileID;label.fontAssetID=parent.fontAssetID;label.fontAssetSHA256=parent.fontAssetSHA256;label.zIndex=parent.zIndex;label.allowsBleed=true
                scene.elements.append(label)
            }
        }
    }
    public static func validate(_ scene:StyleGenome)throws {
        guard scene.elements.filter({$0.shape==shape}).allSatisfy({$0.paperRelief != nil}) else{throw PosterError.invalid("Paper parent is missing its surface genome.")}
        let parents=scene.elements.filter{$0.paperRelief != nil}
        for p in parents{guard p.shape==shape else{throw PosterError.invalid("Paper geometry requires a paper-relief parent.")};try p.paperRelief!.validate()}
        for e in scene.elements {
            guard let a=e.paperAttachment else{continue}
            guard a.localBounds.valid,a.rotation.isFinite,abs(a.rotation)<=360,parents.contains(where:{$0.sourceElementID==a.parentID && $0.paperRelief!.surfaces.contains{$0.id==a.surfaceID}}) else{throw PosterError.invalid("Orphan or invalid paper surface text.")}
        }
    }
}
