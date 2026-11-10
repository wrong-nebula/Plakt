import AppKit
import ImageIO
import UniformTypeIdentifiers
import WebKit

/// Bridges the bundled rule-field editor: the poster's copy and a small image go in, finished files come out through save panels.
@MainActor
final class RuleFieldCoordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    weak var webView: WKWebView?
    private let entryURL: URL
    private let source: RuleFieldSource?

    init(entryURL: URL, source: RuleFieldSource?) {
        self.entryURL = entryURL
        self.source = source
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready": if let source { call("window.ruleFieldStudio.setPoster(poster)", arguments: ["poster": Self.payload(source)]) }
        case "save":
            guard let format = body["format"] as? String, let data = body["data"] as? String else { return }
            let size = (body["width"] as? Double).flatMap { w in (body["height"] as? Double).map { CGSize(width: w, height: $0) } }
            let name = body["name"] as? String ?? "rule-field.\(format)"
            Task {
                do { save(try await Self.file(format: format, data: data, size: size), name: name) }
                catch { showError(error.localizedDescription) }
            }
        case "saveSet":
            guard let folder = body["folder"] as? String, let files = body["files"] as? [[String: Any]] else { return }
            saveFolder(folder, files: files.compactMap { f in (f["name"] as? String).flatMap { n in (f["data"] as? String).map { (n, Data($0.utf8)) } } })
        default: break
        }
    }

    /// What the editor receives: copy for the letters, title and information band, and the poster as a 900 px JPEG.
    static func payload(_ source: RuleFieldSource) -> [String: Any] {
        var poster: [String: Any] = ["name": source.name, "text": source.text, "title": source.title, "info": source.info]
        if let url = source.imageURL, let image = imageDataURL(url) { poster["image"] = image }
        return poster
    }

    static func imageDataURL(_ url: URL, maxPixel: Int = 900) -> String? {
        let options = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: maxPixel,
                       kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary
        guard let input = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateThumbnailAtIndex(input, 0, options) else { return nil }
        let data = NSMutableData()
        guard let output = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(output, image, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
        guard CGImageDestinationFinalize(output) else { return nil }
        return "data:image/jpeg;base64," + (data as Data).base64EncodedString()
    }

    /// The bytes for one export. SVG and JSON are text; PNG arrives as a data URL; PDF is the poster SVG printed by WebKit.
    static func file(format: String, data: String, size: CGSize?) async throws -> (Data, UTType) {
        switch format {
        case "svg": return (Data(data.utf8), .svg)
        case "json": return (Data(data.utf8), .json)
        case "png":
            let prefix = "data:image/png;base64,"
            guard data.hasPrefix(prefix), let decoded = Data(base64Encoded: String(data.dropFirst(prefix.count))) else { throw RuleFieldError("The PNG could not be read.") }
            return (decoded, .png)
        case "pdf":
            guard let size, size.width > 0, size.height > 0 else { throw RuleFieldError("The PDF needs the poster size.") }
            return (try await SVGPrinter().pdf(svg: data, size: size), .pdf)
        default: throw RuleFieldError("Unknown export: \(format)")
        }
    }

    private func save(_ file: (Data, UTType), name: String) {
        guard let window = webView?.window else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [file.1]
        panel.nameFieldStringValue = name
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            do { try file.0.write(to: url, options: .atomic); self?.saved("Saved \(url.lastPathComponent).") }
            catch { self?.showError(error.localizedDescription) }
        }
    }

    /// Separations save as one new folder of SVG sheets.
    private func saveFolder(_ folder: String, files: [(String, Data)]) {
        guard let window = webView?.window, !files.isEmpty else { return }
        let panel = NSSavePanel()
        panel.title = "Save ink separations"
        panel.prompt = "Save \(files.count) sheets"
        panel.nameFieldStringValue = folder
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                for (name, data) in files { try data.write(to: url.appending(path: name), options: .atomic) }
                self?.saved("Saved \(files.count) separation\(files.count == 1 ? "" : "s") in \(url.lastPathComponent).")
            } catch { self?.showError(error.localizedDescription) }
        }
    }

    private func saved(_ message: String) { call("window.ruleFieldStudio.saved(message)", arguments: ["message": message]) }

    private func call(_ code: String, arguments: [String: Any]) {
        Task { [weak self, weak webView] in
            guard let webView else { return }
            do { _ = try await webView.callAsyncJavaScript(code, arguments: arguments, in: nil, contentWorld: .page) }
            catch { self?.showError(error.localizedDescription) }
        }
    }

    private func showError(_ message: String) {
        guard let window = webView?.window else { return }
        let alert = NSAlert()
        alert.messageText = "Rule-field letters"
        alert.informativeText = message
        alert.beginSheetModal(for: window)
    }

    // The editor's "Open a saved rule" file input opens a native panel.
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.json]
        guard let window = webView.window else { completionHandler(nil); return }
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        // The bundled document is the only destination; the editor's own ?rule= updates use replaceState, not navigation.
        decisionHandler(navigationAction.request.url?.standardizedFileURL.path == entryURL.standardizedFileURL.path ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

struct RuleFieldError: LocalizedError {
    let errorDescription: String?
    init(_ message: String) { errorDescription = message }
}

/// Prints one SVG to a single-page vector PDF the size of the poster (1 CSS px = 1 pt).
@MainActor
final class SVGPrinter: NSObject, WKNavigationDelegate {
    private var loaded: CheckedContinuation<Void, Error>?

    func pdf(svg: String, size: CGSize) async throws -> Data {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let webView = WKWebView(frame: CGRect(origin: .zero, size: size), configuration: configuration)
        webView.navigationDelegate = self
        let html = "<!doctype html><meta charset=\"utf-8\"><style>html,body{margin:0}svg{display:block;width:\(size.width)px;height:\(size.height)px}</style>" + svg
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            loaded = continuation
            webView.loadHTMLString(html, baseURL: nil)
        }
        let configurationPDF = WKPDFConfiguration()
        configurationPDF.rect = CGRect(origin: .zero, size: size)
        return try await webView.pdf(configuration: configurationPDF)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded?.resume(); loaded = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { loaded?.resume(throwing: error); loaded = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { loaded?.resume(throwing: error); loaded = nil }
}
