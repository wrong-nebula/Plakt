import SwiftUI
import WebKit
import PosterCore

/// The poster the rule field starts from: its copy and its image. Text rows are separated by line breaks.
struct RuleFieldSource {
    let name: String
    let text: String
    let title: String
    let info: String
    let imageURL: URL?
}

struct RuleFieldView: View {
    let source: RuleFieldSource?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label("Rule-field letters", systemImage: "textformat")
                    .font(.callout.weight(.medium))
                Spacer()
                Text(source.map { "From \($0.name)" } ?? "No poster selected").font(.caption).foregroundStyle(.secondary)
                Button("Done") { dismiss() }.keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 18).padding(.vertical, 10)
            Divider()
            if let entryURL = RuleFieldResources.entryURL {
                RuleFieldWebView(entryURL: entryURL, source: source)
            } else {
                ContentUnavailableView("Rule-field resources are missing", systemImage: "textformat",
                                       description: Text("Run zsh scripts/build-rule-field-editor.sh, then build the app again."))
            }
        }
        .frame(minWidth: 1100, idealWidth: 1340, minHeight: 760, idealHeight: 900)
    }
}

private struct RuleFieldWebView: NSViewRepresentable {
    let entryURL: URL
    let source: RuleFieldSource?

    func makeCoordinator() -> RuleFieldCoordinator {
        RuleFieldCoordinator(entryURL: entryURL, source: source)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "ruleField")
        // Nonpersistent website storage isolates the editor from other app WebKit views.
        configuration.websiteDataStore = .nonPersistent()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        context.coordinator.webView = webView
        webView.loadFileURL(entryURL, allowingReadAccessTo: entryURL.deletingLastPathComponent())
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    static func dismantleNSView(_ nsView: WKWebView, coordinator: RuleFieldCoordinator) {
        nsView.configuration.userContentController.removeScriptMessageHandler(forName: "ruleField")
        nsView.navigationDelegate = nil
        nsView.uiDelegate = nil
        nsView.stopLoading()
    }
}
