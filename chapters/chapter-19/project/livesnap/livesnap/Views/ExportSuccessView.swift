//
//  ExportSuccessView.swift
//  livesnap
//
//  导出成功页面
//

import SwiftUI
import Photos
import UIKit

struct ExportSuccessView: View {
    @ObservedObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var showProUpgrade = false
    @State private var previewImage: UIImage?
    @State private var isLoadingImage = true
    @State private var hasLoadedImage = false // 防止重复加载
    @State private var previewScale: CGFloat = 1.0 // 呼吸动效缩放
    @State private var showShareSheet = false
    @State private var shareItems: [Any] = []
    @State private var showLivePhotoGuide = false
    
    var body: some View {
        ZStack {
            AppTheme.midnightBlack.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 0) {
                    // Content Container with max width (matching prototype max-w-md ≈ 448px)
                    VStack(spacing: 0) {
                        // Success Icon
                        VStack(spacing: 16) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 72))
                                .foregroundColor(AppTheme.successGreen)
                            
                            Text("Export Complete")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(AppTheme.primaryText)
                            
                            Text("Saved to your Photos library")
                                .font(.system(size: 16))
                                .foregroundColor(AppTheme.primaryText.opacity(0.5))
                        }
                        .padding(.top, 24) // 基础顶部 padding
                        .padding(.bottom, 24)
                        
                        // Preview Image
                        ZStack {
                            if let image = previewImage {
                                Image(uiImage: image)
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(maxWidth: .infinity)
                                    .aspectRatio(3/4, contentMode: .fit)
                                    .cornerRadius(24)
                                    .clipped()
                            } else {
                                // 加载占位符
                                RoundedRectangle(cornerRadius: 24)
                                    .fill(AppTheme.graphiteGray)
                                    .frame(maxWidth: .infinity)
                                    .aspectRatio(3/4, contentMode: .fit)
                                
                                if isLoadingImage {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.iosBlue))
                                }
                            }
                            
                            // 边框和 Live Photo 标识
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(Color.white.opacity(0.1), lineWidth: 1)
                            
                            // Live Photo 标识
                            VStack {
                                HStack {
                                    HStack(spacing: 6) {
                                        Image(systemName: "livephoto")
                                            .font(.system(size: 18))
                                        Text("Live")
                                            .font(.system(size: 10, weight: .bold))
                                            .tracking(2)
                                    }
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.black.opacity(0.3))
                                    .cornerRadius(12)
                                    .padding(16)
                                    
                                    Spacer()
                                }
                                Spacer()
                            }
                        }
                        .scaleEffect(previewScale)
                        .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
                        .padding(.horizontal, 32)
                        .padding(.bottom, 24)
                        
                        // Set as Wallpaper Guide
                        VStack(alignment: .leading, spacing: 16) {
                            Text("SET AS WALLPAPER")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(AppTheme.primaryText.opacity(0.6))
                                .tracking(0.5)
                                .padding(.horizontal, 32)
                            
                            // 添加"打开 Photos"按钮
                            if let assetID = appState.exportedLivePhotoAssetID {
                                Button {
                                    openPhotoInPhotosApp(assetID: assetID)
                                } label: {
                                    HStack {
                                        Image(systemName: "photo.on.rectangle")
                                            .font(.system(size: 18))
                                        Text("Open in Photos")
                                            .font(.system(size: 16, weight: .semibold))
                                    }
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 16)
                                    .background(AppTheme.iosBlue)
                                    .cornerRadius(16)
                                }
                                .buttonStyle(EnhancedButtonStyle(scale: 0.97, hapticStyle: .medium))
                                .padding(.horizontal, 32)
                            }
                            
                            VStack(spacing: 12) {
                                // Tap Share - 可点击的分享按钮
                                Button {
                                    shareLivePhoto()
                                } label: {
                                    GuideRow(
                                        icon: "square.and.arrow.up",
                                        title: "Tap Share",
                                        description: "Share this Live Photo or set as wallpaper"
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                                
                                // Enable Live Photo - 可点击的按钮，提供详细指导
                                Button {
                                    showLivePhotoGuide = true
                                } label: {
                                    GuideRow(
                                        icon: "lock.rotation",
                                        title: "Enable Live Photo",
                                        description: "Tap to learn how to enable Live Photo in Photos app"
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                            .padding(.horizontal, 32)
                        }
                        .padding(.bottom, 24)
                        
                        // Pro Upgrade Card
                        if !appState.isProUser {
                            VStack(spacing: 16) {
                                HStack(spacing: 8) {
                                    SystemBadge(text: "PRO", type: .gold)
                                    
                                    Text("Remove Watermark")
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundColor(AppTheme.primaryText)
                                }
                                
                                Text("Unlock high-fidelity 4K exports and remove the Livesnap watermark forever.")
                                    .font(.system(size: 14))
                                    .foregroundColor(AppTheme.primaryText.opacity(0.5))
                                    .multilineTextAlignment(.center)
                                
                                PrimaryButton(
                                    title: "Upgrade to Pro",
                                    action: { showProUpgrade = true }
                                )
                                
                                Button {
                                    restorePurchases()
                                } label: {
                                    Text("Restore Purchases")
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(AppTheme.primaryText.opacity(0.3))
                                }
                            }
                            .padding(24)
                            .background(AppTheme.graphiteGray)
                            .cornerRadius(28)
                            .overlay(
                                RoundedRectangle(cornerRadius: 28)
                                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
                            )
                            .shimmer(duration: 4.0, delay: 2.0) // 周期性扫光，吸引注意力而不突兀
                            .padding(.horizontal, 32)
                            .padding(.bottom, 40)
                        }
                    }
                    .frame(maxWidth: 448) // Match prototype max-w-md
                    .frame(maxWidth: .infinity) // Center on larger screens
                    .padding(.bottom, 40) // 底部 padding 确保内容不被底部安全区域遮挡
                }
            }
            .safeAreaInset(edge: .top) {
                // Fixed Top Header - 使用统一组件
                SystemNavHeader(
                    title: "Success",
                    leadingAction: { dismiss() },
                    trailingAction: { dismiss() },
                    trailingTitle: "Done"
                )
            }
            .safeAreaPadding(.top, 8) // 为 ScrollView 内容添加顶部安全区域 padding，确保不被 Dynamic Island 遮挡
            .sheet(isPresented: $showProUpgrade) {
                ProUpgradeView(appState: appState)
            }
            .sheet(isPresented: $showShareSheet) {
                ShareSheet(activityItems: shareItems)
            }
            .alert("Enable Live Photo", isPresented: $showLivePhotoGuide) {
                Button("Open Settings", role: .none) {
                    if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(settingsURL)
                    }
                }
                Button("OK", role: .cancel) { }
            } message: {
                Text("To enable Live Photo:\n\n1. Open the Photos app\n2. Find your Live Photo\n3. Tap the Live Photo icon (if it's grayed out)\n4. Or go to Settings > Photos and enable Live Photos\n\nThen long press on the Lock Screen to play the Live Photo.")
            }
            .onAppear {
                // 启动预览图片的呼吸微动效
                withAnimation(
                    Animation.easeInOut(duration: 4.0)
                        .repeatForever(autoreverses: true)
                ) {
                    previewScale = 1.03
                }
                
                // 使用 Task 确保在视图更新周期外执行
                if !hasLoadedImage {
                    Task { @MainActor in
                        hasLoadedImage = true
                        loadPreviewImage()
                    }
                }
            }
        }
    }
    
    private func restorePurchases() {
        Task {
            await StoreKitManager.shared.restorePurchases()
            await MainActor.run {
                appState.isProUser = StoreKitManager.shared.isProUser
            }
        }
    }
    
    /// 加载预览图片
    private func loadPreviewImage() {
        // 确保在主线程上更新状态
        Task { @MainActor in
            isLoadingImage = true
        }
        
        // 优先使用 assetID 从 Photos 库加载
        if let assetID = appState.exportedLivePhotoAssetID {
            Task {
                let assets = await MediaLibraryService.shared.fetchAssets(withLocalIdentifiers: [assetID])
                if let asset = assets.first {
                    // 使用最高分辨率预览图片以获得最清晰的显示（优先体验）
                    let size = CGSize(width: 2400, height: 3200) // 3:4 比例，最高分辨率
                    if let image = await MediaLibraryService.shared.generateThumbnail(for: asset, size: size) {
                        await MainActor.run {
                            previewImage = image
                            isLoadingImage = false
                        }
                        return
                    }
                }
                
                // 如果从 Photos 库加载失败，尝试使用临时文件 URL
                await MainActor.run {
                    loadFromTempURL()
                }
            }
        } else {
            // 如果没有 assetID，使用临时文件 URL
            Task { @MainActor in
                loadFromTempURL()
            }
        }
    }
    
    /// 从临时文件 URL 加载图片
    private func loadFromTempURL() {
        guard let url = appState.exportedLivePhotoURL else {
            Task { @MainActor in
                isLoadingImage = false
            }
            return
        }
        
        Task {
            // 检查文件是否存在
            guard FileManager.default.fileExists(atPath: url.path) else {
                await MainActor.run {
                    isLoadingImage = false
                }
                return
            }
            
            // 加载图片
            if let data = try? Data(contentsOf: url),
               let image = UIImage(data: data) {
                await MainActor.run {
                    previewImage = image
                    isLoadingImage = false
                }
            } else {
                await MainActor.run {
                    isLoadingImage = false
                }
            }
        }
    }
    
    /// 在 Photos 应用中打开 Live Photo
    /// 注意：iOS 不支持通过 URL scheme 直接打开 Photos 应用或特定 asset
    /// 这个方法会尝试打开 Photos 应用（如果系统支持）
    private func openPhotoInPhotosApp(assetID: String) {
        // iOS 没有官方的 Photos URL scheme
        // 某些第三方应用可能支持 photos:// 或 photos-redirect://
        // 但这不是官方 API，可能不稳定
        // 作为替代，我们可以提示用户手动打开 Photos 应用
        
        // 尝试打开 Photos 应用（如果系统支持）
        let photosURLs = [
            "photos-redirect://",
            "photos://"
        ]
        
        for urlString in photosURLs {
            if let url = URL(string: urlString),
               UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                return
            }
        }
        
        // 如果无法打开，显示提示
        // 注意：在实际应用中，可以显示一个 alert 提示用户手动打开 Photos
    }
    
    /// 分享 Live Photo
    private func shareLivePhoto() {
        Task {
            var items: [Any] = []

            // 优先尝试从 Photos 库获取 Live Photo asset 并分享
            if let assetID = appState.exportedLivePhotoAssetID {
                let assets = await MediaLibraryService.shared.fetchAssets(withLocalIdentifiers: [assetID])
                if let asset = assets.first {
                    // 分享 Live Photo asset（系统会自动处理 Live Photo 的分享）
                    items.append(asset)
                }
            }

            // 如果有预览图片，也添加图片作为后备
            if let image = previewImage {
                items.append(image)
            }

            // 添加说明文字
            items.append("Created with Livesnap - Turn videos into Live Photos!")

            // 确保有内容才显示分享面板
            guard !items.isEmpty else {
                print("⚠️ No items to share")
                return
            }

            await MainActor.run {
                shareItems = items
                // 延迟一帧确保 shareItems 已更新
                DispatchQueue.main.async {
                    showShareSheet = true
                }
            }
        }
    }
}

struct GuideRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(AppTheme.primaryText.opacity(0.8))
                .frame(width: 40, height: 40)
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(AppTheme.primaryText)
                
                Text(description)
                    .font(.system(size: 13))
                    .foregroundColor(AppTheme.primaryText.opacity(0.4))
            }
            
            Spacer()
        }
        .padding(16)
        .background(AppTheme.graphiteGray)
        .cornerRadius(16)
    }
}

#if false
#Preview {
    ExportSuccessView(appState: AppState())
}
#endif
