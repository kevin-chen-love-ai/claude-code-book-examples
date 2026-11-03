//
//  VideoEditorView.swift
//  livesnap
//
//  视频编辑页面
//

import SwiftUI
import UIKit
import AVFoundation
import AVKit

struct VideoEditorView: View {
    let asset: AVAsset
    @ObservedObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var player: AVPlayer?
    @State private var showProcessing = false
    @State private var showExportSuccess = false
    @State private var showLockPreview = false
    @State private var showProUpgrade = false
    @State private var selectedAspectRatio: AppState.AspectRatio = .original
    @State private var keyFrameImage: UIImage?
    @State private var lastScale: CGFloat = 1.0
    @State private var lastOffset: CGSize = .zero
    @State private var updateTask: Task<Void, Never>?
    
    var body: some View {
        ZStack {
            // Enhanced background with subtle gradient
            GradientBackground(style: .subtle)

            // Subtle ambient light
            LightEffect(position: .topTrailing, color: AppTheme.iosBlue, intensity: 0.08)
                .offset(x: 100, y: -100)
            
            ScrollView {
                VStack(spacing: 24) {
                    // Content Container with max width (matching prototype max-w-md ≈ 448px)
                    VStack(spacing: 24) {
                        // Video Preview
                        GeometryReader { geometry in
                            VideoPreviewView(asset: asset, player: $player, appState: appState)
                                .onAppear {
                                    // 使用 Task 避免在视图更新期间发布更改
                                    Task { @MainActor in
                                        appState.previewSize = geometry.size
                                    }
                                }
                                .onChange(of: geometry.size) { _, newSize in
                                    // 使用 Task 避免在视图更新期间发布更改
                                    Task { @MainActor in
                                        appState.previewSize = newSize
                                    }
                                }
                        }
                        .aspectRatio(9/16, contentMode: .fit)
                        .cornerRadius(44)
                        .overlay(
                            RoundedRectangle(cornerRadius: 44)
                                .stroke(
                                    LinearGradient(
                                        colors: [
                                            Color.white.opacity(0.15),
                                            Color.white.opacity(0.05)
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1.5
                                )
                        )
                        .shadow(color: .black.opacity(0.3), radius: 25, x: 0, y: 15)
                        .shadow(color: AppTheme.iosBlue.opacity(0.1), radius: 40, x: 0, y: 20)
                        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                        
                        // Aspect Ratio Selector - 使用统一分段控制器
                        SystemSegmentedControl(
                            selection: Binding(
                                get: { selectedAspectRatio == .original ? 0 : 1 },
                                set: { newValue in
                                    selectedAspectRatio = newValue == 0 ? .original : .lockScreen
                                    // 使用 Task 避免在视图更新期间发布更改
                                    Task { @MainActor in
                                        appState.aspectRatio = newValue == 0 ? .original : .lockScreen
                                        // Reset crop
                                        withAnimation {
                                            appState.cropScale = 1.0
                                            appState.cropOffset = .zero
                                        }
                                    }
                                }
                            ),
                            items: ["Original", "Lock Screen"]
                        )
                        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                        
                        // Timeline Selector
                        TimelineSelectorView(asset: asset, appState: appState)
                            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                        
                        // Key Frame Selector
                        KeyFrameSelectorView(asset: asset, appState: appState)
                            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                    }
                    .frame(maxWidth: AppTheme.Layout.maxContentWidth) // Match prototype max-w-md
                    .frame(maxWidth: .infinity) // Center on larger screens
                    .padding(.top, 24) // 顶部 padding，避免被导航栏遮挡
                    .padding(.bottom, 120)
                }
            }
            .safeAreaInset(edge: .top) {
                // Fixed Top Header - 使用统一导航栏组件，兼容灵动岛
                SystemNavHeader(
                    title: "Livesnap Editor",
                    leadingAction: { dismiss() },
                    trailingAction: { showLockPreview = true },
                    trailingTitle: "Preview"
                )
            }
            .safeAreaInset(edge: .bottom) {
                // Export Button - 使用统一主按钮样式
                VStack(spacing: 12) {
                    PrimaryButton(
                        title: "Export Live Photo",
                        action: {
                            // 检查是否是 Pro 用户，如果不是，显示付费墙
                            if !appState.isProUser {
                                showProUpgrade = true
                            } else {
                                // 设置 ProcessingView 显示状态
                                showProcessing = true
                                appState.isProcessing = true
                            }
                        }
                    )
                    .padding(.horizontal, AppTheme.Layout.Spacing.large)
                    
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.primaryText.opacity(0.4))
                        Text("High-Fidelity Encoding")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.primaryText.opacity(0.4))
                    }
                }
                .frame(maxWidth: 448) // Match prototype max-w-md
                .frame(maxWidth: .infinity) // Center on larger screens
                .padding(.top, 20)
                .padding(.bottom, 32)
                .background(
                    LinearGradient(
                        colors: [
                            AppTheme.midnightBlack.opacity(0),
                            AppTheme.midnightBlack
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
        }
        .onAppear {
            setupPlayer()
            loadKeyFrameImage()
        }
        .onDisappear {
            cleanupPlayer()
        }
        .fullScreenCover(isPresented: $showProcessing) {
            ProcessingView(appState: appState)
        }
        .onChange(of: appState.isProcessing) { _, newValue in
            // 同步 ProcessingView 的显示状态
            showProcessing = newValue
        }
        .onChange(of: appState.showExportSuccess) { _, newValue in
            // 当 showExportSuccess 为 true 时，确保 ProcessingView 已关闭，然后显示成功页面
            if newValue {
                // 先关闭 ProcessingView
                showProcessing = false
                appState.isProcessing = false
                // 延迟一下确保 ProcessingView 完全关闭，然后显示成功页面
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 600_000_000) // 0.6秒，确保 ProcessingView 完全关闭
                    showExportSuccess = true
                    print("✅ Showing ExportSuccessView")
                }
            }
        }
        .fullScreenCover(isPresented: $showExportSuccess) {
            ExportSuccessView(appState: appState)
        }
        .fullScreenCover(isPresented: $showLockPreview) {
            // 确保 keyFrameImage 已加载，如果没有则传递 nil（LockPreviewView 会处理）
            LockPreviewView(asset: asset, keyFrameImage: keyFrameImage)
        }
        .sheet(isPresented: $showProUpgrade) {
            ProUpgradeView(appState: appState)
        }
    }
    
    private func setupPlayer() {
        // 清理旧的播放器
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        
        // 创建新的播放器
        let playerItem = AVPlayerItem(asset: asset)
        
        // 配置播放器项
        playerItem.videoComposition = nil // 避免不必要的视频合成
        if #available(iOS 15.0, *) {
            playerItem.audioTimePitchAlgorithm = .timeDomain // iOS 15+ 推荐使用
        } else {
            playerItem.audioTimePitchAlgorithm = .lowQualityZeroLatency // iOS 14 及以下
        }
        
        player = AVPlayer(playerItem: playerItem)
        
        // 配置播放器
        player?.actionAtItemEnd = .pause
        player?.isMuted = true // 静音播放
        player?.automaticallyWaitsToMinimizeStalling = false // 减少延迟
        
        // 设置循环播放
        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: playerItem,
            queue: .main
        ) { [weak player] _ in
            player?.seek(to: .zero)
            player?.play()
        }
        
        // 使用 KVO 监听播放器项状态，而不是轮询
        var statusObserver: NSKeyValueObservation?
        statusObserver = playerItem.observe(\.status, options: [.new]) { item, _ in
            if item.status == .readyToPlay {
                DispatchQueue.main.async {
                    player?.play()
                }
                statusObserver?.invalidate()
            } else if item.status == .failed {
                print("⚠️ Player item failed: \(item.error?.localizedDescription ?? "Unknown error")")
                statusObserver?.invalidate()
            }
        }
        
        // 如果已经就绪，立即播放
        if playerItem.status == .readyToPlay {
            player?.play()
        }
    }
    
    private func cleanupPlayer() {
        NotificationCenter.default.removeObserver(self)
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
    }
    
    private func loadKeyFrameImage() {
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        // 使用最高分辨率以获得最清晰的预览（优先体验）
        imageGenerator.maximumSize = CGSize(width: 3200, height: 4800)
        // 使用较小的容差以获得更精确的帧（优先体验）
        imageGenerator.requestedTimeToleranceAfter = CMTime(seconds: 0.01, preferredTimescale: 600)
        imageGenerator.requestedTimeToleranceBefore = CMTime(seconds: 0.01, preferredTimescale: 600)
        
        Task {
            if let cgImage = try? await imageGenerator.image(at: appState.keyFrameTime).image {
                await MainActor.run {
                    keyFrameImage = UIImage(cgImage: cgImage)
                }
            } else {
                // 如果加载失败，尝试从视频的第一帧加载
                await MainActor.run {
                    loadKeyFrameImageFallback()
                }
            }
        }
    }
    
    private func loadKeyFrameImageFallback() {
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.maximumSize = CGSize(width: 3200, height: 4800)
        
        Task {
            // 尝试从视频开始位置加载
            if let cgImage = try? await imageGenerator.image(at: .zero).image {
                await MainActor.run {
                    keyFrameImage = UIImage(cgImage: cgImage)
                }
            }
        }
    }
}

struct VideoPreviewView: View {
    let asset: AVAsset
    @Binding var player: AVPlayer?
    @ObservedObject var appState: AppState
    
    @State private var lastScale: CGFloat = 1.0
    @State private var lastOffset: CGSize = .zero
    
    var body: some View {
        ZStack {
            if let player = player {
                // Video Content with Gestures
                GeometryReader { geometry in
                    ZStack {
                        // Simple black background for the video area
                        Color.black
                        
                        VideoPlayer(player: player)
                            .disabled(true) // Disable native controls
                            .scaleEffect(appState.cropScale)
                            .offset(appState.cropOffset)
                            .gesture(
                                MagnificationGesture()
                                    .onChanged { value in
                                        let delta = value / lastScale
                                        lastScale = value
                                        let newScale = appState.cropScale * delta
                                        // Limit scale - 使用 Task 避免在视图更新期间发布更改
                                        Task { @MainActor in
                                            appState.cropScale = min(max(newScale, 1.0), 3.0)
                                        }
                                    }
                                    .onEnded { _ in
                                        lastScale = 1.0
                                        // Bounce back if scale < 1.0 (though min handled above)
                                        Task { @MainActor in
                                            withAnimation {
                                                if appState.cropScale < 1.0 {
                                                    appState.cropScale = 1.0
                                                    appState.cropOffset = .zero
                                                } else {
                                                    // Clamp offset based on new scale
                                                    clampOffset(viewSize: geometry.size)
                                                }
                                            }
                                        }
                                    }
                            )
                            .simultaneousGesture(
                                DragGesture()
                                    .onChanged { value in
                                        let delta = CGSize(
                                            width: value.translation.width - lastOffset.width,
                                            height: value.translation.height - lastOffset.height
                                        )
                                        lastOffset = value.translation
                                        // 使用 Task 避免在视图更新期间发布更改
                                        Task { @MainActor in
                                            appState.cropOffset = CGSize(
                                                width: appState.cropOffset.width + delta.width,
                                                height: appState.cropOffset.height + delta.height
                                            )
                                        }
                                    }
                                    .onEnded { _ in
                                        lastOffset = .zero
                                        Task { @MainActor in
                                            withAnimation {
                                                clampOffset(viewSize: geometry.size)
                                            }
                                        }
                                    }
                            )
                    }
                    .clipped() // Ensure video doesn't bleed out
                }
                .onAppear {
                    // 确保播放器在视图出现时播放
                    player.play()
                }
                
                // Overlays (Lock Screen & Watermark)
                // These sit ON TOP of the video and are NOT scaled/panned (user wants to position video UNDER these)
                
                // Lock Screen Overlay (preview)
                VStack {
                    Text("Tuesday, October 24")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white.opacity(0.9))
                        .tracking(0.5)
                    Text("09:41")
                        .font(.system(size: 84, weight: .bold))
                        .foregroundColor(.white)
                }
                .shadow(color: .black.opacity(0.3), radius: 20)
                .padding(.top, 40)
                .allowsHitTesting(false) // Allow gestures to pass through
                
                // Watermark (if not Pro)
                if !appState.isProUser {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Text("LIVESNAP")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(AppTheme.watermarkWhite)
                                .tracking(2)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(AppTheme.watermarkWhite.opacity(0.3))
                                .cornerRadius(8)
                                .padding(24)
                        }
                    }
                    .allowsHitTesting(false)
                }
            }
        }
    }
    
    private func clampOffset(viewSize: CGSize) {
        // Calculate bounds based on scale
        // Video is centered.
        // Scaled width = viewWidth * scale
        // Max overlap on one side = (ScaledWidth - ViewWidth) / 2
        
        // 使用 Task 确保在主线程上异步更新，避免在视图更新期间发布更改
        Task { @MainActor in
            // Only clamp if scale > 1
            guard appState.cropScale > 1.0 else {
                appState.cropOffset = .zero
                return
            }
            
            let maxOffsetX = (viewSize.width * appState.cropScale - viewSize.width) / 2
            let maxOffsetY = (viewSize.height * appState.cropScale - viewSize.height) / 2
            
            // Clamp
            let clampedX = min(max(appState.cropOffset.width, -maxOffsetX), maxOffsetX)
            let clampedY = min(max(appState.cropOffset.height, -maxOffsetY), maxOffsetY)
            
            appState.cropOffset = CGSize(width: clampedX, height: clampedY)
        }
    }
}

#if false
#Preview {
    VideoEditorView(
        asset: AVURLAsset(url: URL(string: "https://example.com/video.mov")!),
        appState: AppState()
    )
}
#endif
