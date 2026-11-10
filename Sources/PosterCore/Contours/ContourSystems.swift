import Foundation
import CoreGraphics
import CoreText

/// Immutable paths can be shared across native previews, print exports and study actors.
public struct ContourConstruction:@unchecked Sendable {
    public let bands:[ContourVectorBand];public let counters:[CGPath];public let sources:[CGPath];public let nested:Bool
}
private final class ContourDrawingCache:@unchecked Sendable {
    static let shared=ContourDrawingCache()
    private let lock=NSLock()
    private var values:[String:ContourConstruction]=[:],order:[String]=[]
    func get(_ key:String)->ContourConstruction?{lock.lock();defer{lock.unlock()};return values[key]}
    func put(_ value:ContourConstruction,_ key:String){lock.lock();defer{lock.unlock()};if values[key]==nil{order.append(key)};values[key]=value;while order.count>10{values.removeValue(forKey:order.removeFirst())}}
}
/// A resolved outline in design units, its convergence point for nested copies and, for a
/// silhouette cut by the paper, the skirt that lets parallel channels run off the cut.
private struct ContourPlacement {var path:CGPath;var anchor:CGPoint = .zero;var cut:(y:Double,skirt:CGPath)?=nil}

public enum ContourSystems {
    public static let typeID="contour-letter-channels"
    public static let profileID="contour-profile-channels"
    public static let typeShape="contour-type"
    public static let profileShape="contour-profile"
    public static func isContour(_ shape:String)->Bool{shape==typeShape || shape==profileShape}
    public static func isTextRecipe(_ id:String)->Bool{id==typeID}

    private static func block(_ letter:String)->CGPath? {
        let path=CGMutablePath()
        let points:[CGPoint]
        switch letter.uppercased() {
        case "R":
            points=[.init(x:0.03,y:0.03),.init(x:0.97,y:0.03),.init(x:0.97,y:0.60),.init(x:0.52,y:0.60),.init(x:0.52,y:0.73),.init(x:0.97,y:0.73),.init(x:0.97,y:0.97),.init(x:0.40,y:0.97),.init(x:0.40,y:0.91),.init(x:0.03,y:0.91)]
            path.move(to:points[0]);for p in points.dropFirst(){path.addLine(to:p)};path.closeSubpath()
            path.move(to:.init(x:0.18,y:0.20));for p in [CGPoint(x:0.81,y:0.20),CGPoint(x:0.81,y:0.36),CGPoint(x:0.34,y:0.36),CGPoint(x:0.34,y:0.73),CGPoint(x:0.18,y:0.73)]{path.addLine(to:p)};path.closeSubpath();return path
        case "K":
            points=[.init(x:0.03,y:0.03),.init(x:0.27,y:0.03),.init(x:0.27,y:0.38),.init(x:0.57,y:0.38),.init(x:0.57,y:0.03),.init(x:0.97,y:0.03),.init(x:0.97,y:0.27),.init(x:0.80,y:0.27),.init(x:0.80,y:0.56),.init(x:0.60,y:0.56),.init(x:0.60,y:0.72),.init(x:0.97,y:0.72),.init(x:0.97,y:0.97),.init(x:0.53,y:0.97),.init(x:0.53,y:0.74),.init(x:0.27,y:0.74),.init(x:0.27,y:0.97),.init(x:0.03,y:0.97)]
        case "C":
            points=[.init(x:0.97,y:0.03),.init(x:0.03,y:0.03),.init(x:0.03,y:0.97),.init(x:0.97,y:0.97),.init(x:0.97,y:0.63),.init(x:0.74,y:0.63),.init(x:0.74,y:0.74),.init(x:0.27,y:0.74),.init(x:0.27,y:0.27),.init(x:0.74,y:0.27),.init(x:0.74,y:0.38),.init(x:0.97,y:0.38)]
        default:return nil
        }
        path.move(to:points[0]);for p in points.dropFirst(){path.addLine(to:p)};path.closeSubpath();return path
    }
    public static func profileOutline(lean:Double=0.02)->CGPath {
        let path=CGMutablePath()
        path.move(to:CGPoint(x:0.10+lean,y:0.99));path.addLine(to:CGPoint(x:0.14,y:0.70))
        path.addCurve(to:CGPoint(x:0.04,y:0.24),control1:CGPoint(x:0.13,y:0.53),control2:CGPoint(x:-0.02,y:0.48))
        path.addCurve(to:CGPoint(x:0.48,y:0.025),control1:CGPoint(x:0.09,y:0.07),control2:CGPoint(x:0.28,y:0.015))
        path.addCurve(to:CGPoint(x:0.85,y:0.39),control1:CGPoint(x:0.72,y:0.02),control2:CGPoint(x:0.85,y:0.16))
        path.addLine(to:CGPoint(x:0.98,y:0.565));path.addLine(to:CGPoint(x:0.86,y:0.59))
        path.addLine(to:CGPoint(x:0.89,y:0.625));path.addLine(to:CGPoint(x:0.85,y:0.65))
        path.addCurve(to:CGPoint(x:0.76,y:0.72),control1:CGPoint(x:0.91,y:0.70),control2:CGPoint(x:0.80,y:0.69))
        path.addLine(to:CGPoint(x:0.79+lean,y:0.99));path.closeSubpath();return path
    }
    private static func sources(_ e:SceneElement,frame:CGRect)->[ContourPlacement] {
        let v=e.geometry ?? [:],margin=frame.width*0.045,unit=min(frame.width,frame.height)
        // Outward channels stay on the paper: the layout gives way by the expansion distance.
        let grow=max(0,(v["expansion"] ?? 0)*unit)
        let custom=e.contour?.outline.flatMap{outline->(CGPath,CGPathFillRule)? in
            guard let path=try? outline.path() else{return nil}
            var scale=CGAffineTransform(scaleX:1,y:outline.aspect);return (path.copy(using:&scale) ?? path,outline.pathFillRule)
        }
        func place(_ raw:CGPath,_ cell:CGRect,stretch:Double,bottom:Bool=false,mirror:Bool=false)->CGPath {
            var source=raw
            if mirror{let b=raw.boundingBoxOfPath;var flip=CGAffineTransform(a:-1,b:0,c:0,d:1,tx:b.minX+b.maxX,ty:0);source=raw.copy(using:&flip) ?? raw}
            return ContourVectorEngine.fit(source,to:cell,stretch:stretch,bottom:bottom)
        }
        if e.shape==typeShape {
            let body=frame.insetBy(dx:margin+grow,dy:margin+grow)
            if let custom{return [ContourPlacement(path:place(custom.0,body,stretch:0).normalized(using:custom.1))]}
            let text=(e.contour?.text ?? e.text ?? "RKC").replacingOccurrences(of:"\r\n",with:"\n"),letters=Array(text.filter{!$0.isWhitespace}.prefix(48)).map(String.init)
            guard !letters.isEmpty else{return []}
            let font=FontLibrary.font(name:e.fontName ?? "HelveticaNeue-Bold",variations:e.fontVariations)
            let layout=Int(v["layout"] ?? 0),stretch=v["stretch"] ?? 1
            // Explicit line breaks, typed or from the poster title, set the lines; without them every word is a line.
            let lines=text.contains("\n") ? text.split(separator:"\n").map{$0.trimmingCharacters(in:.whitespaces)}.filter{!$0.isEmpty}:nil
            // The R-above-K/C arrangement belongs to the RKC source; other three-letter titles keep whole-word lines.
            let arrangement=layout==0 && lines==nil && letters.joined().uppercased()=="RKC",reference=(v["construction"] ?? 1)>0.5 && text.uppercased()=="RKC"
            // Font outlines fill nonzero: variable fonts overlap contours at stem joins, which
            // even-odd filling would punch out as false counters.
            func outline(_ string:String)->CGPath{let raw=SurveyTypeGeometry.outline(string,font:font);var flip=CGAffineTransform(scaleX:1,y:-1);return raw.copy(using:&flip) ?? raw}
            func glyphs(_ string:String,_ cell:CGRect,_ stretch:Double)->ContourPlacement{ContourPlacement(path:place(outline(string),cell,stretch:stretch).normalized(using:.winding))}
            func letter(_ letter:String,_ cell:CGRect)->ContourPlacement {
                if reference,let path=block(letter){return ContourPlacement(path:place(path,cell,stretch:stretch).normalized(using:.evenOdd))}
                return glyphs(letter,cell,stretch)
            }
            if layout==1 {
                guard let lines,lines.count>1 else{return [glyphs(lines?.first ?? text,body,0)]}
                // Set as typed: one type size for every line, stacked with an even gap and centred on the widest.
                let shapes=lines.map(outline),boxes=shapes.map{$0.boundingBoxOfPath.isNull ? CGRect.zero:$0.boundingBoxOfPath}
                let lead=CTFontGetCapHeight(font)*0.28,widest=boxes.map(\.width).max() ?? 0
                var y=0.0,stacked:[CGPath]=[]
                for (shape,box) in zip(shapes,boxes) {
                    var shift=CGAffineTransform(translationX:(widest-box.width)/2-box.minX,y:y-box.minY)
                    stacked.append(shape.copy(using:&shift) ?? shape);y+=box.height+lead
                }
                let all=CGMutablePath();for path in stacked{all.addPath(path)}
                guard var shared=ContourVectorEngine.fitTransform(all.boundingBoxOfPath,to:body,stretch:0) else{return []}
                return stacked.map{ContourPlacement(path:($0.copy(using:&shared) ?? $0).normalized(using:.winding))}
            }
            let gap=(v["tracking"] ?? 0.035)*frame.width
            if layout==0 && !arrangement {
                let rows=lines ?? text.split(whereSeparator:{$0.isWhitespace}).map(String.init)
                let height=(body.height-Double(max(0,rows.count-1))*gap)/Double(max(1,rows.count))
                return rows.enumerated().map{index,row in glyphs(row,CGRect(x:body.minX,y:body.minY+Double(index)*(height+gap),width:body.width,height:max(1,height)),stretch)}
            }
            var cells:[CGRect]=[],glyphLetters=letters
            if arrangement {
                let top=body.height*0.43
                cells=[CGRect(x:body.minX,y:body.minY,width:body.width,height:top-gap/2),CGRect(x:body.minX,y:body.minY+top+gap/2,width:(body.width-gap)/2,height:body.height-top-gap/2),CGRect(x:body.midX+gap/2,y:body.minY+top+gap/2,width:(body.width-gap)/2,height:body.height-top-gap/2)]
            }else if let lines {
                // Each typed line is a grid row; columns follow the longest line.
                var budget=48;let rows=lines.map{line->[String] in let row=Array(line.filter{!$0.isWhitespace}.prefix(max(0,budget))).map(String.init);budget-=row.count;return row}.filter{!$0.isEmpty}
                let columns=max(1,rows.map(\.count).max() ?? 1)
                let width=(body.width-Double(columns-1)*gap)/Double(columns),height=(body.height-Double(rows.count-1)*gap)/Double(rows.count)
                glyphLetters=rows.flatMap{$0}
                for (r,row) in rows.enumerated(){for c in row.indices{cells.append(CGRect(x:body.minX+Double(c)*(width+gap),y:body.minY+Double(r)*(height+gap),width:max(1,width),height:max(1,height)))}}
            }else{
                let columns=max(1,Int(ceil(sqrt(Double(letters.count)*frame.width/frame.height))))
                let rows=Int(ceil(Double(letters.count)/Double(columns)))
                let width=(body.width-Double(columns-1)*gap)/Double(columns),height=(body.height-Double(rows-1)*gap)/Double(rows)
                for i in letters.indices{cells.append(CGRect(x:body.minX+Double(i%columns)*(width+gap),y:body.minY+Double(i/columns)*(height+gap),width:max(1,width),height:max(1,height)))}
            }
            return zip(glyphLetters,cells).map{letter($0,$1)}
        }
        let copies=max(1,min(3,Int((v["copies"] ?? 2).rounded()))),satellites=max(0,min(10,Int((v["satellites"] ?? 8).rounded())))
        let facing=(v["facing"] ?? 1)>0.5,anchorX=v["anchorX"] ?? 0.5,anchorY=v["anchorY"] ?? 0.58
        let open=(v["mode"] ?? 1)<=0.5 && (v["openEdge"] ?? 1)>0.5
        let reach=(v["count"] ?? 10)*(v["spacing"] ?? 0.0065)*unit+abs(v["expansion"] ?? 0)*unit
        let (source,rule)=custom ?? (profileOutline(lean:v["lean"] ?? 0.02),.evenOdd)
        // The cut lower edge stays on the bottom margin; the other sides give way to expansion.
        let area=CGRect(x:frame.minX+grow,y:frame.minY+grow,width:frame.width-grow*2,height:frame.height-grow)
        let rows=Int(ceil(Double(satellites)/2)),smallHeight=area.height*min(0.17,0.85/Double(max(1,rows)))
        // The calibrated profile is stretched into narrow border slots. An imported outline keeps its
        // proportions, so its slots take its aspect, widening the border band up to 15% of the width.
        let bounds=source.boundingBoxOfPath,aspect=bounds.width>0 ? bounds.height/bounds.width:1
        let smallWidth=custom==nil ? area.width*0.055:min(smallHeight/max(0.05,aspect),area.width*0.11)
        let side=satellites>0 ? max(area.width*0.12,area.width*0.04+smallWidth):margin,gap=area.width*0.04,available=area.width-side*2
        let width=(available-Double(copies-1)*gap)/Double(copies)
        var placements:[ContourPlacement]=[]
        // Imported outlines keep their proportions; one with a straight base stands on the bottom margin like the profile's neck.
        let standing=custom != nil && ContourVectorEngine.openEdge(source,reach:0) != nil
        func add(_ cell:CGRect,mirror:Bool) {
            let fitted=custom==nil ? place(source,cell,stretch:1,mirror:mirror):place(source,cell,stretch:0,bottom:standing,mirror:mirror)
            let b=fitted.boundingBoxOfPath,path=fitted.normalized(using:rule)
            var anchor=CGPoint(x:b.minX+b.width*(mirror ? 1-anchorX:anchorX),y:b.minY+b.height*anchorY)
            // Converging into a counter makes a tunnel; converging onto open paper does not.
            if !path.contains(anchor) && !ContourVectorEngine.counters(path,within:frame).contains(where:{$0.contains(anchor)}){anchor=ContourVectorEngine.interiorPoint(path,near:anchor)}
            placements.append(ContourPlacement(path:path,anchor:anchor,cut:open ? ContourVectorEngine.openEdge(fitted,reach:reach):nil))
        }
        // Facing pairs mirror every outline right of centre, as the reference heads look at each other.
        for i in 0..<copies{let cell=CGRect(x:area.minX+side+Double(i)*(width+gap),y:area.minY+margin,width:width,height:area.height-margin*2);add(cell,mirror:facing && cell.midX>area.midX+1)}
        for i in 0..<satellites {
            let x=i.isMultiple(of:2) ? area.minX+area.width*0.015:area.maxX-area.width*0.015-smallWidth
            let y=area.minY+margin+Double(i/2)*(area.height-smallHeight-margin*2)/Double(max(1,rows-1))
            add(CGRect(x:x,y:y,width:smallWidth,height:smallHeight),mirror:facing && !i.isMultiple(of:2))
        }
        return placements
    }
    /// The cached vector construction, for checks and tools that inspect bands directly.
    public static func construction(_ e:SceneElement,aspect:Double)->ContourConstruction{drawing(e,aspect:aspect)}
    private static func drawing(_ e:SceneElement,aspect:Double)->ContourConstruction {
        let v=e.geometry ?? [:],frame=CGRect(x:0,y:0,width:1000,height:1000*aspect),unit=min(frame.width,frame.height)
        let params=v.sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined(separator:",")
        let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
        let custom=(try? encoder.encode(e.contour)).flatMap{String(data:$0,encoding:.utf8)} ?? ""
        let variations=(e.fontVariations ?? [:]).sorted{$0.key<$1.key}.map{"\($0.key)=\($0.value)"}.joined(separator:",")
        let key=[e.shape,e.text ?? "",e.fontName ?? "",variations,custom,params,String(format:"%.6f",aspect)].joined(separator:"|")
        if let cached=ContourDrawingCache.shared.get(key){return cached}
        let placements=sources(e,frame:frame),count=max(2,min(28,Int((v["count"] ?? 10).rounded())))
        let expansion=(v["expansion"] ?? 0)*unit,nested=e.shape==profileShape && (v["mode"] ?? 1)>0.5
        let protect=(v["preserveCounters"] ?? 1)>0.5
        var bands:[ContourVectorBand]=[],counters:[CGPath]=[]
        if nested {
            let ratio=min(0.96,max(0.65,v["shrink"] ?? 0.86))
            for placement in placements {
                // Copies scale the filled silhouette. Each copy's own scaled counters open a window
                // through it and every smaller copy stacked on it, so counters follow the copies and
                // stay open instead of being covered by the next layer.
                let holes=ContourVectorEngine.counters(placement.path,within:frame),hole=holes.isEmpty ? nil:ContourVectorEngine.union(holes)
                let silhouette=hole.map{placement.path.union($0,using:.evenOdd)} ?? placement.path
                let root=ContourVectorEngine.offset(silhouette,by:expansion,rounded:true),anchor=placement.anchor
                var copies:[CGPath]=[],scaled:[CGPath?]=[],windows:[CGPath?]=[],previous:CGPath?,crossing=false,window:CGPath?
                for i in 0..<count {
                    let scale=pow(ratio,Double(i));var transform=CGAffineTransform(a:scale,b:0,c:0,d:scale,tx:anchor.x*(1-scale),ty:anchor.y*(1-scale))
                    guard var path=root.copy(using:&transform) else{continue}
                    // Scaling about a point nests copies only when the outline is star-shaped around
                    // it; otherwise each copy is clipped to its parent so layers never cross.
                    if let previous {
                        if i==1{let spill=path.subtracting(previous).boundingBoxOfPath;crossing = !spill.isNull && spill.width>0.5 && spill.height>0.5}
                        if crossing{path=path.intersection(previous)}
                    }
                    previous=path;copies.append(path)
                    var counter:CGPath?
                    if let hole{counter=hole.copy(using:&transform)}
                    if let counter{window=window.map{$0.union(counter,using:.evenOdd)} ?? counter}
                    scaled.append(counter);windows.append(window)
                }
                // Windowed copies stay nested, so band i is copy i less copy i+1. It is built as the
                // ring between the two copies outside the window, plus the part of copy i+1 that its
                // new counter exposes; subtracting two windowed copies directly would leave hairline
                // slivers along the counter arcs they share.
                for i in copies.indices {
                    let next=i+1<copies.count ? copies[i+1]:nil
                    var visible=next.map{copies[i].subtracting($0)} ?? copies[i]
                    if let open=windows[i]{visible=visible.subtracting(open)}
                    if let next,let counter=scaled[i+1] {
                        let exposed=next.intersection(windows[i].map{counter.subtracting($0)} ?? counter)
                        if !exposed.isEmpty{visible=visible.isEmpty ? exposed:visible.union(exposed)}
                    }
                    if !visible.isEmpty{bands.append(ContourVectorBand(path:visible,index:i))}
                }
            }
        }else{
            // Outlines sharing a cut line (a whole title has none) form one distance field.
            var groups:[Int:[ContourPlacement]]=[:],order:[Int]=[]
            for p in placements{let key=p.cut.map{Int(($0.y*2).rounded())} ?? Int.min;if groups[key]==nil{order.append(key)};groups[key,default:[]].append(p)}
            for key in order {
                let group=groups[key]!,source=ContourVectorEngine.union(group.map(\.path))
                let skirts=group.compactMap{$0.cut?.skirt},field=skirts.isEmpty ? source:ContourVectorEngine.union([source]+skirts)
                let holes=ContourVectorEngine.counters(source,within:frame);counters += holes
                var made=ContourVectorEngine.channels(field,count:count,spacing:(v["spacing"] ?? 0.0065)*unit,duty:v["duty"] ?? 0.65,expansion:expansion,rounded:(v["rounded"] ?? 1)>0.5,protecting:protect && !holes.isEmpty ? ContourVectorEngine.union(holes):nil)
                if let cut=group.first?.cut?.y {
                    let keep=CGPath(rect:CGRect(x:frame.minX-1e4,y:frame.minY-1e4,width:frame.width+2e4,height:cut-frame.minY+1e4),transform:nil)
                    made=made.compactMap{band in let clipped=band.path.intersection(keep);return clipped.isEmpty ? nil:ContourVectorBand(path:clipped,index:band.index)}
                }
                bands += made
            }
        }
        let result=ContourConstruction(bands:bands,counters:counters,sources:placements.map(\.path),nested:nested)
        ContourDrawingCache.shared.put(result,key);return result
    }
    static func draw(_ e:SceneElement,rect:CGRect,context:CGContext,aspect:Double)->Bool {
        guard isContour(e.shape) else{return false}
        context.saveGState();defer{context.restoreGState()}
        if let clip=e.clipBounds{context.clip(to:clip.rect)}
        context.translateBy(x:rect.midX,y:rect.midY);context.scaleBy(x:1,y:1/aspect);context.rotate(by:e.rotation * .pi/180);context.scaleBy(x:1,y:aspect);context.translateBy(x:-rect.midX,y:-rect.midY)
        context.scaleBy(x:1,y:1/aspect)
        let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect)
        context.clip(to:r);context.translateBy(x:r.minX,y:r.minY);context.scaleBy(x:r.width/1000,y:r.width/1000)
        let physicalAspect=r.height/r.width,art=drawing(e,aspect:physicalAspect)
        // Nested copies carry their own scaled counters, so only channel constructions need the original-counter mask.
        if !art.nested,(e.geometry?["preserveCounters"] ?? 1)>0.5,!art.counters.isEmpty {
            let clip=CGMutablePath();clip.addRect(CGRect(x:0,y:0,width:1000,height:1000*physicalAspect));for counter in art.counters{clip.addPath(counter)}
            context.addPath(clip);context.clip(using:.evenOdd)
        }
        if e.blendMode=="multiply"{context.setBlendMode(.multiply)}else if e.blendMode=="difference"{context.setBlendMode(.difference)}
        let primary=LibrarySceneRenderer.color(e.color)
        if art.nested,e.contour?.secondaryInk==nil {
            // Nested bands are disjoint layers; transparent mode inks every other one.
            let combined=CGMutablePath();for band in art.bands where band.index.isMultiple(of:2){combined.addPath(band.path)};context.setFillColor(primary);context.addPath(combined);context.drawPath(using:.eoFill)
        }else{
            for band in art.bands {
                let color=band.index.isMultiple(of:2) ? primary:e.contour?.secondaryInk.map{LibrarySceneRenderer.color($0)} ?? primary
                context.setFillColor(color);context.addPath(band.path);context.fillPath()
            }
        }
        return true
    }
    public static func resolveContent(in scene:inout StyleGenome) {
        for i in scene.elements.indices where scene.elements[i].shape==typeShape {
            scene.elements[i].kind="text"
            // The title keeps its typed line breaks; contour lines follow them.
            scene.elements[i].text=scene.elements[i].contour?.text ?? scene.posterCopy?.title.replacingOccurrences(of:"\r\n",with:"\n") ?? scene.elements[i].text ?? "RKC"
            scene.elements[i].fontName=scene.elements[i].fontName ?? scene.font
        }
    }
    public static func validate(_ customization:ContourCustomization?)throws {try customization?.validate()}
}
