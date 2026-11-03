//
//  ProcessingView.swift
//  livesnap
//
//  处理状态页面 - Optimized with Swift Concurrency
//

import SwiftUI
import AVFoundation

struct ProcessingView: View {
    @ObservedObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    @StateObject private var storage = StorageManager.shared
    @State private var lastVideoProgress: Double = 0.0 // 用于节流进度更新
    
    var body: some View {
        ZStack {
            AppTheme.midnightBlack.ignoresSafeArea()
            
            VStack(spacing: 0) {
                Spacer()
                
                // Progress Ring
                ZStack {
                    Circle()
                        .stroke(AppTheme.iosBlue.opacity(0.1), lineWidth: 8)
                        .frame(width: 224, height: 224)
                    
                    Circle()
                        .trim(from: 0, to: appState.processingProgress)
                        .stroke(
                            LinearGradient(
                                colors: [AppTheme.iosBlue, AppTheme.iosBlue.opacity(0.7)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .frame(width: 224, height: 224)
                        .rotationEffect(.degrees(-90))
                        .shadow(color: AppTheme.iosBlue.opacity(0.3), radius: 8, x: 0, y: 0)
                        .animation(.linear(duration: 0.1), value: appState.processingProgress)
                    
                    VStack(spacing: 4) {
                        Text("\(Int(appState.processingProgress * 100))%")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundColor(AppTheme.primaryText)
                        
                        if appState.processingProgress < 1.0 && appState.processingError == nil {
                            HStack(spacing: 4) {
                                ForEach(0..<3) { index in
                                    Circle()
                                        .fill(AppTheme.iosBlue.opacity(0.6))
                                        .frame(width: 6, height: 6)
                                        .scaleEffect(appState.processingProgress < 1.0 ? 1.0 : 0.0)
                                        .animation(
                                            Animation.easeInOut(duration: 0.6)
                                                .repeatForever()
                                                .delay(Double(index) * 0.2),
                                            value: appState.processingProgress
                                        )
                                }
                            }
                            .padding(.top, 4)
                        }
                    }
                }
                .padding(.bottom, 48)
                
                // Status Text
                VStack(spacing: 8) {
                    if let error = appState.processingError {
                        VStack(spacing: 16) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 48))
                                .foregroundColor(AppTheme.warningOrange)
                            
                            Text("Export Failed")
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundColor(AppTheme.primaryText)
                            
                            Text(userFriendlyErrorMessage(error))
                                .font(.system(size: 16))
                                .foregroundColor(AppTheme.secondaryText)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 32)
                        }
                    } else {
                        Text(appState.processingStatus.isEmpty ? "Creating Live Photo..." : appState.processingStatus)
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("Processing high-quality frames")
                            .font(.system(size: 16))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                .padding(.bottom, 48)
                
                // Sub-progress
                VStack(spacing: 12) {
                    HStack {
                        Text("Stabilizing")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.secondaryText.opacity(0.6))
                            .tracking(1)
                        Spacer()
                        Text("\(Int(appState.processingProgress * 100))%")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.secondaryText.opacity(0.6))
                    }
                    
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.white.opacity(0.05))
                                .frame(height: 4)
                            
                            RoundedRectangle(cornerRadius: 2)
                                .fill(
                                    LinearGradient(
                                        colors: [AppTheme.iosBlue.opacity(0.6), AppTheme.iosBlue.opacity(0.4)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geometry.size.width * appState.processingProgress, height: 4)
                                .animation(.linear(duration: 0.1), value: appState.processingProgress)
                        }
                    }
                    .frame(height: 4)
                }
                .frame(maxWidth: 280)
                
                Spacer()
                
                // Action Buttons
                if appState.processingError != nil {
                    VStack(spacing: 12) {
                        PrimaryButton(
                            title: "Retry",
                            action: { startProcessing() }
                        )
                        .padding(.horizontal, 32)
                        
                        Button {
                            dismiss()
                        } label: {
                            Text("Close")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(AppTheme.secondaryText)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 12)
                                .background(Color.white.opacity(0.05))
                                .cornerRadius(24)
                        }
                    }
                    .padding(.bottom, 48)
                } else {
                    Button {
                        dismiss()
                    } label: {
                        Text("Cancel Conversion")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppTheme.secondaryText)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 12)
                            .background(Color.white.opacity(0.05))
                            .cornerRadius(24)
                    }
                    .padding(.bottom, 48)
                }
            }
            .padding(.horizontal, 32)
        }
        .onAppear {
            startProcessing()
        }
    }
    
    private func startProcessing() {
        appState.isProcessing = true
        appState.processingProgress = 0.0
        appState.processingStatus = "Initializing..."
        appState.processingError = nil
        
        Task {
            await runProcess()
        }
    }
    
    private func runProcess() async {
        guard let videoURL = appState.selectedVideoURL,
              let timeRange = appState.selectedTimeRange,
              let asset = appState.selectedVideoAsset else {
            await MainActor.run {
                appState.processingError = "Missing required video data"
                appState.isProcessing = false
            }
            return
        }
        
        do {
            // 1. Extract Key Frame
            await MainActor.run {
                appState.processingStatus = "Extracting key frame..."
                appState.processingProgress = 0.1
            }
            let keyFrameURL = try await VideoProcessor.shared.extractKeyFrame(from: asset, at: appState.keyFrameTime)
            
            // 2. Process Video
            await MainActor.run {
                appState.processingStatus = "Processing video..."
                appState.processingProgress = 0.3
            }
            
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
                        let newProgress = 0.3 + (progress * 0.4)
                        if abs(newProgress - lastVideoProgress) >= 0.05 || progress >= 0.99 {
                            lastVideoProgress = newProgress
                            appState.processingProgress = newProgress
                        }
                    }
                }
            )
            
            // 3. Create Live Photo
            await MainActor.run {
                appState.processingStatus = "Creating Live Photo..."
                appState.processingProgress = 0.75
            }
            
            let assetID = try await LivePhotoComposer.shared.createLivePhoto(
                videoURL: processedVideoURL,
                imageURL: keyFrameURL
            )
            
            // 4. Success
            storage.addHistoryAssetID(assetID)
            
            await MainActor.run {
                appState.processingProgress = 1.0
                appState.processingStatus = "Live Photo created successfully!"
                appState.exportedLivePhotoAssetID = assetID
                appState.exportedLivePhotoURL = keyFrameURL
                
                Task {
                    try? await Task.sleep(nanoseconds: 800_000_000)
                    await MainActor.run {
                        appState.isProcessing = false
                        appState.showExportSuccess = true
                    }
                }
            }
        } catch {
            await MainActor.run {
                appState.processingError = error.localizedDescription
                appState.processingStatus = ""
                appState.isProcessing = false
            }
        }
    }
    
    private func userFriendlyErrorMessage(_ error: String) -> String {
        if error.contains("cancelled") || error.contains("Stopped") {
            return "Export was cancelled. Please try again."
        }
        if error.contains("library") || error.contains("permission") {
            return "Photo library access is required. Please check your Settings."
        }
        if error.contains("memory") {
            return "Not enough memory to process this video. Try a shorter clip."
        }
        if error.contains("disk") {
            return "Not enough storage space. Please free up some space."
        }
        return error
    }
}
