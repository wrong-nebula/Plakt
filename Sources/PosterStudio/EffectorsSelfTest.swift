import AppKit
import WebKit

/// An unattended check of the Effectors sheet inside the app. Launch the app binary with POSTERLAB_EFFECTORS_SELFTEST set
/// to an output folder and POSTERLAB_EFFECTORS_STUDY to a saved generation.json: the app opens that study, opens the
/// sheet on its first poster, drives the editor's controls, writes effectors-selftest.png and .json and exits with 0
/// when everything passed.
/// AppKit and WebKit only, so the offscreen smoke host (scripts/effectors-smoke.sh) compiles it too and shares `controls`.
struct EffectorsSelfTest {
    let output: URL
    let study: URL

    static let current: EffectorsSelfTest? = {
        let env = ProcessInfo.processInfo.environment
        guard let output = env["POSTERLAB_EFFECTORS_SELFTEST"], let study = env["POSTERLAB_EFFECTORS_STUDY"] else { return nil }
        return EffectorsSelfTest(output: URL(fileURLWithPath: output, isDirectory: true), study: URL(fileURLWithPath: study))
    }()

    /// Drives the real controls: adds Twirl and the Liquid combination from the add menu, groups the stack with Group
    /// them, switches the group to Average, renders a frame, undoes and redoes.
    static let controls = """
    const wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
    const add=value=>{const s=document.querySelector('select[data-add="modifiers"]');if(!s)return false;s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));return true;};
    const stack=()=>state.modifiers.map(m=>m.type+(m.children?'('+(m.op||'')+':'+m.children.map(c=>c.type).join('+')+')':''));
    startFromPoster();await wait(50);
    if(!add('twirl')||!add('combo:liquid'))return {ok:false,why:'no add menu for modifiers'};await wait(50);
    out.afterCombo=stack();
    const groupBtn=document.querySelector('#groupall');
    if(!groupBtn)return {ok:false,why:'no Group them button',stack:stack()};
    groupBtn.click();await wait(50);
    out.afterGroup=stack();
    const i=state.modifiers.findIndex(m=>m.type==='group'&&m.children.some(c=>c.type==='twirl'));
    const opSelect=document.querySelector('select[data-path="modifiers.'+i+'.op"]');
    if(!opSelect)return {ok:false,why:'no Combine select on the new group',out};
    opSelect.value='average';opSelect.dispatchEvent(new Event('change',{bubbles:true}));await wait(50);
    out.afterOp=stack();
    const ctx=E.context(state,scene,0.8,null),T=E.evaluate(scene,state,ctx),ops=E.compose(scene,state,T,ctx);draw(g,ops,scale);lastOps=ops;cur=T;
    out.polys=ops.reduce((n,o)=>n+o.polys.length,0);
    const before=JSON.stringify(stack());
    document.querySelector('#undo')?.click();await wait(50);const undone=JSON.stringify(stack());
    document.querySelector('#redo')?.click();await wait(50);const redone=JSON.stringify(stack());
    out.undo=undone!==before;out.redo=redone===before;
    out.ok=out.afterCombo.includes('group(add:wave+turbulence+lens)')&&out.afterGroup.includes('group(chain:lens+twirl)')
      &&out.afterOp.includes('group(average:lens+twirl)')&&out.polys>0&&out.undo&&out.redo;
    return out;
    """

    /// Waits for the poster the bridge sent, runs `controls`, then writes the snapshot and report and quits the app.
    /// `messages` are the bridge's alerts as "title: text"; any titled Effectors is an error, Poster outlines is a note.
    @MainActor
    func run(in webView: WKWebView, source: String?, messages: @MainActor () -> [String]) async {
        func js(_ code: String) async throws -> Any? {
            try await webView.callAsyncJavaScript(code, arguments: [:], in: nil, contentWorld: .page)
        }
        var report: [String: Any] = ["source": source ?? "none", "study": study.path]
        var passed = false
        do {
            var poster: String?
            for _ in 0..<120 where poster == nil {
                poster = try await js("return poster?.name ?? null") as? String
                if poster == nil { try await Task.sleep(for: .milliseconds(250)) }
            }
            report["poster"] = poster ?? "not loaded"
            if poster != nil, let controls = try await js(Self.controls) as? [String: Any] {
                report["controls"] = controls
                passed = controls["ok"] as? Bool == true
            }
            // The window is on screen, so the editor's own animation draws the grouped stack before the snapshot.
            try await Task.sleep(for: .seconds(1))
            let image = try await webView.takeSnapshot(configuration: nil)
            if let tiff = image.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
                try png.write(to: output.appending(path: "effectors-selftest.png"))
                report["snapshot"] = output.appending(path: "effectors-selftest.png").path
            } else { passed = false }
        } catch { report["error"] = error.localizedDescription; passed = false }
        let recorded = messages()
        report["messages"] = recorded
        passed = passed && !recorded.contains { $0.hasPrefix("Effectors:") }
        report["passed"] = passed
        if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
            try? FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
            try? data.write(to: output.appending(path: "effectors-selftest.json"))
        }
        // NSApp.terminate does not quit while the sheet is attached; the exit code carries the result.
        exit(passed ? 0 : 1)
    }
}
