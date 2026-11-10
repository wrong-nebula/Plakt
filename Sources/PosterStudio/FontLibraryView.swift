import SwiftUI
import PosterCore

struct FontLibraryView:View {
    let currentProfileID:String?
    let choose:(String?)->Void
    @Environment(\.dismiss) private var dismiss
    @State private var query=""
    @State private var familyID:String?="archivo"
    @State private var profileID=""
    @State private var preview:NSImage?
    @State private var error:String?
    private let library=FontLibrary.shared
    private var families:[FontFamilyRecord] {library.manifest.families.filter{query.isEmpty || ($0.family+" "+$0.category+" "+$0.designer).localizedCaseInsensitiveContains(query)}}
    private var profiles:[FontStyleProfile] {library.profiles.filter{$0.familyID==familyID}.sorted{a,b in a.weight==b.weight ? a.width==b.width ? !a.italic && b.italic:a.width>b.width:a.weight<b.weight}}
    private var profile:FontStyleProfile? {library.profile(profileID)}
    var body:some View {
        VStack(spacing:0) {
            HStack {
                VStack(alignment:.leading,spacing:4){Text("Font library").font(.title2.bold());Text("Google Fonts · local assets · weight, width and shape embeddings").font(.caption).foregroundStyle(.secondary)}
                Spacer();Button("Done"){dismiss()}.keyboardShortcut(.cancelAction)
            }.padding(20)
            Divider()
            HSplitView {
                VStack(spacing:8) {
                    TextField("Search family, category or designer",text:$query).textFieldStyle(.roundedBorder).padding([.horizontal,.top],12)
                    List(selection:$familyID) {ForEach(families){family in
                        VStack(alignment:.leading,spacing:4){Text(family.family).font(.body.weight(.medium));Text(family.category).font(.caption).foregroundStyle(.secondary)}.padding(.vertical,4).tag(family.id)
                    }}
                }.frame(minWidth:220,idealWidth:250,maxWidth:310)
                ScrollView {
                    VStack(alignment:.leading,spacing:18) {
                        if let profile,let family=library.manifest.families.first(where:{$0.id==profile.familyID}) {
                            HStack {Text(family.family).font(.largeTitle.weight(.semibold));Spacer();Link("Google Fonts source",destination:family.sourceURL).font(.caption)}
                            Text(family.designer+" · "+family.category+" · "+family.license).font(.caption).foregroundStyle(.secondary)
                            Picker("Weight & width",selection:$profileID){ForEach(profiles){p in Text(p.label).tag(p.id)}}.pickerStyle(.menu)
                            if let preview {Image(nsImage:preview).resizable().aspectRatio(contentMode:.fit).clipShape(.rect(cornerRadius:8)).accessibilityLabel("Selected font specimen: VISUAL, Hamburgefontsiv, numbers and letterforms")}
                            HStack(spacing:22){Label("\(Int(profile.weight)) weight",systemImage:"bold");Label("\(Int(profile.width)) width axis",systemImage:"arrow.left.and.right");Text(profile.italic ? "Italic":"Upright")}.font(.caption)
                            if !profile.variations.isEmpty {Text(profile.variations.sorted{$0.key<$1.key}.map{"\($0.key) \($0.value.formatted(.number.precision(.fractionLength(0...1))))"}.joined(separator:" · ")).font(.caption.monospaced()).foregroundStyle(.secondary)}
                            Divider()
                            Text("Similar font styles").font(.headline)
                            Text("\(profile.embedding.count) dimensions combine category, weight, width, slant, glyph metrics and raster shape. A separate \(profile.specimenEmbedding?.dimensions ?? 0)-dimension Vision vector describes an identical specimen for every style.").font(.caption).foregroundStyle(.secondary)
                            ForEach(library.nearest(to:profile,limit:6,otherFamilies:true),id:\.0.id){p,distance in
                                Button {familyID=p.familyID;profileID=p.id} label:{HStack{Text(p.label);Spacer();Text(distance.formatted(.number.precision(.fractionLength(3)))).monospacedDigit().foregroundStyle(.secondary)}}.buttonStyle(.plain)
                            }
                            Text("Descriptive similarity, not a trained style attribution or exact font identification. Fonts register inside this app; each generated scene stores its asset checksum and variable axes.").font(.caption2).foregroundStyle(.secondary)
                        }else{ContentUnavailableView("No indexed font profiles",systemImage:"textformat",description:Text(error ?? "Index the bundled fonts to browse their styles."))}
                    }.padding(24)
                }.frame(minWidth:540)
            }
            Divider()
            HStack {
                Text("\(library.manifest.families.count) families · \(library.profiles.count) style / axis profiles").font(.caption).foregroundStyle(.secondary)
                Spacer();Button("Choose automatically"){choose(nil);dismiss()}
                Button("Use in source studies"){choose(profileID);dismiss()}.buttonStyle(.borderedProminent).disabled(profile==nil)
            }.padding(18)
        }.frame(minWidth:900,minHeight:700)
        .onAppear{if let id=currentProfileID,let p=library.profile(id){familyID=p.familyID;profileID=id}else{selectFamily()}}
        .onChange(of:familyID){if profile?.familyID != familyID{selectFamily()}}
        .task(id:profileID){guard let profile else{return};do{preview=NSImage(cgImage:try FontLibrary.specimen(profile),size:.zero)}catch{self.error=error.localizedDescription}}
    }
    private func selectFamily(){profileID=profiles.first(where:{$0.weight>=400 && !$0.italic})?.id ?? profiles.first?.id ?? ""}
}
