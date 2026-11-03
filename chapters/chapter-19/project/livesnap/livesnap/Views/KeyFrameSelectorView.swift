//
//  KeyFrameSelectorView.swift
//  livesnap
//
//  关键帧选择器（支持拖拽）
//

import SwiftUI
import UIKit
import AVFoundation

struct KeyFrameSelectorView: View {
    let asset: AVAsset
    @ObservedObject var appState: AppState
    @State private var keyFrameImage: UIImage?
    @State private var isDragging = false
    @State private var duration: Double = 0
    @State private var lastGeneratedTime: CMTime = .zero
    @State private var imageGenerationTask: Task<Void, Never>?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("KEY FRAME")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText.opacity(0.4))
                    .tracking(1)
                
                Spacer()
                
                Button {
                    // 随机选择一个新的关键帧
                    // 使用 Task 来避免在视图更新期间发布更改
                    Task { @MainActor in
                        if let range = appState.selectedTimeRange {
                            let randomOffset = Double.random(in: 0...range.duration.seconds)
                            let newTime = range.start.seconds + randomOffset
                            appState.keyFrameTime = CMTime(seconds: newTime, preferredTimescale: 600)
                        }
                    }
                } label: {
                    Text("Change")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(AppTheme.iosBlue)
                }
            }
            
            VStack(spacing: 16) {
                GeometryReader { geometry in
                    ZStack {
                        // Progress Bar Background
                        Rectangle()
                            .fill(Color.white.opacity(0.1))
                            .frame(height: 2)
                            .cornerRadius(1)
                        
                        // Key Frame Indicator (可拖拽)
                        Circle()
                            .fill(Color.white)
                            .frame(width: 28, height: 28)
                            .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 2)
                            .overlay(
                                Circle()
                                    .stroke(AppTheme.graphiteGray, lineWidth: 4)
                            )
                            .overlay(
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(.black)
                            )
                            .offset(x: calculateKeyFramePosition(geometry: geometry) - 14)
                            .gesture(
                                DragGesture(minimumDistance: 0)
                                    .onChanged { value in
                                        isDragging = true
                                        guard duration > 0 else { return }
                                        
                                        let newPosition = (calculateKeyFramePosition(geometry: geometry) + value.translation.width) / geometry.size.width
                                        let clampedPosition = max(0.0, min(1.0, newPosition))
                                        
                                        // 限制在选择的时间范围内
                                        // 使用 Task 来避免在视图更新期间发布更改
                                        Task { @MainActor in
                                            if let range = appState.selectedTimeRange {
                                                let rangeStart = range.start.seconds / duration
                                                let rangeEnd = (range.start.seconds + range.duration.seconds) / duration
                                                let finalPosition = max(rangeStart, min(clampedPosition, rangeEnd))
                                                let newTime = duration * Double(finalPosition)
                                                appState.keyFrameTime = CMTime(seconds: newTime, preferredTimescale: 600)
                                            } else {
                                                let newTime = duration * Double(clampedPosition)
                                                appState.keyFrameTime = CMTime(seconds: newTime, preferredTimescale: 600)
                                            }
                                        }
                                    }
                                    .onEnded { _ in
                                        isDragging = false
                                        // 拖拽结束后生成图片
                                        generateKeyFrameImageThrottled()
                                    }
                            )
                    }
                }
                .frame(height: 28)
                
                if let image = keyFrameImage {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(maxHeight: 100)
                        .cornerRadius(8)
                } else {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AppTheme.graphiteGray)
                        .frame(height: 100)
                }
                
                Text("Pick the static cover for your lock screen")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.primaryText.opacity(0.4))
                    .multilineTextAlignment(.center)
            }
            .padding(16)
            .background(AppTheme.graphiteGray)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )
        }
        .onAppear {
            loadDuration()
            generateKeyFrameImageThrottled()
        }
        .onChange(of: appState.keyFrameTime) { _, newTime in
            // 只有在非拖拽状态或时间变化较大时才生成图片
            if !isDragging {
                generateKeyFrameImageThrottled()
            } else {
                // 拖拽时，检查时间变化是否足够大（避免频繁生成）
                let timeDiff = abs(newTime.seconds - lastGeneratedTime.seconds)
                if timeDiff > 0.1 { // 至少 0.1 秒的变化才生成
                    generateKeyFrameImageThrottled()
                }
            }
        }
    }
    
    private func loadDuration() {
        Task {
            if let loadedDuration = try? await asset.load(.duration) {
                await MainActor.run {
                    duration = loadedDuration.seconds
                }
            }
        }
    }
    
    private func calculateKeyFramePosition(geometry: GeometryProxy) -> CGFloat {
        guard duration > 0 else { return geometry.size.width * 0.5 }
        let currentTime = appState.keyFrameTime.seconds
        let position = currentTime / duration
        return geometry.size.width * CGFloat(position)
    }
    
    // 节流版本的图片生成，避免频繁生成（带错误恢复和内存管理）
    private func generateKeyFrameImageThrottled() {
        // 取消之前的任务
        imageGenerationTask?.cancel()
        
        let currentTime = appState.keyFrameTime
        lastGeneratedTime = currentTime
        
        // 创建新的任务
        imageGenerationTask = Task {
            // 延迟一小段时间，如果用户还在拖拽，这个任务会被取消
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1秒
            
            guard !Task.isCancelled else { return }
            
            // 生成图片（带内存管理）
            let imageGenerator = AVAssetImageGenerator(asset: asset)
            imageGenerator.appliesPreferredTrackTransform = true
            // 使用较小的容差以获得更精确的帧（优先体验）
            imageGenerator.requestedTimeToleranceAfter = CMTime(seconds: 0.01, preferredTimescale: 600)
            imageGenerator.requestedTimeToleranceBefore = CMTime(seconds: 0.01, preferredTimescale: 600)
            // 使用最高分辨率以获得最清晰的预览（优先体验）
            imageGenerator.maximumSize = CGSize(width: 2400, height: 2400)
            
            let cgImage = try? await imageGenerator.image(at: currentTime).image
            
            guard !Task.isCancelled else { return }
            
            if let cgImage = cgImage {
                // 在主线程上创建 UIImage
                await MainActor.run {
                    guard !Task.isCancelled else { return }
                    keyFrameImage = UIImage(cgImage: cgImage)
                }
            } else {
                // 错误恢复：尝试从视频开始位置生成
                print("⚠️ Key frame image generation failed, trying fallback...")
                let fallbackGenerator = AVAssetImageGenerator(asset: asset)
                fallbackGenerator.appliesPreferredTrackTransform = true
                fallbackGenerator.maximumSize = CGSize(width: 2400, height: 2400)
                let fallbackImage = try? await fallbackGenerator.image(at: .zero).image
                
                if let fallbackImage = fallbackImage {
                    await MainActor.run {
                        guard !Task.isCancelled else { return }
                        keyFrameImage = UIImage(cgImage: fallbackImage)
                    }
                }
            }
        }
    }
}
