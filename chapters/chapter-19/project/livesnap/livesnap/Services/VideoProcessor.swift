//
//  VideoProcessor.swift
//  livesnap
//
//  视频处理模块 - Optimized with Swift Concurrency
//

import Foundation
@preconcurrency import AVFoundation
import UIKit

enum VideoAspectRatio {
    case original
    case lockScreen // 9:16
}

enum VideoProcessingError: LocalizedError {
    case fileNotFound(path: String)
    case exportSessionCreationFailed
    case noVideoTrack
    case outputFileMissing
    case exportFailed(underlyingError: Error?)
    case exportCancelled
    case unexpectedStatus
    case compositionFailed(reason: String)

    var errorDescription: String? {
        switch self {
        case .fileNotFound(let path):
            return "Video file not found: \(path)"
        case .exportSessionCreationFailed:
            return "Failed to create video export session"
        case .noVideoTrack:
            return "No video track found in the selected asset"
        case .outputFileMissing:
            return "Video export finished but the output file was not created"
        case .exportFailed(let underlyingError):
            return underlyingError?.localizedDescription ?? "Video export failed"
        case .exportCancelled:
            return "Video export was cancelled"
        case .unexpectedStatus:
            return "Video export ended with an unexpected status"
        case .compositionFailed(let reason):
            return "Video composition failed: \(reason)"
        }
    }
}

actor VideoProcessor {
    static let shared = VideoProcessor()
    
    // 内存管理：跟踪活跃的导出会话 (Actor 隔离，不需要锁)
    private var activeExportSessions: [String: ExportSessionHolder] = [:]
    
    // 性能优化：缓存图片生成器 (Actor 隔离，不需要锁)
    private var imageGeneratorCache: [String: AVAssetImageGenerator] = [:]
    
    private init() {
        // 由于 actor 隔离，我们需要在外部监听通知或通过主线程中转
        Task { @MainActor in
            NotificationCenter.default.addObserver(
                forName: UIApplication.didReceiveMemoryWarningNotification,
                object: nil,
                queue: .main
            ) { _ in
                Task {
                    await VideoProcessor.shared.handleMemoryWarning()
                }
            }
        }
    }

    nonisolated func processVideo(
        inputURL: URL,
        timeRange: CMTimeRange,
        aspectRatio: VideoAspectRatio,
        cropScale: CGFloat,
        cropOffset: CGSize,
        previewSize: CGSize,
        isPro: Bool,
        fps: Int = 30,
        useHighRes: Bool = false,
        progressHandler: @escaping (Double) -> Void,
        completion: @escaping (URL?, Error?) -> Void
    ) {
        Task {
            do {
                let outputURL = try await self.processVideo(
                    inputURL: inputURL,
                    timeRange: timeRange,
                    aspectRatio: aspectRatio,
                    cropScale: cropScale,
                    cropOffset: cropOffset,
                    previewSize: previewSize,
                    isPro: isPro,
                    fps: fps,
                    useHighRes: useHighRes,
                    progressHandler: progressHandler
                )
                completion(outputURL, nil)
            } catch {
                completion(nil, error)
            }
        }
    }
    
    /// 处理内存警告
    func handleMemoryWarning() {
        // 取消所有未完成的导出
        for (_, holder) in activeExportSessions {
            if holder.exportSession.status == .waiting || holder.exportSession.status == .exporting {
                holder.exportSession.cancelExport()
            }
        }
        activeExportSessions.removeAll()
        imageGeneratorCache.removeAll()
        
        // 清理临时文件
        VideoProcessor.cleanupOldTempFiles(all: false)
    }
    
    /// 处理视频：裁剪时间、调整分辨率、添加水印、应用剪裁
    /// - Parameters:
    ///   - inputURL: 输入视频 URL
    ///   - timeRange: 要裁剪的时间范围
    ///   - aspectRatio: 宽高比
    ///   - cropScale: 缩放比例
    ///   - cropOffset: 偏移量 (UI points)
    ///   - previewSize: 预览视图大小 (UI points)
    ///   - isPro: 是否为 Pro 用户
    ///   - completion: 完成回调，返回处理后的视频 URL
    func processVideo(
        inputURL: URL,
        timeRange: CMTimeRange,
        aspectRatio: VideoAspectRatio,
        cropScale: CGFloat,
        cropOffset: CGSize,
        previewSize: CGSize,
        isPro: Bool,
        fps: Int = 30,
        useHighRes: Bool = false,
        progressHandler: @escaping (Double) -> Void
    ) async throws -> URL {
        // 检查文件是否存在
        guard FileManager.default.fileExists(atPath: inputURL.path) else {
            throw VideoProcessingError.fileNotFound(path: inputURL.path)
        }

        let asset = AVURLAsset(url: inputURL, options: [
            AVURLAssetPreferPreciseDurationAndTimingKey: true
        ])

        // 配置 asset 选项以减少警告和优化性能
        asset.resourceLoader.setDelegate(nil, queue: nil)

        // 选择导出预设
        let preset = useHighRes ? AVAssetExportPresetHighestQuality : AVAssetExportPreset1920x1080

        guard let exportSession = AVAssetExportSession(asset: asset, presetName: preset) else {
            throw VideoProcessingError.exportSessionCreationFailed
        }
        
        // 配置会话
        exportSession.shouldOptimizeForNetworkUse = false
        exportSession.canPerformMultiplePassesOverSourceMediaData = false
        
        let sessionID = UUID().uuidString
        let sessionHolder = ExportSessionHolder(exportSession: exportSession)
        
        // 跟踪活跃会话
        activeExportSessions[sessionID] = sessionHolder
        defer {
            Task { await removeSession(id: sessionID) }
        }
        
        // 设置输出 URL
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mov")
        
        try? FileManager.default.removeItem(at: outputURL)
        
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mov
        exportSession.timeRange = timeRange
        
        // 加载轨道
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        guard let videoTrack = videoTracks.first else {
            throw VideoProcessingError.noVideoTrack
        }
        
        // 只有在需要裁剪或旋转时才使用 videoComposition
        let needsComposition = aspectRatio != .original || abs(cropScale - 1.0) > 0.01 || cropOffset.width != 0 || cropOffset.height != 0
        
        if needsComposition {
            if let videoComposition = await createVideoComposition(
                asset: asset,
                videoTrack: videoTrack,
                timeRange: timeRange,
                aspectRatio: aspectRatio,
                cropScale: cropScale,
                cropOffset: cropOffset,
                previewSize: previewSize,
                isPro: isPro,
                fps: fps
            ) {
                exportSession.videoComposition = videoComposition
            }
        }
        
        // 使用 withCheckedThrowingContinuation 桥接传统的异步导出
        return try await withCheckedThrowingContinuation { continuation in
            // 创建进度监听 (在主线程)
            let timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
                let progress = Double(exportSession.progress)
                progressHandler(progress)
                
                if exportSession.status == .completed || 
                   exportSession.status == .failed || 
                   exportSession.status == .cancelled {
                    timer.invalidate()
                }
            }
            RunLoop.main.add(timer, forMode: .common)
            
            exportSession.exportAsynchronously {
                DispatchQueue.main.async {
                    timer.invalidate()
                    
                    switch exportSession.status {
                    case .completed:
                        if FileManager.default.fileExists(atPath: outputURL.path) {
                            progressHandler(1.0)
                            continuation.resume(returning: outputURL)
                        } else {
                            continuation.resume(throwing: VideoProcessingError.outputFileMissing)
                        }
                    case .failed:
                        let error = exportSession.error
                        continuation.resume(throwing: VideoProcessingError.exportFailed(underlyingError: error))
                    case .cancelled:
                        continuation.resume(throwing: VideoProcessingError.exportCancelled)
                    default:
                        continuation.resume(throwing: VideoProcessingError.unexpectedStatus)
                    }
                }
            }
        }
    }
    
    private func removeSession(id: String) {
        activeExportSessions.removeValue(forKey: id)
    }
    
    /// 创建视频合成
    private func createVideoComposition(
        asset: AVAsset,
        videoTrack: AVAssetTrack,
        timeRange: CMTimeRange,
        aspectRatio: VideoAspectRatio,
        cropScale: CGFloat,
        cropOffset: CGSize,
        previewSize: CGSize,
        isPro: Bool,
        fps: Int
    ) async -> AVMutableVideoComposition? {
        let composition = AVMutableComposition()
        guard let compositionVideoTrack = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            return nil
        }
        
        try? compositionVideoTrack.insertTimeRange(timeRange, of: videoTrack, at: .zero)
        
        let naturalSize = try? await videoTrack.load(.naturalSize)
        let preferredTransform = try? await videoTrack.load(.preferredTransform)
        
        guard let naturalSize = naturalSize, let preferredTransform = preferredTransform else {
            return nil
        }
        
        let videoComposition = AVMutableVideoComposition()
        
        // 确定渲染尺寸
        var targetSize = naturalSize
        if aspectRatio == .lockScreen {
            targetSize = CGSize(width: 1080, height: 1920)
        } else {
            let maxDimension: CGFloat = 1920
            if naturalSize.width > maxDimension || naturalSize.height > maxDimension {
                let scale = min(maxDimension / naturalSize.width, maxDimension / naturalSize.height)
                targetSize = CGSize(width: naturalSize.width * scale, height: naturalSize.height * scale)
            }
        }
        videoComposition.renderSize = targetSize
        videoComposition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps))
        
        // 计算变换
        var videoSize = naturalSize
        if preferredTransform.a == 0 && preferredTransform.d == 0 && (preferredTransform.b == 1.0 || preferredTransform.b == -1.0) {
            videoSize = CGSize(width: naturalSize.height, height: naturalSize.width)
        }
        
        let widthRatio = targetSize.width / videoSize.width
        let heightRatio = targetSize.height / videoSize.height
        let baseScale = max(widthRatio, heightRatio)
        
        let scaledWidth = videoSize.width * baseScale
        let scaledHeight = videoSize.height * baseScale
        
        let mapFactor = previewSize.width > 0 ? targetSize.width / previewSize.width : 1.0
        let finalScale = baseScale * cropScale
        
        let userOffsetX = cropOffset.width * mapFactor
        let userOffsetY = cropOffset.height * mapFactor
        
        let finalScaledWidth = scaledWidth * cropScale
        let finalScaledHeight = scaledHeight * cropScale
        
        let finalBaseX = (targetSize.width - finalScaledWidth) / 2
        let finalBaseY = (targetSize.height - finalScaledHeight) / 2
        
        let finalTx = finalBaseX + userOffsetX
        let finalTy = finalBaseY + userOffsetY
        
        var finalTransform = preferredTransform
        finalTransform = finalTransform.concatenating(CGAffineTransform(scaleX: finalScale, y: finalScale))
        finalTransform = finalTransform.concatenating(CGAffineTransform(translationX: finalTx, y: finalTy))
        
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: timeRange.duration)
        
        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compositionVideoTrack)
        layerInstruction.setTransform(finalTransform, at: .zero)
        instruction.layerInstructions = [layerInstruction]
        
        if !isPro {
            let watermarkLayer = createWatermarkLayer(size: targetSize)
            let parentLayer = CALayer()
            let videoLayer = CALayer()
            
            parentLayer.frame = CGRect(origin: .zero, size: targetSize)
            videoLayer.frame = parentLayer.frame
            watermarkLayer.frame = parentLayer.frame
            
            parentLayer.addSublayer(videoLayer)
            parentLayer.addSublayer(watermarkLayer)
            
            videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
                postProcessingAsVideoLayer: videoLayer,
                in: parentLayer
            )
        }
        
        videoComposition.instructions = [instruction]
        return videoComposition
    }
    
    private func createWatermarkLayer(size: CGSize) -> CALayer {
        let layer = CALayer()
        layer.frame = CGRect(origin: .zero, size: size)

        let textLayer = CATextLayer()
        textLayer.string = Config.Processing.Watermark.text
        textLayer.font = UIFont.systemFont(ofSize: Config.Processing.Watermark.fontSize, weight: .regular) // 改为 regular，更低调
        textLayer.fontSize = Config.Processing.Watermark.fontSize
        textLayer.foregroundColor = UIColor.white.withAlphaComponent(Config.Processing.Watermark.opacity).cgColor
        textLayer.alignmentMode = .right
        textLayer.frame = CGRect(
            x: size.width - Config.Processing.Watermark.rightPadding,
            y: size.height - Config.Processing.Watermark.bottomPadding,
            width: 100,
            height: 30
        )

        layer.addSublayer(textLayer)
        return layer
    }
    
    /// 提取关键帧图片
    func extractKeyFrame(from asset: AVAsset, at time: CMTime) async throws -> URL {
        let assetID = (asset as? AVURLAsset)?.url.absoluteString ?? UUID().uuidString
        let imageGenerator: AVAssetImageGenerator
        
        if let cached = imageGeneratorCache[assetID] {
            imageGenerator = cached
        } else {
            imageGenerator = AVAssetImageGenerator(asset: asset)
            imageGenerator.appliesPreferredTrackTransform = true
            imageGenerator.requestedTimeToleranceAfter = CMTime(seconds: 0.01, preferredTimescale: 600)
            imageGenerator.requestedTimeToleranceBefore = CMTime(seconds: 0.01, preferredTimescale: 600)
            imageGenerator.apertureMode = .productionAperture
            imageGenerator.maximumSize = CGSize(width: 3840, height: 3840)
            imageGeneratorCache[assetID] = imageGenerator
        }
        
        do {
            let (cgImage, _) = try await imageGenerator.image(at: time)
            return try await saveImage(cgImage, quality: 0.9)
        } catch {
            print("❌ Key frame extraction error, retrying at .zero: \(error.localizedDescription)")
            let (cgImage, _) = try await imageGenerator.image(at: .zero)
            return try await saveImage(cgImage, quality: 0.9)
        }
    }
    
    private func saveImage(_ cgImage: CGImage, quality: CGFloat) async throws -> URL {
        let uiImage = UIImage(cgImage: cgImage)
        guard let data = uiImage.jpegData(compressionQuality: quality) else {
            throw VideoProcessingError.compositionFailed(reason: "Failed to convert image to JPEG")
        }

        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("jpg")

        try data.write(to: outputURL, options: .atomic)
        return outputURL
    }

    /// 清理旧的临时文件
    static func cleanupOldTempFiles(all: Bool = false) {
        DispatchQueue.global(qos: .utility).async {
            let tempDir = FileManager.default.temporaryDirectory
            let threshold = all ? Date() : Date().addingTimeInterval(-24 * 60 * 60)
            
            do {
                let fileURLs = try FileManager.default.contentsOfDirectory(at: tempDir, includingPropertiesForKeys: [.creationDateKey], options: [])
                for fileURL in fileURLs {
                    autoreleasepool {
                        let resourceValues = try? fileURL.resourceValues(forKeys: [.creationDateKey])
                        if let creationDate = resourceValues?.creationDate, creationDate < threshold {
                            if fileURL.pathExtension == "mov" || fileURL.pathExtension == "jpg" {
                                try? FileManager.default.removeItem(at: fileURL)
                            }
                        }
                    }
                }
            } catch {
                print("Error cleaning up temp files: \(error.localizedDescription)")
            }
        }
    }
}

private class ExportSessionHolder {
    let exportSession: AVAssetExportSession
    init(exportSession: AVAssetExportSession) {
        self.exportSession = exportSession
    }
}
