//
//  HistoryManager.swift
//  livesnap
//
//  历史记录管理
//

import Foundation
import Photos
import UIKit

class HistoryManager {
    static let shared = HistoryManager()
    
    private init() {}
    
    /// Load assets based on filter
    /// - Parameters:
    ///   - filter: "Recent" (My History) or "All" (System Library)
    ///   - completion: Callback with assets
    func loadAssets(filter: GalleryHistoryView.HistoryFilter, completion: @escaping ([PHAsset]) -> Void) {
        Task {
            let assets: [PHAsset]
            
            switch filter {
            case .recent:
                // "Recent" here implies "My History" / "My Exports" based on context,
                // or just the most recent ones.
                // Let's interpret "Recent" as "My App's History" based on typical "History" view usage.
                let ids = StorageManager.shared.historyAssetIDs
                assets = await MediaLibraryService.shared.fetchAssets(withLocalIdentifiers: ids)
                
            case .all:
                // Fetch all Live Photos from library
                assets = await fetchAllSystemLivePhotos()
            }
            
            await MainActor.run {
                completion(assets)
            }
        }
    }
    
    /// Helper to fetch all live photos from system
    private func fetchAllSystemLivePhotos() async -> [PHAsset] {
        guard await MediaLibraryService.shared.requestAuthorization() else { return [] }
        
        let fetchOptions = PHFetchOptions()
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        fetchOptions.predicate = NSPredicate(format: "mediaSubtype == %d", PHAssetMediaSubtype.photoLive.rawValue)
        
        let fetchResult = PHAsset.fetchAssets(with: .image, options: fetchOptions)
        var assets: [PHAsset] = []
        fetchResult.enumerateObjects { asset, _, _ in
            assets.append(asset)
        }
        return assets
    }
    
    /// Helper to bridge legacy getThumbnail calls to new service
    func getThumbnail(for asset: PHAsset, size: CGSize, completion: @escaping (UIImage?) -> Void) {
        Task {
            let image = await MediaLibraryService.shared.generateThumbnail(for: asset, size: size)
            await MainActor.run {
                completion(image)
            }
        }
    }
}

