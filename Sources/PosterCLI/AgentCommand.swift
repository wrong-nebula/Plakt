import Foundation
import ImageIO
import UniformTypeIdentifiers
import PosterCore

/// `poster mcp` — PosterLab as a Model Context Protocol server over stdio.
/// `poster tool …` — the same tools from a shell, JSON in and JSON out.
struct AgentCommand {
    static func tool(_ args: [String]) async throws {
        let agent = PosterAgent()
        guard let sub = args.first, sub != "--help" else {
            print("""
            poster tool list [--json]          every tool with a one-line description (or full JSON schemas)
            poster tool schema NAME            one tool's input schema
            poster tool call NAME ['{json}']   run a tool; prints the JSON result (arguments also from --input file.json or stdin with -)
            poster tool guide                  the agent playbook
            poster mcp                         serve the same tools over MCP (stdio)

            Environment: POSTERLAB_ROOT (project folder with library/ and taste/), POSTERLAB_AGENT_HOME (projects; default ROOT/output/agent).
            """); return
        }
        switch sub {
        case "list":
            if args.contains("--json") { print(JSONValue.array(PosterAgent.tools.map(MCPServer.describe)).text(pretty: true)) }
            else { for t in PosterAgent.tools { print("\(t.name.padding(toLength: 20, withPad: " ", startingAt: 0)) \(t.readOnly ? "read " : "write")\(t.slow ? " slow" : "     ")  \(t.title) — \(t.description.prefix(110))") } }
        case "schema":
            guard args.count >= 2, let t = PosterAgent.tools.first(where: { $0.name == args[1] }) else { throw PosterError.invalid("poster tool schema NAME — see poster tool list.") }
            print(MCPServer.describe(t).text(pretty: true))
        case "guide":
            print((await agent.call("guide", arguments: nil)).summary)
        case "call":
            guard args.count >= 2 else { throw PosterError.invalid("poster tool call NAME ['{json}']") }
            var raw = "{}"
            if let i = args.firstIndex(of: "--input"), i + 1 < args.count { raw = try String(contentsOfFile: args[i + 1], encoding: .utf8) }
            else if args.count >= 3, args[2] == "-" { raw = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? "{}" }
            else if args.count >= 3 { raw = args[2] }
            let input: JSONValue
            do { input = try JSONDecoder().decode(JSONValue.self, from: Data(raw.utf8)) }
            catch { throw PosterError.invalid("Arguments are not valid JSON: \(error.localizedDescription)") }
            let result = await agent.call(args[1], arguments: input) { FileHandle.standardError.write(Data(("… " + $0 + "\n").utf8)) }
            var out: [String: JSONValue] = ["ok": .bool(!result.isError), "summary": .string(result.summary), "data": result.data]
            if !result.images.isEmpty { out["images"] = .array(result.images.map { ["path": .string($0.url.path), "caption": .string($0.caption)] }) }
            print(JSONValue.object(out).text(pretty: true))
            if result.isError { exit(1) }
        default:
            throw PosterError.invalid("Unknown tool command. Use poster tool --help.")
        }
    }

    static func mcp(_ args: [String]) async throws {
        try await MCPServer(agent: PosterAgent()).run()
    }
}

/// Minimal MCP (2025-06-18) server: newline-delimited JSON-RPC 2.0 on stdin/stdout.
/// stdout carries only protocol messages; anything else the process prints goes to stderr.
final class MCPServer: @unchecked Sendable {
    let agent: PosterAgent
    private let out: FileHandle
    private let lock = NSLock()

    init(agent: PosterAgent) {
        self.agent = agent
        // Keep the real stdout for protocol messages and point fd 1 at stderr, so stray prints can't corrupt the stream.
        let saved = dup(STDOUT_FILENO)
        dup2(STDERR_FILENO, STDOUT_FILENO)
        out = FileHandle(fileDescriptor: saved, closeOnDealloc: true)
    }

    static func describe(_ t: AgentToolSpec) -> JSONValue {
        ["name": .string(t.name), "title": .string(t.title), "description": .string(t.description + (t.slow ? " (Slow: reports progress.)" : "")), "inputSchema": t.inputSchema,
         "annotations": ["title": .string(t.title), "readOnlyHint": .bool(t.readOnly), "destructiveHint": false, "idempotentHint": .bool(t.readOnly), "openWorldHint": false]]
    }

    func send(_ message: JSONValue) {
        guard var data = try? message.data() else { return }
        data.append(0x0a)
        lock.lock(); defer { lock.unlock() }
        out.write(data)
    }
    func log(_ text: String) { FileHandle.standardError.write(Data(("posterlab-mcp: " + text + "\n").utf8)) }

    func run() async throws {
        log("ready (root \(agent.environment.root.path))")
        var tasks: [String: Task<Void, Never>] = [:]
        for try await line in FileHandle.standardInput.bytes.lines {
            guard !line.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
            guard let message = try? JSONDecoder().decode(JSONValue.self, from: Data(line.utf8)) else {
                send(["jsonrpc": "2.0", "id": .null, "error": ["code": -32700, "message": "Parse error"]]); continue
            }
            let id = message["id"], method = message["method"]?.string ?? ""
            if method == "notifications/cancelled", let target = message["params"]?["requestId"] { tasks[target.text()]?.cancel(); continue }
            guard let id else { continue } // other notifications need no reply
            if method == "tools/call" {
                // Tool calls run concurrently with the read loop, so cancellations and pings still arrive.
                let key = id.text()
                tasks[key] = Task { [weak self] in
                    guard let self else { return }
                    await self.callTool(id: id, params: message["params"])
                }
                continue
            }
            send(await handle(method: method, id: id, params: message["params"]))
        }
        for t in tasks.values { await t.value }
    }

    private func handle(method: String, id: JSONValue, params: JSONValue?) async -> JSONValue {
        func ok(_ result: JSONValue) -> JSONValue { ["jsonrpc": "2.0", "id": id, "result": result] }
        switch method {
        case "initialize":
            let requested = params?["protocolVersion"]?.string ?? "2025-06-18"
            let supported = ["2025-06-18", "2025-03-26", "2024-11-05"]
            return ok(["protocolVersion": .string(supported.contains(requested) ? requested : "2025-06-18"),
                       "capabilities": ["tools": ["listChanged": false], "resources": ["listChanged": false], "prompts": ["listChanged": false]],
                       "serverInfo": ["name": "posterlab", "title": "PosterLab", "version": .string(PosterAgent.version)],
                       "instructions": "PosterLab makes and edits print posters as vector scenes. Call `guide` first. Use real event copy from list_briefs, look at every preview, pick between alternatives with rank_posters (the user's own taste jury), and export_poster for print."])
        case "ping": return ok([:])
        case "tools/list": return ok(["tools": .array(PosterAgent.tools.map(Self.describe))])
        case "resources/list":
            return ok(["resources": [["uri": "posterlab://guide", "name": "guide", "title": "PosterLab agent guide", "mimeType": "text/markdown"],
                                     ["uri": "posterlab://briefs", "name": "briefs", "title": "Real event briefs", "mimeType": "application/json"]]])
        case "resources/read":
            let uri = params?["uri"]?.string ?? ""
            let name = uri == "posterlab://guide" ? "guide" : uri == "posterlab://briefs" ? "list_briefs" : ""
            guard !name.isEmpty else { return ["jsonrpc": "2.0", "id": id, "error": ["code": -32002, "message": .string("Unknown resource \(uri)")]] }
            let r = await agent.call(name, arguments: name == "list_briefs" ? ["limit": 200] : nil)
            let text = name == "guide" ? r.summary : r.data.text(pretty: true)
            return ok(["contents": [["uri": .string(uri), "mimeType": name == "guide" ? "text/markdown" : "application/json", "text": .string(text)]]])
        case "prompts/list":
            return ok(["prompts": [["name": "design-poster", "title": "Design a poster", "description": "Plan, sketch, refine and export a poster for a real event.",
                                    "arguments": [["name": "event", "description": "A brief id, or a description of the event", "required": false], ["name": "direction", "description": "A style or mood", "required": false]]]]])
        case "prompts/get":
            let a = params?["arguments"]
            let event = a?["event"]?.string ?? "an event from list_briefs", direction = a?["direction"]?.string ?? "the direction that fits the content"
            let text = """
            Design a print poster in PosterLab for \(event), in \(direction).
            1. Call guide. Find real copy with list_briefs (never invent dates or venues).
            2. sketch_variations (6–8) in one or two fitting styles; look at the ranked sheet.
            3. Take the best project. describe_poster, then improve it with edit_poster in small steps: hierarchy, alignment, palette (2–4 calm inks), margins.
               After each step look at the preview; zoom with view_poster region on type details.
            4. critique_poster until preflight is clean; if you made alternatives, rank_posters.
            5. export_poster and report the PDF/PNG paths with a one-line rationale.
            """
            return ok(["description": "Design a poster", "messages": [["role": "user", "content": ["type": "text", "text": .string(text)]]]])
        default:
            return ["jsonrpc": "2.0", "id": id, "error": ["code": -32601, "message": .string("Method not found: \(method)")]]
        }
    }

    private func callTool(id: JSONValue, params: JSONValue?) async {
        guard let name = params?["name"]?.string else {
            send(["jsonrpc": "2.0", "id": id, "error": ["code": -32602, "message": "tools/call needs params.name"]]); return
        }
        let token = params?["_meta"]?["progressToken"]
        let counter = ProgressCounter()
        let result = await agent.call(name, arguments: params?["arguments"]) { [weak self] text in
            guard let self, let token else { return }
            self.send(["jsonrpc": "2.0", "method": "notifications/progress", "params": ["progressToken": token, "progress": .number(counter.next()), "message": .string(text)]])
        }
        var content: [JSONValue] = [["type": "text", "text": .string(result.summary)]]
        if !result.isError, result.data != .null, !(result.data.object?.isEmpty ?? true), name != "guide" {
            content.append(["type": "text", "text": .string(result.data.text(pretty: false))])
        }
        for image in result.images {
            if let data = Self.png(image.url, maxWidth: 1000) {
                content.append(["type": "image", "data": .string(data.base64EncodedString()), "mimeType": "image/png"])
            }
            content.append(["type": "text", "text": .string("[image] \(image.caption): \(image.url.path)")])
        }
        var payload: [String: JSONValue] = ["content": .array(content), "isError": .bool(result.isError)]
        if case .object = result.data { payload["structuredContent"] = result.data }
        send(["jsonrpc": "2.0", "id": id, "result": .object(payload)])
    }

    /// PNG bytes, downscaled if wider than maxWidth so tool results stay small.
    static func png(_ url: URL, maxWidth: Int) -> Data? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
        if image.width <= maxWidth { return try? Data(contentsOf: url) }
        let w = maxWidth, h = max(1, Int(Double(image.height) * Double(w) / Double(image.width)))
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.interpolationQuality = .high; ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let scaled = ctx.makeImage() else { return nil }
        let data = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, scaled, nil)
        return CGImageDestinationFinalize(dest) ? data as Data : nil
    }
}

final class ProgressCounter: @unchecked Sendable {
    private var value = 0.0
    private let lock = NSLock()
    func next() -> Double { lock.lock(); defer { lock.unlock() }; value += 1; return value }
}
