//
//  LivePhotoComposer.swift
//  livesnap
//
//  Live Photo 组装模块 - Optimized with Swift Concurrency
//

import Foundation
import AVFoundation
import Photos
import PhotosUI
import UIKit
import ImageIO
import UniformTypeIdentifiers

enum LivePhotoError: LocalizedError {
    case videoFileNotFound
    case imageFileNotFound
    case photoLibraryAccessDenied
    case imageMetadataFailed
    case videoMetadataFailed
    case creationFailed(underlyingError: Error)
    case noPlaceholder

    var errorDescription: String? {
        switch self {
        case .videoFileNotFound:
            return "Video file not found."
        case .imageFileNotFound:
            return "Image file not found."
        case .photoLibraryAccessDenied:
            return "Photo library access was denied."
        case .imageMetadataFailed:
            return "Failed to write Live Photo metadata to the image."
        case .videoMetadataFailed:
            return "Failed to write Live Photo metadata to the video."
        case .creationFailed(let underlyingError):
            return "Failed to create Live Photo: \(underlyingError.localizedDescription)"
        case .noPlaceholder:
            return "Photo library did not return a created asset identifier."
        }
    }
}

actor LivePhotoComposer {
    static let shared = LivePhotoComposer()
    
    private init() {}
    
    /// 创建 Live Photo（包含 metadata）
    /// - Parameters:
    ///   - videoURL: 处理后的视频 URL
    ///   - imageURL: 关键帧图片 URL
    /// - Returns: 创建的资产标识符 (localIdentifier)
    func createLivePhoto(videoURL: URL, imageURL: URL) async throws -> String {
        // 检查文件是否存在
        guard FileManager.default.fileExists(atPath: videoURL.path) else {
            throw LivePhotoError.videoFileNotFound
        }
        guard FileManager.default.fileExists(atPath: imageURL.path) else {
            throw LivePhotoError.imageFileNotFound
        }

        // 获取权限
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw LivePhotoError.photoLibraryAccessDenied
        }

        let assetIdentifier = UUID().uuidString

        // 为图片添加 metadata
        guard let imageWithMetadata = addImageMetadata(to: imageURL, assetIdentifier: assetIdentifier) else {
            throw LivePhotoError.imageMetadataFailed
        }

        // 为视频添加 metadata
        guard let videoWithMetadata = await addVideoMetadata(to: videoURL, assetIdentifier: assetIdentifier) else {
            throw LivePhotoError.videoMetadataFailed
        }
        
        defer {
            try? FileManager.default.removeItem(at: imageWithMetadata)
            try? FileManager.default.removeItem(at: videoWithMetadata)
        }
        
        // 存储并返回标识符
        return try await withCheckedThrowingContinuation { continuation in
            var localIdentifier: String?
            
            PHPhotoLibrary.shared().performChanges({
                let creationRequest = PHAssetCreationRequest.forAsset()
                
                let imageOptions = PHAssetResourceCreationOptions()
                imageOptions.uniformTypeIdentifier = UTType.jpeg.identifier
                imageOptions.originalFilename = "LivePhoto.jpg"
                creationRequest.addResource(with: .photo, fileURL: imageWithMetadata, options: imageOptions)
                
                let videoOptions = PHAssetResourceCreationOptions()
                videoOptions.uniformTypeIdentifier = UTType.quickTimeMovie.identifier
                videoOptions.originalFilename = "LivePhoto.mov"
                creationRequest.addResource(with: .pairedVideo, fileURL: videoWithMetadata, options: videoOptions)
                
                if let placeholder = creationRequest.placeholderForCreatedAsset {
                    localIdentifier = placeholder.localIdentifier
                }
            }, completionHandler: { success, error in
                if let error = error {
                    continuation.resume(throwing: LivePhotoError.creationFailed(underlyingError: error))
                } else if success, let id = localIdentifier {
                    continuation.resume(returning: id)
                } else {
                    continuation.resume(throwing: LivePhotoError.noPlaceholder)
                }
            })
        }
    }
    
    private func addImageMetadata(to imageURL: URL, assetIdentifier: String) -> URL? {
        guard let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil),
              let originalMetadata = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [String: Any] else {
            return nil
        }
        
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("jpg")
        
        guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
            return nil
        }
        
        var metadata = originalMetadata
        var makerApple: [String: Any] = metadata[kCGImagePropertyMakerAppleDictionary as String] as? [String: Any] ?? [:]
        
        makerApple["17"] = assetIdentifier as NSString
        
        let mutableMetadata = NSMutableDictionary(dictionary: metadata)
        mutableMetadata[kCGImagePropertyMakerAppleDictionary] = makerApple
        
        if let exif = metadata[kCGImagePropertyExifDictionary as String] as? [String: Any] {
            mutableMetadata[kCGImagePropertyExifDictionary] = exif
        }
        if let tiff = metadata[kCGImagePropertyTIFFDictionary as String] as? [String: Any] {
            mutableMetadata[kCGImagePropertyTIFFDictionary] = tiff
        }
        
        CGImageDestinationAddImage(destination, image, mutableMetadata as CFDictionary)
        
        guard CGImageDestinationFinalize(destination) else { return nil }
        return outputURL
    }
    
    private func addVideoMetadata(to videoURL: URL, assetIdentifier: String) async -> URL? {
        let asset = AVURLAsset(url: videoURL)
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("mov")
        
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
            return nil
        }
        
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mov
        exportSession.shouldOptimizeForNetworkUse = false
        
        let metadataItem = AVMutableMetadataItem()
        metadataItem.identifier = AVMetadataIdentifier.quickTimeMetadataContentIdentifier
        metadataItem.value = assetIdentifier as NSString
        metadataItem.extendedLanguageTag = "und"
        metadataItem.dataType = kCMMetadataBaseDataType_UTF8 as String
        exportSession.metadata = [metadataItem]
        
        do {
            try await exportSession.export(to: outputURL, as: .mov)
            return outputURL
        } catch {
            print("❌ Video metadata export error: \(error.localizedDescription)")
            return nil
        }
    }
}
