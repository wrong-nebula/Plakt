import Foundation

/// Voronoi fracture of compound convex bodies. Cells partition a padded bounding box, so every point of the
/// original outline belongs to exactly one fragment; each fragment's collision pieces are the exact convex
/// intersections of the body's pieces with its cells.
public enum PhysicsFracture {
    /// Keeps the part of a convex polygon where `normal · p <= offset`.
    static func clip(_ polygon:[PhysicsVector],_ normal:PhysicsVector,_ offset:Double)->[PhysicsVector] {
        var out:[PhysicsVector]=[]
        for i in polygon.indices {
            let a=polygon[i],b=polygon[(i+1)%polygon.count],da=normal.dot(a)-offset,db=normal.dot(b)-offset
            if da<=0{out.append(a)}
            if da*db<0{out.append(a+(da/(da-db))*(b-a))}
        }
        return out
    }
    /// Intersection of two convex polygons; `b` must be counter-clockwise (positive area). Empty when they don't overlap.
    public static func intersection(_ a:[PhysicsVector],_ b:[PhysicsVector])->[PhysicsVector] {
        var out=a
        for i in b.indices where !out.isEmpty {let p=b[i],normal=(b[(i+1)%b.count]-p).cross(1);out=clip(out,normal,normal.dot(p))}
        return out.count>=3 && PhysicsWorld.area(out)>1e-12 ? out:[]
    }
    /// Voronoi cells of `seeds` inside the box from `low` to `high`, in seed order.
    public static func cells(_ seeds:[PhysicsVector],low:PhysicsVector,high:PhysicsVector)->[[PhysicsVector]] {
        let box=[low,PhysicsVector(high.x,low.y),high,PhysicsVector(low.x,high.y)]
        return seeds.indices.map{i in
            var cell=box
            for j in seeds.indices where j != i && !cell.isEmpty {
                let normal=seeds[j]-seeds[i]
                if normal.length>1e-9{cell=clip(cell,normal,normal.dot(0.5*(seeds[i]+seeds[j])))}
            }
            return cell
        }
    }
    /// Splits a body's convex pieces (body-local) into about `count` fragments around a local impact point. Seeds
    /// crowd the impact, so shards are small where it hit and large far away. Cells holding almost no material join
    /// the fragment of the nearest larger seed. Returns no fragments when fewer than two would carry material.
    public static func fragments(pieces:[[PhysicsVector]],impact:PhysicsVector,count:Int,rng:inout SeededRandom)->[(pieces:[[PhysicsVector]],cells:[[PhysicsVector]])] {
        let points=pieces.flatMap{$0}
        guard let minX=points.map(\.x).min(),let maxX=points.map(\.x).max(),let minY=points.map(\.y).min(),let maxY=points.map(\.y).max() else{return []}
        let size=max(maxX-minX,maxY-minY),pad=0.04*size
        let low=PhysicsVector(minX-pad,minY-pad),high=PhysicsVector(maxX+pad,maxY+pad)
        func inside(_ p:PhysicsVector)->PhysicsVector{PhysicsVector(max(low.x,min(high.x,p.x)),max(low.y,min(high.y,p.y)))}
        let start=inside(impact)
        var seeds=[start]
        while seeds.count<max(2,count) {
            let angle=rng.value(0,2 * .pi),radius=size*(0.12+0.88*pow(rng.unit(),1.4))
            seeds.append(inside(start+radius*PhysicsVector(cos(angle),sin(angle))))
        }
        let cells=cells(seeds,low:low,high:high),total=pieces.reduce(0.0){$0+PhysicsWorld.area($1)}
        let parts=cells.map{cell in pieces.map{intersection($0,cell)}.filter{!$0.isEmpty}}
        let areas=parts.map{$0.reduce(0.0){$0+PhysicsWorld.area($1)}}
        let kept=cells.indices.filter{areas[$0]>=total*0.015}
        guard kept.count>=2 else{return []}
        var groups=kept.map{(pieces:parts[$0],cells:[cells[$0]])}
        for i in cells.indices where !kept.contains(i) && cells[i].count>=3 {
            let nearest=kept.indices.min{(seeds[kept[$0]]-seeds[i]).length<(seeds[kept[$1]]-seeds[i]).length}!
            groups[nearest].pieces+=parts[i];groups[nearest].cells.append(cells[i])
        }
        return groups
    }
}
