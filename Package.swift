// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PosterLab",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "PosterCore", targets: ["PosterCore"]),
        .executable(name: "PosterStudio", targets: ["PosterStudio"]),
        .executable(name: "poster", targets: ["PosterCLI"]),
        .executable(name: "poster-checks", targets: ["PosterChecks"])
    ],
    targets: [
        .target(name: "PosterCore", resources: [.copy("Resources")]),
        .executableTarget(name: "PosterCLI", dependencies: ["PosterCore"]),
        .executableTarget(name: "PosterStudio", dependencies: ["PosterCore"]),
        .executableTarget(name: "PosterChecks", dependencies: ["PosterCore"])
    ]
)
