import SwiftUI
import PosterCore

struct ElementHitBox:View {
    let element:PosterElement
    @Binding var selection:String?
    let width:Double
    let height:Double
    var body:some View {
        let b=element.bounds,selected=selection==element.id
        Button {selection=element.id} label: {
            Rectangle().fill(Color.accentColor.opacity(selected ? 0.16:0.001))
                .overlay{Rectangle().stroke(selected ? Color.accentColor:Color.orange.opacity(0.65),lineWidth:selected ? 2:1)}
        }.buttonStyle(.plain).frame(width:b.width*width,height:b.height*height)
            .position(x:(b.x+b.width/2)*width,y:(b.y+b.height/2)*height)
            .accessibilityLabel("Inspect "+element.kind+" "+(element.text ?? element.id))
    }
}
