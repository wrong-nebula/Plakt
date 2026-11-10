import CoreGraphics
import CoreText
import Foundation
import PosterCore

extension PosterChecks {
    static func checkGlass() async throws {
        let root = URL(fileURLWithPath: ProcessInfo.processInfo.environment["GLASS_PROOF_OUTPUT"] ?? NSTemporaryDirectory() + "posterlab-glass-proof")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        guard let context = CGContext(data: nil, width: 240, height: 336, bitsPerComponent: 8,
            bytesPerRow: 240 * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw CheckFailure("Cannot create glass fixture") }
        context.setFillColor(CGColor(red: 0.95, green: 0.9, blue: 0.75, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: 240, height: 336))
        for row in 0..<14 {
            context.setFillColor(CGColor(red: row % 3 == 0 ? 0.9 : 0.02, green: row % 3 == 1 ? 0.7 : 0.02, blue: row % 3 == 2 ? 0.8 : 0.02, alpha: 1))
            context.fill(CGRect(x: 20 + row % 4 * 13, y: row * 24, width: 156, height: 11))
        }
        let artwork = context.makeImage()!
        let renderer = try GlassRenderer()
        var empty = GlassScene(); empty.objects = []
        let base = try await renderer.render(artwork: artwork, scene: empty, width: 240, samples: 1)
        let originalPixels = try rgba(artwork), basePixels = try rgba(base)
        let originalError = zip(originalPixels, basePixels).map { abs(Int($0) - Int($1)) }.max()!
        try require(originalError <= 1, "Empty scene changed orientation or source color (max error \(originalError))")

        var air = GlassScene()
        air.objects[0].ior = 1; air.objects[0].dispersion = 0; air.objects[0].roughness = 0; air.objects[0].absorption = 0
        let airImage = try await renderer.render(artwork: artwork, scene: air, width: 240, samples: 1)
        let airPixels = try rgba(airImage)
        let airError = zip(airPixels, basePixels).map { abs(Int($0) - Int($1)) }.max()!
        try require(airError <= 1, "IOR 1 should not bend or shade the source (max error \(airError))")
        print("PASS: empty-scene color/orientation preservation and IOR-1 optical identity")

        // 16 samples at 1200 px exceeds one pass, so the image is assembled from offset GPU passes.
        let log = ProgressLog()
        let singlePass = try await renderer.render(artwork: artwork, scene: empty, width: 1200, samples: 1)
        let multiPass = try await renderer.render(artwork: artwork, scene: empty, width: 1200, samples: 16,
                                                  progress: { log.record($0) })
        let singlePassPixels = try rgba(singlePass), multiPassPixels = try rgba(multiPass)
        try require(multiPassPixels == singlePassPixels, "Multi-pass render shifted or changed pixels")
        let steps = log.values
        try require(steps.count > 1 && steps == steps.sorted() && steps.last == 1, "Render progress was not reported per pass (\(steps))")
        let cancelled = Task { try await renderer.render(artwork: artwork, scene: GlassScene(), width: 1200, samples: 64) }
        cancelled.cancel()
        do {
            _ = try await cancelled.value
            throw CheckFailure("A cancelled glass render ran to completion")
        } catch is CancellationError {}
        print("PASS: multi-pass renders are seamless, report progress per pass and stop when cancelled")

        var fingerprints = Set<Data>()
        for shape in GlassShape.allCases {
            var scene = GlassScene(); scene.objects = [GlassObject(shape: shape)]
            let rendered = try await renderer.render(artwork: artwork, scene: scene, width: 240, samples: 8)
            let repeated = try await renderer.render(artwork: artwork, scene: scene, width: 240, samples: 8)
            let pixels = try rgba(rendered), again = try rgba(repeated)
            let changed = zip(pixels, basePixels).filter { abs(Int($0) - Int($1)) > 8 }.count
            try require(changed > 900, "\(shape.label) did not visibly refract the poster")
            try require(pixels == again, "\(shape.label) rendering is not repeatable")
            fingerprints.insert(Data(pixels))
            try PosterRenderer.png(rendered, to: root.appending(path: "fixture-\(shape.rawValue).png"))
        }
        try require(fingerprints.count == 4, "Different solids rendered identically")
        print("PASS: all four solid shapes refract, remain distinct and render deterministically")

        var scene = GlassScene()
        let normal = try await renderer.render(artwork: artwork, scene: scene, width: 240, samples: 8)
        scene.objects[0].depth = 1.8; scene.objects[0].elevation = 0.2; scene.objects[0].ior = 1.9
        scene.objects[0].roughness = 0.35; scene.objects[0].absorption = 3
        scene.objects[0].tintRed = 0.1; scene.objects[0].tintBlue = 0.2
        let modified = try await renderer.render(artwork: artwork, scene: scene, width: 240, samples: 8)
        let normalPixels = try rgba(normal), modifiedPixels = try rgba(modified)
        try require(normalPixels != modifiedPixels, "Optical and geometry controls did not affect pixels")
        scene.objects[0].enabled = false
        let hidden = try await renderer.render(artwork: artwork, scene: scene, width: 240, samples: 1)
        let hiddenPixels = try rgba(hidden)
        try require(hiddenPixels == basePixels, "Hidden objects still refract")
        scene.objects[0].ior = .nan
        try require(rejected { try scene.validate() }, "Non-finite controls were accepted")
        var tooMany = GlassScene(); tooMany.objects = (0..<9).map { _ in GlassObject() }
        try require(rejected { try tooMany.validate() }, "More than eight objects were accepted")
        print("PASS: controls change optics; hiding, invalid input and object limits work")

        var simple = GlassScene(); simple.objects[0].material = .simple
        let simpleImage = try await renderer.render(artwork: artwork, scene: simple, width: 240, samples: 1)
        let simplePixels = try rgba(simpleImage)
        simple.lightIntensity = 3; simple.environment = 1; simple.lightAzimuth = 150
        simple.studio = .dark; simple.shadows = 1; simple.lightSpread = 30
        simple.objects[0].roughness = 0.5; simple.objects[0].dispersion = 0.08
        simple.objects[0].absorption = 10; simple.objects[0].tintRed = 0.01
        let simpleAgain = try await renderer.render(artwork: artwork, scene: simple, width: 240, samples: 1)
        let simpleAgainPixels = try rgba(simpleAgain)
        try require(simplePixels == simpleAgainPixels, "Simple refraction was affected by physical shading controls")
        try require(simplePixels != basePixels && simplePixels != normalPixels, "Simple mode did not independently refract the poster")
        simple.objects[0].ior = 1
        let simpleAir = try await renderer.render(artwork: artwork, scene: simple, width: 240, samples: 1)
        let simpleAirPixels = try rgba(simpleAir)
        try require(zip(simpleAirPixels, basePixels).allSatisfy { abs(Int($0) - Int($1)) <= 1 }, "Simple IOR 1 changed artwork")
        let simpleRoundtrip = try JSONDecoder().decode(GlassScene.self, from: JSONEncoder().encode(simple))
        try require(simpleRoundtrip.objects[0].material == .simple, "Project lost simple refraction mode")
        context.setFillColor(CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [0.2, 0.5, 0.8, 1])!)
        context.fill(CGRect(x: 0, y: 0, width: 240, height: 336))
        let flatArtwork = context.makeImage()!
        simple.objects[0].ior = 1.5
        let flatBase = try await renderer.render(artwork: flatArtwork, scene: empty, width: 240, samples: 1)
        let flatSimple = try await renderer.render(artwork: flatArtwork, scene: simple, width: 240, samples: 1)
        let flatBasePixels = try rgba(flatBase), flatSimplePixels = try rgba(flatSimple)
        try require(zip(flatBasePixels, flatSimplePixels).allSatisfy { abs(Int($0) - Int($1)) <= 1 }, "Simple refraction introduced a shaded or white rim on uniform artwork")
        try PosterRenderer.png(simpleImage, to: root.appending(path: "fixture-simple.png"))
        print("PASS: simple refraction bends artwork, ignores all physical shading, preserves IOR-1 identity and saves its mode")

        let legacy = try JSONDecoder().decode(GlassScene.self, from: Data(
            #"{"objects":[],"lightAzimuth":-40,"lightElevation":55,"lightIntensity":1,"environment":0.3}"#.utf8))
        try require(legacy.studio == .dark && legacy.shadows == 0 && legacy.perspective == 0, "Projects saved before studio styles would change their lighting")
        var legacyObject = try JSONSerialization.jsonObject(with: JSONEncoder().encode(GlassObject(shape: .cube))) as! [String: Any]
        legacyObject.removeValue(forKey: "edgeRoundingAmount")
        let decodedObject = try JSONDecoder().decode(GlassObject.self, from: JSONSerialization.data(withJSONObject: legacyObject))
        try require(decodedObject.edgeRounding == 0, "Solids saved before edge rounding would gain rounded edges")
        // Light from +x at 45°: the sphere's shadow falls to its left; glass never brightens the paper (no caustics).
        var lit = GlassScene()
        lit.objects[0].size = 0.4; lit.objects[0].elevation = 0.15
        lit.objects[0].roughness = 0; lit.objects[0].dispersion = 0; lit.objects[0].absorption = 0
        lit.lightAzimuth = 0; lit.lightElevation = 45; lit.lightSpread = 4; lit.shadows = 1
        var unlit = lit; unlit.shadows = 0
        let litPixels = try rgba(try await renderer.render(artwork: flatArtwork, scene: lit, width: 240, samples: 8))
        let unlitPixels = try rgba(try await renderer.render(artwork: flatArtwork, scene: unlit, width: 240, samples: 8))
        var darker = 0, brighter = 0, farChanges = 0
        for y in 0..<336 {
            for x in 0..<240 {
                let green = (y * 240 + x) * 4 + 1, ratio = Double(litPixels[green]) / Double(max(1, unlitPixels[green]))
                if x < 70 { darker += ratio < 0.85 ? 1 : 0; brighter += ratio > 1.15 ? 1 : 0 }
                if x > 200 && litPixels[green] != unlitPixels[green] { farChanges += 1 }
            }
        }
        try require(darker > 150 && brighter == 0, "Glass shadow missing or paper brightened (\(darker) darker, \(brighter) brighter pixels)")
        try require(farChanges == 0, "Paper lighting changed \(farChanges) pixels where no glass blocks the light")
        var darkStudio = unlit; darkStudio.studio = .dark
        var posterStudio = unlit; posterStudio.studio = .poster
        let darkPixels = try rgba(try await renderer.render(artwork: flatArtwork, scene: darkStudio, width: 240, samples: 8))
        let posterPixels = try rgba(try await renderer.render(artwork: flatArtwork, scene: posterStudio, width: 240, samples: 8))
        let brightness = { (pixels: [UInt8]) in pixels.enumerated().filter { $0.offset % 4 != 3 }.reduce(0) { $0 + Int($1.element) } }
        try require(brightness(unlitPixels) > brightness(darkPixels), "The light studio did not brighten the glass")
        try require(posterPixels != unlitPixels, "The poster-colored studio matched the light studio")
        print("PASS: legacy projects keep their lighting; glass casts shadows only where it blocks light, without caustics; studio styles differ")

        func meanDifference(_ a: [UInt8], _ b: [UInt8]) -> Double {
            var total = 0
            for i in a.indices where i % 4 != 3 { total += abs(Int(a[i]) - Int(b[i])) }
            return Double(total) / Double(a.count / 4 * 3)
        }
        // A barely rounded cube is ray-marched; it must match the exact analytic cube except right at its edges.
        var sharpCube = GlassScene(); sharpCube.objects = [GlassObject(shape: .cube)]; sharpCube.objects[0].edgeRounding = 0
        var barelyRounded = sharpCube; barelyRounded.objects[0].edgeRounding = 0.02
        var wellRounded = sharpCube; wellRounded.objects[0].edgeRounding = 0.6
        let sharpPixels = try rgba(try await renderer.render(artwork: artwork, scene: sharpCube, width: 240, samples: 8))
        let barelyPixels = try rgba(try await renderer.render(artwork: artwork, scene: barelyRounded, width: 240, samples: 8))
        let roundedPixels = try rgba(try await renderer.render(artwork: artwork, scene: wellRounded, width: 240, samples: 8))
        let roundedAgain = try rgba(try await renderer.render(artwork: artwork, scene: wellRounded, width: 240, samples: 8))
        let barelyError = meanDifference(sharpPixels, barelyPixels), roundedChange = meanDifference(sharpPixels, roundedPixels)
        try require(barelyError < 1.5, "Ray-marched edges disagree with the analytic cube (mean difference \(barelyError))")
        try require(roundedChange > 3 * barelyError && roundedPixels == roundedAgain, "Edge rounding had no effect or is not repeatable (\(roundedChange))")
        // A perspective camera keeps the paper undistorted: IOR-1 glass seen in perspective leaves the poster unchanged.
        var perspectiveAir = air; perspectiveAir.perspective = 1
        let perspectiveAirPixels = try rgba(try await renderer.render(artwork: artwork, scene: perspectiveAir, width: 240, samples: 1))
        try require(zip(perspectiveAirPixels, basePixels).allSatisfy { abs(Int($0) - Int($1)) <= 1 }, "The perspective camera distorted the poster")
        var straightDown = GlassScene(); straightDown.objects[0].roughness = 0
        var perspectiveGlass = straightDown; perspectiveGlass.perspective = 0.6
        let straightPixels = try rgba(try await renderer.render(artwork: artwork, scene: straightDown, width: 240, samples: 8))
        let perspectivePixels = try rgba(try await renderer.render(artwork: artwork, scene: perspectiveGlass, width: 240, samples: 8))
        try require(meanDifference(straightPixels, perspectivePixels) > 1, "Perspective did not change how the glass looks")
        print("PASS: ray-marched rounded edges match analytic solids, perspective keeps the paper undistorted, both repeatable (edge error \(String(format: "%.2f", barelyError)))")

        let trace = try GlassVectorTrace.trace(normal, width: 320, colors: 10)
        let repeatedTrace = try GlassVectorTrace.trace(normal, width: 320, colors: 10)
        try require(trace.svg == repeatedTrace.svg, "Vector trace is not repeatable")
        try require(trace.pathCount > 20 && trace.colorCount <= 10, "Vector trace did not create color contours")
        try require(trace.gapPixels == 0 && trace.svg.contains("C"), "Vector regions left \(trace.gapPixels) pixels uncovered or lost their curves")
        // Thin anti-aliased strokes, like small type at trace resolution, must survive speck cleanup.
        guard let strokes = CGContext(data: nil, width: 600, height: 848, bitsPerComponent: 8, bytesPerRow: 600 * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw CheckFailure("Cannot create stroke fixture") }
        strokes.setFillColor(CGColor(red: 0.94, green: 0.2, blue: 0.3, alpha: 1)); strokes.fill(CGRect(x: 0, y: 0, width: 600, height: 848))
        strokes.setStrokeColor(CGColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 1)); strokes.setLineWidth(1.2)
        for i in 0..<36 {
            let x = 20 + Double(i) * 16
            strokes.move(to: CGPoint(x: x, y: 60)); strokes.addLine(to: CGPoint(x: x + Double(i % 7) * 9, y: 420)); strokes.strokePath()
            strokes.strokeEllipse(in: CGRect(x: x, y: 500 + Double(i % 5) * 60, width: 7 + Double(i % 3) * 2, height: 9))
        }
        let strokeImage = strokes.makeImage()!
        let strokeTrace = try GlassVectorTrace.trace(strokeImage, width: 600, colors: 8)
        func dark(_ pixels: [UInt8]) -> Int {
            var count = 0
            for i in stride(from: 0, to: pixels.count, by: 4) {
                let red = 0.3 * Double(pixels[i]), green = 0.59 * Double(pixels[i + 1]), blue = 0.11 * Double(pixels[i + 2])
                if red + green + blue < 110 { count += 1 }
            }
            return count
        }
        let strokeSource = dark(try rgba(strokeImage)), strokeTraced = dark(try rgba(strokeTrace.preview))
        try require(Double(strokeTraced) >= 0.85 * Double(strokeSource), "Tracing erased thin strokes (\(strokeTraced) of \(strokeSource) dark pixels kept)")
        try require(!trace.svg.contains("<image") && !trace.svg.contains("base64") && trace.svg.contains("fill-rule=\"evenodd\""), "SVG contains a bitmap or lost its holes")
        try require(XMLParser(data: Data(trace.svg.utf8)).parse(), "SVG is not well-formed XML")
        try trace.svg.write(to: root.appending(path: "fixture-vectors.svg"), atomically: true, encoding: .utf8)
        try PosterRenderer.png(trace.preview, to: root.appending(path: "fixture-vectors.png"))
        let artworkPNG = try Data(contentsOf: root.appending(path: "fixture-sphere.png"))
        let document = GlassDocument(artworkName: "portable-poster.png", artworkPNG: artworkPNG, scene: GlassScene())
        let restored = try JSONDecoder().decode(GlassDocument.self, from: JSONEncoder().encode(document))
        try restored.validate()
        try require(restored.scene == document.scene && restored.artworkPNG == artworkPNG, "Project roundtrip lost optics or embedded artwork")
        print("PASS: deterministic path-only SVG with shared curved borders, no gaps and thin strokes kept, and portable JSON project roundtrip")

        // A vector poster keeps its own artwork in the SVG; only the pixels the glass changes are traced.
        let posterPDF = try vectorPosterFixture(text: false)
        let posterArtwork = try GlassPosterPDF.rasterize(posterPDF, maxSide: 1680)
        var bare = GlassScene(); bare.objects = []
        let bareRender = try await renderer.renderWithCoverage(artwork: posterArtwork, scene: bare, width: 1200, samples: 4)
        let untouched = try GlassVectorTrace.trace(bareRender.image, width: 600, colors: 12,
                                                   poster: .init(pdf: posterPDF, coverage: bareRender.coverage))
        try require(untouched.posterVectors && untouched.tracedShare == 0 && untouched.pathCount == 0,
                    "Without glass the vector poster still needed tracing (\(untouched.pathCount) paths)")
        // The converted shapes must draw as Core Graphics draws the PDF itself.
        let pdfPixels = try rgba(GlassPosterPDF.rasterize(posterPDF, maxSide: untouched.preview.height))
        let convertedPixels = try rgba(untouched.preview)
        try require(pdfPixels.count == convertedPixels.count, "Vector poster preview has the wrong size")
        let conversionErrors = zip(pdfPixels, convertedPixels).map { abs(Int($0) - Int($1)) }
        let conversionError = Double(conversionErrors.reduce(0, +)) / Double(conversionErrors.count)
        let conversionOutliers = Double(conversionErrors.filter { $0 > 32 }.count) / Double(conversionErrors.count)
        try require(conversionError < 0.6 && conversionOutliers < 0.002,
                    "PDF to SVG conversion drew differently (mean error \(conversionError), \(conversionOutliers * 100) % outliers)")
        for feature in ["clip-path=", "stroke-dasharray=", "stroke-linecap=\"round\"", "fill-opacity=", "fill-rule=\"evenodd\""] {
            try require(untouched.svg.contains(feature), "Vector poster SVG lost \(feature)")
        }
        var lens = GlassScene()
        lens.objects[0].size = 0.42; lens.objects[0].x = 0.56; lens.objects[0].y = 0.46
        let lensRender = try await renderer.renderWithCoverage(artwork: posterArtwork, scene: lens, width: 1200, samples: 24)
        let lensPoster = GlassVectorTrace.Poster(pdf: posterPDF, coverage: lensRender.coverage)
        let kept = try GlassVectorTrace.trace(lensRender.image, width: 600, colors: 12, poster: lensPoster)
        let keptAgain = try GlassVectorTrace.trace(lensRender.image, width: 600, colors: 12, poster: lensPoster)
        try require(kept.svg == keptAgain.svg, "Vector poster trace is not repeatable")
        try require(kept.posterVectors && kept.tracedShare > 0.05 && kept.tracedShare < 0.5,
                    "The trace should cover only the glass footprint (traced \(kept.tracedShare * 100) %)")
        try require(kept.gapPixels == 0, "Traced glass left \(kept.gapPixels) changed pixels uncovered")
        let lensPixels = try rgba(try await renderer.render(artwork: lensRender.image, scene: bare, width: 600, samples: 1))
        let keptPixels = try rgba(kept.preview)
        let keptErrors = zip(lensPixels, keptPixels).map { abs(Int($0) - Int($1)) }
        let keptError = Double(keptErrors.reduce(0, +)) / Double(keptErrors.count)
        let fullTrace = try GlassVectorTrace.trace(lensRender.image, width: 600, colors: 12)
        let fullErrors = zip(lensPixels, try rgba(fullTrace.preview)).map { abs(Int($0) - Int($1)) }
        let fullError = Double(fullErrors.reduce(0, +)) / Double(fullErrors.count)
        try require(keptError < fullError && keptError < 4, "Vector poster SVG strays from the render (mean error \(keptError), full trace \(fullError))")
        try require(XMLParser(data: Data(kept.svg.utf8)).parse() && !kept.svg.contains("<image") && kept.svg.contains("<g id=\"glass\">"),
                    "Vector poster SVG is malformed or embeds a bitmap")
        // Text needs fonts the SVG would not carry, so such a poster is traced whole, as before.
        let textTrace = try GlassVectorTrace.trace(lensRender.image, width: 600, colors: 12,
                                                   poster: .init(pdf: try vectorPosterFixture(text: true), coverage: lensRender.coverage))
        try require(!textTrace.posterVectors && textTrace.tracedShare == 1 && textTrace.gapPixels == 0 && textTrace.note?.contains("text") == true,
                    "A PDF with text did not fall back to a full trace")
        let vectorDocument = GlassDocument(artworkName: "vector-poster.pdf", artworkPNG: artworkPNG, artworkPDF: posterPDF, scene: lens)
        let reopened = try JSONDecoder().decode(GlassDocument.self, from: JSONEncoder().encode(vectorDocument))
        try reopened.validate()
        try require(reopened.artworkPDF == posterPDF && restored.artworkPDF == nil, "Project roundtrip lost or invented the vector poster")
        try kept.svg.write(to: root.appending(path: "vector-poster-glass.svg"), atomically: true, encoding: .utf8)
        try PosterRenderer.png(kept.preview, to: root.appending(path: "vector-poster-glass-preview.png"))
        try PosterRenderer.png(lensRender.image, to: root.appending(path: "vector-poster-glass-render.png"))
        try posterPDF.write(to: root.appending(path: "vector-poster.pdf"))
        print("PASS: vector posters stay vectors in SVG (conversion error \(String(format: "%.2f", conversionError))), only the glass footprint (\(Int(kept.tracedShare * 100)) %) is traced without gaps, text falls back to a full trace, projects keep the PDF")

        // PosterLab's own vector exports convert completely.
        let posterlabURL = root.appending(path: "posterlab-poster.pdf")
        try PosterRenderer.pdf(.random(seed: 2035), copy: PosterCopy(), to: posterlabURL)
        let posterlabPDF = try Data(contentsOf: posterlabURL)
        let posterlab = try GlassPosterPDF.rasterize(posterlabPDF, maxSide: 2400)
        let posterlabBare = try await renderer.renderWithCoverage(artwork: posterlab, scene: bare, width: 1200, samples: 1)
        let posterlabShapes = try GlassVectorTrace.trace(posterlabBare.image, width: 600, colors: 16,
                                                         poster: .init(pdf: posterlabPDF, coverage: posterlabBare.coverage))
        let posterlabErrors = zip(try rgba(GlassPosterPDF.rasterize(posterlabPDF, maxSide: posterlabShapes.preview.height)),
                                  try rgba(posterlabShapes.preview)).map { abs(Int($0) - Int($1)) }
        let posterlabError = Double(posterlabErrors.reduce(0, +)) / Double(posterlabErrors.count)
        try require(posterlabShapes.pathCount == 0 && posterlabError < 0.6,
                    "The PosterLab PDF converted to shapes that draw differently (mean error \(posterlabError))")
        let posterlabRender = try await renderer.renderWithCoverage(artwork: posterlab, scene: lens, width: 1200, samples: 24)
        let posterlabTrace = try GlassVectorTrace.trace(posterlabRender.image, width: 600, colors: 16,
                                                        poster: .init(pdf: posterlabPDF, coverage: posterlabRender.coverage))
        try require(posterlabTrace.posterVectors && posterlabTrace.gapPixels == 0,
                    "A PosterLab PDF was not kept as vectors (\(posterlabTrace.note ?? "\(posterlabTrace.gapPixels) gap pixels"))")
        try posterlabTrace.svg.write(to: root.appending(path: "posterlab-glass-vectors.svg"), atomically: true, encoding: .utf8)
        try PosterRenderer.png(posterlabTrace.preview, to: root.appending(path: "posterlab-glass-vectors-preview.png"))
        try PosterRenderer.png(posterlabRender.image, to: root.appending(path: "posterlab-glass-render.png"))
        print("PASS: a PosterLab poster PDF converts exactly (error \(String(format: "%.2f", posterlabError))) and keeps its vectors under glass (\(Int(posterlabTrace.tracedShare * 100)) % traced, \(posterlabTrace.pathCount) glass paths)")

        if let demoURL = GlassWorkspaceResources.demoURL {
            let demo = try LibraryRaster.oriented(demoURL, maxSize: 2400)
            var scene = GlassScene()
            scene.objects[0].size = 0.72; scene.objects[0].x = 0.48; scene.objects[0].y = 0.41
            let proof = try await renderer.render(artwork: demo, scene: scene, width: 1200, samples: 24)
            try PosterRenderer.png(proof, to: root.appending(path: "poster-glass.png"))
            var simpleDemo = scene; simpleDemo.objects[0].material = .simple
            let simpleProof = try await renderer.render(artwork: demo, scene: simpleDemo, width: 1200, samples: 24)
            try PosterRenderer.png(simpleProof, to: root.appending(path: "poster-simple.png"))
            let vector = try GlassVectorTrace.trace(proof, width: 600, colors: 16)
            let reference = try await renderer.render(artwork: proof, scene: empty, width: 600, samples: 1)
            let referencePixels = try rgba(reference), vectorPixels = try rgba(vector.preview)
            var directError = 0, flippedError = 0
            for y in 0..<reference.height {
                for x in 0..<reference.width {
                    for channel in 0..<3 {
                        let index = (y * reference.width + x) * 4 + channel
                        let flipped = ((reference.height - 1 - y) * reference.width + x) * 4 + channel
                        directError += abs(Int(referencePixels[index]) - Int(vectorPixels[index]))
                        flippedError += abs(Int(referencePixels[index]) - Int(vectorPixels[flipped]))
                    }
                }
            }
            let meanError = Double(directError) / Double(reference.width * reference.height * 3)
            try require(directError < flippedError && meanError < 25, "Vector preview orientation or color changed (mean error \(meanError))")
            try require(vector.gapPixels == 0, "Poster vector regions left \(vector.gapPixels) pixels uncovered")
            try vector.svg.write(to: root.appending(path: "poster-glass.svg"), atomically: true, encoding: .utf8)
            try PosterRenderer.png(vector.preview, to: root.appending(path: "poster-glass-vector-preview.png"))
            print("PASS: 1200px poster render and \(vector.pathCount) closed-contour SVG proof")
        }
        print("Glass proofs: \(root.path)")
    }

    /// A small vector poster: flat bars, an even-odd ring, a clipped disc, a translucent panel, a rotated square,
    /// a dashed round-capped curve and a hairline frame, optionally with a line of text.
    static func vectorPosterFixture(text: Bool) throws -> Data {
        let data = NSMutableData()
        var box = CGRect(x: 0, y: 0, width: 300, height: 420)
        guard let consumer = CGDataConsumer(data: data), let pdf = CGContext(consumer: consumer, mediaBox: &box, nil) else {
            throw CheckFailure("Cannot create vector poster fixture")
        }
        let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
        func color(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> CGColor { CGColor(colorSpace: sRGB, components: [r, g, b, a])! }
        pdf.beginPDFPage(nil)
        pdf.setFillColor(color(0.95, 0.9, 0.78)); pdf.fill(box)
        for row in 0..<9 {
            pdf.setFillColor(color(row % 3 == 0 ? 0.85 : 0.05, row % 3 == 1 ? 0.6 : 0.05, row % 3 == 2 ? 0.75 : 0.1))
            pdf.fill(CGRect(x: 24 + Double(row % 4) * 14, y: 30 + Double(row) * 40, width: 190, height: 18))
        }
        pdf.addEllipse(in: CGRect(x: 170, y: 250, width: 110, height: 110)); pdf.addEllipse(in: CGRect(x: 200, y: 280, width: 50, height: 50))
        pdf.setFillColor(color(0.9, 0.2, 0.15)); pdf.fillPath(using: .evenOdd)
        pdf.saveGState(); pdf.clip(to: CGRect(x: 30, y: 300, width: 80, height: 60))
        pdf.setFillColor(color(0.1, 0.3, 0.8)); pdf.fillEllipse(in: CGRect(x: 10, y: 280, width: 120, height: 120)); pdf.restoreGState()
        pdf.setFillColor(color(1, 0.85, 0.1, 0.6)); pdf.fill(CGRect(x: 120, y: 60, width: 150, height: 120))
        pdf.saveGState(); pdf.translateBy(x: 210, y: 210); pdf.rotate(by: .pi / 7)
        pdf.setFillColor(color(0.2, 0.6, 0.3)); pdf.fill(CGRect(x: -30, y: -30, width: 60, height: 60)); pdf.restoreGState()
        pdf.setStrokeColor(color(0.07, 0.07, 0.07)); pdf.setLineWidth(3); pdf.setLineCap(.round); pdf.setLineDash(phase: 0, lengths: [8, 6])
        pdf.move(to: CGPoint(x: 20, y: 20))
        pdf.addCurve(to: CGPoint(x: 280, y: 40), control1: CGPoint(x: 100, y: 120), control2: CGPoint(x: 200, y: -40)); pdf.strokePath()
        pdf.setLineDash(phase: 0, lengths: []); pdf.setLineCap(.butt); pdf.setLineWidth(0.8)
        pdf.stroke(CGRect(x: 12, y: 12, width: 276, height: 396))
        if text {
            let font = CTFontCreateWithName("Helvetica" as CFString, 40, nil)
            let line = CTLineCreateWithAttributedString(NSAttributedString(string: "Glass", attributes: [.init(kCTFontAttributeName as String): font]))
            pdf.textPosition = CGPoint(x: 40, y: 200); CTLineDraw(line, pdf)
        }
        pdf.endPDFPage(); pdf.closePDF()
        return data as Data
    }
}

private final class ProgressLog: @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [Double] = []
    var values: [Double] { lock.withLock { recorded } }
    func record(_ value: Double) { lock.withLock { recorded.append(value) } }
}
