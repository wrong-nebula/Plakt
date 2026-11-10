import SwiftUI

struct LibrarySearchControls:View {
    @Bindable var model:LibraryReviewModel
    var body:some View {
        VStack(alignment:.leading,spacing:8) {
            Picker("Search method",selection:$model.semanticMode) {
                Text("Words & tags").tag(false)
                Text("Visual meaning").tag(true)
            }.pickerStyle(.segmented)
                .disabled(model.semanticBusy)
            TextField(model.semanticMode ? "Describe a poster design":"Find words, colors or techniques",text:$model.query)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel(model.semanticMode ? "Describe the design to search for":"Search words and tags")
                .onSubmit {model.searchSemantically()}
                .disabled(model.semanticBusy)
            if model.semanticMode {
                HStack {
                    if model.semanticBusy {
                        ProgressView().controlSize(.small)
                        Button("Stop"){model.cancelSemanticWork()}
                    }else{
                        Button("Search",systemImage:"magnifyingglass"){model.searchSemantically()}
                            .disabled(model.query.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
                        Spacer(minLength:0)
                        Menu("Index",systemImage:"arrow.clockwise") {
                            Button("Build or refresh search index"){model.buildSemanticIndex()}
                        }.help("Index poster images once for local visual search.")
                    }
                }
                Text(model.semanticMessage).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal:false,vertical:true)
                if model.semanticHasResults,model.filtered.isEmpty {
                    Text("No matches in this review section. Try Elements & styles to include reviewed posters.")
                        .font(.caption).fixedSize(horizontal:false,vertical:true)
                }
            }
        }.padding(10)
            .onChange(of:model.query){model.invalidateSemanticSearch()}
            .onChange(of:model.semanticMode){model.invalidateSemanticSearch()}
            .onChange(of:model.borderMode){model.invalidateSemanticSearch()}
    }
}
