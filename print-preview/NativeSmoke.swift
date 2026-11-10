import AppKit
import WebKit

/// Compile with Sources/PosterStudio/PrintPreviewCoordinator.swift; runs an independent,
/// nonactivating WebKit host and checks the production bridge against the offline bundle.
@main
@MainActor
enum NativeSmoke {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited)
        let delegate = SmokeDelegate()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

@MainActor
private final class SmokeDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var bridge: PrintPreviewCoordinator!
    private var finished = false
    private let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    private let suite = "posterlab-print-preview-verification-" + UUID().uuidString

    func applicationDidFinishLaunching(_ notification: Notification) {
        let entry = root.appending(path: "Sources/PosterCore/Resources/PrintPreview/index.html")
        let artwork = root.appending(path: "output/curated/color-field-user-v13/poster.png")
        bridge = PrintPreviewCoordinator(entryURL: entry, artworkURL: artwork, preferences: UserDefaults(suiteName: suite)!)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "printPreview")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1240, height: 850), configuration: config)
        webView.navigationDelegate = bridge
        bridge.webView = webView
        window = NSWindow(contentRect: webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = webView
        window.setFrameOrigin(NSPoint(x: -20000, y: -20000))
        window.orderBack(nil)
        webView.loadFileURL(entry, allowingReadAccessTo: entry.deletingLastPathComponent())
        Task {
            try? await Task.sleep(for: .seconds(45))
            if !finished { finish("Timed out waiting for the bundled WebKit renderer", code: 1) }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        bridge.userContentController(userContentController, didReceive: message)
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "error" { finish("Renderer error: \(body)", code: 1) }
        if type == "ready" { Task { await check() } }
    }

    private func js(_ script: String) async throws -> Any? {
        try await webView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    }

    private func check() async {
        do {
            for _ in 0..<20 {
                let name = try await js("return document.querySelector('#artwork-name').textContent") as? String
                if name == "poster.png" { break }
                try await Task.sleep(for: .milliseconds(500))
            }
            let name = try await js("return document.querySelector('#artwork-name').textContent") as? String
            guard name == "poster.png" else { finish("Native artwork import failed", code: 1); return }
            _ = try await js("return window.posterPreview.snapshot()")
            guard try await js("return window.posterPreview.diagnostics().settings.environment") as? String == "studio" else {
                finish("The default studio scene did not load", code: 1); return
            }
            try await capture("native-studio.png")
            let highResolution = try await js("const blob=await window.posterPreview.renderImage(3840); const header=await blob.slice(0,24).arrayBuffer(); const view=new DataView(header); return [blob.size,view.getUint32(16),view.getUint32(20)];") as? [NSNumber]
            guard let highResolution, highResolution.count == 3,
                  max(highResolution[1].intValue, highResolution[2].intValue) == 3840, highResolution[0].intValue > 100_000 else {
                finish("Native high-resolution PNG rendering failed", code: 1); return
            }
            print("Native 4K PNG: \(highResolution[1]) × \(highResolution[2]), \(highResolution[0]) bytes")
            _ = try await js("window.posterPreview.restore({environment:'gallery',finish:'gold',mask:'accent'}); return true")
            try await Task.sleep(for: .milliseconds(500))
            // Offscreen WebKit throttles rAF. Snapshot explicitly renders the scene before readback.
            _ = try await js("return window.posterPreview.snapshot()")
            let diagnostics = try await js("return window.posterPreview.diagnostics()")
            guard let report = diagnostics as? [String: Any], let settings = report["settings"] as? [String: Any],
                  settings["environment"] as? String == "gallery", settings["finish"] as? String == "gold" else {
                finish("Native scene settings did not reach the renderer", code: 1); return
            }
            let error = try await js("return document.querySelector('#error').hidden") as? Bool
            guard error == true else { finish("WebKit shader failed", code: 1); return }
            let output = root.appending(path: "output/print-preview")
            try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
            try await capture("native-webkit.png")
            if let diagnostics, JSONSerialization.isValidJSONObject(diagnostics) {
                try JSONSerialization.data(withJSONObject: diagnostics, options: [.prettyPrinted, .sortedKeys])
                    .write(to: output.appending(path: "native-webkit-report.json"))
            }
            let exported = try await js("return window.posterPreview.snapshot()") as? String
            guard exported?.hasPrefix("data:image/png;base64,") == true else { finish("Native PNG export failed", code: 1); return }
            _ = try await js("window.posterPreview.dispose(); return true")
            finish("Native WebKit checks passed: offline loading, production artwork bridge, gallery/foil shader, snapshot/export and disposal", code: 0)
        } catch { finish(error.localizedDescription, code: 1) }
    }

    private func capture(_ filename: String) async throws {
        let image = try await webView.takeSnapshot(configuration: nil)
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "PrintPreviewVerification", code: 1, userInfo: [NSLocalizedDescriptionKey: "WebKit snapshot failed"])
        }
        let output = root.appending(path: "output/print-preview")
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        try png.write(to: output.appending(path: filename))
    }

    private func finish(_ message: String, code: Int32) {
        guard !finished else { return }
        finished = true
        UserDefaults.standard.removePersistentDomain(forName: suite)
        print(message)
        exit(code)
    }
}
