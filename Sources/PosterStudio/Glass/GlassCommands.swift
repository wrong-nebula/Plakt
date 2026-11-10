import AppKit
import SwiftUI
import PosterCore

/// The glass workspace in the key window, so menu commands act on the window in front.
struct GlassWorkspaceKey: FocusedValueKey {
    typealias Value = GlassWorkspaceModel
}

extension FocusedValues {
    var glassWorkspace: GlassWorkspaceModel? {
        get { self[GlassWorkspaceKey.self] }
        set { self[GlassWorkspaceKey.self] = newValue }
    }
}

/// Menu commands and shortcuts. With the glass window in front, Undo and Redo step through glass edits;
/// elsewhere they go to the standard responder chain, so text fields keep their own undo. The Glass menu is
/// disabled unless the glass window is in front, so its shortcuts (⌘D, ⌘⌫, ⌘[ …) stay with the other windows.
struct GlassCommands: Commands {
    let studio: StudioModel
    @FocusedValue(\.glassWorkspace) private var glass

    var body: some Commands {
        CommandGroup(after: .newItem) {
            if let glass {
                Button("Open Glass Project…") { glass.openProject() }.keyboardShortcut("o")
            } else {
                Button("Open Study…") { studio.loadGeneration() }.keyboardShortcut("o").disabled(studio.busy)
            }
            Button("Generate New Study") { studio.start(newSession: true) }.keyboardShortcut("g").disabled(studio.busy)
        }
        CommandGroup(replacing: .saveItem) {
            Button("Save Glass Project…") { glass?.saveProject() }.keyboardShortcut("s").disabled(glass == nil)
            Button("Export Glass PNG…") { glass?.showExportSheet = true }.keyboardShortcut("e", modifiers: [.command, .shift])
                .disabled(glass == nil)
        }
        CommandGroup(replacing: .undoRedo) {
            Button("Undo") {
                if let glass { glass.undo() } else { NSApp.sendAction(Selector(("undo:")), to: nil, from: nil) }
            }.keyboardShortcut("z")
            Button("Redo") {
                if let glass { glass.redo() } else { NSApp.sendAction(Selector(("redo:")), to: nil, from: nil) }
            }.keyboardShortcut("z", modifiers: [.command, .shift])
        }
        CommandMenu("Glass") {
            ForEach(Array(GlassShape.allCases.enumerated()), id: \.element) { index, shape in
                Button("Add \(shape.label)") { glass?.add(shape) }
                    .keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: [.command, .option]).disabled(glass == nil)
            }
            Divider()
            Button("Duplicate") { glass?.duplicate() }.keyboardShortcut("d").disabled(glass == nil)
            Button("Delete") { glass?.remove() }.keyboardShortcut(.delete, modifiers: .command).disabled(glass == nil)
            Button("Move Up in List") { glass?.moveSelected(by: -1) }.keyboardShortcut("[").disabled(glass == nil)
            Button("Move Down in List") { glass?.moveSelected(by: 1) }.keyboardShortcut("]").disabled(glass == nil)
            Divider()
            Button("Compare Split") { if let glass { glass.compare = glass.compare == .split ? .glass : .split } }
                .keyboardShortcut("\\").disabled(glass == nil)
        }
    }
}
