import AppKit
import WebKit

/// Compile with PosterVectors.swift and EffectorsCoordinator.swift (scripts/effectors-smoke.sh). Runs the bundled
/// editor in an offscreen, nonactivating WebKit host behind the production bridge, sends it a real poster PDF and
/// checks every recipe, every combination and the exports.
@main
@MainActor
enum EffectorsSmoke {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited)
        let delegate = SmokeDelegate()
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

/// The app's EffectorsSource lives in EffectorsView.swift with the SwiftUI views; the smoke host only needs the type.
struct EffectorsSource {
    let name: String
    let svg: @MainActor () throws -> PosterVectors.Conversion
}

/// PosterVectors throws PosterCore's error; the smoke host compiles it without the rest of PosterCore.
enum PosterError: LocalizedError {
    case invalid(String)
    case render
    var errorDescription: String? {
        switch self {
        case .invalid(let text): text
        case .render: "The PDF could not be drawn."
        }
    }
}

@MainActor
private final class SmokeDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var bridge: EffectorsCoordinator!
    private var finished = false
    private var saved: [String: String] = [:]
    private let entry = URL(fileURLWithPath: CommandLine.arguments[1])
    private let posterPDF = URL(fileURLWithPath: CommandLine.arguments[2])
    private let output = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)

    func applicationDidFinishLaunching(_ notification: Notification) {
        let name = posterPDF.deletingPathExtension().lastPathComponent
        let pdf = posterPDF
        bridge = EffectorsCoordinator(entryURL: entry, source: EffectorsSource(name: name) { try PosterVectors.svg(pdfAt: pdf) })
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "effectors")
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
            try? await Task.sleep(for: .seconds(240))
            if !finished { finish("Timed out waiting for the effector editor", code: 1) }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        // Saves are kept here instead of opening panels; everything else goes through the production bridge.
        if type == "save", let format = body["format"] as? String, let data = body["data"] as? String { saved[format] = data; return }
        bridge.userContentController(userContentController, didReceive: message)
        if type == "ready" { Task { await check() } }
    }

    private func js(_ script: String) async throws -> Any? {
        try await webView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    }

    private func check() async {
        do {
            var loaded = false
            for _ in 0..<40 {
                if try await js("return poster?.name ?? null") as? String != nil { loaded = true; break }
                try await Task.sleep(for: .milliseconds(250))
            }
            guard loaded else { finish("The poster never reached the editor", code: 1); return }
            guard let layer = try await js("return [state.layers.length, state.layers[0].type, scene.layers?.[0]?.shapes?.length ?? scene.W]") as? [Any],
                  layer.count == 3, layer[1] as? String == "artwork" else { finish("The poster did not become an Artwork element", code: 1); return }
            print("Poster in the editor: \(layer)")
            try await capture("native-poster.png")

            // Every recipe and every combination on the poster, then in the editor's own elements.
            let report = try await js(Self.sweep)
            guard let rows = report as? [[String: Any]] else { finish("The sweep returned no report", code: 1); return }
            let failures = rows.filter { $0["error"] != nil || ($0["ink"] as? Int ?? 0) == 0 }
            let slow = rows.filter { ($0["ms"] as? Double ?? 0) > 1500 }
            for row in failures { print("FAIL", row) }
            for row in slow { print("slow", row["label"] ?? "", row["ms"] ?? "") }
            let times = rows.compactMap { $0["ms"] as? Double }.sorted()
            print("Sweep: \(rows.count) stacks, \(failures.count) failing, median \(Int(times[times.count / 2])) ms, slowest \(Int(times.last ?? 0)) ms")
            try JSONSerialization.data(withJSONObject: rows, options: [.prettyPrinted, .sortedKeys])
                .write(to: output.appending(path: "native-sweep.json"))

            // A combination built through the editor UI: add menu → combo, then group the stack with Group them.
            let ui = try await js(EffectorsSelfTest.controls)
            print("Editor UI: \(ui ?? "nothing")")
            guard let uiReport = ui as? [String: Any], uiReport["ok"] as? Bool == true else { finish("Group editor check failed: \(ui ?? "")", code: 1); return }
            try await capture("native-groups.png")

            // Exports go through the bridge's formats; PDF is rebuilt natively from the exported SVG.
            _ = try await js("document.querySelector('#svg')?.click(); document.querySelector('#pdf')?.click(); document.querySelector('#json')?.click(); exportPNG(2000); return true")
            for _ in 0..<20 where saved.count < 4 { try await Task.sleep(for: .milliseconds(250)) }
            guard let svg = saved["svg"], svg.contains("<path") else { finish("SVG export did not arrive: \(saved.keys.sorted())", code: 1); return }
            guard let pdfSVG = saved["pdf"] else { finish("PDF export did not arrive: \(saved.keys.sorted())", code: 1); return }
            let pdf = try PosterVectors.pdf(fromSVG: pdfSVG)
            let back = try PosterVectors.svg(pdf: pdf)
            guard back.paths > 0 else { finish("Exported PDF has no shapes", code: 1); return }
            guard let png = saved["png"], png.hasPrefix("data:image/png;base64,"), png.count > 50_000 else { finish("PNG export failed", code: 1); return }
            guard let json = saved["json"], json.contains("\"modifiers\"") else { finish("Rules export failed", code: 1); return }
            try Data(svg.utf8).write(to: output.appending(path: "native-export.svg"))
            try pdf.write(to: output.appending(path: "native-export.pdf"))
            print("Exports: SVG \(svg.count / 1024) KB, PDF \(pdf.count / 1024) KB with \(back.paths) paths, PNG \(png.count * 3 / 4 / 1024) KB, rules \(json.count) chars")

            let errors = try await js("return [...document.querySelectorAll('.error,.alert,[role=alert]')].map(e=>e.textContent).filter(Boolean)") as? [String] ?? []
            guard errors.isEmpty else { finish("Editor showed errors: \(errors)", code: 1); return }
            finish(failures.isEmpty ? "Native effector checks passed" : "\(failures.count) stacks failed", code: failures.isEmpty ? 0 : 1)
        } catch { finish("Smoke error: \(error)", code: 1) }
    }

    /// Renders one frame of each recipe (on the poster and on its own elements) and each combination (on the poster
    /// and on text), through the editor's own state, scene and draw path.
    private static let sweep = """
    const rows=[],base=structuredClone(state);
    const ink=ops=>{let n=0;for(const o of ops)if(o.fill!==state.colors[0]&&o.a>.02)for(const p of o.polys)if(Math.abs(E.polyArea(p))>1)n++;return n;};
    const run=(label,next)=>{try{load(next,false);const ctx=E.context(state,scene,1.37,null),T=E.evaluate(scene,state,ctx);const t0=performance.now();
      const ops=E.compose(scene,state,T,ctx);const ms=performance.now()-t0;draw(g,ops,scale);lastOps=ops;cur=T;
      rows.push({label,ms:Math.round(ms),ink:ink(ops),stats:ops.stats});}catch(e){rows.push({label,error:String(e&&e.stack||e)});}};
    const text={id:'L1',type:'text',text:'COMBINE',size:.5};
    for(const id of Object.keys(E.RECIPES)){const r=E.recipeState(id);
      run('poster · '+id,{...r,format:base.format,layers:[posterLayer()]});
      run('recipe · '+id,{...r});}
    for(const [id,c] of Object.entries(E.COMBOS)){
      run('poster · combo '+id,{...base,recipe:'custom',effectors:[],modifiers:[structuredClone(c.group)]});
      run('text · combo '+id,{recipe:'custom',layers:[text],effectors:[],modifiers:[structuredClone(c.group)]});}
    // Every combination stacked at once, inside one group and as a group of groups.
    const all=Object.values(E.COMBOS).map(c=>structuredClone(c.group));
    run('poster · all combos in a row',{...base,recipe:'custom',effectors:[],modifiers:all});
    run('poster · nested group',{...base,recipe:'custom',effectors:[],modifiers:[{type:'group',op:'chain',children:all.slice(0,3)}]});
    run('poster · empty group',{...base,recipe:'custom',effectors:[],modifiers:[{type:'group',op:'add',children:[]}]});
    load(base,false);
    return rows;
    """

    private func capture(_ filename: String) async throws {
        let image = try await webView.takeSnapshot(configuration: nil)
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "EffectorsSmoke", code: 1, userInfo: [NSLocalizedDescriptionKey: "WebKit snapshot failed"])
        }
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        try png.write(to: output.appending(path: filename))
    }

    private func finish(_ message: String, code: Int32) {
        guard !finished else { return }
        finished = true
        print(message)
        exit(code)
    }
}
