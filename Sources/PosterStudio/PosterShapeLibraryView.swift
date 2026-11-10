import SwiftUI
import PosterCore
import UniformTypeIdentifiers

struct PosterShapeLibraryView:View {
    let initialPreset:PosterShapePreset?
    let initialFontID:String?
    let choose:(PosterShapePreset?)->Void
    @Environment(\.dismiss) private var dismiss
    @State private var selection=""
    @State private var search=""
    @State private var loadedRecipe:PosterShapeRecipe?
    @State private var parameters:[String:Double]=[:]
    @State private var seed="817"
    @State private var fontID=""
    @State private var pairing=true
    @State private var dominant=false
    @State private var objectCount=1
    @State private var depth="weave"
    @State private var framing="span"
    @State private var objectScale=1.0
    @State private var objectX=0.0
    @State private var objectY=0.0
    @State private var crossing=0.16
    @State private var displacement=0.0
    @State private var secondShape="poster-loop"
    @State private var reveal=0.04
    @State private var placementMode="anchored"
    @State private var contrastMode="auto"
    @State private var showAnchors=false
    @State private var inks:[String]=[]
    @State private var paper:String?
    @State private var preview:NSImage?
    @State private var reliefTitle=""
    @State private var reliefSurfaces:[PaperReliefSurface]?
    @State private var fallingTitle=""
    @State private var contourText=""
    @State private var contourInk=""
    @State private var contourOutline:ContourOutline?
    @State private var error:String?
    @State private var packEdits:[CirclePackEdits.Item]=[]
    @State private var packTool="circle"
    @State private var packSize=0.12
    @State private var packLetter="A"
    @State private var packShapes:[CirclePackShape]=[]
    @State private var packFrame:PackFrame?
    @State private var packDrag:Int?
    @State private var packGesture=false
    @State private var packSelected:Int?
    private var isPack:Bool{recipe?.id=="survey-circle-pack" && !dominant}
    private var recipe:PosterShapeRecipe?{loadedRecipe?.id==selection ? loadedRecipe:PosterShapeLibrary.recipe(selection)}
    private var filtered:[PosterShapeRecipe]{PosterShapeLibrary.recipes.filter{(!dominant || DominantShapeSystem.recipeIDs.contains($0.id)) && (search.isEmpty || ($0.name+" "+$0.group+" "+$0.tags.joined(separator:" ")).localizedCaseInsensitiveContains(search))}}
    private var key:String {
        let values=parameters.sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined()
        let controls=[String(dominant),String(objectCount),depth,framing,String(objectScale),String(objectX),String(objectY),String(crossing),String(displacement),String(reveal),secondShape,placementMode,contrastMode,String(showAnchors),inks.joined(separator:","),paper ?? ""].joined(separator:"|")
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        let outlineKey=(try? encoder.encode(contourOutline)).map{LibraryRaster.hash($0)} ?? ""
        return [selection,seed,fontID,String(pairing),values,controls,contourText,contourInk,outlineKey,reliefTitle,(try? encoder.encode(reliefSurfaces)).map{LibraryRaster.hash($0)} ?? "",fallingTitle,(try? encoder.encode(packEdits)).map{LibraryRaster.hash($0)} ?? ""].joined(separator:"|")
    }
    private func preset()throws->PosterShapePreset {
        guard let recipe,let number=UInt64(seed) else{throw PosterError.invalid("Enter an unsigned integer seed.")}
        _ = try recipe.values(parameters)
        var p=PosterShapePreset(recipe:recipe,seed:number,parameters:parameters,fontProfileID:fontID.isEmpty ? nil:fontID)
        p.placement=TypePlacementSettings(mode:placementMode,contrast:contrastMode)
        if !inks.isEmpty{p.inks=inks}
        p.paper=paper
        if ContourSystems.isContour(recipe.renderer),!contourText.isEmpty || !contourInk.isEmpty || contourOutline != nil {
            p.contour=ContourCustomization(text:contourText.isEmpty ? nil:contourText,outline:contourOutline,secondaryInk:contourInk.isEmpty ? nil:contourInk)
            try p.contour?.validate()
        }
        if recipe.renderer==PaperReliefSystems.shape{p.relief=PaperReliefCustomization(title:reliefTitle.isEmpty ? nil:reliefTitle,surfaces:reliefSurfaces);try p.relief?.validate()}
        if recipe.renderer==GravityTypeSystems.shape,!fallingTitle.isEmpty{p.physics=GravityTypeCustomization(title:fallingTitle);try p.physics?.validate()}
        if recipe.id=="survey-circle-pack",!packEdits.isEmpty{p.circlePack=CirclePackEdits(items:packEdits);try p.circlePack?.validate()}
        if dominant{var d=DominantShapeSettings();d.count=objectCount;d.depth=depth;d.framing=framing;d.scale=objectScale;d.offsetX=objectX;d.offsetY=objectY;d.crossing=crossing;d.displacement=displacement;d.secondRecipeID=secondShape;d.reveal=reveal;p.dominant=d}
        return p
    }
    var body:some View {
        VStack(spacing:0) {
            HStack {VStack(alignment:.leading,spacing:4){Text("Shape library").font(.title2.bold());Text("\(PosterShapeLibrary.recipes.count) reusable recipes · whole-poster gestures, solid forms and volumes").font(.caption).foregroundStyle(.secondary)};Spacer();Button("Done"){dismiss()}.keyboardShortcut(.cancelAction)}.padding(20)
            Divider()
            HSplitView {sidebar;canvas;editor}
            Divider()
            HStack {
                Button("Open preset…"){open()};Button("Save preset…"){save()};Button("Export PDF…"){export()}
                Spacer();Button("Automatic matching"){choose(nil);dismiss()}
                Button(dominant ? "Use poster system":"Use in image areas"){do{choose(try preset());dismiss()}catch{self.error=error.localizedDescription}}.buttonStyle(.borderedProminent).disabled(preview==nil)
            }.padding(16)
        }.frame(minWidth:1100,minHeight:740)
        .onChange(of:dominant){if dominant{search="";if !DominantShapeSystem.recipeIDs.contains(selection){select("poster-helix")}}}
        .onAppear{if let initialPreset{load(initialPreset)}else{fontID=initialFontID ?? "";select(PosterShapeLibrary.recipes.first?.id ?? "")}}
        .task(id:key){do{try await Task.sleep(for:.milliseconds(isPack ? 8:100));try Task.checkCancellation();let request=try preset(),paired=pairing
            // Scene construction can run a physics simulation; keep it off the main thread.
            let scene=try await Task.detached(priority:.userInitiated){try PosterShapeLibrary.scene(request,pairing:paired)}.value;try Task.checkCancellation()
            if let element=scene.elements.first(where:{$0.shape==CirclePackGeometry.shape}) {
                let shapes=await Task.detached(priority:.userInitiated){CirclePackGeometry.shapes(element,aspect:scene.aspect)}.value;try Task.checkCancellation()
                packShapes=shapes;packFrame=PackFrame(bounds:element.bounds,aspect:scene.aspect)
            }else{packShapes=[];packFrame=nil}
            let image=showAnchors ? try ShapeTypePlacement.anchorOverlay(scene,width:680):try LibrarySceneRenderer.render(scene,width:680);try Task.checkCancellation();preview=NSImage(cgImage:image,size:.zero);error=nil}catch is CancellationError{}catch{preview=nil;self.error=error.localizedDescription}}
    }
    private var sidebar:some View {
        VStack(spacing:8){TextField("Search shapes or tags",text:$search).textFieldStyle(.roundedBorder).padding(12)
            List(selection:Binding<String?>(get:{selection},set:{if let id=$0{select(id)}})) {
                ForEach(Array(Set(filtered.map(\.group))).sorted(),id:\.self){group in Section(group){ForEach(filtered.filter{$0.group==group}){r in VStack(alignment:.leading,spacing:3){Text(r.name);Text(r.tags.prefix(3).joined(separator:" · ")).font(.caption2).foregroundStyle(.secondary)}.padding(.vertical,3).tag(r.id)}}}
            }
            Text("Shapes retain their rules, parameters and seed. No source crops.").font(.caption2).foregroundStyle(.secondary).padding(12)
        }.frame(minWidth:215,idealWidth:240,maxWidth:280)
    }
    private var canvas:some View {
        VStack(spacing:12){if !dominant && recipe?.renderer != PaperReliefSystems.shape && recipe?.renderer != GravityTypeSystems.shape{Picker("Preview",selection:$pairing){Text("Shape").tag(false);Text("With type").tag(true)}.pickerStyle(.segmented).frame(width:210)}else{Text(recipe?.renderer==PaperReliefSystems.shape ? "Paper surfaces + attached type":recipe?.renderer==GravityTypeSystems.shape ? "Simulated letters + supporting copy":"Whole-poster composition").font(.caption).foregroundStyle(.secondary)}
            ZStack{Color(nsColor:.underPageBackgroundColor);if let preview{Image(nsImage:preview).resizable().scaledToFit().overlay{if isPack,let frame=packFrame{GeometryReader{g in packOverlay(frame,size:g.size)}}}.padding(22)}else{Text(error ?? "Drawing shape…").foregroundStyle(.secondary).padding()}}.clipShape(RoundedRectangle(cornerRadius:8))
            if let error{Text(error).foregroundStyle(.red).font(.caption)}
            Text(dominant ? "One or two logical objects. Zoom and crop their envelopes, weave across type, or push display blocks away from the shape.":"Pinned shapes occupy suitable image areas in inherited layouts. Type-only layouts keep their composition.").font(.caption).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
        }.padding(18).frame(minWidth:350,maxWidth:.infinity,maxHeight:.infinity)
    }
    private var editor:some View {
        ScrollView{VStack(alignment:.leading,spacing:18){if let recipe{
            posterControls
            Text(recipe.name).font(.title3.bold());Text(recipe.logic).font(.callout)
            if let looks=recipe.looks,!looks.isEmpty{lookControls(recipe,looks)}
            if isPack{packControls}
            if ContourSystems.isContour(recipe.renderer){contourControls}
            if recipe.renderer==PaperReliefSystems.shape{TextField("Surface title (optional)",text:$reliefTitle).textFieldStyle(.roundedBorder).accessibilityLabel("Paper surface title");Text("Blank follows the poster brief. Labels are attached to panels and folds, with real cutout clipping and layer occlusion.").font(.caption2).foregroundStyle(.secondary)}
            if recipe.renderer==GravityTypeSystems.shape{TextField("Falling title (optional)",text:$fallingTitle,axis:.vertical).lineLimit(1...4).textFieldStyle(.roundedBorder).accessibilityLabel("Falling title");Text("Blank follows the poster brief. ⌥Return starts a new line. Seed chooses which letters fall and how they tumble; raising “Letters that fall” adds letters without changing the others. Lower “Moment shown” to catch letters mid-fall.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)}
            HStack{TextField("Seed",text:$seed).textFieldStyle(.roundedBorder);Button("Next"){if let n=UInt64(seed){seed=String(n &+ 1)}}}.accessibilityElement(children:.contain)
            Text("Seed controls stochastic arrangements, including arc tiles, shards and radial cell mosaics.").font(.caption2).foregroundStyle(.secondary)
            ForEach(recipe.parameters){p in VStack(alignment:.leading,spacing:4){HStack{Text(p.label);Spacer();Text((parameters[p.id] ?? p.value).formatted(.number.precision(.fractionLength(p.step>=1 ? 0:3)))).monospacedDigit().foregroundStyle(.secondary)}.font(.caption)
                Slider(value:Binding(get:{parameters[p.id] ?? p.value},set:{parameters[p.id]=$0}),in:p.min...p.max,step:p.step).accessibilityLabel(p.label).disabled(!parameterActive(p))
            }}
            Button("Reset parameters"){parameters=(try? recipe.values()) ?? [:]}
            if let canonical=recipe.inks{inkControls(canonical)}
            placementControls
            Divider();Text("Font pairing").font(.headline)
            Picker("Font",selection:$fontID){Text("Suggested automatically").tag("");ForEach(FontLibrary.shared.profiles){p in Text(p.label).tag(p.id)}}.labelsHidden()
            Text("Suggested families").font(.caption).foregroundStyle(.secondary)
            ForEach(PosterShapeLibrary.suggestedFonts(recipe),id:\.0.id){p,score in Button{fontID=p.id}label:{HStack{Text(p.family);Spacer();Text("\(Int(score*100))%").monospacedDigit()}}.buttonStyle(.plain).padding(.vertical,2)}
            Text("Pairing scores are authored preferences for weight, width, serif and rhythm. They are starting points for the jury.").font(.caption2).foregroundStyle(.secondary)
            if let profile=FontLibrary.shared.profile(fontID){let match=PosterShapeLibrary.fontCompatibility(recipe,profile:profile);Text("Current pairing: \(Int(match.score*100))%").font(.caption.bold());Text(match.reasons.joined(separator:" ")).font(.caption).foregroundStyle(.secondary)}
            DisclosureGroup("Tags and reference evidence") {Text(recipe.tags.joined(separator:", ")).font(.caption);Text(recipe.basis).font(.caption2);ForEach(Array(recipe.references.enumerated()),id:\.offset){_,ref in Text(ref.queryID+" · "+ref.posterID).font(.caption2).textSelection(.enabled)};Text("References include semantic retrievals and visually reviewed SAM masks. Each recipe states which relationships its geometry reconstructs.").font(.caption2).foregroundStyle(.secondary)}
        }}.padding(18)}.frame(minWidth:270,idealWidth:300,maxWidth:340)
    }
    private func lookControls(_ recipe:PosterShapeRecipe,_ looks:[PosterShapeLook])->some View {
        VStack(alignment:.leading,spacing:8){Text("Looks").font(.headline)
            LazyVGrid(columns:[GridItem(.adaptive(minimum:118),spacing:6)],alignment:.leading,spacing:6){ForEach(looks){look in Button(look.name){apply(look,to:recipe)}.buttonStyle(.bordered).controlSize(.small).help(look.name==looks.first?.name ? "Matches the source poster":"Sets every parameter and the inks")}}
            Text("A look sets every parameter and the inks; adjust from there. The first look follows the source.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
            if let paper{HStack{Text("Specimen paper \(paper) from the look; posters keep their own paper.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true);Button("Light paper"){self.paper=nil}.controlSize(.small)}}
        }
    }
    private func apply(_ look:PosterShapeLook,to recipe:PosterShapeRecipe){do{parameters=try recipe.values(look.parameters);inks=look.inks ?? [];paper=look.paper;error=nil}catch{self.error=error.localizedDescription}}
    private var posterControls:some View {
        VStack(alignment:.leading,spacing:12) {
            Toggle("Whole-poster system",isOn:$dominant).disabled(recipe?.renderer==PaperReliefSystems.shape || recipe?.renderer==GravityTypeSystems.shape)
            if dominant {
                Text("Inspired by L Viscosi: a large object sets the spatial rules for the entire paper.").font(.caption).foregroundStyle(.secondary)
                Picker("Objects",selection:$objectCount){Text("One").tag(1);Text("Two").tag(2)}.pickerStyle(.segmented)
                Picker("Framing",selection:$framing){Text("Full-page span").tag("span");Text("Extreme zoom").tag("zoom");Text("Offset crop").tag("offset");Text("Edge fragment").tag("edge");Text("Corner fragment").tag("corner")}
                Picker("Text crossing",selection:$depth){Text("Behind").tag("behind");Text("In front").tag("front");Text("Weave behind / above").tag("weave")}
                if objectCount==2 {Picker("Second shape",selection:$secondShape){ForEach(DominantShapeSystem.recipeIDs,id:\.self){id in Text(PosterShapeLibrary.recipe(id)?.name ?? id).tag(id)}}}
                if framing=="edge" || framing=="corner"{shapeControl("Visible shape amount",value:$reveal,range:0.002...0.35)}
                shapeControl("Object zoom",value:$objectScale,range:0.65...3)
                shapeControl("Horizontal offset",value:$objectX,range:-2...2)
                shapeControl("Vertical offset",value:$objectY,range:-2...2)
                if depth=="weave"{shapeControl("Crossing window",value:$crossing,range:0.04...0.5)}
                shapeControl("Push nearby type",value:$displacement,range:0...1)
                Text("Displacement moves display blocks within the paper; original anchors and actual offsets are saved. Supporting information stays protected.").font(.caption2).foregroundStyle(.secondary)
                Divider()
            }
        }
    }
    private func inkControls(_ canonical:[String])->some View {
        VStack(alignment:.leading,spacing:8) {
            Divider();Text("Inks").font(.headline)
            Toggle("Custom inks",isOn:Binding(get:{!inks.isEmpty},set:{inks=$0 ? canonical:[]}))
            ForEach(inks.indices,id:\.self){i in
                ColorPicker(i==0 ? "Shape ink":"Ink \(i+1)",selection:Binding(get:{let value=Int(inks[i].dropFirst(),radix:16) ?? 0;return Color(red:Double((value>>16)&255)/255,green:Double((value>>8)&255)/255,blue:Double(value&255)/255)},set:{color in if let rgb=NSColor(color).usingColorSpace(.sRGB),i<inks.count{inks[i]=String(format:"#%02x%02x%02x",Int((rgb.redComponent*255).rounded()),Int((rgb.greenComponent*255).rounded()),Int((rgb.blueComponent*255).rounded()))}}),supportsOpacity:false)
            }
            Text(inks.isEmpty ? "The specimen shows the source inks. In posters, inks keep the source's colour relationships and turn toward the layout's shape colour.":"These inks are used as they are, in every poster that uses this preset.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
        }
    }
    private var placementControls:some View {
        VStack(alignment:.leading,spacing:10) {
            Divider();Text("Type placement").font(.headline)
            Picker("Placement",selection:$placementMode){Text("Anchored").tag("anchored");Text("Title + info").tag("mixed");Text("Free").tag("free")}.pickerStyle(.segmented).labelsHidden().accessibilityLabel("Type placement")
            Text(placementMode=="anchored" ? "Every text block moves to a place the shape defines. Repeated words collapse into the anchored ones.":placementMode=="mixed" ? "The headline and information move to anchors; other type stays where the layout put it.":"Type stays where the layout put it. Anchors are still measured, so you can compare.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
            Picker("Overlap contrast",selection:$contrastMode){Text("No contrast change").tag("off");Text("Recolor type on the shape").tag("auto");Text("Interlock through the shape").tag("interlock")}
            Text("Where type crosses ink of a similar color, the crossing part is repainted in the most legible palette color. Interlock also cuts through shapes drawn above the type.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
            Toggle("Show anchors",isOn:$showAnchors)
            if !dominant && !pairing{Text("Switch the preview to “With type” to see placement.").font(.caption2).foregroundStyle(.secondary)}
        }
    }
    private func shapeControl(_ name:String,value:Binding<Double>,range:ClosedRange<Double>)->some View {
        VStack(alignment:.leading,spacing:3){HStack{Text(name);Spacer();Text(value.wrappedValue.formatted(.number.precision(.fractionLength(name=="Visible shape amount" ? 3:2)))).monospacedDigit()}.font(.caption);Slider(value:value,in:range,step:0.01).accessibilityLabel(name)}
    }
    private func parameterActive(_ p:PosterShapeParameter)->Bool {
        guard p.isActive(in:parameters) else{return false}
        // Imported silhouettes keep the profile composition; only the profile's own neck lean stops applying.
        if contourOutline != nil,["construction","layout","tracking","stretch","lean"].contains(p.id){return false}
        if recipe?.renderer==ContourSystems.typeShape {
            if p.id=="construction"{return (parameters["layout"] ?? 0) != 1 && (contourText.isEmpty || contourText.uppercased()=="RKC")}
            if ["tracking","stretch"].contains(p.id),(parameters["layout"] ?? 0)==1{return false}
        }
        return true
    }
    private var contourControls:some View {
        VStack(alignment:.leading,spacing:10){
            if recipe?.renderer==ContourSystems.typeShape {
                TextField("Letters / word (optional)",text:$contourText,axis:.vertical).lineLimit(1...4).textFieldStyle(.roundedBorder).accessibilityLabel("Contour letters")
                Text("Blank uses RKC in the specimen and the actual title, with its line breaks, in generated posters. Reference construction applies only to RKC. Other titles keep whole-word lines; ⌥Return starts your own line, which word, single-line and letter-grid layouts all follow.").font(.caption2).foregroundStyle(.secondary)
            }
            Toggle("Alternate channel color",isOn:Binding(get:{!contourInk.isEmpty},set:{contourInk=$0 ? "#efa78b":""}))
            if !contourInk.isEmpty {
                ColorPicker("Second ink",selection:Binding(get:{let value=Int(contourInk.dropFirst(),radix:16) ?? 0;return Color(red:Double((value>>16)&255)/255,green:Double((value>>8)&255)/255,blue:Double(value&255)/255)},set:{color in if let rgb=NSColor(color).usingColorSpace(.sRGB){contourInk=String(format:"#%02x%02x%02x",Int((rgb.redComponent*255).rounded()),Int((rgb.greenComponent*255).rounded()),Int((rgb.blueComponent*255).rounded()))}}),supportsOpacity:false)
            }
            HStack{Button("Import outline…"){importContourOutline()};if contourOutline != nil{Button("Use reference outline"){contourOutline=nil}}}
            Text("SVG paths, polygons, rectangles, circles and ellipses, or a saved outline JSON. Fill rule and curves are kept; strokes and text are not traced.").font(.caption2).foregroundStyle(.secondary)
            if let outline=contourOutline{Text("Saved custom outline · \(outline.commands.count) vector commands · \(outline.fillRule ?? "evenodd") fill").font(.caption2).foregroundStyle(.secondary)}
        }
    }
    private func importContourOutline(){let panel=NSOpenPanel();panel.allowedContentTypes=[.svg,.json];guard panel.runModal() == .OK,let url=panel.url else{return};do{contourOutline=try ContourOutline.load(from:url)}catch{self.error=error.localizedDescription}}
    private func select(_ id:String){loadedRecipe=nil;selection=id;packEdits=[];packSelected=nil;parameters=(try? recipe?.values()) ?? [:];contourText="";contourInk="";contourOutline=nil;reliefTitle="";reliefSurfaces=nil;fallingTitle="";inks=[];paper=nil}
    private func load(_ p:PosterShapePreset){do{guard PosterShapeLibrary.recipe(p.recipe.id) != nil else{throw PosterError.invalid("Unknown recipe.")};let values=try p.recipe.values(p.parameters);_ = try PosterShapeLibrary.scene(p);loadedRecipe=p.recipe;selection=p.recipe.id;parameters=values;seed=String(p.seed);fontID=p.fontProfileID ?? "";contourText=p.contour?.text ?? "";contourInk=p.contour?.secondaryInk ?? "";contourOutline=p.contour?.outline;reliefTitle=p.relief?.title ?? "";reliefSurfaces=p.relief?.surfaces;fallingTitle=p.physics?.title ?? "";paper=p.paper;packEdits=p.circlePack?.items ?? [];packSelected=nil
        // Presets saved before type placement existed replay unchanged as free, uncontrasted type.
        placementMode=p.placement?.mode ?? "free";contrastMode=p.placement?.contrast ?? "off";inks=p.inks ?? []
        if let d=p.dominant{dominant=true;objectCount=d.count;depth=d.depth;framing=d.framing;objectScale=d.scale;objectX=d.offsetX;objectY=d.offsetY;crossing=d.crossing;displacement=d.displacement;secondShape=d.secondRecipeID ?? "poster-loop";reveal=d.reveal ?? 0.04}else{dominant=false}
        }catch{self.error=error.localizedDescription}}
    private func open(){let panel=NSOpenPanel();panel.allowedContentTypes=[.json];guard panel.runModal() == .OK,let url=panel.url else{return};do{load(try JSONDecoder().decode(PosterShapePreset.self,from:Data(contentsOf:url)))}catch{self.error=error.localizedDescription}}
    private func save(){let panel=NSSavePanel();panel.allowedContentTypes=[.json];panel.nameFieldStringValue=selection+"-preset.json";guard panel.runModal() == .OK,let url=panel.url else{return};do{try LibraryRaster.write(preset(),to:url)}catch{self.error=error.localizedDescription}}
    private func export(){let panel=NSSavePanel();panel.allowedContentTypes=[.pdf];panel.nameFieldStringValue=selection+".pdf";guard panel.runModal() == .OK,let url=panel.url else{return};do{try LibrarySceneRenderer.pdf(PosterShapeLibrary.scene(preset(),pairing:pairing),to:url)}catch{self.error=error.localizedDescription}}

    // MARK: Circle packing editor

    private var packControls:some View {
        VStack(alignment:.leading,spacing:8){Text("Place shapes").font(.headline)
            Picker("Tool",selection:$packTool){Text("Circle").tag("circle");Text("Letter").tag("letter");Text("Remove").tag("remove");Text("Move").tag("move")}.pickerStyle(.segmented).labelsHidden().accessibilityLabel("Packing tool")
            if packTool=="letter"{TextField("Letter",text:Binding(get:{packLetter},set:{packLetter=String($0.trimmingCharacters(in:.whitespaces).suffix(1))})).textFieldStyle(.roundedBorder).frame(width:60).accessibilityLabel("Letter to place")}
            shapeControl(packSelected==nil ? "New shape size":"Selected shape size",value:Binding(get:{packSelected.flatMap{packEdits.indices.contains($0) ? packEdits[$0].r:nil} ?? packSize},set:{if let i=packSelected,packEdits.indices.contains(i){packEdits[i].r=$0}else{packSize=$0}}),range:0.02...0.6)
            if packSelected != nil && packEdits.indices.contains(packSelected!) && packEdits[packSelected!].kind == .letter{shapeControl("Selected letter turn",value:Binding(get:{packEdits[packSelected!].turn ?? 0},set:{packEdits[packSelected!].turn=$0}),range:-180...180)}
            HStack{Text("\(packEdits.filter{$0.kind != .void}.count) placed · \(packEdits.filter{$0.kind == .void}.count) removed").font(.caption).foregroundStyle(.secondary);Spacer();if packSelected != nil{Button("Deselect"){packSelected=nil}.controlSize(.small)};Button("Clear"){packEdits=[];packSelected=nil}.controlSize(.small).disabled(packEdits.isEmpty)}
            Text("Click the preview to add a circle or letter, or to remove a shape: the rest repack around it. Drag any shape in Move to pin it somewhere else. Removed packed shapes leave their space empty; removing a placed shape deletes it. Placed shapes are saved with the preset.").font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
        }
    }
    private func packOverlay(_ frame:PackFrame,size:CGSize)->some View {
        Canvas{context,_ in
            let unit=frame.unit(size)
            for (i,e) in packEdits.enumerated() {
                let c=frame.point(e.x,e.y,size),r=max(3,e.r*unit*(e.kind == .letter ? 1.05:1))
                let ring=Path(ellipseIn:CGRect(x:c.x-r,y:c.y-r,width:2*r,height:2*r))
                let tint:Color=i==packSelected ? .accentColor:e.kind == .void ? .gray:.white
                context.stroke(ring,with:.color(.black.opacity(0.55)),style:StrokeStyle(lineWidth:3,dash:[5,4]))
                context.stroke(ring,with:.color(tint),style:StrokeStyle(lineWidth:1.5,dash:[5,4]))
                if e.kind == .void{var x=Path();x.move(to:CGPoint(x:c.x-r*0.5,y:c.y-r*0.5));x.addLine(to:CGPoint(x:c.x+r*0.5,y:c.y+r*0.5));x.move(to:CGPoint(x:c.x+r*0.5,y:c.y-r*0.5));x.addLine(to:CGPoint(x:c.x-r*0.5,y:c.y+r*0.5));context.stroke(x,with:.color(.gray),lineWidth:1.5)}
            }
        }
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance:0).onChanged{v in
            if !packGesture {
                packGesture=true
                if packTool=="move",let hit=packHit(v.startLocation,frame,size) {
                    if let pin=hit.pin{packDrag=pin}
                    else{packEdits.append(CirclePackEdits.Item(kind:hit.kind == .letter ? .letter:.circle,x:hit.x,y:hit.y,r:hit.r,character:hit.character,turn:hit.turn));packDrag=packEdits.count-1}
                    packSelected=packDrag
                }
            }
            if let i=packDrag,packEdits.indices.contains(i){let p=frame.field(v.location,size);packEdits[i].x=min(1.2,max(-0.2,p.x));packEdits[i].y=min(1.2,max(-0.2,p.y))}
        }.onEnded{v in
            packGesture=false
            if packDrag==nil && hypot(v.translation.width,v.translation.height)<4{packClick(v.startLocation,frame,size)}
            packDrag=nil
        })
        .help("Click to place or remove shapes; drag in Move to pin one")
    }
    private func packHit(_ point:CGPoint,_ frame:PackFrame,_ size:CGSize)->CirclePackShape? {
        let unit=frame.unit(size)
        func near(_ x:Double,_ y:Double,_ r:Double)->Bool{let c=frame.point(x,y,size);return hypot(c.x-point.x,c.y-point.y)<=max(6,r*unit)}
        // Placed shapes (and voids) first, newest on top, from the edits themselves so a drag never lags the render.
        for (i,e) in packEdits.enumerated().reversed() where near(e.x,e.y,e.r){return CirclePackShape(kind:e.kind,x:e.x,y:e.y,r:e.r,character:e.character,turn:e.turn ?? 0,pin:i)}
        return packShapes.filter{$0.pin==nil && $0.kind != .void}.sorted{$0.r<$1.r}.first{near($0.x,$0.y,$0.kind == .letter ? $0.r*0.85:$0.r)}
    }
    private func packClick(_ point:CGPoint,_ frame:PackFrame,_ size:CGSize) {
        let p=frame.field(point,size),hit=packHit(point,frame,size)
        switch packTool {
        case "remove":
            guard let hit else{return}
            if let pin=hit.pin{packEdits.remove(at:pin);packSelected=nil}
            else{packEdits.append(CirclePackEdits.Item(kind:.void,x:hit.x,y:hit.y,r:hit.r))}
        case "move":packSelected=hit?.pin
        case "letter":
            guard let c=packLetter.first,!c.isWhitespace else{error="Type a letter to place.";return}
            packEdits.append(CirclePackEdits.Item(kind:.letter,x:p.x,y:p.y,r:packSize,character:String(c)));packSelected=nil
        default:packEdits.append(CirclePackEdits.Item(kind:.circle,x:p.x,y:p.y,r:packSize));packSelected=nil
        }
    }
}

/// Where the packing field sits in the preview: its bounds on the poster and the poster's aspect.
private struct PackFrame:Equatable {
    var bounds:UnitBox;var aspect:Double
    /// Pixels per unit of the field's short side.
    func unit(_ size:CGSize)->Double{min(bounds.width,bounds.height*aspect)*size.width}
    func point(_ x:Double,_ y:Double,_ size:CGSize)->CGPoint{CGPoint(x:(bounds.x+x*bounds.width)*size.width,y:(bounds.y+y*bounds.height)*size.height)}
    func field(_ p:CGPoint,_ size:CGSize)->CGPoint{CGPoint(x:(p.x/size.width-bounds.x)/bounds.width,y:(p.y/size.height-bounds.y)/bounds.height)}
}

