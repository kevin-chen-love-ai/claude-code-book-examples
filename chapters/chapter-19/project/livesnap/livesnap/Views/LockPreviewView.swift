//
//  LockPreviewView.swift
//  livesnap
//
//  锁屏预览模式
//

import SwiftUI
import UIKit
import AVFoundation
import AVKit

struct LockPreviewView: View {
    let asset: AVAsset
    let keyFrameImage: UIImage?
    @Environment(\.dismiss) var dismiss
    @State private var isLongPressing = false
    @State private var player: AVPlayer?
    @State private var displayImage: UIImage? // 用于显示的图片（可能是 keyFrameImage 或从 asset 加载的）
    @State private var isLoadingImage = true
    @State private var isPlayerReady = false // 播放器是否已准备好
    @State private var showHint = true // 是否显示提示
    @State private var hintOpacity: Double = 0 // 提示透明度
    @State private var handIconScale: CGFloat = 1.0 // 手势图标缩放
    @State private var statusObserver: NSKeyValueObservation? // 保存 observer 防止被释放
    
    var body: some View {
        ZStack {
            // Background - 显示图片或视频（手势识别层）
            GeometryReader { geometry in
                ZStack {
                    // 如果有图片，显示图片；否则显示黑色背景
                    if let image = displayImage {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .clipped()
                            .opacity(isLongPressing ? 0 : 1)
                    } else {
                        // 如果没有图片，显示黑色背景
                        Color.black
                            .frame(width: geometry.size.width, height: geometry.size.height)
                        
                        // 加载指示器
                        if isLoadingImage {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            // 如果加载完成但没有图片，显示提示
                            VStack {
                                Image(systemName: "photo")
                                    .font(.system(size: 48))
                                    .foregroundColor(.white.opacity(0.3))
                                Text("No preview available")
                                    .font(.system(size: 14))
                                    .foregroundColor(.white.opacity(0.5))
                                    .padding(.top, 8)
                            }
                        }
                    }
                    
                    // 长按时显示视频 - 使用 VideoPlayer 或自定义播放器层
                    if let player = player, isLongPressing {
                        VideoPlayer(player: player)
                            .disabled(true)
                            .opacity(isLongPressing ? 1 : 0)
                    }
                }
                // 将手势附加到背景层，确保整个区域都可以接收长按
                .contentShape(Rectangle())
                .gesture(
                    LongPressGesture(minimumDuration: 0.05)
                        .onChanged { _ in
                            Task { @MainActor in
                                Logger.debug("Long press started on lock preview")
                                isLongPressing = true

                                // 隐藏提示
                                if showHint {
                                    withAnimation(.easeOut(duration: 0.3)) {
                                        hintOpacity = 0
                                    }
                                    try? await Task.sleep(nanoseconds: 300_000_000) // 0.3秒
                                    showHint = false
                                }

                                // 只在播放器准备好时才播放
                                guard let player = player, isPlayerReady else {
                                    print("⚠️ Player not ready yet, will retry when ready")
                                    return
                                }

                                print("🎬 Starting playback from beginning")
                                player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) { completed in
                                    if completed {
                                        player.play()
                                        print("▶️ Playback started")
                                    }
                                }
                            }
                        }
                        .onEnded { _ in
                            Task { @MainActor in
                                print("👆 Long press ended")
                                isLongPressing = false

                                // 暂停并重置到开始位置
                                if let player = player {
                                    player.pause()
                                    player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
                                }
                            }
                        }
                )
            }
            .ignoresSafeArea()
            
            // Gradient Overlay - 只在有图片时显示（不拦截触摸）
            if keyFrameImage != nil {
                LinearGradient(
                    colors: [
                        Color.black.opacity(0.2),
                        Color.clear,
                        Color.black.opacity(0.4)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                .allowsHitTesting(false) // 不拦截触摸事件
            }
            
            // Content（交互元素层，需要保持可点击）
            VStack(spacing: 0) {
                // Top Controls
                HStack {
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18))
                            .foregroundColor(.white)
                            .frame(width: 40, height: 40)
                            .background(AppTheme.graphiteGray.opacity(0.9))
                            .cornerRadius(20)
                            .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
                    }
                    .padding(.top, 48)
                    .padding(.trailing, 24)
                }
                
                // Lock Screen Clock（不拦截触摸，让手势可以穿透）
                VStack(spacing: 8) {
                    Text(formatDate())
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 0)
                    
                    Text(formatTime())
                        .font(.system(size: 96, weight: .bold))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 0)
                }
                .padding(.top, 48)
                .allowsHitTesting(false) // 不拦截触摸，让手势可以穿透
                
                Spacer()
                
                // Bottom Area（不拦截触摸，让手势可以穿透）
                VStack(spacing: 48) {
                    // Instruction with animated hint
                    if showHint {
                        VStack(spacing: 16) {
                            // 手势图标动画
                            HStack(spacing: 12) {
                                Image(systemName: "hand.tap.fill")
                                    .font(.system(size: 28))
                                    .foregroundColor(.white)
                                    .scaleEffect(handIconScale)
                                    .shadow(color: .black.opacity(0.5), radius: 10, x: 0, y: 5)

                                Image(systemName: "arrow.right")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundColor(.white.opacity(0.8))

                                Image(systemName: "play.circle.fill")
                                    .font(.system(size: 28))
                                    .foregroundColor(AppTheme.iosBlue)
                                    .shadow(color: AppTheme.iosBlue.opacity(0.5), radius: 15, x: 0, y: 5)
                            }

                            Text("Long press anywhere to play")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(.white)
                                .shadow(color: .black.opacity(0.5), radius: 10, x: 0, y: 5)

                            Text("Release to pause")
                                .font(.system(size: 14))
                                .foregroundColor(.white.opacity(0.7))
                                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 0)
                        }
                        .padding(.horizontal, 32)
                        .padding(.vertical, 24)
                        .background(
                            RoundedRectangle(cornerRadius: 20)
                                .fill(Color.black.opacity(0.6))
                                .background(
                                    RoundedRectangle(cornerRadius: 20)
                                        .fill(.ultraThinMaterial)
                                )
                        )
                        .opacity(hintOpacity)
                        .onAppear {
                            // 淡入动画
                            withAnimation(.easeInOut(duration: 0.6).delay(0.3)) {
                                hintOpacity = 1.0
                            }

                            // 手势图标脉冲动画
                            withAnimation(
                                Animation.easeInOut(duration: 1.2)
                                    .repeatForever(autoreverses: true)
                            ) {
                                handIconScale = 1.15
                            }

                            // 5秒后淡出提示
                            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                                withAnimation(.easeInOut(duration: 0.5)) {
                                    hintOpacity = 0
                                }
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                                    showHint = false
                                }
                            }
                        }
                    }
                    
                    // iOS Bottom Shortcuts（这些按钮不拦截触摸，因为它们只是装饰）
                    HStack(spacing: 0) {
                        Spacer()
                        
                        Button {
                            // Flashlight（装饰性，不实际功能）
                        } label: {
                            Image(systemName: "flashlight.on.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.white)
                                .frame(width: 48, height: 48)
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(24)
                        }
                        .allowsHitTesting(false) // 不拦截触摸
                        
                        Spacer()
                        
                        Button {
                            // Camera（装饰性，不实际功能）
                        } label: {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.white)
                                .frame(width: 48, height: 48)
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(24)
                        }
                        .allowsHitTesting(false) // 不拦截触摸
                        
                        Spacer()
                    }
                    .padding(.horizontal, 40)
                    
                    // Home Indicator
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.white.opacity(0.4))
                        .frame(width: 128, height: 6)
                }
                .padding(.bottom, 64)
                .allowsHitTesting(false) // 不拦截触摸，让手势可以穿透
            }
        }
        .onAppear {
            print("🔍 LockPreviewView appeared - keyFrameImage: \(keyFrameImage != nil ? "exists" : "nil")")
            setupPlayer()
            loadDisplayImage()
        }
        .task {
            // 确保图片加载
            if displayImage == nil && !isLoadingImage {
                print("🔄 Retrying to load display image...")
                loadDisplayImage()
            }
        }
        .onDisappear {
            cleanupPlayer()
        }
    }
    
    private func formatDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }
    
    private func formatTime() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: Date())
    }
    
    private func setupPlayer() {
        // 确保在主线程上创建播放器
        Task { @MainActor in
            print("🎬 Setting up preview player...")
            let playerItem = AVPlayerItem(asset: asset)

            // 配置播放器项以优化性能
            playerItem.preferredForwardBufferDuration = 1.0
            playerItem.canUseNetworkResourcesForLiveStreamingWhilePaused = false

            player = AVPlayer(playerItem: playerItem)
            player?.isMuted = true
            player?.actionAtItemEnd = .none

            // 监听播放器状态 - 保存 observer 防止被释放
            statusObserver = playerItem.observe(\.status, options: [.new]) { item, _ in
                Task { @MainActor in
                    switch item.status {
                    case .readyToPlay:
                        print("✅ Preview player ready")
                        isPlayerReady = true

                        // 如果用户已经在长按，立即开始播放
                        if isLongPressing, let player = player {
                            player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) { completed in
                                if completed {
                                    player.play()
                                    print("▶️ Auto-started playback after player ready")
                                }
                            }
                        }

                    case .failed:
                        print("⚠️ Preview player item failed: \(item.error?.localizedDescription ?? "Unknown error")")
                        isPlayerReady = false

                    case .unknown:
                        print("⏳ Preview player status: unknown")

                    @unknown default:
                        break
                    }
                }
            }

            // 如果播放器已经准备好，立即设置状态
            if playerItem.status == .readyToPlay {
                print("✅ Preview player already ready")
                isPlayerReady = true
            }

            // 设置循环播放 - 当播放结束时自动重新开始
            NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: playerItem,
                queue: .main
            ) { _ in
                Task { @MainActor in
                    guard let currentPlayer = player else { return }
                    // 只在仍在长按时循环
                    if isLongPressing {
                        currentPlayer.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) { completed in
                            if completed {
                                currentPlayer.play()
                            }
                        }
                    }
                }
            }

            // 监听播放错误
            NotificationCenter.default.addObserver(
                forName: .AVPlayerItemFailedToPlayToEndTime,
                object: playerItem,
                queue: .main
            ) { notification in
                if let error = notification.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error {
                    print("⚠️ Preview player failed to play: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func cleanupPlayer() {
        NotificationCenter.default.removeObserver(self)
        statusObserver?.invalidate()
        statusObserver = nil
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
    }
    
    /// 加载显示图片：优先使用 keyFrameImage，如果不存在则从 asset 加载
    private func loadDisplayImage() {
        // 如果已经有 keyFrameImage，直接使用
        if let image = keyFrameImage {
            Task { @MainActor in
                displayImage = image
                isLoadingImage = false
                print("✅ Using keyFrameImage for preview - size: \(image.size)")
            }
            return
        }
        
        print("📸 Loading preview image from asset...")
        Task { @MainActor in
            isLoadingImage = true
        }
        
        // 否则从 asset 加载第一帧
        Task {
            let imageGenerator = AVAssetImageGenerator(asset: asset)
            imageGenerator.appliesPreferredTrackTransform = true
            imageGenerator.maximumSize = CGSize(width: 3000, height: 4000) // 最高分辨率用于预览（优先体验）
            // 使用较小的容差以获得更精确的帧（优先体验）
            imageGenerator.requestedTimeToleranceAfter = CMTime(seconds: 0.01, preferredTimescale: 600)
            imageGenerator.requestedTimeToleranceBefore = CMTime(seconds: 0.01, preferredTimescale: 600)
            
            do {
                let cgImage = try await imageGenerator.image(at: .zero).image
                await MainActor.run {
                    displayImage = UIImage(cgImage: cgImage)
                    isLoadingImage = false
                    print("✅ Preview image loaded successfully from .zero - size: \(cgImage.width)x\(cgImage.height)")
                }
            } catch {
                print("⚠️ Failed to load preview image from .zero: \(error.localizedDescription)")
                // 尝试从其他时间点加载
                do {
                    if let duration = try? await asset.load(.duration), duration.seconds > 0 {
                        let midTime = CMTime(seconds: min(1.0, duration.seconds / 2), preferredTimescale: 600)
                        let cgImage = try await imageGenerator.image(at: midTime).image
                        await MainActor.run {
                            displayImage = UIImage(cgImage: cgImage)
                            isLoadingImage = false
                            print("✅ Preview image loaded from mid point - size: \(cgImage.width)x\(cgImage.height)")
                        }
                    } else {
                        // 尝试从 0.1 秒加载
                        let fallbackTime = CMTime(seconds: 0.1, preferredTimescale: 600)
                        if let fallbackImage = try? await imageGenerator.image(at: fallbackTime).image {
                            await MainActor.run {
                                displayImage = UIImage(cgImage: fallbackImage)
                                isLoadingImage = false
                                print("✅ Preview image loaded from fallback time 0.1s")
                            }
                        } else {
                            await MainActor.run {
                                isLoadingImage = false
                                print("❌ Could not load preview image from any time point")
                            }
                        }
                    }
                } catch {
                    print("⚠️ Fallback image loading also failed: \(error.localizedDescription)")
                    await MainActor.run {
                        isLoadingImage = false
                    }
                }
            }
        }
    }
}

#if false
#Preview {
    LockPreviewView(
        asset: AVURLAsset(url: URL(string: "https://example.com/video.mov")!),
        keyFrameImage: nil
    )
}
#endif
