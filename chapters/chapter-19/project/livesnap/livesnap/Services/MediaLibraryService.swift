//
//  MediaLibraryService.swift
//  livesnap
//
//  Manages interactions with the Photo Library (PhotoKit)
//

import Foundation
import Photos
import UIKit

/// 媒体库服务 - 使用 Actor 处理并发安全
actor MediaLibraryService {
    static let shared = MediaLibraryService()
    
    // 图片缓存：NSCache 本身是线程安全的
    private let thumbnailCache = NSCache<NSString, UIImage>()
    
    private init() {
        // 配置缓存
        thumbnailCache.countLimit = 100 // 增加缓存数量
        thumbnailCache.totalCostLimit = 100 * 1024 * 1024 // 100MB
        
        // 由于 actor 隔离，我们需要在外部监听通知或通过主线程中转
        Task { @MainActor in
            NotificationCenter.default.addObserver(
                forName: UIApplication.didReceiveMemoryWarningNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { [weak self] in
                    await self?.clearCache()
                }
            }
        }
    }
    
    /// 清理缓存
    func clearCache() {
        thumbnailCache.removeAllObjects()
    }
    
    /// 请求相册权限
    func requestAuthorization() async -> Bool {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        return status == .authorized || status == .limited
    }
    
    /// 获取最近视频
    func fetchRecentVideos(limit: Int = 10) async -> [PHAsset] {
        guard await requestAuthorization() else { return [] }
        
        let fetchOptions = PHFetchOptions()
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        fetchOptions.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.video.rawValue)
        fetchOptions.fetchLimit = limit
        
        let fetchResult = PHAsset.fetchAssets(with: fetchOptions)
        var assets: [PHAsset] = []
        fetchResult.enumerateObjects { asset, _, _ in
            assets.append(asset)
        }
        return assets
    }
    
    /// 获取所有视频
    func fetchAllVideos() async -> [PHAsset] {
        guard await requestAuthorization() else { return [] }
        
        let fetchOptions = PHFetchOptions()
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        fetchOptions.predicate = NSPredicate(format: "mediaType = %d", PHAssetMediaType.video.rawValue)
        
        let fetchResult = PHAsset.fetchAssets(with: fetchOptions)
        var assets: [PHAsset] = []
        fetchResult.enumerateObjects { asset, _, _ in
            assets.append(asset)
        }
        return assets
    }
    
    /// 根据标识符获取资源
    func fetchAssets(withLocalIdentifiers identifiers: [String]) async -> [PHAsset] {
        guard await requestAuthorization() else { return [] }
        
        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: identifiers, options: nil)
        var assets: [PHAsset] = []
        fetchResult.enumerateObjects { asset, _, _ in
            assets.append(asset)
        }
        return assets.sorted { asset1, asset2 in
            return (asset1.creationDate ?? Date.distantPast) > (asset2.creationDate ?? Date.distantPast)
        }
    }
    
    /// 生成缩略图 (带高效缓存)
    func generateThumbnail(for asset: PHAsset, size: CGSize) async -> UIImage? {
        let cacheKey = "\(asset.localIdentifier)_\(Int(size.width))x\(Int(size.height))" as NSString
        
        // NSCache 是线程安全的，可以直接尝试读取
        if let cachedImage = thumbnailCache.object(forKey: cacheKey) {
            return cachedImage
        }
        
        // 使用 withCheckedContinuation 将回调转换为异步
        let image = await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .opportunistic // 先显示模糊的，再显示清晰的（配合 PHImageManager 逻辑）
            options.isNetworkAccessAllowed = true
            options.isSynchronous = false
            options.resizeMode = .fast
            
            // 使用原子操作或简单的 actor 属性是不够的，因为这是一个异步回调
            // 但因为我们在 completion 内部只需要恢复一次，可以利用 completion 的特性
            var hasResumed = false
            
            PHImageManager.default().requestImage(
                for: asset,
                targetSize: size,
                contentMode: .aspectFill,
                options: options
            ) { image, info in
                // 确保只恢复一次（requestImage 可能会在 opportunistic 模式下调用多次）
                let isDegraded = info?[PHImageResultIsDegradedKey] as? Bool ?? false
                
                if !isDegraded && !hasResumed {
                    hasResumed = true
                    continuation.resume(returning: image)
                } else if image != nil && !hasResumed && isDegraded {
                    // 如果只想要一张，也可以在这里恢复，但通常我们想要清晰的
                    // 这里为了简单，我们等待最终清晰的图片，除非是错误
                }
                
                // 处理错误或取消
                if !hasResumed {
                    if let error = info?[PHImageErrorKey] as? Error {
                        print("⚠️ PhotoKit error: \(error)")
                        hasResumed = true
                        continuation.resume(returning: nil)
                    } else if (info?[PHImageCancelledKey] as? Bool) == true {
                        hasResumed = true
                        continuation.resume(returning: nil)
                    }
                }
            }
        }
        
        // 存入缓存
        if let image = image {
            thumbnailCache.setObject(image, forKey: cacheKey)
        }
        
        return image
    }
    
    /// 获取时长字符串
    nonisolated func getDurationString(for asset: PHAsset) -> String {
        let duration = Int(round(asset.duration))
        let minutes = duration / 60
        let seconds = duration % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
