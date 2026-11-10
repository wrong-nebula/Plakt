import SwiftUI

struct LibraryThumbnail:View {
    let url:URL
    @State private var image:NSImage?
    var body:some View {
        Group {
            if let image {Image(nsImage:image).resizable().scaledToFit()}
            else{Rectangle().fill(.quaternary)}
        }.task(id:url){image=NSImage(contentsOf:url)}.accessibilityHidden(true)
    }
}
