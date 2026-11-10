import SwiftUI
import WebKit
import PosterCore

/// A poster whose outlines effectors and modifiers act on. The SVG is produced when the editor is ready.
struct EffectorsSource {
    let name: String
    let svg: @MainActor () throws -> PosterVectors.Conversion
}

struct EffectorsView: View {
    let source: EffectorsSource?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label("Effectors & modifiers", systemImage: "wand.and.rays")
                    .font(.callout.weight(.medium))
                Spacer()
                Text(source.map { "On \($0.name)" } ?? "No poster selected").font(.caption).foregroundStyle(.secondary)
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 18).padding(.vertical, 10)
            Divider()
            if let entryURL = EffectorResources.entryURL {
                EffectorsWebView(entryURL: entryURL, source: source)
            } else {
                ContentUnavailableView("Effector resources are missing", systemImage: "wand.and.rays",
                                       description: Text("Run zsh scripts/build-effectors-editor.sh, then build the app again."))
            }
        }
        .frame(minWidth: 1100, idealWidth: 1340, minHeight: 760, idealHeight: 900)
    }
}

private struct EffectorsWebView: NSViewRepresentable {
    let entryURL: URL
    let source: EffectorsSource?

    func makeCoordinator() -> EffectorsCoordinator {
        EffectorsCoordinator(entryURL: entryURL, source: source)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "effectors")
        // Nonpersistent website storage isolates the editor from other app WebKit views.
        configuration.websiteDataStore = .nonPersistent()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        context.coordinator.webView = webView
        webView.loadFileURL(entryURL, allowingReadAccessTo: entryURL.deletingLastPathComponent())
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    static func dismantleNSView(_ nsView: WKWebView, coordinator: EffectorsCoordinator) {
        nsView.configuration.userContentController.removeScriptMessageHandler(forName: "effectors")
        nsView.navigationDelegate = nil
        nsView.uiDelegate = nil
        nsView.stopLoading()
    }
}
