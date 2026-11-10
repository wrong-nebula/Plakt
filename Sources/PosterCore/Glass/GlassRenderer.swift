import CoreGraphics
import Foundation
import Metal
import simd

/// Orthographic GPU ray tracing through closed solid dielectrics onto the poster plane.
/// Snell transmission, exact dielectric Fresnel, internal reflection, Beer–Lambert
/// absorption, GGX microfacet normals, RGB dispersion and a studio environment.
/// A shadow pass traces straight rays from the paper toward the key light through physical
/// glass, so the paper shows the transparent, tinted shadows the glass casts (no caustics).
/// Light and poster-colored studios evaluate three.js r187's RoomEnvironment analytically.
public actor GlassRenderer {
    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private let pipeline: MTLComputePipelineState
    private let shadowPipeline: MTLComputePipelineState
    private let blurPipeline: MTLComputePipelineState
    private let studioPipeline: MTLComputePipelineState
    /// Bound in place of the shadow map when no glass shades the paper, and of the studio map in the dark studio.
    private let unshadowed: MTLTexture

    public init() throws {
        guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else {
            throw PosterError.invalid("Glass rendering needs a Mac with Metal support.")
        }
        guard let url = PosterResources.bundle.url(forResource: "Glass", withExtension: "metal", subdirectory: "Resources/Glass") else {
            throw PosterError.invalid("The glass renderer is missing. Rebuild PosterLab Glass.")
        }
        let library = try device.makeLibrary(source: String(contentsOf: url, encoding: .utf8), options: nil)
        guard let function = library.makeFunction(name: "renderGlass"),
              let castShadows = library.makeFunction(name: "castShadows"),
              let blurShadows = library.makeFunction(name: "blurShadows"),
              let bakeStudio = library.makeFunction(name: "bakeStudio") else { throw PosterError.render }
        let neutral = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: 1, height: 1, mipmapped: false)
        neutral.usage = .shaderRead
        guard let unshadowed = device.makeTexture(descriptor: neutral) else { throw PosterError.render }
        let one = [UInt16](repeating: 0x3C00, count: 4) // half-precision 1.0
        one.withUnsafeBytes { unshadowed.replace(region: MTLRegionMake2D(0, 0, 1, 1), mipmapLevel: 0, withBytes: $0.baseAddress!, bytesPerRow: 8) }
        self.device = device
        self.queue = queue
        self.pipeline = try device.makeComputePipelineState(function: function)
        self.shadowPipeline = try device.makeComputePipelineState(function: castShadows)
        self.blurPipeline = try device.makeComputePipelineState(function: blurShadows)
        self.studioPipeline = try device.makeComputePipelineState(function: bakeStudio)
        self.unshadowed = unshadowed
    }

    /// Renders run as sequential command buffers so they report progress, stop between passes when
    /// cancelled and never hold the GPU for long. Each pass covers every `rowStride`-th row from a few
    /// offsets, so all passes see the same mix of empty paper and dense glass and cost about the same.
    /// The first pass (one offset) measures this scene; the rest are sized to about `passSeconds`.
    private static let rowStride = 1024
    private static let passSeconds = 0.4
    /// A GPU job that a busy GPU aborts is encoded and run again, up to this many times.
    private static let retries = 3

    /// `progress` receives the completed fraction after each pass. Cancelling the calling task
    /// stops the render at the next pass boundary with `CancellationError`.
    public func render(artwork: CGImage, scene: GlassScene, width: Int = 900, samples: Int = 8,
                       progress: (@Sendable (Double) -> Void)? = nil) async throws -> CGImage {
        try await render(artwork: artwork, scene: scene, width: width, samples: samples, coverage: false, progress: progress).image
    }

    /// Also returns a gray image of the share of samples per pixel that met glass or landed in a glass
    /// shadow. Where it is 0 the render shows the plain poster, so a vector export can keep the poster's own
    /// artwork there and trace only the rest.
    public func renderWithCoverage(artwork: CGImage, scene: GlassScene, width: Int, samples: Int,
                                   progress: (@Sendable (Double) -> Void)? = nil) async throws -> (image: CGImage, coverage: CGImage) {
        let result = try await render(artwork: artwork, scene: scene, width: width, samples: samples, coverage: true, progress: progress)
        return (result.image, result.coverage!)
    }

    private func render(artwork: CGImage, scene: GlassScene, width: Int, samples: Int, coverage: Bool,
                        progress: (@Sendable (Double) -> Void)?) async throws -> (image: CGImage, coverage: CGImage?) {
        try scene.validate()
        guard (160...4096).contains(width), (1...64).contains(samples), artwork.width > 0, artwork.height > 0 else {
            throw PosterError.invalid("Glass export width must be 160–4096 pixels and samples 1–64.")
        }
        let aspect = Double(artwork.height) / Double(artwork.width)
        let height = max(1, Int((Double(width) * aspect).rounded()))
        guard height <= 8192, width * height <= 24_000_000 else {
            throw PosterError.invalid("This poster is too tall for that export width. Choose a smaller width.")
        }
        let sourceWidth = min(artwork.width, 4096)
        let sourceHeight = max(1, Int((Double(sourceWidth) * aspect).rounded()))
        guard sourceHeight <= 16384 else { throw PosterError.invalid("Choose an image with a less extreme aspect ratio.") }
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
        guard let context = CGContext(data: nil, width: sourceWidth, height: sourceHeight, bitsPerComponent: 8,
            bytesPerRow: sourceWidth * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue),
            let pixels = context.data else { throw PosterError.render }
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: sourceWidth, height: sourceHeight))
        context.interpolationQuality = .high
        context.draw(artwork, in: CGRect(x: 0, y: 0, width: sourceWidth, height: sourceHeight))
        // Mipmapped so a preview smaller than the poster samples a properly filtered level, not every nth texel.
        let sourceDescriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm_srgb,
            width: sourceWidth, height: sourceHeight, mipmapped: true)
        sourceDescriptor.storageMode = .shared
        sourceDescriptor.usage = [.shaderRead, .renderTarget]
        let resultDescriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm,
            width: width, height: height, mipmapped: false)
        resultDescriptor.storageMode = .shared
        resultDescriptor.usage = .shaderWrite
        guard let source = device.makeTexture(descriptor: sourceDescriptor),
              let result = device.makeTexture(descriptor: resultDescriptor) else {
            throw PosterError.render
        }
        source.replace(region: MTLRegionMake2D(0, 0, sourceWidth, sourceHeight), mipmapLevel: 0,
                       withBytes: pixels, bytesPerRow: sourceWidth * 4)
        for attempt in 1... {
            guard let command = queue.makeCommandBuffer(), let blit = command.makeBlitCommandEncoder() else { throw PosterError.render }
            blit.generateMipmaps(for: source)
            blit.endEncoding()
            do { try await complete(command); break } catch where attempt <= Self.retries { continue }
        }
        var objects = scene.objects.filter(\.enabled).map { PackedGlassObject($0, aspect: Float(aspect)) }
        let count = objects.count
        if objects.isEmpty { objects = [PackedGlassObject(GlassObject(), aspect: Float(aspect))] }
        var uniforms = GlassUniforms(
            viewport: SIMD4(1, Float(aspect), Float(width), Float(height)),
            controls: SIMD4(Float(count), Float(samples), Float(scene.lightAzimuth * .pi / 180), Float(scene.lightElevation * .pi / 180)),
            lighting: SIMD4(Float(scene.lightIntensity), Float(scene.environment),
                            max(0, log2(Float(sourceWidth) / Float(width))), Self.cameraHeight(scene.perspective, objects: objects.prefix(count))),
            tile: .zero, shading: .zero, tone: .zero, shadowMap: .zero)
        // The shadow map covers the poster plus a margin, so shadows continue past the poster edge.
        let shadowStrength = min(1, scene.shadows * scene.lightIntensity)
        let margin: Float = 0.2
        let mapColumns = Int((Float(min(1024, max(192, width / 4))) * (1 + 2 * margin)).rounded())
        let mapRows = Int((Float(mapColumns) * Float(aspect)).rounded())
        let castsShadows = shadowStrength > 0 && mapRows <= 16384
            && scene.objects.contains { $0.enabled && $0.material == .physical }
        uniforms.shading = SIMD4(scene.studio.shaderIndex, castsShadows ? Float(shadowStrength) : 0, Float(scene.lightSpread * .pi / 180), margin)
        uniforms.tone = scene.studio == .poster ? SIMD4(Self.meanColor(pixels, count: sourceWidth * sourceHeight), 0) : .zero
        uniforms.shadowMap = SIMD4(Float(mapColumns), Float(mapRows), samples >= 24 ? 6 : 4, coverage ? 1 : 0)
        var shadow = unshadowed, room = unshadowed
        if castsShadows { shadow = try await shadowMap(objects: objects, uniforms: uniforms) }
        if scene.studio != .dark { room = try await studioMap(uniforms: uniforms) }
        try await interleavedPasses(pipeline, width: width, rows: height, uniforms: &uniforms, progress: progress) { encoder in
            encoder.setTexture(source, index: 0)
            encoder.setTexture(result, index: 1)
            encoder.setTexture(shadow, index: 2)
            encoder.setTexture(room, index: 3)
            objects.withUnsafeBytes { encoder.setBytes($0.baseAddress!, length: $0.count, index: 0) }
        }
        var bytes = [UInt8](repeating: 0, count: width * height * 4)
        result.getBytes(&bytes, bytesPerRow: width * 4, from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
        var coverageImage: CGImage?
        if coverage {
            // Coverage moves from alpha into its own gray image; the render itself is opaque.
            let shares = Swift.stride(from: 3, to: bytes.count, by: 4).map { bytes[$0] }
            for index in Swift.stride(from: 3, to: bytes.count, by: 4) { bytes[index] = 255 }
            guard let provider = CGDataProvider(data: Data(shares) as CFData),
                  let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: width,
                    space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue),
                    provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent) else { throw PosterError.render }
            coverageImage = image
        }
        guard let provider = CGDataProvider(data: Data(bytes) as CFData),
              let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                bytesPerRow: width * 4, space: colorSpace,
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue), provider: provider,
                decode: nil, shouldInterpolate: true, intent: .defaultIntent) else { throw PosterError.render }
        return (image, coverageImage)
    }

    /// Key-light transmittance on the paper after physical glass; 1 wherever no glass is in the way.
    private func shadowMap(objects: [PackedGlassObject], uniforms: GlassUniforms) async throws -> MTLTexture {
        var uniforms = uniforms
        let columns = Int(uniforms.shadowMap.x), rows = Int(uniforms.shadowMap.y)
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: columns, height: rows, mipmapped: false)
        descriptor.storageMode = .private
        descriptor.usage = [.shaderRead, .shaderWrite]
        guard let raw = device.makeTexture(descriptor: descriptor), let shadow = device.makeTexture(descriptor: descriptor) else {
            throw PosterError.render
        }
        try await interleavedPasses(shadowPipeline, width: columns, rows: rows, uniforms: &uniforms, progress: nil) { encoder in
            objects.withUnsafeBytes { encoder.setBytes($0.baseAddress!, length: $0.count, index: 0) }
            encoder.setTexture(raw, index: 0)
        }
        for attempt in 1... {
            guard let command = queue.makeCommandBuffer(), let encoder = command.makeComputeCommandEncoder() else { throw PosterError.render }
            encoder.setComputePipelineState(blurPipeline)
            encoder.setTexture(raw, index: 0)
            encoder.setTexture(shadow, index: 1)
            encoder.dispatchThreads(MTLSize(width: columns, height: rows, depth: 1), threadsPerThreadgroup: Self.groupSize(blurPipeline))
            encoder.endEncoding()
            do { try await complete(command); break } catch where attempt <= Self.retries { continue }
        }
        return shadow
    }

    /// The light or poster-colored studio for this render as a 512 × 256 equirectangular map.
    private func studioMap(uniforms: GlassUniforms) async throws -> MTLTexture {
        var uniforms = uniforms
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba16Float, width: 512, height: 256, mipmapped: false)
        descriptor.storageMode = .private
        descriptor.usage = [.shaderRead, .shaderWrite]
        guard let map = device.makeTexture(descriptor: descriptor) else { throw PosterError.render }
        for attempt in 1... {
            guard let command = queue.makeCommandBuffer(), let encoder = command.makeComputeCommandEncoder() else { throw PosterError.render }
            encoder.setComputePipelineState(studioPipeline)
            encoder.setBytes(&uniforms, length: MemoryLayout<GlassUniforms>.stride, index: 1)
            encoder.setTexture(map, index: 0)
            encoder.dispatchThreads(MTLSize(width: 512, height: 256, depth: 1), threadsPerThreadgroup: Self.groupSize(studioPipeline))
            encoder.endEncoding()
            do { try await complete(command); break } catch where attempt <= Self.retries { continue }
        }
        return map
    }

    /// Perspective 1 puts the camera 1.5 poster widths above the centre; 0 means looking straight down.
    /// The camera always stays above the tallest solid.
    private static func cameraHeight(_ perspective: Double, objects: ArraySlice<PackedGlassObject>) -> Float {
        guard perspective > 0 else { return 0 }
        let top = objects.map { $0.center.z + simd_length(SIMD3($0.dimensions.x, $0.dimensions.y, $0.dimensions.z)) }.max() ?? 0
        return max(1.5 / Float(perspective), top + 0.25)
    }

    /// Dispatches `pipeline` over `rows` rows in interleaved passes: each pass covers every `rowStride`-th row
    /// from a few offsets. The first pass (one offset) measures the work; the rest are sized to `passSeconds`.
    private func interleavedPasses(_ pipeline: MTLComputePipelineState, width: Int, rows: Int, uniforms: inout GlassUniforms,
                                   progress: (@Sendable (Double) -> Void)?, bind: (MTLComputeCommandEncoder) -> Void) async throws {
        let stride = min(Self.rowStride, rows), rowsPerOffset = (rows + stride - 1) / stride
        var offset = 0, offsetsPerPass = 1, failures = 0
        while offset < stride {
            try Task.checkCancellation()
            let offsets = min(offsetsPerPass, stride - offset)
            guard let command = queue.makeCommandBuffer(), let encoder = command.makeComputeCommandEncoder() else {
                throw PosterError.render
            }
            uniforms.tile = SIMD4(UInt32(offset), UInt32(offsets), UInt32(stride), UInt32(rowsPerOffset))
            encoder.setComputePipelineState(pipeline)
            bind(encoder)
            encoder.setBytes(&uniforms, length: MemoryLayout<GlassUniforms>.stride, index: 1)
            encoder.dispatchThreads(MTLSize(width: width, height: offsets * rowsPerOffset, depth: 1),
                                    threadsPerThreadgroup: Self.groupSize(pipeline))
            encoder.endEncoding()
            do {
                try await complete(command)
            } catch {
                // Passes write separate rows and render deterministically, so a pass can simply run again.
                failures += 1
                if failures > Self.retries { throw error }
                offsetsPerPass = max(1, offsets / 2)
                continue
            }
            let seconds = command.gpuEndTime - command.gpuStartTime
            if seconds > 0 { offsetsPerPass = max(1, min(stride, Int(Double(offsets) * Self.passSeconds / seconds))) }
            offset += offsets
            progress?(Double(offset) / Double(stride))
        }
    }

    private func complete(_ command: MTLCommandBuffer) async throws {
        await withCheckedContinuation { (finished: CheckedContinuation<Void, Never>) in
            command.addCompletedHandler { _ in finished.resume() }
            command.commit()
        }
        if let error = command.error { throw error }
    }

    private static func groupSize(_ pipeline: MTLComputePipelineState) -> MTLSize {
        let width = pipeline.threadExecutionWidth
        return MTLSize(width: width, height: min(8, pipeline.maxTotalThreadsPerThreadgroup / width), depth: 1)
    }

    /// Mean linear color of the artwork, which tints the poster-colored studio.
    private static func meanColor(_ pixels: UnsafeMutableRawPointer, count: Int) -> SIMD3<Float> {
        let bytes = pixels.assumingMemoryBound(to: UInt8.self)
        let linear = (0..<256).map { value -> Float in
            let c = Float(value) / 255
            return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        let step = max(1, count / 250_000)
        var sum = SIMD3<Float>.zero, samples: Float = 0
        for i in stride(from: 0, to: count, by: step) {
            sum += SIMD3(linear[Int(bytes[i * 4])], linear[Int(bytes[i * 4 + 1])], linear[Int(bytes[i * 4 + 2])])
            samples += 1
        }
        return sum / samples
    }
}

private struct GlassUniforms {
    var viewport: SIMD4<Float>
    var controls: SIMD4<Float>
    var lighting: SIMD4<Float>
    var tile: SIMD4<UInt32>
    var shading: SIMD4<Float>
    var tone: SIMD4<Float>
    var shadowMap: SIMD4<Float>
}

private struct PackedGlassObject {
    var center: SIMD4<Float>
    var dimensions: SIMD4<Float>
    var optical: SIMD4<Float>
    var tint: SIMD4<Float>
    var axisX: SIMD4<Float>
    var axisY: SIMD4<Float>
    var axisZ: SIMD4<Float>

    init(_ object: GlassObject, aspect: Float) {
        let rx = simd_quatf(angle: Float(object.rotationX * .pi / 180), axis: SIMD3(1, 0, 0))
        let ry = simd_quatf(angle: Float(object.rotationY * .pi / 180), axis: SIMD3(0, 1, 0))
        let rz = simd_quatf(angle: Float(object.rotationZ * .pi / 180), axis: SIMD3(0, 0, 1))
        let rotation = simd_float3x3(rz * ry * rx)
        let half = SIMD3<Float>(Float(object.size / 2), Float(object.size / 2), Float(object.size * object.depth / 2))
        let extent = SIMD3(rotation.columns.0.z, rotation.columns.1.z, rotation.columns.2.z) * half
        let bottomExtent = object.shape == .sphere ? simd_length(extent) : simd_reduce_add(simd_abs(extent))
        center = SIMD4(Float(object.x - 0.5), Float(0.5 - object.y) * aspect, Float(object.elevation) + bottomExtent, object.shape.shaderIndex)
        dimensions = SIMD4(half.x, half.y, half.z, Float(object.ior))
        optical = SIMD4(Float(object.roughness), Float(object.dispersion), Float(object.absorption), object.material == .simple ? 1 : 0)
        tint = SIMD4(Float(object.tintRed), Float(object.tintGreen), Float(object.tintBlue), 1)
        // The edge radius rides in axisX.w; spheres and unrounded solids keep exact analytic intersections.
        let flatExtent = object.shape == .prism ? half.x * 0.5 : half.x
        let radius = object.shape == .sphere ? 0 : Float(object.edgeRounding) * 0.5 * min(flatExtent, half.z)
        axisX = SIMD4(rotation.columns.0, radius)
        axisY = SIMD4(rotation.columns.1, 0)
        axisZ = SIMD4(rotation.columns.2, 0)
    }
}
