import SwiftUI

struct BorderHandle:View {
    @Binding var point:[Double]
    let index:Int
    let width:Double
    let height:Double
    var onEditingEnded:()->Void={}
    @FocusState private var focused:Bool
    var body:some View {
        Text("\(index+1)").font(.callout.bold()).foregroundStyle(.black)
            .frame(width:30,height:30).background(.white,in:Circle())
            .overlay{Circle().stroke(focused ? Color.blue:Color.orange,lineWidth:3)}
            .contentShape(Circle()).focusable().focused($focused)
            .accessibilityLabel(["Top left","Top right","Bottom right","Bottom left"][index]+" poster corner")
            .accessibilityValue("x \(point[0].formatted(.percent)), y \(point[1].formatted(.percent))")
            .help("Drag this corner. Focus and use arrow keys for fine adjustment.")
            .gesture(DragGesture(minimumDistance:0,coordinateSpace:.named("poster-border")).onChanged { value in
                focused=true
                point=[min(1,max(0,value.location.x/width)),min(1,max(0,value.location.y/height))]
            }.onEnded{_ in onEditingEnded()})
            .onMoveCommand(perform:move)
            .position(x:point[0]*width,y:point[1]*height)
    }
    private func move(_ direction:MoveCommandDirection) {
        let step=0.002
        switch direction {
        case .left:point[0]=max(0,point[0]-step)
        case .right:point[0]=min(1,point[0]+step)
        case .up:point[1]=max(0,point[1]-step)
        case .down:point[1]=min(1,point[1]+step)
        default:break
        }
        onEditingEnded()
    }
}
