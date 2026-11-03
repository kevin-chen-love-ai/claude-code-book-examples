//
//  BatchSelectionView.swift
//  livesnap
//
//  批量选择页面 - Redesigned to match iOS Photos style
//

import SwiftUI
import UIKit
import PhotosUI

struct BatchSelectionView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var appState = AppState()
    @State private var selectedItems: Set<String> = []
    @State private var allVideos: [VideoItem] = []
    @State private var isConverting = false
    @State private var showProcessingView = false
    @State private var processingAppState: AppState?
    @StateObject private var storage = StorageManager.shared
    
    // Grid Configuration: 3 columns, 1px spacing
    private let columns = [
        GridItem(.flexible(), spacing: 1),
        GridItem(.flexible(), spacing: 1),
        GridItem(.flexible(), spacing: 1)
    ]
    
    struct VideoItem: Identifiable {
        let id: String
        let duration: String
        let asset: PHAsset
        let creationDate: Date
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.midnightBlack.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom Navigation Bar - 使用统一组件
                    SystemNavHeader(
                        title: "All Videos",
                        leadingAction: { dismiss() },
                        trailingAction: {
                            if selectedItems.count == allVideos.count {
                                selectedItems.removeAll()
                            } else {
                                selectedItems = Set(allVideos.map { $0.id })
                            }
                        },
                        trailingTitle: selectedItems.count == allVideos.count ? "Deselect All" : "Select All"
                    )
                    
                    // Video Grid
                    if allVideos.isEmpty {
                        Spacer()
                        SystemEmptyState(
                            icon: "video.slash",
                            title: "No Videos Found",
                            message: "We couldn't find any videos in your library"
                        )
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVGrid(columns: columns, spacing: 1) {
                                ForEach(allVideos) { video in
                                    VideoThumbnail(
                                        video: video,
                                        isSelected: selectedItems.contains(video.id),
                                        onTap: {
                                            toggleSelection(for: video.id)
                                        }
                                    )
                                }
                            }
                            .padding(.bottom, 120)
                        }
                    }
                }
            }
            .navigationBarHidden(true)
            .safeAreaInset(edge: .bottom) {
                // Bottom Action Bar - Only show when items are selected
                if !selectedItems.isEmpty {
                    VStack(spacing: 0) {
                        Divider()
                            .background(Color.white.opacity(0.1))
                        
                        HStack {
                            VStack(alignment: .leading) {
                                if selectedItems.count == 1 {
                                    Text("1 Selected")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundColor(AppTheme.primaryText)
                                } else {
                                    Text("\(selectedItems.count) Selected")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundColor(AppTheme.primaryText)
                                    
                                    Text("Select only 1 video to convert")
                                        .font(.system(size: 12))
                                        .foregroundColor(AppTheme.secondaryText)
                                }
                            }
                            
                            Spacer()
                            
                            PrimaryButton(
                                title: "Convert",
                                action: { convertSelectedVideos() },
                                isEnabled: selectedItems.count == 1 && !isConverting
                            )
                            .frame(height: 52) // 使用标准按钮高度
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 8)
                        .background(AppTheme.midnightBlack.opacity(0.95))
                    }
                }
            }
        }
        .onAppear {
            loadVideos()
        }
        .fullScreenCover(isPresented: $showProcessingView) {
            if let processingAppState = processingAppState {
                ProcessingView(appState: processingAppState)
            } else {
                ProcessingView(appState: appState)
            }
        }
    }
    
    private func toggleSelection(for id: String) {
        if selectedItems.contains(id) {
            selectedItems.remove(id)
        } else {
            selectedItems.insert(id)
        }
    }
    
    private func loadVideos() {
        Task {
            let assets = await MediaLibraryService.shared.fetchAllVideos()
            let items = assets.map { asset in
                VideoItem(
                    id: asset.localIdentifier,
                    duration: MediaLibraryService.shared.getDurationString(for: asset),
                    asset: asset,
                    creationDate: asset.creationDate ?? Date()
                )
            }
            
            await MainActor.run {
                allVideos = items
            }
        }
    }
    
    private func convertSelectedVideos() {
        // 限制：一次只能转换一个视频
        guard selectedItems.count == 1 else {
            print("⚠️ Please select only 1 video to convert")
            return
        }
        
        // 获取选中的视频
        let selectedVideos = allVideos.filter { selectedItems.contains($0.id) }
        guard let video = selectedVideos.first else { return }
        
        // 防止重复转换
        guard !isConverting else { return }
        
        isConverting = true
        
        // 创建独立的 AppState 用于处理
        let processingState = AppState()
        processingState.isProUser = appState.isProUser
        processingAppState = processingState
        
        showProcessingView = true
        
        Task {
            let success = await convertVideo(video, appState: processingState)
            
            await MainActor.run {
                if success {
                    print("✅ Video converted successfully")
                    // 延迟关闭，让用户看到成功状态
                    Task {
                        try? await Task.sleep(nanoseconds: 1000_000_000) // 1秒
                        await MainActor.run {
                            isConverting = false
                            showProcessingView = false
                            selectedItems.removeAll()
                            processingAppState = nil
                        }
                    }
                } else {
                    print("❌ Video conversion failed")
                    isConverting = false
                    showProcessingView = false
                    processingAppState = nil
                }
            }
        }
    }
    
    private func convertVideo(_ video: VideoItem, appState: AppState) async -> Bool {
        // 加载视频资源
        let options = PHVideoRequestOptions()
        options.version = .original
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        
        return await withCheckedContinuation { continuation in
            PHImageManager.default().requestAVAsset(forVideo: video.asset, options: options) { avAsset, _, _ in
                guard let avAsset = avAsset as? AVURLAsset else {
                    print("❌ Failed to load video asset")
                    continuation.resume(returning: false)
                    return
                }
                
                Task {
                    do {
                        // 初始化编辑参数（使用默认值）
                        let duration = try await avAsset.load(.duration)
                        let startTime = CMTime(seconds: 0, preferredTimescale: 600)
                        let clipDuration = CMTime(seconds: min(3.0, duration.seconds), preferredTimescale: 600)
                        
                        await MainActor.run {
                            appState.selectedVideoURL = avAsset.url
                            appState.selectedVideoAsset = avAsset
                            appState.selectedTimeRange = CMTimeRange(start: startTime, duration: clipDuration)
                            appState.keyFrameTime = startTime
                            appState.aspectRatio = .original
                            appState.isProcessing = true
                        }
                        
                        // 执行转换
                        let success = await performConversion(appState: appState)
                        continuation.resume(returning: success)
                    } catch {
                        print("❌ Failed to initialize video parameters: \(error.localizedDescription)")
                        continuation.resume(returning: false)
                    }
                }
            }
        }
    }
    
    private func performConversion(appState: AppState) async -> Bool {
        guard let videoURL = appState.selectedVideoURL,
              let timeRange = appState.selectedTimeRange,
              let asset = appState.selectedVideoAsset else {
            print("❌ Missing required video data")
            return false
        }
        
        do {
            // 更新进度
            await MainActor.run {
                appState.processingProgress = 0.1
                appState.processingStatus = "Extracting key frame..."
            }
            
            // 提取关键帧
            let keyFrameURL = try await VideoProcessor.shared.extractKeyFrame(from: asset, at: appState.keyFrameTime)
            
            // 更新进度
            await MainActor.run {
                appState.processingProgress = 0.3
                appState.processingStatus = "Processing video..."
            }
            
            // 处理视频
            let videoAspectRatio: VideoAspectRatio = appState.aspectRatio == .original ? .original : .lockScreen
            let processedVideoURL = try await VideoProcessor.shared.processVideo(
                inputURL: videoURL,
                timeRange: timeRange,
                aspectRatio: videoAspectRatio,
                cropScale: appState.cropScale,
                cropOffset: appState.cropOffset,
                previewSize: appState.previewSize,
                isPro: appState.isProUser,
                fps: storage.use60FPS ? 60 : 30,
                useHighRes: storage.highResExportEnabled,
                progressHandler: { progress in
                    Task { @MainActor in
                        // 视频处理进度：30% - 70%
                        appState.processingProgress = 0.3 + (progress * 0.4)
                    }
                }
            )
            
            // 更新进度
            await MainActor.run {
                appState.processingProgress = 0.7
                appState.processingStatus = "Creating Live Photo..."
            }
            
            // 创建 Live Photo
            let assetID = try await LivePhotoComposer.shared.createLivePhoto(
                videoURL: processedVideoURL,
                imageURL: keyFrameURL
            )
            
            // 保存到历史记录 (直接使用 StorageManager)
            storage.addHistoryAssetID(assetID)
            
            await MainActor.run {
                appState.processingProgress = 1.0
                appState.processingStatus = "Live Photo created successfully!"
            }
            return true
        } catch {
            print("❌ Conversion failed: \(error.localizedDescription)")
            return false
        }
    }
}

struct VideoThumbnail: View {
    let video: BatchSelectionView.VideoItem
    let isSelected: Bool
    let onTap: () -> Void
    @State private var thumbnail: UIImage?
    
    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .bottomTrailing) {
                // Background / Image
                Rectangle()
                    .fill(AppTheme.graphiteGray)
                    .aspectRatio(1, contentMode: .fit)
                    .overlay(
                        Group {
                            if let thumbnail = thumbnail {
                                Image(uiImage: thumbnail)
                                    .resizable()
                                    .scaledToFill()
                                    .transition(.opacity.combined(with: .scale(scale: 1.05)))
                            } else {
                                // Shimmering placeholder
                                AppTheme.graphiteGray
                                    .shimmer(duration: 1.5, delay: 0)
                            }
                        }
                    )
                    .clipped()
                
                // Selection Overlay (Dim when selected)
                if isSelected {
                    Color.white.opacity(0.2)
                }
                
                // Content Overlay
                VStack {
                    HStack {
                        Spacer()
                        // Selection Circle
                        ZStack {
                            Circle()
                                .stroke(Color.white, lineWidth: 1) // Outer ring
                                .background(Circle().fill(isSelected ? AppTheme.iosBlue : Color.clear)) // Fill
                                .frame(width: 22, height: 22)
                            
                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        .scaleEffect(isSelected ? 1.0 : 0.9)
                        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isSelected)
                        .padding(6)
                        // Add shadow to make it visible on light backgrounds even if unselected
                        .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
                    }
                    Spacer()
                }
                
                // Duration Badge
                Text(video.duration)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.6)) // Semi-transparent black 
                    .cornerRadius(4)
                    .padding(6)
            }
        }
        .buttonStyle(PlainButtonStyle())
        .onAppear {
            loadThumbnail()
        }
    }
    
    private func loadThumbnail() {
        Task {
            // 使用高分辨率缩略图以获得清晰显示（优先体验）
            if let image = await MediaLibraryService.shared.generateThumbnail(for: video.asset, size: CGSize(width: 600, height: 600)) {
                await MainActor.run {
                    thumbnail = image
                }
            }
        }
    }
}

#if false
#Preview {
    BatchSelectionView()
}
#endif
