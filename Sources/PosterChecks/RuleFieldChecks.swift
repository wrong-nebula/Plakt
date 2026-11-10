import Foundation
import PosterCore

extension PosterChecks {
    /// The rule-field editor is one bundled page. This checks that it is in the resource bundle, that it still speaks
    /// the bridge the app listens on, and that it loads nothing from outside. The editor itself (every style and every
    /// export, behind the app's own bridge) is exercised by scripts/rule-field-smoke.sh, which needs WebKit.
    static func checkRuleField() throws {
        guard let url = RuleFieldResources.entryURL else { throw CheckFailure("The rule-field editor page is not in the resource bundle") }
        let page = try String(contentsOf: url, encoding: .utf8)
        try require(page.count > 100_000, "The rule-field editor page is too small to hold the engine")
        for marker in ["messageHandlers?.ruleField", "ruleFieldStudio", "setPoster", "type:'ready'", "type:'save'", "type:'saveSet'"] {
            try require(page.contains(marker), "The rule-field editor page lost its bridge to the app: \(marker)")
        }
        // The page is loaded from disk with navigation limited to itself; it must not depend on anything remote.
        let remote = page.matches(of: /https?:\/\/[A-Za-z0-9.\-]+/).map { String($0.output) }.filter { $0 != "http://www.w3.org" }
        try require(remote.isEmpty, "The rule-field editor page refers to outside addresses: \(Set(remote).sorted().joined(separator: ", "))")
        for tag in ["<script src", "<link rel=\"stylesheet\"", "@import"] {
            try require(!page.contains(tag), "The rule-field editor page loads a separate file: \(tag)")
        }
        print("PASS: rule-field editor page bundled, bridge messages present, nothing loaded from outside")
    }
}
