import SwiftUI

@main
struct PosterStudioApp: App {
    @State private var model = StudioModel()
    @State private var bridge = StudioAgentBridge()
    var body: some Scene {
        WindowGroup("PosterLab") {
            StudioRootView(model: model).environment(bridge)
                .frame(minWidth: 1080, minHeight: 740)
                .task {
                    AppAppearance(rawValue: UserDefaults.standard.string(forKey: AppAppearance.key) ?? "")?.apply() ?? AppAppearance.dark.apply()
                    SystemPreviews.prewarm()
                    NSApplication.shared.setActivationPolicy(.regular)
                    NSApplication.shared.activate(ignoringOtherApps: true)
                    if model.current==nil,let path=UserDefaults.standard.string(forKey:"posterlab-last-study"),FileManager.default.fileExists(atPath:path){model.restoreGeneration(URL(fileURLWithPath:path))}
                    if model.referenceImage == nil { model.referenceImage = NSImage(contentsOf: model.referenceURL) }
                }
        }
        .defaultSize(width: 1440, height: 960)
        .commands {
            CommandGroup(before: .toolbar) {
                AppearancePicker().pickerStyle(.inline)
                Divider()
            }
            // Open Study and Generate New Study live in GlassCommands, which swaps Open for the glass project when its window is in front.
            GlassCommands(studio: model)
        }
        Window("PosterLab Glass", id: "glass") {
            GlassWorkspaceView(artworkURL: model.glassArtworkURL)
        }.defaultSize(width: 1280, height: 960)
        WindowGroup("Agent poster", id: StudioAgentViewer.windowID, for: StudioAgentItem.self) { $item in if let item { StudioAgentViewer(item: item, model: model).environment(bridge) } }.defaultSize(width: 1200, height: 920)
        Settings {
            PosterSettingsView()
        }
    }
}
