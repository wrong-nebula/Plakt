import SwiftUI

@main
struct PosterStudioApp: App {
    @State private var model = StudioModel()
    var body: some Scene {
        WindowGroup("PosterLab") {
            StudioRootView(model: model)
                .frame(minWidth: 1080, minHeight: 740)
                .task {
                    NSApplication.shared.setActivationPolicy(.regular)
                    NSApplication.shared.activate(ignoringOtherApps: true)
                    if model.current==nil,let path=UserDefaults.standard.string(forKey:"posterlab-last-study"),FileManager.default.fileExists(atPath:path){model.restoreGeneration(URL(fileURLWithPath:path))}
                    if model.referenceImage == nil { model.referenceImage = NSImage(contentsOf: model.referenceURL) }
                }
        }
        .defaultSize(width: 1440, height: 960)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Open Study…") { model.loadGeneration() }.keyboardShortcut("o").disabled(model.busy)
                Button("Generate New Study") { model.start(newSession: true) }.keyboardShortcut("g").disabled(model.busy)
            }
        }
    }
}
