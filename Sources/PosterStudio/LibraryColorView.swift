import SwiftUI
import PosterCore

struct LibraryColorView:View {
    let profile:PosterColorProfile?
    var body:some View {
        VStack(alignment:.leading,spacing:10) {
            Text("Measured colors").font(.headline)
            if let profile {
                ForEach(Array(profile.swatches.enumerated()),id:\.offset) { _,swatch in
                    HStack {
                        Rectangle().fill(color(swatch.hex)).frame(width:28,height:28).border(.gray.opacity(0.5))
                        VStack(alignment:.leading) {
                            Text(swatch.name).font(.caption.bold())
                            Text("\(swatch.hex) · \(swatch.basicFamily) · \(swatch.proportion.formatted(.percent.precision(.fractionLength(0))))").font(.caption2)
                        }
                    }
                }
                Text(profile.paletteTypes.joined(separator:" · ")).font(.caption)
                let harmonies=profile.harmonies.filter{$0.score>=0.65}
                if !harmonies.isEmpty {Text("Suggested harmony: "+harmonies.map(\.type).joined(separator:", ")).font(.caption)}
                Text("Photographed sRGB colors. Names are nearest Meodai catalog matches; harmonies are geometric suggestions.").font(.caption2).foregroundStyle(.secondary)
            }else{Text("Colors have not been analyzed yet.").font(.caption).foregroundStyle(.secondary)}
        }
    }
    private func color(_ hex:String)->Color {
        let n=Int(hex.dropFirst(),radix:16) ?? 0
        return Color(.sRGB,red:Double((n>>16)&255)/255,green:Double((n>>8)&255)/255,blue:Double(n&255)/255,opacity:1)
    }
}
