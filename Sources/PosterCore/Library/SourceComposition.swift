import Foundation
import CoreText

/// Recombines source traits by semantic roles rather than splicing unrelated OCR rectangles.
enum SourceComposition {
    static func make(_ a:PosterRecord,_ b:PosterRecord,category:String,seed:UInt64,copy:PosterCopy,id:String,fontProfileID:String?=nil,typeSystem:TypeSystemVariant?=nil,shapePreset:PosterShapePreset?=nil,palette:(background:String,foreground:String,accent:String)?=nil)->StyleGenome {
        SourceLayoutDNA.make(a,b,category:category,seed:seed,copy:copy,id:id,fontProfileID:fontProfileID,typeSystem:typeSystem,shapePreset:shapePreset,palette:palette)
    }

    static func recipe(_ genome:Genome,copy:PosterCopy)->StyleGenome {
        var scene=build(measured:[],total:Int(genome.density*60),marginHint:genome.scale*0.12,category:genome.renderStyle ?? "swiss",seed:genome.seed,copy:copy,id:"recipe-\(genome.seed)")
        if copy.briefID != nil{PosterShapeLibrary.upgradeLegacy(&scene,seed:genome.seed)}
        return scene
    }
    /// The direction's own forms without any type: the "image" of a source study.
    /// Legacy recipe shapes become shape-library recipes; recipe letters are dropped,
    /// so every word on the poster still comes from the brief.
    static func graphic(category:String,seed:UInt64,copy:PosterCopy,palette:(background:String,foreground:String,accent:String)?)->StyleGenome {
        var scene=build(measured:[],total:30,marginHint:0.1,category:category,seed:seed,copy:copy,id:"graphic-\(category)-\(seed)")
        scene.styleCategory=category
        scene.elements=scene.elements.filter{$0.kind=="shape" && $0.sourceElementID.hasPrefix("art:")}
        PosterShapeLibrary.upgradeLegacy(&scene,seed:seed)
        if let palette {
            for i in scene.elements.indices {
                let lab=PerceptualColor.fromHex(scene.elements[i].color)
                scene.elements[i].color=hypot(lab.a,lab.b)>0.06 ? (i%2==0 ? palette.accent:ImagePosterComposer.mix(palette.accent,palette.foreground,0.45)):palette.foreground
            }
            scene.background=palette.background
        }
        return scene
    }
    /// Display type reads upright and unmirrored, phrases keep natural proportions unless the
    /// direction distorts type, echoes stay at a few copies, and reductive directions set type solid.
    /// Applied before judging, so presence is measured on the type that is actually drawn.
    static func normalizeDisplay(_ input:StyleGenome,category:String)->StyleGenome {
        var scene=input
        let distorting=["kinetic","expressive","brutalist","typographic-collage"].contains(category)
        for i in scene.elements.indices where scene.elements[i].kind=="text" && scene.elements[i].sourceAnchor != nil {
            var e=scene.elements[i]
            if abs(e.rotation)>100 {e.rotation=e.rotation>0 ? e.rotation-180:e.rotation+180}
            if e.typeTransform?["scaleX"].map({$0<0})==true {e.typeTransform?["scaleX"]=1}
            // A phrase squeezed far from its natural proportions reads as one joined word;
            // fit it uniformly unless the direction distorts type on purpose.
            if e.preserveTypeProportions != true,let text=e.text,!text.isEmpty {
                let font=FontLibrary.font(name:e.fontName ?? scene.font,variations:e.fontVariations)
                let line=CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:[.font:font]))
                let glyphs=CTLineGetBoundsWithOptions(line,[.useGlyphPathBounds])
                if glyphs.width>0,glyphs.height>0 {
                    let stretch=(e.bounds.width/max(0.0001,e.bounds.height*scene.aspect))/(glyphs.width/glyphs.height)
                    let range=distorting ? 0.45...2.2:0.62...1.6
                    if !range.contains(stretch) {e.preserveTypeProportions=true;e.textTreatment="source-uniform-fit"}
                }
            }
            // Optical echoes stay readable with a few offset copies, not a solid stack.
            e.copies=min(e.copies,3)
            // Reductive directions set display type solid; hairline outlines vanish at poster distance.
            if ["minimal","swiss","editorial"].contains(category){e.outline=false}
            scene.elements[i]=e
        }
        return scene
    }
    /// Replaces the composed raster stand-in with the graphic's vector forms, mapped
    /// through the same frame and focal crop the composer chose for the raster.
    static func vectorize(_ composed:StyleGenome,graphic:StyleGenome)->StyleGenome {
        var scene=composed
        guard let index=scene.elements.firstIndex(where:{$0.kind=="image"}),let crop=scene.elements[index].rasterAsset?.crop else{return scene}
        let frame=scene.elements[index].bounds
        var paper=SceneElement(sourceElementID:"graphic:paper",kind:"shape",bounds:frame,rotation:0,text:nil,color:scene.background,shape:"rectangle",outline:false,shadow:false,offsetX:0,offsetY:0,copies:1)
        paper.zIndex = -100;paper.minimumStage=0
        var mapped=[paper]
        for (n,element) in graphic.elements.enumerated() {
            var e=element,b=element.bounds
            b = .init(x:frame.x+(b.x-crop.x)/crop.width*frame.width,y:frame.y+(b.y-crop.y)/crop.height*frame.height,width:b.width/crop.width*frame.width,height:b.height/crop.height*frame.height)
            e.bounds=b;e.clipBounds=frame;e.zIndex = -90+n;e.minimumStage=0
            mapped.append(e)
        }
        scene.elements.replaceSubrange(index...index,with:mapped)
        // Forms float on the page, so their frame is the page colour, not a visible panel.
        // Display type reads upright and unmirrored, as on a designed poster.
        scene=normalizeDisplay(scene,category:graphic.styleCategory ?? "")
        scene.imageInfluence?.operations.append("Vector forms of the \(graphic.styleCategory ?? "source") direction replace the measured stand-in raster in the same frame and crop.")
        return scene
    }
    private static func build(measured:[NamedSwatch],total:Int,marginHint:Double,category:String,seed:UInt64,copy:PosterCopy,id:String)->StyleGenome {
        var rng=SeededRandom(seed:seed),items:[SceneElement]=[]
        let variant=rng.int(category=="optical" ? 8:category=="typographic-collage" ? 6:4)
        let dark=["expressive","brutalist","typographic-collage"].contains(category) || (category=="kinetic" && variant>=2) || (category=="optical" && seed&1==0) || (category=="editorial" && variant>=2)
        let paper="#f2efe6",ink="#161817"
        var background=dark ? ink:paper,foreground=dark ? paper:ink
        let chromatic=measured.filter{$0.chroma>0.07 && $0.lightness>0.38 && $0.lightness<0.82}.sorted{$0.proportion>$1.proportion}
        let hue=chromatic.first?.hue ?? [25.0,145,265,70][rng.int(4)]
        func accent(_ h:Double,_ l:Double)->String {PerceptualColor.hex(.init(l:l,a:0.17*cos(h * .pi/180),b:0.17*sin(h * .pi/180))).0}
        let neutralOnly=chromatic.isEmpty && variant>=2
        let c1=neutralOnly ? foreground:accent(hue,0.61),c2=neutralOnly ? (dark ? "#b3b5ad":"#686c63"):accent((hue+135).truncatingRemainder(dividingBy:360),0.76)
        if category=="color-field" {background=accent(hue+30,0.84);foreground=ink}
        if category=="halftone" {background=variant%2==0 ? paper:accent(hue+25,0.89);foreground=ink}
        if category=="guilloche" {background="#f1e6d3";foreground=["#4b203a","#173e39","#272c5b","#292622"][variant]}
        let margin=0.058+min(0.025,marginHint*0.2)+rng.value(0,0.012),width=1-margin*2
        let phase=rng.value(-0.025,0.025)
        let displayFace=variant%2==0 ? "HelveticaNeue-Bold":"HelveticaNeue-CondensedBlack"
        let font=category=="expressive" ? "HelveticaNeue-CondensedBlack":rng.unit()<0.6 ? "HelveticaNeue-Bold":"HelveticaNeue-Medium"
        func text(_ role:String,_ value:String,_ x:Double,_ y:Double,_ w:Double,_ h:Double,_ color:String?=nil,_ rotation:Double=0,_ face:String?=nil,_ outline:Bool=false) {
            items.append(SceneElement(sourceElementID:role,kind:"text",bounds:.init(x:x,y:y,width:w,height:h),rotation:rotation,text:value,color:color ?? foreground,shape:"rectangle",outline:outline,shadow:false,offsetX:0,offsetY:0,copies:1,preserveTypeProportions:true,fontName:face=="HelveticaNeue-Bold" ? displayFace:face,textAlignment:role=="meta:edition" ? "right":role=="art:monogram" || role.hasPrefix("glyph:") || role.hasPrefix("art:disc-glyph") ? "center":"left",minimumStage:role.hasPrefix("ring:") ? 3:nil))
        }
        func shape(_ role:String,_ kind:String,_ x:Double,_ y:Double,_ w:Double,_ h:Double,_ color:String,_ rotation:Double=0,_ minimumStage:Int=0) {
            items.append(SceneElement(sourceElementID:role,kind:"shape",bounds:.init(x:x,y:y,width:w,height:h),rotation:rotation,text:nil,color:color,shape:kind,outline:false,shadow:false,offsetX:0,offsetY:0,copies:1,minimumStage:minimumStage))
        }
        let event=ContentBriefLibrary.brief(copy.briefID),year=ContentBriefLibrary.brief(copy.briefID).map{String($0.startDate.prefix(4))} ?? "2026"
        let title=copy.words.first ?? "VISUAL",second=copy.words.dropFirst().joined(separator:" ")
        text("meta:institution",copy.institution,margin,0.045,0.6,0.015,nil,0,"HelveticaNeue-Medium")
        text("meta:edition",event?.kind.uppercased() ?? "STUDIES / 2026",0.75,0.045,0.19,0.015,nil,0,"HelveticaNeue-Medium")
        switch category {
        case "kinetic":
            text("title:primary",title,margin,0.14,width,0.18,nil,-8+phase*60,"DINCondensed-Bold")
            let cut=second.count>9 ? second.index(second.startIndex,offsetBy:7):second.endIndex
            text("title:secondary",String(second[..<cut]),margin,0.435,width,0.155,nil,8-phase*40,"HelveticaNeue-CondensedBlack")
            if cut<second.endIndex {text("title:tertiary",String(second[cut...]),margin,0.70,width,0.16,dark ? c2:foreground,-7+phase*40,"HelveticaNeue-CondensedBlack")}
            text("meta:subtitle",copy.subtitle,margin,0.917,0.6,0.021,nil,0,"HelveticaNeue-Medium")
        case "color-field":
            let lower=variant>=2
            text("title:primary",title,margin,lower ? 0.73:0.13,width,0.105,nil,0,"HelveticaNeue-Bold")
            text("title:secondary",second,margin,lower ? 0.862:0.265,width,0.035,nil,0,"HelveticaNeue-Medium")
            shape("art:cut-paper-a","organic-blob",0.035,lower ? 0.10:0.34,0.77,0.42,accent(hue+170,0.50),-14)
            items[items.count-1].geometry=["phase":phase*60,"lobes":3,"amplitude":0.12];items[items.count-1].blendMode="multiply"
            shape("art:cut-paper-b","organic-blob",0.24,lower ? 0.30:0.52,0.73,0.37,accent(hue-20,0.62),18)
            items[items.count-1].geometry=["phase":1+phase*40,"lobes":4,"amplitude":0.10];items[items.count-1].blendMode="multiply"
            text("meta:subtitle",copy.subtitle,margin,0.917,0.6,0.021,nil,0,"HelveticaNeue-Medium")
        case "halftone":
            let lower=variant>=2
            text("title:primary",title,margin,lower ? 0.76:0.12,width,0.105,nil,0,"HelveticaNeue-Bold")
            text("title:secondary",second,margin,lower ? 0.88:0.253,width,lower ? 0.03:0.035,nil,0,"HelveticaNeue-Medium")
            shape("art:tonal-form",variant<2 ? "halftone-torus":"halftone-sphere",0.055,lower ? 0.12:0.30,0.89,0.89/1.414,ink,variant%2==0 ? -12:14)
            items[items.count-1].geometry=["grid":Double(46+total%19),"tilt":rng.value(0.65,1.25),"light":rng.value(-0.9,0.5)]
            text("meta:subtitle",copy.subtitle,margin,lower ? 0.932:0.917,0.6,lower ? 0.018:0.021,nil,0,"HelveticaNeue-Medium")
        case "guilloche":
            let lower=variant>=2
            text("title:primary",title.capitalized,margin,lower ? 0.73:0.115,width,0.12,nil,0,"Didot-Italic")
            text("title:secondary",second.capitalized,margin,lower ? 0.868:0.265,width,lower ? 0.038:0.052,nil,0,"Didot")
            shape("art:rosette","guilloche",0.075,lower ? 0.12:0.36,0.85,0.53,foreground,0)
            items[items.count-1].geometry=["lobes":Double(5+variant*2),"layers":Double(5+total%5),"phase":rng.value(-0.6,0.6),"lineWidth":0.0011]
            text("meta:subtitle",copy.subtitle,margin,0.917,0.6,0.021,nil,0,"Didot-Italic")
        case "bauhaus":
            shape("art:circle","ellipse",margin+0.01,0.18+phase,0.46,0.46/1.414,c1)
            shape("art:triangle","triangle",0.51,0.25-phase,0.35,0.38,c2,9)
            shape("art:bar","rectangle",0.14,0.58,0.73,0.038,ink,-9)
            shape("art:small-circle","ellipse",0.72,0.14,0.1,0.1/1.414,ink)
            text("title:primary",title,margin,0.72,width,0.095,nil,0,"HelveticaNeue-Bold")
            text("title:secondary",second,margin,0.842,width,0.040,nil,0,"HelveticaNeue-Medium")
            text("meta:subtitle",copy.subtitle,margin,0.908,0.48,0.018,nil,0,"HelveticaNeue-Medium")
        case "abstract":
            text("title:primary",title,margin,0.105,width,0.095,nil,0,"HelveticaNeue-Bold")
            text("title:secondary",second,margin,0.224,width,0.034,nil,0,"HelveticaNeue-Medium")
            shape("art:ribbon-a","ribbon",0.08,0.35+phase,0.80,0.30,c1,-16)
            shape("art:ribbon-b","ribbon",0.12,0.51-phase,0.79,0.29,c2,18)
            shape("art:dot","ellipse",0.7,0.29,0.12,0.12/1.414,ink)
            text("meta:subtitle",copy.subtitle,margin,0.91,0.6,0.022,nil,0,"HelveticaNeue-Medium")
        case "minimal":
            let letter=["V","C","D","I"][(total+variant)%4]
            text("art:monogram",letter,0.27+phase,0.29,0.46,0.30,ink,0,"HelveticaNeue-Bold")
            shape("art:accent","ellipse",0.61,0.53,0.085,0.085/1.414,c1)
            text("title:primary",title,margin,0.74,width,0.084,nil,0,"HelveticaNeue-Medium")
            text("title:secondary",second,margin,0.85,width,0.032,nil,0,"HelveticaNeue-Medium")
            text("meta:subtitle",copy.subtitle,margin,0.913,0.55,0.019,nil,0,"HelveticaNeue-Medium")
        case "swiss":
            text("title:primary",title,margin,0.145,width,0.13,nil,0,"HelveticaNeue-Bold")
            let cut=second.count>9 ? second.index(second.startIndex,offsetBy:7):second.endIndex
            text("title:secondary",String(second[..<cut]),margin,0.32,width,0.13,nil,0,"HelveticaNeue-Bold")
            if cut<second.endIndex{text("title:tertiary",String(second[cut...]),margin,0.495,width,0.13,nil,0,"HelveticaNeue-Bold")}
            shape("art:rule","rectangle",margin,0.69,width,0.005,c1)
            text("meta:subtitle",copy.subtitle,margin,0.74,0.4,0.025,nil,0,"HelveticaNeue-Medium")
            text("meta:label",copy.briefID==nil ? "FORM / TYPE / SYSTEM":copy.subtitle,margin+(width+0.025)/2,0.74,(width-0.025)/2,0.025,nil,0,"HelveticaNeue-Medium")
            text("meta:year",year,margin,0.84,0.25,0.055,c1,0,"HelveticaNeue-Bold")
            text("meta:location",copy.briefID==nil ? "INSTITUTE OF DESIGN":copy.institution,margin+(width+0.025)/2,0.84,(width-0.025)/2,0.035,nil,0,"HelveticaNeue-Medium")
        case "constructivist":
            text("title:primary",title,margin,0.13,width,0.12,nil,0,"HelveticaNeue-Bold")
            shape("art:circle","ellipse",0.43,0.34,0.43,0.43/1.414,c1)
            shape("art:diagonal","rectangle",0.13,0.52,0.76,0.055,ink,-23)
            shape("art:triangle","triangle",0.12,0.32,0.3,0.27,c2,10)
            text("title:secondary",second,margin,0.79,width,0.05,nil,0,"HelveticaNeue-Bold")
            text("meta:subtitle",copy.subtitle,margin,0.91,0.6,0.022,nil,0,"HelveticaNeue-Medium")
        case "editorial":
            if variant<2 {
                text("title:primary",title,margin,0.13,width,0.105,nil,0,"HelveticaNeue-Bold")
                text("title:secondary",second,margin,0.267,width,0.039,nil,0,"HelveticaNeue-Medium")
                shape("art:rule","rectangle",margin,0.35,width,0.003,ink)
                text("art:monogram","V",margin,0.41,0.4,0.31,ink,0,"HelveticaNeue-Bold")
                shape("art:circle","ellipse",0.54,0.43,0.36,0.36/1.414,c1)
                text("meta:subtitle",copy.subtitle,margin,0.81,0.42,0.026,nil,0,"HelveticaNeue-Medium")
                text("meta:year",year,0.55,0.81,0.35,0.05,c1,0,"HelveticaNeue-Medium")
            }else{
                text("meta:subtitle",copy.subtitle,margin,0.086,0.5,0.0145,nil,0,"HelveticaNeue-Medium")
                text("art:interlock-v","V",0.02+phase,0.15,0.82,0.59,paper,rng.value(-11,-4),"BodoniSvtyTwoITCTT-Bold")
                text("art:interlock-c","C",0.19+phase,0.235,0.77,0.52,c2,rng.value(6,13),"Didot-Italic")
                items[items.count-1].textTreatment="knockout-outline";items[items.count-1].outlineWidth=rng.value(0.75,1.2)
                text("title:primary",title,margin,0.85,width,0.055,paper,0,"HelveticaNeue-Medium")
                text("title:secondary",second,margin,0.922,width,0.024,paper,0,"HelveticaNeue-Medium")
            }
        case "optical":
            if variant>=4 {
                let slices=variant%2==0 ? 12:18,top=0.17,span=0.60
                let initial=variant<6 ? "V":"C",face=variant<6 ? "HelveticaNeue-CondensedBlack":"BodoniSvtyTwoITCTT-Bold"
                let amplitude=rng.value(0.025,0.065),frequency=rng.value(0.65,1.15)
                for i in 0..<slices {
                    let y=top+Double(i)*span/Double(slices),offset=sin(Double(i)/Double(slices)*Double.pi*2*frequency+phase*30)*amplitude
                    text("art:sliced-glyph-\(i)",initial,0.10+offset,top,0.80,span, i==slices/2 ? c1:foreground,0,face)
                    items[items.count-1].textAlignment="center"
                    items[items.count-1].clipBounds=UnitBox(x:0,y:y,width:1,height:span/Double(slices)*0.86)
                    items[items.count-1].minimumStage=i%3==0 ? 1:3
                }
                text("title:primary",title,margin,0.82,width,0.068,nil,0,"HelveticaNeue-Bold")
                text("title:secondary",second,margin,0.91,width,0.028,nil,0,"HelveticaNeue-Medium")
                text("meta:subtitle",copy.subtitle,margin,0.098,0.55,0.02,nil,0,"HelveticaNeue-Medium")
            }else if variant<2 {
                text("title:primary",title,margin,0.105,width,0.095,nil,0,"HelveticaNeue-Bold")
                text("title:secondary",second,margin,0.224,width,0.034,nil,0,"HelveticaNeue-Medium")
                for i in 0..<(10+variant) {
                    let diameter=0.78-Double(i)*0.051
                    shape("art:ring-\(i)","ellipse-outline",0.5-diameter/2+Double(i)*0.004,0.565-diameter/2/1.414,diameter,diameter/1.414,i%4==0 ? c1:foreground)
                }
                text("meta:subtitle",copy.subtitle,margin,0.91,0.6,0.022,nil,0,"HelveticaNeue-Medium")
            }else{
                shape("art:left-wave","crescent",0.005,0.17,0.24,0.66,foreground,-4)
                shape("art:right-wave","crescent",0.755,0.17,0.24,0.66,foreground,176)
                shape("art:bottom-wave","crescent",0.29,0.76,0.42,0.13,c1,95)
                text("title:primary",title,0.255,0.39,0.49,0.10,nil,0,"HelveticaNeue-Bold")
                text("title:secondary",second,0.255,0.522,0.49,0.032,nil,0,"HelveticaNeue-Medium")
                text("meta:subtitle",copy.subtitle,0.255,0.59,0.49,0.021,nil,0,"HelveticaNeue-Medium")
            }
        case "brutalist":
            text("title:primary",title,margin,0.13,width,0.13,paper,0,"HelveticaNeue-CondensedBlack")
            shape("art:title-band","rectangle",margin,0.32,width,0.08,c2)
            text("title:secondary",second,margin+0.02,0.342,width-0.04,0.034,ink,0,"HelveticaNeue-Bold")
            text("art:monogram","26",margin,0.48,width,0.31,paper,0,"HelveticaNeue-CondensedBlack")
            text("meta:subtitle",copy.subtitle,margin,0.91,0.6,0.022,paper,0,"HelveticaNeue-Medium")
        case "typographic-collage":
            text("title:primary",title,margin,0.105,width,0.105,paper,0,"HelveticaNeue-Bold")
            text("title:secondary",second,margin,0.235,width,0.035,paper,0,"HelveticaNeue-Medium")
            let gap=0.035,column=(width-gap)/2,left=margin,right=margin+column+gap
            if variant>=4 {
                let cell=(width-0.024)/3,diameter=cell*0.96,start=0.32
                for row in 0..<3 {for column in 0..<3 {
                    let index=row*3+column,x=left+Double(column)*(cell+0.012),y=start+Double(row)*0.195
                    let angle=Double((index+variant)%4)*90
                    if (row+column)%3==0 {
                        text("art:matrix-glyph-\(index)",["V","C","D"][row],x,y,diameter,diameter/1.414,variant%2==0 ? paper:c1,0,"HelveticaNeue-CondensedBlack")
                        items[items.count-1].textAlignment="center"
                    }else {
                        shape("art:matrix-form-\(index)",index%2==0 ? "quarter-disc":"quarter-ring",x,y,diameter,diameter/1.414,paper,angle)
                        shape("art:matrix-form-b-\(index)","quarter-ring",x,y,diameter,diameter/1.414,paper,angle+180,3)
                    }
                }}
            }else if variant<2 {
                shape("art:monogram-circle","ellipse-outline",left,0.34,column,column/1.414,paper)
                text("art:monogram",copy.initials.first ?? "V",left+0.055,0.367,column-0.11,0.20,paper,0,"HelveticaNeue-CondensedBlack")
                for i in 0..<4 {
                    let y=0.34+Double(i)*0.07
                    shape("art:capsule-\(i)","capsule-outline",right,y,column,0.057,paper)
                    text("wordmark:\(i)",(copy.briefID==nil ? [title,second,"INSTITUTE","OF DESIGN"]:[title,second,copy.institution,copy.subtitle])[i],right+0.025,y+0.009,column-0.05,0.038,paper,0,"HelveticaNeue-Medium")
                }
                shape("art:rule","rectangle",margin,0.655,width,0.003,paper)
                let cell=(width-0.04)/3
                for i in 0..<3 {
                    let x=margin+Double(i)*(cell+0.02),d=cell*0.92
                    shape("art:lower-ring-\(i)","ellipse-outline",x,0.72,d,d/1.414,paper)
                    text("glyph:lower-\(i)",["C","I","D"][i],x+0.04,0.75,d-0.08,0.12,paper,0,"HelveticaNeue-Medium")
                }
            }else{
                let cx=left+column/2,cy=0.485,radius=column*0.49
                let ring=Array(copy.briefID==nil ? "VISUAL COMMUNICATION / INSTITUTE OF DESIGN / ":copy.words.joined(separator:" ")+" / "+copy.subtitle+" / ")
                for (i,c) in ring.enumerated() {
                    let angle=Double(i)/Double(ring.count)*2*Double.pi-Double.pi/2
                    text("ring:collage-\(i)",String(c),cx+cos(angle)*radius-0.012,cy+sin(angle)*radius/1.414-0.012,0.024,0.024,paper,angle*180/Double.pi+90,"HelveticaNeue-Medium")
                }
                text("art:monogram","V",left+0.06,0.39,column-0.12,0.19,paper,0,"HelveticaNeue-CondensedBlack")
                for row in 0..<3 {
                    let copies=9+(total+row)%4,d=column*0.70,y=0.335+Double(row)*0.17
                    for step in 0..<copies {
                        shape("art:trail-\(row)-\(step)","disc",right+Double(step)*0.008,y,d,d/1.414,paper,0,step==copies-1 ? 0:3)
                    }
                    text("art:disc-glyph-\(row)",["C","I","D"][row],right+Double(copies-1)*0.008+d*0.2,y+0.025,d*0.6,0.13,ink,0,"HelveticaNeue-Bold")
                }
                for i in 0..<3 {
                    let y=0.69+Double(i)*0.062
                    shape("art:left-capsule-\(i)","capsule-outline",left,y,column,0.05,paper)
                    text("wordmark:left-\(i)",(copy.briefID==nil ? ["VISUAL","COMMUNICATION","DESIGN"]:[title,second,copy.subtitle])[i],left+0.02,y+0.01,column-0.04,0.028,paper,0,"HelveticaNeue-Medium")
                }
            }
            text("meta:subtitle",copy.subtitle,margin,0.922,0.6,0.019,paper,0,"HelveticaNeue-Medium")
        default:
            text("title:primary",title,margin,0.13,width,0.125,nil,-4,"HelveticaNeue-CondensedBlack")
            text("title:secondary",second,margin,0.30,width,0.046,c2,0,"HelveticaNeue-CondensedBlack")
            text("art:monogram","V",0.28+phase,0.425,0.5,0.355,paper,0,"HelveticaNeue-CondensedBlack",true)
            let ring=copy.briefID==nil ? "VISUAL COMMUNICATION / INSTITUTE OF DESIGN / ":copy.words.joined(separator:" ")+" / "+copy.subtitle+" / "
            let chars=Array(ring),radius=0.36
            for (i,char) in chars.enumerated() {
                let angle=Double(i)/Double(chars.count)*2*Double.pi-Double.pi/2
                let x=0.5+cos(angle)*radius,y=0.615+sin(angle)*radius/1.414
                text("ring:\(i)",String(char),x-0.014,y-0.014,0.028,0.028,c2,angle*180/Double.pi+90,"HelveticaNeue-Medium")
            }
            text("meta:subtitle",copy.subtitle,margin,0.91,0.6,0.023,nil,0,"HelveticaNeue-Medium")
        }
        if ["bauhaus","abstract","constructivist"].contains(category) && variant>=2 {
            for i in items.indices where items[i].sourceElementID.hasPrefix("art:") {
                items[i].bounds.x=1-items[i].bounds.x-items[i].bounds.width
                items[i].rotation = -items[i].rotation
            }
        }
        text("meta:footer",copy.footer,margin,0.966,width,0.0135,nil,0,"HelveticaNeue-Medium")
        var genome=StyleGenome(version:"semantic-source-layout-v10",posterID:id,aspect:1.414,background:background,font:font,textScale:1,tracking:0,elements:items,score:nil,fittingStatus:"Donor palette, density, rhythm and typographic scale recombined into semantic composition roles; natural font proportions retained.",sourceEmbeddingModel:"Apple-Vision-r2")
        genome.styleCategory=category;genome.layoutVariant=variant
        genome.posterCopy=copy;genome.contentBrief=event
        genome.composition=CompositionPlan.scene(genome,origin:"declared-semantic-crossover",style:category)
        let direction:String
        switch category {
        case "kinetic":direction="The headline itself becomes the graphic field: three monumental fragments follow alternating angled baselines. Supporting information stays horizontal and isolated, with no additional monogram or decorative motif."
        case "color-field":direction="Two smooth cut-paper silhouettes overlap in a saturated color field. Their declared multiply blend creates the third ink relationship; a restrained title block balances the organic masses."
        case "halftone":direction="A ray-marched three-dimensional torus or sphere is lit and translated into a physical vector dot screen. The dot grid develops across construction stages with a protected title block "+(variant>=2 ? "below":"above")+" the tonal form."
        case "guilloche":direction="A large italic serif title and a secondary serif line frame a closed hypotrochoid rosette. Layer count, lobe ratio, phase and physical pen width codify the ornamental graphic "+(variant>=2 ? "above":"beneath")+" the typography."
        case "bauhaus":direction="An asymmetric geometric field balances a large circle, a triangular mass and a linking diagonal bar. A strong title anchors the lower third; institutional copy aligns to the outer margin."
        case "abstract":direction="Two opposed curved ribbons create a central flowing figure. A small circular counterweight and a restrained two-ink palette connect the graphic field to a clear title block above."
        case "minimal":direction="A single oversized monogram and one accent dot occupy an otherwise open field. The lower title and supporting copy form a compact aligned block, preserving generous negative space."
        case "swiss":direction="A large three-line typographic stack establishes the dominant rhythm. Shared left alignment, a thin color rule and two supporting columns codify the information hierarchy."
        case "constructivist":direction="A diagonal bar links a circular and triangular mass into a directional central composition. Upper and lower title blocks bracket the field while supporting copy remains horizontal."
        case "editorial":direction=variant<2 ? "An upper display title leads into a two-column graphic field. A monogram and a circular image-equivalent balance the center, with aligned information blocks below.":"Two monumental initials interlock through a declared knockout-outline treatment. Natural serif curves form the graphic field; small institutional information above and a compact title below preserve the information hierarchy."
        case "optical":direction=variant>=4 ? "A monumental natural glyph is cut into evenly spaced horizontal strips. A seeded sinusoidal phase displaces the strips into a coherent optical silhouette; one accent strip and a protected lower title complete the system.":variant<2 ? "A concentric outline field produces optical rhythm beneath a separated title. Controlled shifts between rings give the graphic a directional center without disrupting the supporting copy.":"Opposing crescent fields frame a compact central title and subtitle. The curved edge masses create motion around a protected information space, with a smaller accent form providing a counterweight."
        case "brutalist":direction="A high-contrast oversized title and a hard color band establish the top hierarchy. A monumental year-mark acts as the central graphic, balanced by small restrained supporting copy."
        case "typographic-collage":direction=variant>=4 ? "A three-by-three counterform matrix repeats quarter-discs, annular quadrants and natural glyphs. A common physical module and quarter-turn grammar bind the form field beneath an aligned wordmark.":"A dominant upper wordmark leads into a two-column monogram-and-capsule system. A dividing rule and three lower circular modules create a repeated typographic grammar, with all label alignment and type proportions explicitly preserved."
        default:direction="An angled heavy title contrasts with a circular text ring and a large outlined monogram. Bright secondary type separates the information hierarchy from the intentionally layered graphic lettering."
        }
        genome.composition?.description=direction+" Layout variant \(variant); \(items.count) declared regions. Donor colors, margins and density are constrained by this role graph."

        return genome
    }
    static func cross(_ a:StyleGenome,_ b:StyleGenome,seed:UInt64,id:String)->StyleGenome {
        if a.layoutInheritance != nil || b.layoutInheritance != nil {
            return SourceLayoutDNA.cross(a,b,seed:seed,id:id)
        }
        var rng=SeededRandom(seed:seed),child=rng.unit()<0.5 ? a:b
        let other=child.posterID==a.posterID ? b:a
        let t=rng.value(0.15,0.4)
        for i in child.elements.indices where child.layoutVariant==other.layoutVariant {
            let item=child.elements[i]
            guard let match=other.elements.first(where:{$0.sourceElementID==item.sourceElementID && $0.kind==item.kind}) else{continue}
            // Move a semantic role together, instead of accumulating duplicate OCR fragments.
            let x=item.bounds.x*(1-t)+match.bounds.x*t,y=item.bounds.y*(1-t)+match.bounds.y*t
            let w=item.bounds.width*(1-t)+match.bounds.width*t,h=item.bounds.height*(1-t)+match.bounds.height*t
            child.elements[i].bounds=UnitBox(x:x,y:y,width:w,height:h)
            child.elements[i].rotation=item.rotation*(1-t)+match.rotation*t
        }
        let description=child.composition?.description
        let inherited=(a.composition?.constraints ?? [])+(b.composition?.constraints ?? [])
        child.posterID=id;child.composition=CompositionPlan.scene(child,origin:"declared-semantic-crossover",style:child.styleCategory)
        if let description{child.composition?.description=description}
        for rule in inherited where rule.type=="donor-traits" {
            if !(child.composition?.constraints.contains{$0.type==rule.type && $0.targets==rule.targets} ?? false){child.composition?.constraints.append(rule)}
        }
        return child
    }
    static func geometryScores(_ genome:StyleGenome)->[String:Double] {
        let text=genome.elements.filter{$0.kind=="text" && !$0.sourceElementID.hasPrefix("ring:") && !$0.sourceElementID.hasPrefix("art:")}
        var overlap=0.0
        for i in text.indices {for j in text.indices where i<j {let a=text[i].bounds,b=text[j].bounds;let r=a.rect.intersection(b.rect);if !r.isNull{overlap+=r.width*r.height/max(0.0001,min(a.area,b.area))}}}
        let body=text.filter{$0.sourceElementID.hasPrefix("meta:")}
        let minHeight=body.map(\.bounds.height).min() ?? 0
        let titles=text.filter{$0.sourceElementID.hasPrefix("title:")}
        let titleArea=titles.map(\.bounds.area).max() ?? 0
        return ["Spacing":exp(-overlap*2),"Hierarchy":min(1,titleArea/max(0.001,body.map(\.bounds.area).max() ?? 0.001)/5),"Legibility":min(1,minHeight/0.013)]
    }
}
