import SwiftUI
import PosterCore

struct ElementCanvas:View {
    let image:NSImage
    let elements:[PosterElement]
    @Binding var selection:String?
    let zoom:Double
    let showWords:Bool
    var body:some View {
        GeometryReader { geometry in
            let ratio=image.size.width/max(1,image.size.height)
            let width=max(100,min(geometry.size.width-60,(geometry.size.height-60)*ratio))*zoom
            let height=width/ratio
            ScrollView([.horizontal,.vertical]) {
                canvas(width:width,height:height).padding(24)
                    .frame(minWidth:geometry.size.width,minHeight:geometry.size.height)
            }
        }.background(.primary.opacity(0.08))
    }
    private func canvas(width:Double,height:Double)->some View {
        ZStack(alignment:.topLeading) {
            Image(nsImage:image).resizable().frame(width:width,height:height)
            ForEach(elements.filter{$0.reviewStatus != "rejected" && (showWords || $0.kind != "word")}) { element in
                ElementHitBox(element:element,selection:$selection,width:width,height:height)
            }
        }.frame(width:width,height:height)
    }
}
