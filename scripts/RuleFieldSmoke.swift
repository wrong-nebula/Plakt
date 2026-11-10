import AppKit
import ImageIO
import WebKit

/// Compile with RuleFieldCoordinator.swift (scripts/rule-field-smoke.sh). Runs the bundled editor in an offscreen,
/// nonactivating WebKit host behind the production bridge, sends it a generated poster's copy and image, and checks
/// the copy, the poster colours, every style, a rejected copy, and every export converted by the production code.
@main
@MainActor
enum RuleFieldSmoke {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited)
        let delegate = SmokeDelegate()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

/// The app's RuleFieldSource lives in RuleFieldView.swift with the SwiftUI views; the smoke host only needs the type.
struct RuleFieldSource {
    let name: String
    let text: String
    let title: String
    let info: String
    let imageURL: URL?
}

@MainActor
private final class SmokeDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var bridge: RuleFieldCoordinator!
    private var finished = false
    private var messages: [[String: Any]] = []
    private var report: [String] = []
    private let entry = URL(fileURLWithPath: CommandLine.arguments[1])
    private let image = URL(fileURLWithPath: CommandLine.arguments[2])
    private let output = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)
    // The default PosterLab copy, mapped as StudioRootView maps it.
    private lazy var source = RuleFieldSource(name: "poster 2035", text: "VISUAL\nCOMMUNICATION", title: "Institute of Design",
                                              info: "Visual Communication Institute / FORM · TYPE · SYSTEM • 2026", imageURL: image)

    func applicationDidFinishLaunching(_ notification: Notification) {
        bridge = RuleFieldCoordinator(entryURL: entry, source: source)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "ruleField")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1340, height: 900), configuration: config)
        webView.navigationDelegate = bridge
        webView.uiDelegate = bridge
        bridge.webView = webView
        window = NSWindow(contentRect: webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = webView
        window.setFrameOrigin(NSPoint(x: -20000, y: -20000))
        window.orderBack(nil)
        webView.loadFileURL(entry, allowingReadAccessTo: entry.deletingLastPathComponent())
        Task {
            try? await Task.sleep(for: .seconds(300))
            if !finished { finish("Timed out waiting for the rule-field editor", code: 1) }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        // Saves are kept here instead of opening panels; everything else goes through the production bridge.
        if type == "save" || type == "saveSet" { messages.append(body); return }
        bridge.userContentController(userContentController, didReceive: message)
        if type == "ready" { Task { await check() } }
    }

    private func js(_ script: String) async throws -> Any? {
        try await webView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    }

    private func expect(_ ok: Bool, _ what: String) throws {
        report.append((ok ? "PASS " : "FAIL ") + what)
        if !ok { throw RuleFieldError(what) }
    }

    private func waitFor(_ condition: String, seconds: Double = 30) async throws {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if (try await js("return Boolean(\(condition))") as? Bool) == true { return }
            try await Task.sleep(for: .milliseconds(100))
        }
        throw RuleFieldError("Waited for \(condition)")
    }

    private func check() async {
        do {
            try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
            // 1. The bridge sends the poster: copy and image arrive and set the letters, band and reference.
            try await waitFor("document.getElementById('ref-title').textContent==='The PosterLab poster'")
            try? await waitFor("document.getElementById('ref-img').naturalWidth>0", seconds: 10)
            let state = try await js("const s=RuleFieldEditor.getState();return {text:s.text,title:s.title,info:s.info,colours:!document.getElementById('poster-colours').hidden,copy:!document.getElementById('poster-copy').hidden,image:document.getElementById('ref-img').naturalWidth}") as? [String: Any] ?? [:]
            try expect(state["text"] as? String == "VISUAL/COMMUNICATION", "poster title becomes the letters: \(state["text"] ?? "nil")")
            try expect(state["title"] as? String == source.title && state["info"] as? String == source.info, "subtitle, institution and footer fill the band")
            try expect(state["colours"] as? Bool == true && state["copy"] as? Bool == true, "poster copy and poster colours offered")
            try expect((state["image"] as? Double ?? 0) >= 600, "poster image shown beside the rule field (\(state["image"] ?? 0) px wide)")
            // 2. Poster colours: four valid colours, different from the style's own.
            let before = try await js("return RuleFieldEditor.getState().colors.join()") as? String ?? ""
            _ = try await js("document.getElementById('poster-colours').click()")
            try await waitFor("RuleFieldEditor.getState().colors.join()!=='\(before)'")
            let colours = try await js("return RuleFieldEditor.getState().colors") as? [String] ?? []
            try expect(colours.count == 4 && colours.allSatisfy { $0.range(of: "^#[0-9a-f]{6}$", options: .regularExpression) != nil }, "poster colours: \(colours.joined(separator: " "))")
            // 3. Every style keeps the poster copy and draws rules.
            let styles = try await js("""
                const out=[],sel=document.getElementById('family');
                for(const o of sel.options){sel.value=o.value;sel.dispatchEvent(new Event('change'));const s=RuleFieldEditor.getState();out.push({id:o.value,text:s.text,title:s.title,rules:window.$features.rules,marks:window.$features.runs+window.$features.dots});}
                sel.value='boxes';sel.dispatchEvent(new Event('change'));return out
                """) as? [[String: Any]] ?? []
            let broken = styles.filter { $0["text"] as? String != "VISUAL/COMMUNICATION" || $0["title"] as? String != source.title || ($0["rules"] as? Double ?? 0) < 1 || ($0["marks"] as? Double ?? 0) < 10 }
            try expect(styles.count == 22 && broken.isEmpty, "\(styles.count) styles keep the poster copy and draw runs or dots\(broken.isEmpty ? "" : "; broken: \(broken.map { $0["id"] ?? "" })")")
            // 4. A copy the faces cannot set stays in the field with the reason, and the last good letters remain.
            _ = try await js("window.ruleFieldStudio.setPoster({name:'long',text:'A TITLE THAT IS FAR TOO LONG FOR THE FORTY LETTER LIMIT',title:'',info:''})")
            let rejected = try await js("return {error:document.getElementById('error').textContent,field:document.getElementById('text').value,text:RuleFieldEditor.getState().text,title:RuleFieldEditor.getState().title}") as? [String: Any] ?? [:]
            try expect((rejected["error"] as? String ?? "").contains("40") && rejected["text"] as? String == "VISUAL/COMMUNICATION" && rejected["title"] as? String == source.title,
                       "too-long copy explained (\(rejected["error"] ?? "")), letters and band kept")
            _ = try await webView.callAsyncJavaScript("window.ruleFieldStudio.setPoster(p)", arguments: ["p": RuleFieldCoordinator.payload(source)], in: nil, contentWorld: .page)
            // 5. Every export, converted by the production bridge code.
            messages.removeAll()
            for id in ["save-svg", "save-plotter", "save-seps", "save-specimen", "save-rule", "print", "save-png"] { _ = try await js("document.getElementById('\(id)').click()") }
            let deadline = Date().addingTimeInterval(90)
            while messages.count < 7 && Date() < deadline { try await Task.sleep(for: .milliseconds(200)) }
            try expect(messages.count == 7, "seven exports sent (\(messages.count))")
            var written: [String] = []
            for body in messages {
                if body["type"] as? String == "saveSet" {
                    let folder = output.appending(path: "separations")
                    try? FileManager.default.removeItem(at: folder)
                    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                    let files = body["files"] as? [[String: Any]] ?? []
                    for f in files { try Data((f["data"] as? String ?? "").utf8).write(to: folder.appending(path: f["name"] as? String ?? "x.svg")) }
                    try expect(files.count >= 2 && files.allSatisfy { ($0["data"] as? String ?? "").hasPrefix("<svg") }, "separations: \(files.count) SVG sheets in one folder")
                    written.append("separations/ (\(files.count))")
                    continue
                }
                let format = body["format"] as? String ?? "", name = body["name"] as? String ?? "x"
                let size = (body["width"] as? Double).flatMap { w in (body["height"] as? Double).map { CGSize(width: w, height: $0) } }
                let (data, _) = try await RuleFieldCoordinator.file(format: format, data: body["data"] as? String ?? "", size: size)
                try data.write(to: output.appending(path: name))
                written.append(name)
                switch format {
                case "svg": try expect(String(decoding: data.prefix(5), as: UTF8.self) == "<svg ", "\(name): SVG (\(data.count / 1024) KB)")
                case "json":
                    let rule = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
                    try expect(rule["engine"] as? String == "rule-field-v2" && rule["text"] as? String == "VISUAL/COMMUNICATION", "\(name): rule replays the poster copy")
                case "png":
                    let image = CGImageSourceCreateWithData(data as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) }
                    try expect(max(image?.width ?? 0, image?.height ?? 0) == 3000, "\(name): PNG \(image?.width ?? 0) × \(image?.height ?? 0)")
                case "pdf":
                    let document = CGDataProvider(data: data as CFData).flatMap { CGPDFDocument($0) }, page = document?.page(at: 1), box = page?.getBoxRect(.mediaBox) ?? .zero
                    try expect(document?.numberOfPages == 1 && abs(box.width - (size?.width ?? 0)) < 1 && abs(box.height - (size?.height ?? 0)) < 1,
                               "\(name): one page, \(Int(box.width)) × \(Int(box.height)) pt for a \(Int(size?.width ?? 0)) × \(Int(size?.height ?? 0)) px poster (\(data.count / 1024) KB)")
                    if let page { try render(page, box: box, to: output.appending(path: "pdf-page.png")) }
                default: break
                }
            }
            // 6. Snapshot of the editor as the sheet shows it.
            _ = try await js("window.scrollTo(0,0)")
            let snapshot = try await webView.takeSnapshot(configuration: nil)
            if let tiff = snapshot.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                try png.write(to: output.appending(path: "editor.png"))
            }
            report.append("Wrote \(written.joined(separator: ", ")), editor.png and pdf-page.png to \(output.path)")
            finish(report.joined(separator: "\n"), code: 0)
        } catch {
            finish((report + ["ERROR \(error.localizedDescription)"]).joined(separator: "\n"), code: 1)
        }
    }

    /// Draws the PDF page so the vector output can be looked at.
    private func render(_ page: CGPDFPage, box: CGRect, to url: URL) throws {
        let scale = 1000 / box.height, width = Int(box.width * scale), height = 1000
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        context.setFillColor(.white); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: scale, y: scale)
        context.drawPDFPage(page)
        guard let image = context.makeImage(), let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
    }

    private func finish(_ text: String, code: Int32) {
        guard !finished else { return }
        finished = true
        print(text)
        exit(code)
    }
}
