//
//  TimelineSelectorView.swift
//  livesnap
//
//  时间轴选择器（支持拖拽）
//

import SwiftUI
import UIKit
import AVFoundation

struct TimelineSelectorView: View {
    let asset: AVAsset
    @ObservedObject var appState: AppState
    @State private var thumbnails: [UIImage] = []
    @State private var startPosition: CGFloat = 0.15
    @State private var endPosition: CGFloat = 0.75
    @State private var isDraggingStart = false
    @State private var isDraggingEnd = false
    @State private var isDraggingPlayhead = false
    @State private var duration: Double = 0
    @State private var showRecommendedHint = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("SELECT CLIP")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText.opacity(0.4))
                    .tracking(1)
                
                Spacer()
                
                if let range = appState.selectedTimeRange {
                    let selectedDuration = range.duration.seconds
                    let isInRecommendedRange = Config.Processing.recommendedDurationRange.contains(selectedDuration)

                    HStack(spacing: 6) {
                        if isInRecommendedRange {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.successGreen)
                        } else if selectedDuration < Config.Processing.recommendedDurationRange.lowerBound {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.warningOrange)
                        } else {
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(AppTheme.warningOrange)
                        }

                        Text(formatDuration(selectedDuration))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(
                                isInRecommendedRange
                                    ? AppTheme.successGreen
                                    : AppTheme.primaryText.opacity(0.6)
                            )
                    }
                }
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Thumbnails Background
                    HStack(spacing: 2) {
                        ForEach(thumbnails.indices, id: \.self) { index in
                            if let image = thumbnails[safe: index] {
                                Image(uiImage: image)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: geometry.size.width / 4)
                                    .clipped()
                            }
                        }
                    }
                    .opacity(0.3)
                    .grayscale(1)

                    // 推荐时长区域高亮（仅当视频足够长时显示）
                    if duration > Config.Processing.recommendedDurationRange.upperBound {
                        let recommendedStart = Config.Processing.recommendedDurationRange.lowerBound / duration
                        let recommendedEnd = Config.Processing.recommendedDurationRange.upperBound / duration

                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        AppTheme.successGreen.opacity(0.15),
                                        AppTheme.successGreen.opacity(0.25),
                                        AppTheme.successGreen.opacity(0.15)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * CGFloat(recommendedEnd - recommendedStart))
                            .offset(x: geometry.size.width * CGFloat(recommendedStart))
                            .opacity(showRecommendedHint ? 0.6 : 0)
                            .animation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true), value: showRecommendedHint)
                    }
                    
                    // Selection Range
                    HStack(spacing: 0) {
                        Spacer()
                            .frame(width: geometry.size.width * startPosition)
                        
                        Rectangle()
                            .fill(Color.white.opacity(0.4))
                            .frame(width: geometry.size.width * (endPosition - startPosition))
                            .overlay(
                                HStack {
                                    // Start Handle
                                    DragHandle()
                                        .gesture(
                                            DragGesture()
                                                .onChanged { value in
                                                    isDraggingStart = true
                                                    let newPosition = (startPosition * geometry.size.width + value.translation.width) / geometry.size.width
                                                    startPosition = max(0, min(newPosition, endPosition - 0.1))
                                                    // 使用 Task 来避免在视图更新期间发布更改
                                                    Task { @MainActor in
                                                        updateTimeRange()
                                                    }
                                                }
                                                .onEnded { _ in
                                                    isDraggingStart = false
                                                }
                                        )
                                    
                                    Spacer()
                                    
                                    // End Handle
                                    DragHandle()
                                        .gesture(
                                            DragGesture()
                                                .onChanged { value in
                                                    isDraggingEnd = true
                                                    let newPosition = (endPosition * geometry.size.width + value.translation.width) / geometry.size.width
                                                    endPosition = min(1.0, max(newPosition, startPosition + 0.1))
                                                    // 使用 Task 来避免在视图更新期间发布更改
                                                    Task { @MainActor in
                                                        updateTimeRange()
                                                    }
                                                }
                                                .onEnded { _ in
                                                    isDraggingEnd = false
                                                }
                                        )
                                }
                            )
                        
                        Spacer()
                            .frame(width: geometry.size.width * (1 - endPosition))
                    }
                    
                    // Playhead (可拖拽)
                    Rectangle()
                        .fill(AppTheme.iosBlue)
                        .frame(width: 2)
                        .offset(x: (geometry.size.width * calculatePlayheadPosition()) - 1)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    isDraggingPlayhead = true
                                    let newPosition = (calculatePlayheadPosition() * geometry.size.width + value.translation.width) / geometry.size.width
                                    let clampedPosition = max(startPosition, min(newPosition, endPosition))
                                    let newTime = duration * Double(clampedPosition)
                                    // 使用 Task 来避免在视图更新期间发布更改
                                    Task { @MainActor in
                                        appState.keyFrameTime = CMTime(seconds: newTime, preferredTimescale: 600)
                                    }
                                }
                                .onEnded { _ in
                                    isDraggingPlayhead = false
                                }
                        )
                }
            }
            .frame(height: 68)
            .background(AppTheme.graphiteGray)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )

            // 推荐时长提示（仅首次显示）
            if showRecommendedHint && duration > Config.Processing.recommendedDurationRange.upperBound {
                HStack(spacing: 8) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.successGreen)

                    Text("Recommended: \(formatDuration(Config.Processing.recommendedDurationRange.lowerBound)) - \(formatDuration(Config.Processing.recommendedDurationRange.upperBound)) for best results")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.primaryText.opacity(0.6))

                    Spacer()

                    Button {
                        withAnimation {
                            showRecommendedHint = false
                        }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundColor(AppTheme.primaryText.opacity(0.4))
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(AppTheme.graphiteGray)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(AppTheme.successGreen.opacity(0.3), lineWidth: 1)
                )
                .transition(.opacity.combined(with: .scale))
            }
        }
        .onAppear {
            loadDuration()
            generateThumbnails()
            // 使用 Task 来避免在视图更新期间发布更改
            Task { @MainActor in
                updateTimeRange()
            }

            // 5秒后自动隐藏提示
            DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
                withAnimation {
                    showRecommendedHint = false
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
    
    private func calculatePlayheadPosition() -> CGFloat {
        guard duration > 0 else { return 0.5 }
        let currentTime = appState.keyFrameTime.seconds
        let position = currentTime / duration
        return max(startPosition, min(position, endPosition))
    }
    
    private func generateThumbnails() {
        Task {
            // 在主线程上获取 asset 的引用
            let assetRef = asset
            guard let loadedDuration = try? await assetRef.load(.duration) else { return }
            let durationSeconds = loadedDuration.seconds
            guard durationSeconds > 0 else { return }
            
            let times = (0..<4).map { CMTime(seconds: Double($0) * durationSeconds / 4, preferredTimescale: 600) }
            
            // 并发生成缩略图以提高性能（带错误恢复和内存管理）
            let indexedImages = await withTaskGroup(of: (Int, UIImage?).self, returning: [(Int, UIImage)].self) { group in
                for (index, time) in times.enumerated() {
                    group.addTask {
                        let generator = AVAssetImageGenerator(asset: assetRef)
                        generator.appliesPreferredTrackTransform = true
                        // 使用较小的容差以获得更精确的缩略图（优先体验）
                        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.05, preferredTimescale: 600)
                        generator.requestedTimeToleranceBefore = CMTime(seconds: 0.05, preferredTimescale: 600)
                        generator.maximumSize = CGSize(width: 600, height: 600) // 高质量缩略图以获得清晰显示
                        
                        // 尝试生成图片
                        do {
                            let cgImage = try await generator.image(at: time).image
                            return (index, UIImage(cgImage: cgImage))
                        } catch {
                            // 错误恢复：尝试从视频开始位置生成
                            if index == 0 {
                                if let fallbackImage = try? await generator.image(at: .zero).image {
                                    return (index, UIImage(cgImage: fallbackImage))
                                }
                            }
                            print("⚠️ Thumbnail generation failed for index \(index): \(error.localizedDescription)")
                            return (index, nil)
                        }
                    }
                }
                
                var results: [(Int, UIImage)] = []
                for await result in group {
                    if let image = result.1 {
                        results.append((result.0, image))
                    }
                }
                
                // 按索引排序
                results.sort { $0.0 < $1.0 }
                return results
            }
            
            await MainActor.run {
                // 只更新非空的缩略图，避免清空已有的图片
                if !indexedImages.isEmpty {
                    thumbnails = indexedImages.map { $0.1 }
                }
            }
        }
    }
    
    private func updateTimeRange() {
        guard duration > 0 else { return }
        let startTime = duration * Double(startPosition)
        let endTime = duration * Double(endPosition)
        let clipDuration = max(0.5, min(6.0, endTime - startTime))
        
        appState.selectedTimeRange = CMTimeRange(
            start: CMTime(seconds: startTime, preferredTimescale: 600),
            duration: CMTime(seconds: clipDuration, preferredTimescale: 600)
        )
        
        // 确保关键帧在选择范围内
        let keyFrameTime = appState.keyFrameTime.seconds
        if keyFrameTime < startTime || keyFrameTime > endTime {
            appState.keyFrameTime = CMTime(seconds: startTime, preferredTimescale: 600)
        }
    }
    
    private func formatDuration(_ seconds: Double) -> String {
        return String(format: "%.1fs", seconds)
    }
}

struct DragHandle: View {
    var body: some View {
        Rectangle()
            .fill(Color.white)
            .frame(width: 4, height: 68)
    }
}

extension Array {
    subscript(safe index: Index) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}
