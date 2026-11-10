import SwiftUI

struct BorderCanvas:View {
    let image:NSImage
    @Binding var corners:[[Double]]
    let zoom:Double
    let editable:Bool
    var onEditingEnded:()->Void={}
    var body:some View {
        GeometryReader { geometry in
            let ratio=image.size.width/max(1,image.size.height)
            let width=max(100,min(geometry.size.width-60,(geometry.size.height-60)*ratio))*zoom
            let height=width/ratio
            ScrollView([.horizontal,.vertical]) {
                canvas(width:width,height:height)
                    .padding(24).frame(minWidth:geometry.size.width,minHeight:geometry.size.height)
            }
        }.background(.primary.opacity(0.08))
    }
    private func border(width:Double,height:Double)->Path {
        Path { path in
            guard corners.count==4 else{return}
            path.move(to:CGPoint(x:corners[0][0]*width,y:corners[0][1]*height))
            for point in corners.dropFirst(){path.addLine(to:CGPoint(x:point[0]*width,y:point[1]*height))}
            path.closeSubpath()
        }
    }
    private func canvas(width:Double,height:Double)->some View {
        ZStack(alignment:.topLeading) {
            Image(nsImage:image).resizable().frame(width:width,height:height)
            if editable && corners.count==4 {
                border(width:width,height:height).fill(.orange.opacity(0.13)).allowsHitTesting(false)
                border(width:width,height:height).stroke(.orange,lineWidth:2).allowsHitTesting(false)
                ForEach(0..<4,id:\.self) { i in
                    BorderHandle(point:$corners[i],index:i,width:width,height:height,onEditingEnded:onEditingEnded)
                }
            }
        }.frame(width:width,height:height).coordinateSpace(name:"poster-border").accessibilityElement(children:.contain)
    }
}
