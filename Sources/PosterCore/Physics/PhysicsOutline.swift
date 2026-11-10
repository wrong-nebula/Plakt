import Foundation
import CoreGraphics

/// Convex collision pieces for any filled outline, including glyphs with counters, overlapping
/// contours and separate parts (tittles, accents). The outline is rasterised with the renderer's
/// non-zero fill, cut into thin horizontal bands, and each connected run of a band becomes a hull.
/// Vertically stacked hulls merge while the merge adds almost no empty area, so stems become one
/// piece while bowls, counters and crooks stay open for other bodies to nest into.
public enum PhysicsOutline {
    public static func pieces(_ path:CGPath,resolution:Int=40,band:Int=4,maxVertices:Int=8)->[[PhysicsVector]] {
        let box=path.boundingBoxOfPath
        guard box.width>0,box.height>0,box.width.isFinite,box.height.isFinite else{return []}
        let cell=max(box.width,box.height)/Double(max(8,resolution))
        let cols=Int((box.width/cell).rounded(.up))+2,rows=Int((box.height/cell).rounded(.up))+2
        guard let ctx=CGContext(data:nil,width:cols,height:rows,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceGray(),bitmapInfo:CGImageAlphaInfo.none.rawValue),let data=ctx.data else{return [rectangle(box)]}
        // Memory row r holds y in [r, r+1) cells below the padded top edge.
        ctx.translateBy(x:0,y:Double(rows));ctx.scaleBy(x:1/cell,y:-1/cell);ctx.translateBy(x:-box.minX+cell,y:-box.minY+cell)
        ctx.setFillColor(gray:1,alpha:1);ctx.addPath(path);ctx.fillPath()
        let bytes=data.assumingMemoryBound(to:UInt8.self),rowBytes=ctx.bytesPerRow
        func filled(_ r:Int,_ c:Int)->Bool{bytes[r*rowBytes+c]>=128}
        // A cell counts as ink from half coverage, so the true edge lies within half a cell of the cell boundary.
        // Runs are inset sideways by 0.3 cell, which keeps pieces on the ink and stops neighbours in tight type
        // overlapping; rows stay full height so stacked bands still meet and stems merge into one piece.
        func corner(_ c:Double,_ r:Double)->PhysicsVector{PhysicsVector(box.minX+(c-1)*cell,box.minY+(r-1)*cell)}
        let inset=0.3
        struct Piece {var points:[PhysicsVector];var cells:Int;var lastBand:Int;var low:Int;var high:Int}
        var pieces:[Piece]=[]
        let cellArea=cell*cell
        for (bandIndex,top) in stride(from:0,to:rows,by:max(1,band)).enumerated() {
            let bottom=min(rows,top+max(1,band))
            var seen=Set<Int>()
            var found:[Piece]=[]
            for r in top..<bottom {for c in 0..<cols where filled(r,c) && !seen.contains(r*cols+c) {
                // Flood fill one 8-connected component inside the band.
                var stack=[(r,c)],extremes:[Int:(Int,Int)]=[:],count=0;seen.insert(r*cols+c)
                while let (y,x)=stack.popLast() {
                    count+=1;let e=extremes[y] ?? (x,x);extremes[y]=(min(e.0,x),max(e.1,x))
                    for dy in -1...1 {for dx in -1...1 where dy != 0 || dx != 0 {
                        let ny=y+dy,nx=x+dx
                        guard ny>=top,ny<bottom,nx>=0,nx<cols,filled(ny,nx),seen.insert(ny*cols+nx).inserted else{continue}
                        stack.append((ny,nx))
                    }}
                }
                var points:[PhysicsVector]=[]
                for (y,e) in extremes.sorted(by:{$0.key<$1.key}) {
                    let left=Double(e.0)+inset,right=Double(e.1+1)-inset,top=Double(y),bottom=Double(y+1)
                    points+=[corner(left,top),corner(left,bottom),corner(right,top),corner(right,bottom)]
                }
                let low=extremes.values.map(\.0).min()!,high=extremes.values.map(\.1).max()!
                found.append(Piece(points:PhysicsWorld.hull(points),cells:count,lastBand:bandIndex,low:low,high:high))
            }}
            for piece in found {
                var best:Int?,bestAdded=Double.infinity
                for i in pieces.indices where pieces[i].lastBand==bandIndex-1 && pieces[i].low<=piece.high+1 && piece.low<=pieces[i].high+1 {
                    let merged=PhysicsWorld.hull(pieces[i].points+piece.points)
                    let added=PhysicsWorld.area(merged)-PhysicsWorld.area(pieces[i].points)-PhysicsWorld.area(piece.points)
                    if added<=0.06*Double(pieces[i].cells+piece.cells)*cellArea && added<bestAdded{best=i;bestAdded=added}
                }
                if let i=best {
                    pieces[i].points=PhysicsWorld.hull(pieces[i].points+piece.points);pieces[i].cells+=piece.cells
                    pieces[i].lastBand=bandIndex;pieces[i].low=piece.low;pieces[i].high=piece.high
                }else{pieces.append(piece)}
            }
        }
        let result=pieces.map{simplified($0.points,maxVertices:max(3,maxVertices))}.filter{$0.count>=3 && PhysicsWorld.area($0)>cellArea*0.25}
        return result.isEmpty ? [rectangle(box)]:result
    }
    static func rectangle(_ box:CGRect)->[PhysicsVector]{[PhysicsVector(box.minX,box.minY),PhysicsVector(box.maxX,box.minY),PhysicsVector(box.maxX,box.maxY),PhysicsVector(box.minX,box.maxY)]}
    /// Removes the vertex that loses the least area until the hull fits the vertex budget; stays convex.
    static func simplified(_ hull:[PhysicsVector],maxVertices:Int)->[PhysicsVector] {
        var p=hull
        func loss(_ i:Int)->Double{let a=p[(i+p.count-1)%p.count],b=p[i],c=p[(i+1)%p.count];return abs((b-a).cross(c-a))*0.5}
        while p.count>maxVertices {
            guard let i=p.indices.min(by:{loss($0)<loss($1)}) else{break}
            p.remove(at:i)
        }
        return p
    }
}
