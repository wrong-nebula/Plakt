import PosterCore
import SwiftUI

struct PosterSettingsView: View {
    @AppStorage(TextWrappingPreferences.pretextEnabledKey) private var pretextEnabled = true

    var body: some View {
        Form {
            Section("Appearance") {
                AppearancePicker().pickerStyle(.segmented)
            }
            Section("Text layout") {
                Toggle("Pretext", isOn: $pretextEnabled)
                    .help("Reuse text measurements for faster layout. Turn off to use the previous wrapping method.")
                Text("Speed up text layout by reusing measurements. Turn off to use the previous wrapping method.")
                    .foregroundStyle(.secondary)
                Text("Applies to newly generated posters.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(minWidth: 400, idealWidth: 440, maxWidth: 520, minHeight: 200)
        .fixedSize(horizontal: false, vertical: true)
    }
}
