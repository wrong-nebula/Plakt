import Foundation
import CoreGraphics

public struct ContourPoint:Codable,Sendable {
    public var x:Double;public var y:Double
    public init(x:Double,y:Double){self.x=x;self.y=y}
}
public struct ContourCommand:Codable,Sendable {
    public var kind:String;public var points:[ContourPoint]
    public init(kind:String,points:[ContourPoint]=[]){self.kind=kind;self.points=points}
}
/// A source outline, not a baked collection of channel paths. Coordinates use the
/// scene's top-left unit space; curve commands survive preset/genome round trips.
public struct ContourOutline:Codable,Sendable {
    public var version="contour-outline-v1"
    public var aspect:Double
    public var commands:[ContourCommand]
    /// "nonzero" or "evenodd". Absent in older files, which were always filled even-odd.
    public var fillRule:String?=nil
    public var pathFillRule:CGPathFillRule{fillRule=="nonzero" ? .winding:.evenOdd}
    public init(aspect:Double=1,commands:[ContourCommand]){self.aspect=aspect;self.commands=commands}
    public init(path:CGPath,in bounds:CGRect) {
        aspect=bounds.height/max(0.00001,bounds.width);commands=[]
        func point(_ p:CGPoint)->ContourPoint{ContourPoint(x:(p.x-bounds.minX)/max(0.00001,bounds.width),y:(p.y-bounds.minY)/max(0.00001,bounds.height))}
        path.applyWithBlock{pointer in
            let e=pointer.pointee
            switch e.type {
            case .moveToPoint:commands.append(.init(kind:"M",points:[point(e.points[0])]))
            case .addLineToPoint:commands.append(.init(kind:"L",points:[point(e.points[0])]))
            case .addQuadCurveToPoint:commands.append(.init(kind:"Q",points:[point(e.points[0]),point(e.points[1])]))
            case .addCurveToPoint:commands.append(.init(kind:"C",points:[point(e.points[0]),point(e.points[1]),point(e.points[2])]))
            case .closeSubpath:commands.append(.init(kind:"Z"))
            @unknown default:break
            }
        }
    }
    public func validate()throws {
        guard version=="contour-outline-v1",aspect.isFinite,(0.1...10).contains(aspect),(2...4096).contains(commands.count),commands.first?.kind=="M" else{throw PosterError.invalid("Invalid contour outline version, proportions or command count.")}
        guard fillRule==nil || fillRule=="nonzero" || fillRule=="evenodd" else{throw PosterError.invalid("Contour outline fill rule must be nonzero or evenodd.")}
        let sizes=["M":1,"L":1,"Q":2,"C":3,"Z":0]
        for command in commands {
            guard sizes[command.kind]==command.points.count,command.points.allSatisfy({$0.x.isFinite && $0.y.isFinite && (-4...4).contains($0.x) && (-4...4).contains($0.y)}) else{throw PosterError.invalid("Contour outlines support finite M/L/Q/C/Z commands in normalized coordinates.")}
        }
    }
    public func path()throws->CGPath {
        try validate();let path=CGMutablePath()
        for command in commands {
            let p=command.points.map{CGPoint(x:$0.x,y:$0.y)}
            switch command.kind {
            case "M":path.move(to:p[0])
            case "L":path.addLine(to:p[0])
            case "Q":path.addQuadCurve(to:p[1],control:p[0])
            case "C":path.addCurve(to:p[2],control1:p[0],control2:p[1])
            default:path.closeSubpath()
            }
        }
        return path
    }
    /// Filled SVG geometry (paths, polygons, rectangles, circles, ellipses) with its fill rule.
    public init(svg data:Data)throws{self=try ContourSVG.outline(data)}
    /// Reads either a saved contour-outline JSON file or an SVG drawing.
    public static func load(from url:URL)throws->ContourOutline {
        let data=try Data(contentsOf:url)
        let markup=data.first{!" \t\r\n".utf8.contains($0)}==UInt8(ascii:"<")
        let outline=url.pathExtension.lowercased()=="svg" || markup ? try ContourOutline(svg:data):try JSONDecoder().decode(ContourOutline.self,from:data)
        try outline.validate();return outline
    }
}
public struct ContourCustomization:Codable,Sendable {
    public var version="contour-customization-v1"
    public var text:String?
    public var outline:ContourOutline?
    public var secondaryInk:String?
    public init(text:String?=nil,outline:ContourOutline?=nil,secondaryInk:String?=nil){self.text=text;self.outline=outline;self.secondaryInk=secondaryInk}
    public func validate()throws {
        guard version=="contour-customization-v1" else{throw PosterError.invalid("Unsupported contour customization.")}
        if let text {guard !text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,text.count<=48 else{throw PosterError.invalid("Enter 1–48 visible contour characters.")}}
        if let outline {try outline.validate()}
        if let secondaryInk {guard secondaryInk.count==7,secondaryInk.first=="#",UInt32(secondaryInk.dropFirst(),radix:16) != nil else{throw PosterError.invalid("Use a six-digit hex channel color, such as #f3b28d.")}}
    }
}
