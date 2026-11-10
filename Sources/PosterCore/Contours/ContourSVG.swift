import Foundation
import CoreGraphics

/// Imports filled SVG geometry as an editable contour outline. Paths, polygons,
/// polylines, rectangles, circles and ellipses keep their transforms and fill rule;
/// arcs become cubic curves. Strokes, text, images and <use> references are not traced.
enum ContourSVG {
    static func outline(_ data:Data)throws->ContourOutline {
        let reader=Reader(),parser=XMLParser(data:data);parser.delegate=reader
        let parsed=parser.parse()
        if let error=reader.error{throw error}
        guard parsed else{throw PosterError.invalid("The SVG could not be read: \(parser.parserError?.localizedDescription ?? "malformed XML").")}
        guard !reader.shapes.isEmpty else{throw PosterError.invalid("The SVG has no filled paths, polygons, rectangles, circles or ellipses.")}
        let combined=CGMutablePath(),rule:CGPathFillRule
        if Set(reader.shapes.map{$0.rule == .winding}).count==1 {rule=reader.shapes[0].rule;for shape in reader.shapes{combined.addPath(shape.path)}}
        else {
            // Mixed rules cannot share one fill: resolve each shape, then merge the regions.
            rule = .evenOdd;var merged:CGPath=CGMutablePath()
            for shape in reader.shapes{let resolved=shape.path.normalized(using:shape.rule);merged=merged.isEmpty ? resolved:merged.union(resolved,using:.evenOdd)}
            combined.addPath(merged)
        }
        let bounds=combined.boundingBoxOfPath
        guard bounds.width>0,bounds.height>0 else{throw PosterError.invalid("The SVG geometry has no area.")}
        var outline=ContourOutline(path:combined,in:bounds);outline.fillRule=rule == .winding ? "nonzero":"evenodd"
        guard outline.commands.count<=4096 else{throw PosterError.invalid("The SVG outline has \(outline.commands.count) vector commands; simplify it below 4096.")}
        guard (0.1...10).contains(outline.aspect) else{throw PosterError.invalid("The SVG outline is too narrow; its height must be 0.1–10 times its width.")}
        try outline.validate();return outline
    }

    private final class Reader:NSObject,XMLParserDelegate {
        struct State{var transform:CGAffineTransform;var rule:CGPathFillRule;var filled:Bool;var hidden:Bool}
        var shapes:[(path:CGPath,rule:CGPathFillRule)]=[],error:Error?
        private var stack=[State(transform:.identity,rule:.winding,filled:true,hidden:false)]
        private static let containers:Set<String>=["defs","clipPath","mask","symbol","pattern","marker","style","title","desc","metadata","linearGradient","radialGradient","filter"]
        func parser(_ parser:XMLParser,didStartElement name:String,namespaceURI:String?,qualifiedName:String?,attributes:[String:String]=[:]) {
            let parent=stack[stack.count-1],local=name.split(separator:":").last.map(String.init) ?? name
            var style:[String:String]=[:]
            for item in (attributes["style"] ?? "").split(separator:";"){let pair=item.split(separator:":",maxSplits:1);if pair.count==2{style[pair[0].trimmingCharacters(in:.whitespaces)]=pair[1].trimmingCharacters(in:.whitespaces)}}
            func property(_ key:String)->String?{(style[key] ?? attributes[key])?.trimmingCharacters(in:.whitespaces)}
            var state=parent
            if Self.containers.contains(local) || property("display")=="none"{state.hidden=true}
            if let fill=property("fill"){state.filled=fill != "none"}
            if let rule=property("fill-rule"){state.rule=rule=="evenodd" ? .evenOdd:.winding}
            do {
                if let text=attributes["transform"]{state.transform=try ContourSVG.transform(text).concatenating(parent.transform)}
                stack.append(state)
                guard !state.hidden,state.filled,let path=try ContourSVG.shape(local,attributes) else{return}
                var transform=state.transform
                if let placed=path.copy(using:&transform),!placed.isEmpty{shapes.append((placed,state.rule))}
            }catch{self.error=error;parser.abortParsing()}
        }
        func parser(_ parser:XMLParser,didEndElement name:String,namespaceURI:String?,qualifiedName:String?){if stack.count>1{stack.removeLast()}}
    }

    static func shape(_ name:String,_ a:[String:String])throws->CGPath? {
        func n(_ key:String,_ fallback:Double=0)throws->Double {
            guard let raw=a[key] else{return fallback}
            let text=raw.trimmingCharacters(in:.whitespaces),plain=text.hasSuffix("px") ? String(text.dropLast(2)):text
            guard let value=Double(plain),value.isFinite else{throw PosterError.invalid("SVG \(name) has an unreadable \(key) (\(raw)); use plain or px units.")}
            return value
        }
        switch name {
        case "path":return try a["d"].map{try pathData($0)}
        case "polygon","polyline":
            var scanner=Scanner(a["points"] ?? ""),values:[Double]=[]
            while scanner.isNumberNext(){values.append(try scanner.number())}
            guard values.count>=6 else{return nil}
            let path=CGMutablePath();path.move(to:CGPoint(x:values[0],y:values[1]))
            for i in stride(from:2,to:values.count-1,by:2){path.addLine(to:CGPoint(x:values[i],y:values[i+1]))}
            path.closeSubpath();return path
        case "rect":
            let w=try n("width"),h=try n("height");guard w>0,h>0 else{return nil}
            var rx=try n("rx",.nan),ry=try n("ry",.nan)
            if rx.isNaN{rx=ry.isNaN ? 0:ry};if ry.isNaN{ry=rx};rx=min(max(0,rx),w/2);ry=min(max(0,ry),h/2)
            let rect=CGRect(x:try n("x"),y:try n("y"),width:w,height:h)
            return rx>0 && ry>0 ? CGPath(roundedRect:rect,cornerWidth:rx,cornerHeight:ry,transform:nil):CGPath(rect:rect,transform:nil)
        case "circle":
            let r=try n("r");guard r>0 else{return nil}
            return CGPath(ellipseIn:CGRect(x:try n("cx")-r,y:try n("cy")-r,width:r*2,height:r*2),transform:nil)
        case "ellipse":
            let rx=try n("rx"),ry=try n("ry");guard rx>0,ry>0 else{return nil}
            return CGPath(ellipseIn:CGRect(x:try n("cx")-rx,y:try n("cy")-ry,width:rx*2,height:ry*2),transform:nil)
        default:return nil
        }
    }

    /// SVG number lists may omit separators: "1-2", "1.5.5", "2e-3".
    struct Scanner {
        let bytes:[UInt8];var index=0
        init(_ text:String){bytes=Array(text.utf8)}
        mutating func skip(){while index<bytes.count,[9,10,13,32,44].contains(bytes[index]){index+=1}}
        mutating func atEnd()->Bool{skip();return index>=bytes.count}
        mutating func peek()->UInt8?{skip();return index<bytes.count ? bytes[index]:nil}
        mutating func isNumberNext()->Bool{guard let c=peek() else{return false};return (48...57).contains(c) || c==43 || c==45 || c==46}
        mutating func number()throws->Double {
            skip();let start=index
            if index<bytes.count,bytes[index]==43 || bytes[index]==45{index+=1}
            var digits=false,dot=false
            while index<bytes.count {
                if (48...57).contains(bytes[index]){digits=true;index+=1}else if bytes[index]==46 && !dot{dot=true;index+=1}else{break}
            }
            if digits,index<bytes.count,bytes[index]==101 || bytes[index]==69 {
                var j=index+1;if j<bytes.count,bytes[j]==43 || bytes[j]==45{j+=1}
                if j<bytes.count,(48...57).contains(bytes[j]){index=j;while index<bytes.count,(48...57).contains(bytes[index]){index+=1}}
            }
            guard digits,let value=Double(String(decoding:bytes[start..<index],as:UTF8.self)),value.isFinite else{throw PosterError.invalid("SVG geometry contains an unreadable number.")}
            return value
        }
        mutating func flag()throws->Bool {
            skip();guard index<bytes.count,bytes[index]==48 || bytes[index]==49 else{throw PosterError.invalid("SVG arc flags must be 0 or 1.")}
            index+=1;return bytes[index-1]==49
        }
    }

    static func pathData(_ d:String)throws->CGPath {
        var s=Scanner(d);let path=CGMutablePath()
        var current=CGPoint.zero,start=CGPoint.zero,command:UInt8=0
        var lastCubic:CGPoint?,lastQuad:CGPoint?
        while !s.atEnd() {
            if let c=s.peek(),(65...90).contains(c) || (97...122).contains(c){command=c;s.index+=1}
            else if command==0 || command|32==122{throw PosterError.invalid("SVG path data has numbers without a drawing command.")}
            let relative=command>=97,kind=command|32
            func point(_ x:Double,_ y:Double)->CGPoint{relative ? CGPoint(x:current.x+x,y:current.y+y):CGPoint(x:x,y:y)}
            var cubic:CGPoint?,quad:CGPoint?
            switch kind {
            case 109:
                let p=point(try s.number(),try s.number());path.move(to:p);current=p;start=p
                command=relative ? 108:76
            case 108:let p=point(try s.number(),try s.number());path.addLine(to:p);current=p
            case 104:let x=try s.number(),p=CGPoint(x:relative ? current.x+x:x,y:current.y);path.addLine(to:p);current=p
            case 118:let y=try s.number(),p=CGPoint(x:current.x,y:relative ? current.y+y:y);path.addLine(to:p);current=p
            case 99:
                let a=point(try s.number(),try s.number()),b=point(try s.number(),try s.number()),p=point(try s.number(),try s.number())
                path.addCurve(to:p,control1:a,control2:b);current=p;cubic=b
            case 115:
                let a=lastCubic.map{CGPoint(x:current.x*2-$0.x,y:current.y*2-$0.y)} ?? current
                let b=point(try s.number(),try s.number()),p=point(try s.number(),try s.number())
                path.addCurve(to:p,control1:a,control2:b);current=p;cubic=b
            case 113:
                let c=point(try s.number(),try s.number()),p=point(try s.number(),try s.number())
                path.addQuadCurve(to:p,control:c);current=p;quad=c
            case 116:
                let c=lastQuad.map{CGPoint(x:current.x*2-$0.x,y:current.y*2-$0.y)} ?? current,p=point(try s.number(),try s.number())
                path.addQuadCurve(to:p,control:c);current=p;quad=c
            case 97:
                let rx=try s.number(),ry=try s.number(),rotation=try s.number(),large=try s.flag(),sweep=try s.flag(),p=point(try s.number(),try s.number())
                arc(path,from:current,to:p,rx:rx,ry:ry,degrees:rotation,large:large,sweep:sweep);current=p
            case 122:path.closeSubpath();current=start
            default:throw PosterError.invalid("Unsupported SVG path command \(String(UnicodeScalar(command))).")
            }
            if path.isEmpty && kind != 109{throw PosterError.invalid("SVG path data must start with a move command.")}
            lastCubic=cubic;lastQuad=quad
        }
        return path
    }

    /// Endpoint arc to cubic Béziers of at most a quarter turn each (SVG 1.1, appendix F.6).
    private static func arc(_ path:CGMutablePath,from p0:CGPoint,to p1:CGPoint,rx:Double,ry:Double,degrees:Double,large:Bool,sweep:Bool) {
        guard p0 != p1 else{return}
        var rx=abs(rx),ry=abs(ry)
        guard rx>0,ry>0 else{path.addLine(to:p1);return}
        let phi=degrees * .pi/180,cosPhi=cos(phi),sinPhi=sin(phi)
        let dx=(p0.x-p1.x)/2,dy=(p0.y-p1.y)/2,x1=cosPhi*dx+sinPhi*dy,y1=cosPhi*dy-sinPhi*dx
        let lambda=x1*x1/(rx*rx)+y1*y1/(ry*ry)
        if lambda>1{rx*=sqrt(lambda);ry*=sqrt(lambda)}
        let numerator=rx*rx*ry*ry-rx*rx*y1*y1-ry*ry*x1*x1,denominator=rx*rx*y1*y1+ry*ry*x1*x1
        let coefficient=(large==sweep ? -1.0:1.0)*sqrt(max(0,numerator/max(1e-12,denominator)))
        let cx1=coefficient*rx*y1/ry,cy1=(-coefficient)*ry*x1/rx
        let cx=cosPhi*cx1-sinPhi*cy1+(p0.x+p1.x)/2,cy=sinPhi*cx1+cosPhi*cy1+(p0.y+p1.y)/2
        func angle(_ ux:Double,_ uy:Double,_ vx:Double,_ vy:Double)->Double{atan2(ux*vy-uy*vx,ux*vx+uy*vy)}
        let theta=angle(1,0,(x1-cx1)/rx,(y1-cy1)/ry)
        var delta=angle((x1-cx1)/rx,(y1-cy1)/ry,(-x1-cx1)/rx,(-y1-cy1)/ry)
        if !sweep && delta>0{delta-=2 * .pi}else if sweep && delta<0{delta+=2 * .pi}
        let segments=max(1,Int(ceil(abs(delta)/(Double.pi/2)-1e-9))),step=delta/Double(segments),k=4/3*tan(step/4)
        func sample(_ t:Double)->(point:CGPoint,tangent:CGPoint) {
            let c=cos(t),s=sin(t)
            return (CGPoint(x:cx+rx*c*cosPhi-ry*s*sinPhi,y:cy+rx*c*sinPhi+ry*s*cosPhi),CGPoint(x:-rx*s*cosPhi-ry*c*sinPhi,y:-rx*s*sinPhi+ry*c*cosPhi))
        }
        for i in 0..<segments {
            let a=sample(theta+Double(i)*step),b=sample(theta+Double(i+1)*step)
            path.addCurve(to:i==segments-1 ? p1:b.point,control1:CGPoint(x:a.point.x+k*a.tangent.x,y:a.point.y+k*a.tangent.y),control2:CGPoint(x:b.point.x-k*b.tangent.x,y:b.point.y-k*b.tangent.y))
        }
    }

    static func transform(_ text:String)throws->CGAffineTransform {
        var s=Scanner(text),result=CGAffineTransform.identity
        while !s.atEnd() {
            let start=s.index
            while s.index<s.bytes.count,(65...90).contains(s.bytes[s.index]) || (97...122).contains(s.bytes[s.index]){s.index+=1}
            let name=String(decoding:s.bytes[start..<s.index],as:UTF8.self)
            guard s.peek()==40 else{throw PosterError.invalid("Unreadable SVG transform: \(text)")}
            s.index+=1;var v:[Double]=[]
            while s.isNumberNext(){v.append(try s.number())}
            guard s.peek()==41 else{throw PosterError.invalid("Unreadable SVG transform: \(text)")}
            s.index+=1
            let item:CGAffineTransform
            switch (name,v.count) {
            case ("matrix",6):item=CGAffineTransform(a:v[0],b:v[1],c:v[2],d:v[3],tx:v[4],ty:v[5])
            case ("translate",1),("translate",2):item=CGAffineTransform(translationX:v[0],y:v.count>1 ? v[1]:0)
            case ("scale",1),("scale",2):item=CGAffineTransform(scaleX:v[0],y:v.count>1 ? v[1]:v[0])
            case ("rotate",1):item=CGAffineTransform(rotationAngle:v[0] * .pi/180)
            case ("rotate",3):item=CGAffineTransform(translationX:-v[1],y:-v[2]).concatenating(CGAffineTransform(rotationAngle:v[0] * .pi/180)).concatenating(CGAffineTransform(translationX:v[1],y:v[2]))
            case ("skewX",1):item=CGAffineTransform(a:1,b:0,c:tan(v[0] * .pi/180),d:1,tx:0,ty:0)
            case ("skewY",1):item=CGAffineTransform(a:1,b:tan(v[0] * .pi/180),c:0,d:1,tx:0,ty:0)
            default:throw PosterError.invalid("Unsupported SVG transform \(name) with \(v.count) values.")
            }
            // The rightmost transform in a list applies to the points first.
            result=item.concatenating(result)
        }
        return result
    }
}
