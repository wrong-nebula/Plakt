import AppKit
import PosterCore
import UniformTypeIdentifiers
import WebKit

/// Bridges the bundled effector editor: the poster goes in as outlines, finished files come out through save panels.
@MainActor
final class EffectorsCoordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    weak var webView: WKWebView?
    private let entryURL: URL
    private let source: EffectorsSource?
    // While the self-test runs, alerts are recorded for its report instead of shown.
    private var selfTestMessages: [String]?

    init(entryURL: URL, source: EffectorsSource?) {
        self.entryURL = entryURL
        self.source = source
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            if let test = EffectorsSelfTest.current, selfTestMessages == nil, let webView {
                selfTestMessages = []
                Task { await test.run(in: webView, source: source?.name) { [weak self] in self?.selfTestMessages ?? [] } }
            }
            if let source { send(source.name) { try source.svg() } }
        case "openVector": chooseVector()
        case "save":
            guard let format = body["format"] as? String, let data = body["data"] as? String else { return }
            save(format: format, data: data, name: body["name"] as? String ?? "effectors.\(format)")
        default: break
        }
    }

    private func send(_ name: String, _ convert: () throws -> PosterVectors.Conversion) {
        do {
            let conversion = try convert()
            guard conversion.paths > 0 else { showError("\(name) has no vector shapes to work with. Library photographs are images; choose a generated poster or an outlined PDF or SVG."); return }
            call("window.effectorStudio.setPoster(svg, name)", arguments: ["svg": conversion.svg, "name": name])
            if !conversion.skipped.isEmpty {
                showError("\(name): \(conversion.paths) shapes converted. Not converted: \(conversion.skipped.joined(separator: ", ")).", title: "Poster outlines")
            }
        } catch { showError(error.localizedDescription) }
    }

    private func chooseVector() {
        guard let window = webView?.window else { return }
        let panel = NSOpenPanel()
        panel.title = "Choose an outlined PDF or SVG"
        panel.allowedContentTypes = [.pdf, .svg]
        panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            let name = url.deletingPathExtension().lastPathComponent
            if url.pathExtension.lowercased() == "pdf" {
                self?.send(name) { try PosterVectors.svg(pdfAt: url) }
            } else {
                do {
                    let svg = try String(contentsOf: url, encoding: .utf8)
                    self?.call("window.effectorStudio.setPoster(svg, name)", arguments: ["svg": svg, "name": name])
                } catch { self?.showError(error.localizedDescription) }
            }
        }
    }

    private func save(format: String, data: String, name: String) {
        let bytes: Data
        let type: UTType
        do {
            switch format {
            case "svg": bytes = Data(data.utf8); type = .svg
            case "json": bytes = Data(data.utf8); type = .json
            case "pdf": bytes = try PosterVectors.pdf(fromSVG: data); type = .pdf
            case "png":
                let prefix = "data:image/png;base64,"
                guard data.hasPrefix(prefix), let decoded = Data(base64Encoded: String(data.dropFirst(prefix.count))) else { return }
                bytes = decoded; type = .png
            default: return
            }
        } catch { showError(error.localizedDescription); return }
        guard let window = webView?.window else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [type]
        panel.nameFieldStringValue = name
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            do { try bytes.write(to: url, options: .atomic) } catch { self?.showError(error.localizedDescription) }
        }
    }

    private func call(_ code: String, arguments: [String: Any]) {
        Task { [weak self, weak webView] in
            guard let webView else { return }
            do { _ = try await webView.callAsyncJavaScript(code, arguments: arguments, in: nil, contentWorld: .page) }
            catch { self?.showError(error.localizedDescription) }
        }
    }

    private func showError(_ message: String, title: String = "Effectors") {
        if selfTestMessages != nil { selfTestMessages?.append("\(title): \(message)"); return }
        guard let window = webView?.window else { return }
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.beginSheetModal(for: window)
    }

    // File inputs in the editor (saved rules, SVG artwork) open a native panel.
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        guard let window = webView.window else { completionHandler(nil); return }
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        // The bundled document is the only navigation destination. No remote pages or arbitrary files.
        decisionHandler(navigationAction.request.url?.standardizedFileURL == entryURL.standardizedFileURL ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
