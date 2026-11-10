import Foundation
import CoreGraphics
import CoreText

/// Text stays editable in SceneElement.text; only its native glyph outlines are projected.
enum SurveyTypeGeometry {
    static let shapes: Set<String> = ["motif-survey-portal-type", "motif-survey-module-substitution", "motif-survey-scalloped-frame"]

    static func outline(_ text: String, font: CTFont) -> CGPath {
        let line = CTLineCreateWithAttributedString(NSAttributedString(string:text, attributes:[.font:font]))
        let path = CGMutablePath()
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let count = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating:0,count:count), positions = [CGPoint](repeating:.zero,count:count)
            CTRunGetGlyphs(run,CFRange(location:0,length:count),&glyphs); CTRunGetPositions(run,CFRange(location:0,length:count),&positions)
            let runFont = (CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
            for i in 0..<count { if let glyph = CTFontCreatePathForGlyph(runFont,glyphs[i],nil) { path.addPath(glyph,transform:CGAffineTransform(translationX:positions[i].x,y:positions[i].y)) } }
        }
        return path
    }
    /// Flatten in glyph space before a non-affine projection: transformed Bezier
    /// control points alone would not reproduce a projective curve.
    static func contours(_ path: CGPath) -> [[CGPoint]] {
        var result:[[CGPoint]] = []
        var points:[CGPoint] = []
        var cursor = CGPoint.zero
        var start = CGPoint.zero
        path.applyWithBlock { (pointer:UnsafePointer<CGPathElement>) -> Void in
            let e = pointer.pointee
            switch e.type {
            case .moveToPoint:
                if !points.isEmpty { result.append(points) }; cursor=e.points[0];start=cursor;points=[cursor]
            case .addLineToPoint: cursor=e.points[0];points.append(cursor)
            case .addQuadCurveToPoint:
                let from=cursor,c=e.points[0],end=e.points[1]
                for i in 1...12 {points.append(quadratic(from,c,end,Double(i)/12))};cursor=end
            case .addCurveToPoint:
                let from=cursor,a=e.points[0],b=e.points[1],end=e.points[2]
                for i in 1...14 {points.append(cubic(from,a,b,end,Double(i)/14))};cursor=end
            case .closeSubpath:
                points.append(start);result.append(points);points=[];cursor=start
            @unknown default: break
            }
        }
        if !points.isEmpty { result.append(points) };return result
    }
    private static func quadratic(_ a:CGPoint,_ b:CGPoint,_ c:CGPoint,_ t:Double)->CGPoint {
        let s=1-t,wa=s*s,wb=2*s*t,wc=t*t
        let x=wa*a.x+wb*b.x+wc*c.x
        let y=wa*a.y+wb*b.y+wc*c.y
        return CGPoint(x:x,y:y)
    }
    private static func cubic(_ a:CGPoint,_ b:CGPoint,_ c:CGPoint,_ d:CGPoint,_ t:Double)->CGPoint {
        let s=1-t,wa=s*s*s,wb=3*s*s*t,wc=3*s*t*t,wd=t*t*t
        let x1=wa*a.x+wb*b.x,x2=wc*c.x+wd*d.x
        let y1=wa*a.y+wb*b.y,y2=wc*c.y+wd*d.y
        return CGPoint(x:x1+x2,y:y1+y2)
    }
    static func inkArea(_ path:CGPath) -> Double {
        var area=0.0
        for points in contours(path) where points.count>2 {
            for i in points.indices {let next=points[(i+1)%points.count];area += (points[i].x*next.y-next.x*points[i].y)/2}
        }
        return abs(area)
    }
    static func project(_ path:CGPath,quad:[CGPoint],across:ClosedRange<Double>=0.04...0.96) -> CGPath {
        let bounds=path.boundingBoxOfPath, output=CGMutablePath()
        guard quad.count==4,bounds.width>0,bounds.height>0 else{return output}
        let p0=quad[0],p1=quad[1],p2=quad[2],p3=quad[3]
        let dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x
        let dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y
        let determinant=dx1*dy2-dx2*dy1
        let g=abs(determinant)>1e-12 ? (dx3*dy2-dx2*dy3)/determinant:0
        let h=abs(determinant)>1e-12 ? (dx1*dy3-dx3*dy1)/determinant:0
        for contour in contours(path) {
            for (i,point) in contour.enumerated() {
                let u=across.lowerBound+(point.x-bounds.minX)/bounds.width*(across.upperBound-across.lowerBound)
                let v=0.12+(1-(point.y-bounds.minY)/bounds.height)*0.76
                let denominator=g*u+h*v+1
                let x=((p1.x-p0.x+g*p1.x)*u+(p3.x-p0.x+h*p3.x)*v+p0.x)/denominator
                let y=((p1.y-p0.y+g*p1.y)*u+(p3.y-p0.y+h*p3.y)*v+p0.y)/denominator
                if i==0{output.move(to:CGPoint(x:x,y:y))}else{output.addLine(to:CGPoint(x:x,y:y))}
            }
            output.closeSubpath()
        }
        return output
    }
    private static func scalloped(_ path:CGPath,in cell:CGRect,lobes:Double,depth:Double,phase:Double)->CGPath {
        let bounds=path.boundingBoxOfPath,result=CGMutablePath()
        guard bounds.width>0,bounds.height>0 else{return result}
        let margin=min(cell.width,cell.height)*0.035
        let target=cell.insetBy(dx:margin,dy:margin)
        let pitch=cell.height/max(2,lobes),requestedAmplitude=min(cell.width,cell.height)*depth
        for contour in contours(path) where contour.count>2 {
            let mapped=contour.map{CGPoint(x:target.minX+($0.x-bounds.minX)/bounds.width*target.width,y:target.minY+(1-($0.y-bounds.minY)/bounds.height)*target.height)}
            let contourWidth=(mapped.map(\.x).max() ?? 0)-(mapped.map(\.x).min() ?? 0)
            let contourHeight=(mapped.map(\.y).max() ?? 0)-(mapped.map(\.y).min() ?? 0)
            let amplitude=min(requestedAmplitude,min(contourWidth,contourHeight)*0.18)
            var points:[CGPoint]=[]
            for i in mapped.indices {
                let a=mapped[i],b=mapped[(i+1)%mapped.count],length=hypot(b.x-a.x,b.y-a.y)
                let samples=max(1,Int(ceil(length/max(0.0001,pitch/12))))
                for j in 0..<samples {let t=Double(j)/Double(samples);points.append(CGPoint(x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t))}
            }
            var distance=0.0
            for i in points.indices {
                let a=points[(i+points.count-1)%points.count],b=points[(i+1)%points.count],current=points[i]
                let length=max(0.000001,hypot(b.x-a.x,b.y-a.y)),wave=sin(distance/pitch*Double.pi*2+phase)*amplitude
                let displaced=CGPoint(x:current.x-(b.y-a.y)/length*wave,y:current.y+(b.x-a.x)/length*wave)
                if i==0{result.move(to:displaced)}else{result.addLine(to:displaced)}
                distance += hypot(b.x-current.x,b.y-current.y)
            }
            result.closeSubpath()
        }
        return result
    }
    static func draw(_ element:SceneElement, rect:CGRect, context:CGContext, aspect:Double, text:String?=nil, image:CGImage?=nil) -> Bool {
        guard shapes.contains(element.shape) else{return false}
        let values=element.geometry ?? [:]
        func n(_ key:String,_ fallback:Double,_ low:Double,_ high:Double)->Double {let v=values[key] ?? fallback;return v.isFinite ? min(high,max(low,v)):fallback}
        func count(_ key:String,_ fallback:Int,_ low:Int,_ high:Int)->Int{Int(n(key,Double(fallback),Double(low),Double(high)).rounded())}
        let string=text ?? element.text ?? "SPACE",font=FontLibrary.font(name:element.fontName ?? "HelveticaNeue-Bold",variations:element.fontVariations)
        context.saveGState();defer{context.restoreGState()}
        if let clip=element.clipBounds{context.clip(to:clip.rect)}
        context.translateBy(x:rect.midX,y:rect.midY);context.scaleBy(x:1,y:1/aspect);context.rotate(by:element.rotation * .pi/180);context.scaleBy(x:1,y:aspect);context.translateBy(x:-rect.midX,y:-rect.midY)
        context.scaleBy(x:1,y:1/aspect)
        let r=CGRect(x:rect.minX,y:rect.minY*aspect,width:rect.width,height:rect.height*aspect),unit=min(r.width,r.height)
        context.clip(to:r);context.setFillColor(LibrarySceneRenderer.color(element.color));context.setStrokeColor(LibrarySceneRenderer.color(element.color))
        if element.blendMode=="multiply"{context.setBlendMode(.multiply)}else if element.blendMode=="difference"{context.setBlendMode(.difference)}
        func p(_ x:Double,_ y:Double)->CGPoint{CGPoint(x:r.minX+x*r.width,y:r.minY+y*r.height)}
        if element.shape=="motif-survey-scalloped-frame" {
            let columns=count("columns",2,1,4),lobes=n("lobes",10,3,18),depth=n("depth",0.035,0.007,0.055)
            let phase=n("phase",0,-1.2,1.2),gap=n("gap",0,0,0.08),alternation=count("alternation",1,0,1)
            let characters=Array(string.filter{!$0.isWhitespace}.prefix(32)).map(String.init)
            let letters=characters.isEmpty ? ["F","U","B","U"]:characters,rows=max(1,Int(ceil(Double(letters.count)/Double(columns))))
            for (index,letter) in letters.enumerated() {
                let row=index/columns,col=index%columns,w=r.width/Double(columns),h=r.height/Double(rows)
                let cell=CGRect(x:r.minX+Double(col)*w,y:r.minY+Double(row)*h,width:w,height:h).insetBy(dx:w*gap/2,dy:h*gap/2)
                let glyph=scalloped(outline(letter,font:font),in:cell,lobes:lobes,depth:depth,phase:phase)
                context.saveGState();context.clip(to:cell)
                if alternation==1 && row%2==1 {let field=CGMutablePath();field.addRect(cell);field.addPath(glyph);context.addPath(field);context.drawPath(using:.eoFill)}
                else {context.addPath(glyph);context.fillPath()}
                context.restoreGState()
            }
        }else if element.shape=="motif-survey-portal-type" {
            let levels=count("levels",3,1,6),faces=count("faces",4,2,4)
            let depth=n("depth",0.44,0.2,0.7),fx=n("focusX",0.53,0.25,0.75),fy=n("focusY",0.5,0.25,0.75),guides=n("guides",0.35,0,1)
            let words=string.split(whereSeparator:{$0.isWhitespace}).map(String.init),paths=(words.isEmpty ? ["SPACE"]:words).map{outline($0,font:font)}
            let tiling=n("tiling",0,0,1)>=0.5,sides=count("sides",4,3,8),flow=n("flow",0,0,1)>=0.5,shading=n("shading",0,0,1)
            func frame(_ level:Int)->[CGPoint]{
                let scale=pow(1-depth,Double(level)/Double(levels));let x=fx*(1-scale),y=fy*(1-scale)
                guard sides != 4 else{return [p(x,y),p(x+scale,y),p(x+scale,y+scale),p(x,y+scale)]}
                // Regular frames with a flat base, inscribed in the square frame and stretched to the field like it.
                return (0..<sides).map{k in let angle=Double.pi/2+Double.pi/Double(sides)+Double(k)*2*Double.pi/Double(sides);return p(x+scale*(0.5+0.5*cos(angle)),y+scale*(0.5+0.5*sin(angle)))}
            }
            // Continuous flow runs the whole title round the corridor as one ticker, broken only where walls turn.
            let ticker=Array((words.isEmpty ? "SPACE":words.joined(separator:" "))+"  ")
            let tickerBounds=outline(String(ticker),font:font).boundingBoxOfPath,charAspect=tickerBounds.width/max(0.0001,tickerBounds.height)/Double(max(1,ticker.count))
            var cursor=0,wall=0
            func paint(_ word:CGPath,_ quad:[CGPoint],repeating:Bool) {
                let bounds=word.boundingBoxOfPath
                guard bounds.width>0,bounds.height>0 else{return}
                guard tiling || flow else{context.addPath(project(word,quad:quad));context.fillPath();return}
                // Repeat the word at its natural proportions along the wall instead of stretching one copy:
                // letters fill 76% of the wall depth, and even spacing absorbs whatever length remains.
                let length=(hypot(quad[1].x-quad[0].x,quad[1].y-quad[0].y)+hypot(quad[2].x-quad[3].x,quad[2].y-quad[3].y))/2
                let across=(hypot(quad[3].x-quad[0].x,quad[3].y-quad[0].y)+hypot(quad[2].x-quad[1].x,quad[2].y-quad[1].y))/2
                let share=0.76*across/max(0.0001,length)/bounds.height,natural=bounds.width*share,gap=0.3*bounds.height*share
                let copies=repeating ? max(1,Int(floor((0.96+gap)/(natural+gap)))):1
                guard copies>1 || natural<0.96 else{context.addPath(project(word,quad:quad));context.fillPath();return}
                let spacing=copies>1 ? (0.96-Double(copies)*natural)/Double(copies-1)/share:0,repeated=CGMutablePath()
                for i in 0..<copies{repeated.addPath(word,transform:CGAffineTransform(translationX:Double(i)*(bounds.width+spacing),y:0))}
                let span=copies>1 ? 0.96:natural
                context.addPath(project(repeated,quad:quad,across:(0.5-span/2)...(0.5+span/2)));context.fillPath()
            }
            let fade=n("fade",0,0,1)
            for level in 0..<levels {
                let a=frame(level),b=frame(level+1)
                // Depth fade: deeper rings recede toward the paper, as if lit only from the viewer's end.
                if fade>0{context.setAlpha(1-fade*0.85*Double(level)/Double(max(1,levels-1)))}
                var quads:[[CGPoint]]
                if sides==4 {
                    // With tiling, the right wall also runs along its length (reading down), like the other three.
                    quads=[[a[0],a[1],b[1],b[0]],[b[3],b[2],a[2],a[3]],[a[3],a[0],b[0],b[3]],tiling ? [a[1],a[2],b[2],b[1]]:[b[1],a[1],a[2],b[2]]]
                    quads=Array(quads.prefix(faces))
                }else{
                    // Walls run clockwise along each edge; edges heading left read the other way, so lower walls stay upright.
                    quads=(0..<sides).compactMap{k in
                        guard faces==4 || k%(faces==2 ? 2:4) != (faces==2 ? 1:3) else{return nil}
                        let j=(k+1)%sides
                        return a[j].x-a[k].x < -1e-9 ? [b[j],b[k],a[k],a[j]]:[a[k],a[j],b[j],b[k]]
                    }
                }
                let centre=CGPoint(x:a.map(\.x).reduce(0,+)/Double(a.count),y:a.map(\.y).reduce(0,+)/Double(a.count))
                for (face,quad) in quads.enumerated() {
                    if shading>0 {
                        // Light falls off toward the vanishing point: each wall fades from its outer edge inward.
                        let near=CGPoint(x:(quad[0].x+quad[1].x)/2,y:(quad[0].y+quad[1].y)/2),far=CGPoint(x:(quad[2].x+quad[3].x)/2,y:(quad[2].y+quad[3].y)/2)
                        let outer=hypot(near.x-centre.x,near.y-centre.y)>=hypot(far.x-centre.x,far.y-centre.y) ? near:far,inner=outer==near ? far:near
                        let colour=LibrarySceneRenderer.color(element.color)
                        if let g=CGGradient(colorsSpace:CGColorSpace(name:CGColorSpace.sRGB),colors:[colour.copy(alpha:shading*0.4)!,colour.copy(alpha:0)!] as CFArray,locations:[0,1]) {
                            context.saveGState();context.beginPath();context.addLines(between:quad);context.closePath();context.clip()
                            context.drawLinearGradient(g,start:outer,end:inner,options:[]);context.restoreGState()
                        }
                    }
                    if flow {
                        let length=(hypot(quad[1].x-quad[0].x,quad[1].y-quad[0].y)+hypot(quad[2].x-quad[3].x,quad[2].y-quad[3].y))/2
                        let across=(hypot(quad[3].x-quad[0].x,quad[3].y-quad[0].y)+hypot(quad[2].x-quad[1].x,quad[2].y-quad[1].y))/2
                        let fit=max(1,Int(0.96*length/(0.76*across*max(0.05,charAspect))))
                        let piece=String((0..<fit).map{ticker[(cursor+$0)%ticker.count]}).trimmingCharacters(in:.whitespaces);cursor+=fit
                        if !piece.isEmpty{paint(outline(piece,font:font),quad,repeating:false)}
                    }else{
                        paint(paths[(sides==4 ? level*faces+face:wall)%paths.count],quad,repeating:true);wall+=1
                    }
                }
                if guides>0 {context.saveGState();context.setAlpha(guides);context.setLineWidth(unit*0.0015);context.beginPath();context.move(to:a[0]);for point in a.dropFirst(){context.addLine(to:point)};context.closePath();context.strokePath();context.restoreGState()}
            }
        }else{
            let rows=count("rows",12,4,64),columns=count("columns",9,3,32),bias=n("bias",1.65,0.55,3.2)
            let mass=n("mass",0.56,0.25,0.82),mode=count("moduleKind",0,0,2),rotation=n("rotation",0,-0.8,0.8),fuse=n("fuse",0,0,1)
            let direction=count("direction",0,0,2),mask=count("mask",0,0,2)
            let characters=Array(string.filter{!$0.isWhitespace}.prefix(24)).map(String.init)
            let paths=(characters.isEmpty ? ["O"]:characters).map{outline($0,font:font)}
            let areas=paths.map{max(1,inkArea($0))}
            // A letter mask keeps only the modules inside (or outside) the title's first letter, drawn as large as the field allows.
            var letter:CGPath?
            if mask>0,let first=characters.first {
                let glyph=outline(first,font:font),b=glyph.boundingBoxOfPath
                if b.width>0,b.height>0 {let s=min(r.width*0.94/b.width,r.height*0.94/b.height);var t=CGAffineTransform(a:s,b:0,c:0,d:-s,tx:r.midX-b.midX*s,ty:r.midY+b.midY*s);letter=glyph.copy(using:&t)}
            }
            // Density runs down the field (legacy), across it, or out from its centre in rings.
            var modules:[(position:CGPoint,cell:Double,index:Int,parity:Int)]=[]
            if direction==2 {
                let centre=CGPoint(x:r.midX,y:r.midY),reach=min(r.width,r.height)*0.5*0.93
                for row in 0..<rows {
                    let t=(Double(row)+0.5)/Double(rows),radius=pow(t,bias)*reach
                    let pitch=max(0.002,(pow(min(1,t+0.5/Double(rows)),bias)-pow(max(0,t-0.5/Double(rows)),bias))*reach),cell=pitch*0.84
                    let around=max(1,min(240,Int(2*Double.pi*radius/(cell*(1.15-0.3*fuse)))))
                    for col in 0..<around {let a=2*Double.pi*(Double(col)+0.5)/Double(around)+Double(row)*0.37;modules.append((CGPoint(x:centre.x+cos(a)*radius,y:centre.y+sin(a)*radius),cell,(row+col)%paths.count,row+col))}
                }
            }else{
                let along=direction==1 ? r.width:r.height,span=direction==1 ? r.height:r.width
                for row in 0..<rows {
                    let t=(Double(row)+0.5)/Double(rows),y=0.035+pow(t,bias)*0.93
                    let pitch=max(0.002,(pow(min(1,t+0.5/Double(rows)),bias)-pow(max(0,t-0.5/Double(rows)),bias))*0.93*along)
                    // Fusion adds columns to rows too tight for the grid until glyphs sized by the row touch and slightly
                    // overlap, so the dense end becomes a solid band of type, as in the MOMO source. Sparse rows keep the grid.
                    let packed=Int(span*0.9/(pitch*0.84*0.8)),dense=packed>columns
                    let rowColumns=dense ? min(240,columns+Int((Double(packed-columns)*fuse).rounded())):columns
                    let cell=min(span/Double(rowColumns)*0.84*(dense ? 1/(1-0.25*fuse):1),pitch*0.84)
                    for col in 0..<rowColumns {
                        let x=0.05+(Double(col)+0.5)/Double(rowColumns)*0.9
                        modules.append((direction==1 ? p(y,x):p(x,y),cell,(row+col)%paths.count,row+col))
                    }
                }
            }
            // A size field scales every module: by the photo's darkness (a glyph halftone of the image), or by a
            // radial or diagonal ramp when the poster has no photo.
            let sizeField=count("sizeField",0,0,3)
            var tone:[UInt8]=[],toneSide=0
            if sizeField==1,let image {
                toneSide=64;tone=[UInt8](repeating:255,count:toneSide*toneSide)
                tone.withUnsafeMutableBytes{buffer in
                    if let ctx=CGContext(data:buffer.baseAddress,width:toneSide,height:toneSide,bitsPerComponent:8,bytesPerRow:toneSide,space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGImageAlphaInfo.none.rawValue){ctx.draw(image,in:CGRect(x:0,y:0,width:toneSide,height:toneSide))}
                }
            }
            func size(_ q:CGPoint)->Double {
                let u=min(1,max(0,(q.x-r.minX)/r.width)),v=min(1,max(0,(q.y-r.minY)/r.height))
                switch sizeField {
                case 1:guard toneSide>0 else{return 1};let value=Double(tone[min(toneSide-1,Int(v*Double(toneSide)))*toneSide+min(toneSide-1,Int(u*Double(toneSide)))])/255;return 0.2+0.95*(1-value)
                case 2:return 1.15-0.9*min(1,hypot(u-0.5,v-0.5)/0.7071)
                case 3:return 0.25+0.9*(u+v)/2
                default:return 1
                }
            }
            let halftone=sizeField==1 && toneSide>0
            for module in modules {
                if let letter,letter.contains(module.position,using:.evenOdd) != (mask==1){continue}
                let cell=module.cell*size(module.position),index=module.index
                context.saveGState();context.translateBy(x:module.position.x,y:module.position.y);context.rotate(by:rotation)
                if let image,!halftone {
                    let box=CGRect(x:-cell*mass/2,y:-cell*mass/2,width:cell*mass,height:cell*mass)
                    context.clip(to:box);context.translateBy(x:box.minX,y:box.maxY);context.scaleBy(x:box.width/Double(image.width),y:-box.height/Double(image.height));context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
                }else if mode==1{
                    let side=cell*mass
                    if module.parity.isMultiple(of:2){context.fillEllipse(in:CGRect(x:-side/2,y:-side/2,width:side,height:side))}
                    else{let h=side*1.1;context.move(to:CGPoint(x:0,y:-h/2));context.addLine(to:CGPoint(x:side/2,y:h/2));context.addLine(to:CGPoint(x:-side/2,y:h/2));context.closePath();context.fillPath()}
                }else if mode==2{
                    // Soft modules: rounded squares with a faint halo, like lit panels seen at night.
                    let side=cell*mass
                    context.saveGState();context.setAlpha(0.22);context.addPath(CGPath(roundedRect:CGRect(x:-side*0.66,y:-side*0.66,width:side*1.32,height:side*1.32),cornerWidth:side*0.4,cornerHeight:side*0.4,transform:nil));context.fillPath();context.restoreGState()
                    context.addPath(CGPath(roundedRect:CGRect(x:-side/2,y:-side/2,width:side,height:side),cornerWidth:side*0.28,cornerHeight:side*0.28,transform:nil));context.fillPath()
                }else{
                    let path=paths[index],bounds=path.boundingBoxOfPath
                    // Equal ink area with a cell-bound cap: narrow glyphs do not become enormous.
                    let inkScale=cell*mass/sqrt(areas[index]),cap=cell*0.9/max(bounds.width,bounds.height)
                    let scale=min(inkScale,cap)
                    context.scaleBy(x:scale,y:-scale);context.translateBy(x:-bounds.midX,y:-bounds.midY);context.addPath(path);context.fillPath()
                }
                context.restoreGState()
            }
        }
        return true
    }
}

public extension PosterShapeLibrary {
    /// Resolve semantic modules using the actual brief and chosen font, not source copy.
    static func resolveSurveyContent(in scene:inout StyleGenome) {
        ContourSystems.resolveContent(in:&scene)
        PaperReliefSystems.resolve(in:&scene)
        GravityTypeSystems.resolve(in:&scene)
        for i in scene.elements.indices where SurveyTypeGeometry.shapes.contains(scene.elements[i].shape) {
            scene.elements[i].kind="text"
            scene.elements[i].text=scene.posterCopy?.title.replacingOccurrences(of:"\n",with:" ") ?? scene.elements[i].text ?? "SPACE"
            scene.elements[i].fontName=scene.elements[i].fontName ?? scene.font
        }
        // Material systems that set the title (letters, surface print, outline, engraving) stay shapes but carry its text.
        for i in scene.elements.indices where scene.elements[i].kind=="shape" {
            guard let id=recipeID(scene.elements[i]),ExtendedSurveyGeometry.carriesType(id,scene.elements[i].geometry ?? [:]) else{continue}
            scene.elements[i].text=scene.posterCopy?.title.replacingOccurrences(of:"\n",with:" ") ?? scene.elements[i].text
            scene.elements[i].fontName=scene.elements[i].fontName ?? scene.font
        }
    }
}
