//
//  VideoSelectionView.swift
//  livesnap
//
//  视频选择页面
//

import SwiftUI
import PhotosUI
import AVFoundation
import UniformTypeIdentifiers

// 用于从 PhotosPickerItem 获取视频 URL 的辅助类型
struct Movie: Transferable {
    let url: URL
    
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            let copy = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("mov")
            try? FileManager.default.removeItem(at: copy)
            try FileManager.default.copyItem(at: received.file, to: copy)
            return Movie(url: copy)
        }
    }
}

struct VideoSelectionView: View {
    @StateObject private var appState = AppState()
    @StateObject private var storeKitManager = StoreKitManager.shared
    @State private var selectedItem: PhotosPickerItem?
    @State private var showEditor = false
    @State private var editorAsset: AVAsset?
    @State private var selectedTab: Tab = .convert
    @State private var showHistory = false
    @State private var showSettings = false
    @State private var showBatchSelection = false
    @State private var recentVideos: [PHAsset] = []
    @State private var showFileSizeError = false
    @State private var fileSizeErrorMessage = ""
    
    enum Tab {
        case convert
        case history
        case settings
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Enhanced Background with gradient
                GradientBackground(style: .midnight)

                // Ambient light effects
                LightEffect(position: .topLeading, color: AppTheme.iosBlue, intensity: 0.15)
                    .offset(x: -150, y: -150)

                LightEffect(position: .bottomTrailing, color: Color(hex: "6a0572"), intensity: 0.1)
                    .offset(x: 150, y: 150)
                
                // Main Content - Full screen with safe area padding
                ScrollView {
                    VStack(spacing: 0) {
                        // Content Container with max width (matching prototype max-w-md ≈ 448px)
                        VStack(spacing: 0) {
                            // Select Video Button - Enhanced with premium visual
                            VStack(spacing: 16) {
                                PhotosPicker(
                                    selection: $selectedItem,
                                    matching: .videos,
                                    photoLibrary: .shared()
                                ) {
                                    VStack(spacing: 12) {
                                        Image(systemName: "plus.circle.fill")
                                            .font(.system(size: 40, weight: .regular))
                                            .foregroundColor(.white)
                                            .glowEffect(color: .white, radius: 8)
                                            .floatingAnimation(amplitude: 8, duration: 2.5)

                                        Text("Select Video")
                                            .font(.system(size: 18, weight: .semibold))
                                            .foregroundColor(.white)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 200)
                                    .background(
                                        ZStack {
                                            // 主渐变
                                            LinearGradient(
                                                colors: [
                                                    AppTheme.iosBlue,
                                                    Color(hex: "0051D5")
                                                ],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )

                                            // 高光层
                                            LinearGradient(
                                                colors: [
                                                    Color.white.opacity(0.3),
                                                    Color.clear
                                                ],
                                                startPoint: .top,
                                                endPoint: .center
                                            )
                                        }
                                    )
                                    .cornerRadius(AppTheme.CornerRadius.large)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.large)
                                            .stroke(
                                                LinearGradient(
                                                    colors: [
                                                        Color.white.opacity(0.4),
                                                        Color.white.opacity(0.1)
                                                    ],
                                                    startPoint: .topLeading,
                                                    endPoint: .bottomTrailing
                                                ),
                                                lineWidth: 1.5
                                            )
                                    )
                                    .shadow(color: AppTheme.iosBlue.opacity(0.4), radius: 20, x: 0, y: 10)
                                    .shadow(color: AppTheme.iosBlue.opacity(0.2), radius: 40, x: 0, y: 20)
                                }
                                .buttonStyle(ScaleButtonStyle())
                                
                                Text("Convert videos to high-quality Live Photos")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(AppTheme.systemGray)
                                    .tracking(-0.2)
                            }
                            .padding(.top, 24) // 减少顶部 padding，避免被标题遮挡
                            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                            .padding(.bottom, 32)
                            
                            // Recent Videos Section
                            VStack(alignment: .leading, spacing: 16) {
                                HStack {
                                    Text("Recent Videos")
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundColor(AppTheme.primaryText)
                                        .tracking(-0.4)
                                    
                                    Spacer()
                                    
                                    Button("See All") {
                                        showBatchSelection = true
                                    }
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(AppTheme.iosBlue)
                                }
                                .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                                
                                // Recent Videos Grid
                                LazyVGrid(columns: [
                                    GridItem(.flexible(), spacing: 12),
                                    GridItem(.flexible(), spacing: 12)
                                ], spacing: 12) {
                                    ForEach(recentVideos, id: \.localIdentifier) { asset in
                                        RecentVideoThumbnail(asset: asset) {
                                            // Handle selection to open editor logic
                                            // For now, simple tap to open?
                                            // The original code passed PhotosPickerItem.
                                            // Mapping PHAsset to Editor needs logic.
                                            loadVideoFromAsset(asset)
                                        }
                                    }
                                }
                                .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                            }
                            .padding(.bottom, 120) // Bottom padding for fixed navigation bar
                        }
                        .frame(maxWidth: 448) // Match prototype max-w-md
                        .frame(maxWidth: .infinity) // Center on larger screens
                    }
                }
                .safeAreaInset(edge: .top) {
                    // Premium Brand Header - 精心设计的品牌展示
                    HStack {
                        PremiumBrandHeader()

                        Spacer()

                        if appState.isProUser {
                            PremiumProBadge()
                        }
                    }
                    .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                    .padding(.top, 12) // 增加顶部 padding 给予更多呼吸空间
                    .padding(.bottom, 12) // 增加底部 padding
                    .frame(maxWidth: AppTheme.Layout.maxContentWidth)
                    .frame(maxWidth: .infinity)
                    .background(
                        ZStack {
                            // 玻璃态背景
                            GlassNavBackground()
                                .ignoresSafeArea(edges: .top)

                            // 顶部微妙渐变装饰
                            LinearGradient(
                                colors: [
                                    AppTheme.iosBlue.opacity(0.05),
                                    Color.clear
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                            .frame(height: 100)
                            .ignoresSafeArea(edges: .top)
                        }
                    )
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    // Fixed Bottom Navigation
                    BottomNavigationBar(
                        selectedTab: $selectedTab,
                        onHistoryTap: { showHistory = true },
                        onSettingsTap: { showSettings = true }
                    )
                }
            }
            .onChange(of: selectedItem) { _, newItem in
                // 使用 Task 来避免在视图更新期间发布更改
                Task { @MainActor in
                    if let newItem = newItem {
                        await loadVideo(from: newItem)
                    }
                }
            }
            .fullScreenCover(isPresented: $showEditor) {
                if let asset = editorAsset {
                    VideoEditorView(asset: asset, appState: appState)
                }
            }
            .sheet(isPresented: $showHistory) {
                GalleryHistoryView()
            }
            .sheet(isPresented: $showSettings) {
                SettingsView(appState: appState)
            }
            .sheet(isPresented: $showBatchSelection) {
                BatchSelectionView()
            }
            .alert("File Too Large", isPresented: $showFileSizeError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(fileSizeErrorMessage)
            }
            .onAppear {
                loadRecentVideos()
                // 同步 Pro 用户状态 - 使用 Task 避免在视图更新期间发布更改
                Task { @MainActor in
                    appState.isProUser = storeKitManager.isProUser
                }
            }
            .onChange(of: storeKitManager.isProUser) { _, newValue in
                // 当购买状态改变时，同步到 appState - 使用 Task 避免在视图更新期间发布更改
                Task { @MainActor in
                    appState.isProUser = newValue
                }
            }
        }
    }
    
    private func loadRecentVideos() {
        Task {
            let assets = await MediaLibraryService.shared.fetchRecentVideos(limit: 6)
            await MainActor.run {
                recentVideos = assets
            }
        }
    }
    
    private func loadVideoFromAsset(_ asset: PHAsset) {
        // 首先检查资源大小（如果可用）
        let resources = PHAssetResource.assetResources(for: asset)
        if let videoResource = resources.first(where: { $0.type == .video }) {
            if let fileSize = videoResource.value(forKey: "fileSize") as? Int64 {
                let maxSize: Int64 = 200 * 1024 * 1024 // 200MB
                if fileSize > maxSize {
                    let fileSizeMB = fileSize / 1024 / 1024
                    DispatchQueue.main.async {
                        print("❌ Video file too large: \(fileSizeMB)MB (max: 200MB)")
                        self.fileSizeErrorMessage = "Video file is too large (\(fileSizeMB)MB). Maximum file size is 200MB. Please select a shorter video."
                        self.showFileSizeError = true
                    }
                    return
                }
            }
        }
        
        let options = PHVideoRequestOptions()
        options.version = .original
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        
        PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, _ in
            if let avAsset = avAsset {
                // 再次检查文件大小（如果可以从 URL 获取）
                if let urlAsset = avAsset as? AVURLAsset {
                    let url = urlAsset.url
                    if FileManager.default.fileExists(atPath: url.path) {
                        if let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
                           let fileSize = attributes[.size] as? Int64 {
                            let maxSize: Int64 = 200 * 1024 * 1024 // 200MB
                            if fileSize > maxSize {
                                DispatchQueue.main.async {
                                    print("❌ Video file too large: \(fileSize / 1024 / 1024)MB (max: 200MB)")
                                    // TODO: 显示用户友好的错误提示
                                }
                                return
                            }
                        }
                    }
                }
                
                DispatchQueue.main.async {
                    self.appState.selectedVideoAsset = avAsset
                    if let urlAsset = avAsset as? AVURLAsset {
                        self.appState.selectedVideoURL = urlAsset.url
                    }
                    
                    Task {
                        if let duration = try? await avAsset.load(.duration) {
                            let startTime = CMTime(seconds: 0, preferredTimescale: 600)
                            let clipDuration = CMTime(seconds: min(3.0, duration.seconds), preferredTimescale: 600)
                            await MainActor.run {
                                self.appState.selectedTimeRange = CMTimeRange(start: startTime, duration: clipDuration)
                                self.appState.keyFrameTime = startTime
                                self.editorAsset = avAsset
                                self.showEditor = true
                            }
                        } else {
                            // 即使无法加载时长，也打开编辑器
                            await MainActor.run {
                                // 设置默认时间范围
                                let startTime = CMTime(seconds: 0, preferredTimescale: 600)
                                let clipDuration = CMTime(seconds: 3.0, preferredTimescale: 600)
                                self.appState.selectedTimeRange = CMTimeRange(start: startTime, duration: clipDuration)
                                self.appState.keyFrameTime = startTime
                                self.editorAsset = avAsset
                                self.showEditor = true
                            }
                        }
                    }
                }
            }
        }
    }

    private func loadVideo(from item: PhotosPickerItem) async {
        // 尝试直接获取文件 URL（更高效，避免大文件内存问题）
        var videoURL: URL?
        
        // 方法1: 尝试使用 MovieTransferable 获取 URL（iOS 16+）
        if let movie = try? await item.loadTransferable(type: Movie.self) {
            videoURL = movie.url
        }
        
        // 方法2: 如果无法直接获取 URL，则使用 Data（适用于小文件或旧系统）
        if videoURL == nil {
            if let data = try? await item.loadTransferable(type: Data.self),
               let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent(UUID().uuidString + ".mov") {
                do {
                    // 检查文件大小（限制为 200MB）
                    let maxSize: Int64 = 200 * 1024 * 1024 // 200MB
                    if Int64(data.count) > maxSize {
                        let fileSizeMB = data.count / 1024 / 1024
                        await MainActor.run {
                            print("❌ Video file too large: \(fileSizeMB)MB (max: 200MB)")
                            fileSizeErrorMessage = "Video file is too large (\(fileSizeMB)MB). Maximum file size is 200MB. Please select a shorter video."
                            showFileSizeError = true
                        }
                        return
                    }
                    try data.write(to: url)
                    videoURL = url
                } catch {
                    print("❌ Failed to write video data: \(error.localizedDescription)")
                    return
                }
            }
        }
        
        guard let url = videoURL else {
            print("❌ Failed to load video from PhotosPickerItem")
            return
        }
        
        // 检查文件大小（如果文件已存在）
        if FileManager.default.fileExists(atPath: url.path) {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
               let fileSize = attributes[.size] as? Int64 {
                let maxSize: Int64 = 200 * 1024 * 1024 // 200MB
                if fileSize > maxSize {
                    let fileSizeMB = fileSize / 1024 / 1024
                    await MainActor.run {
                        print("❌ Video file too large: \(fileSizeMB)MB (max: 200MB)")
                        fileSizeErrorMessage = "Video file is too large (\(fileSizeMB)MB). Maximum file size is 200MB. Please select a shorter video."
                        showFileSizeError = true
                    }
                    return
                }
            }
        }
        
        let asset = AVURLAsset(url: url)
        
        // 初始化编辑参数
        await MainActor.run {
            appState.selectedVideoURL = url
            appState.selectedVideoAsset = asset
        }
        
        // 加载视频时长并初始化编辑参数
        if let duration = try? await asset.load(.duration) {
            let startTime = CMTime(seconds: 0, preferredTimescale: 600)
            let clipDuration = CMTime(seconds: min(3.0, duration.seconds), preferredTimescale: 600)
            await MainActor.run {
                appState.selectedTimeRange = CMTimeRange(start: startTime, duration: clipDuration)
                appState.keyFrameTime = startTime
                editorAsset = asset
                showEditor = true
            }
        } else {
            // 即使无法加载时长，也打开编辑器
            await MainActor.run {
                // 设置默认时间范围
                let startTime = CMTime(seconds: 0, preferredTimescale: 600)
                let clipDuration = CMTime(seconds: 3.0, preferredTimescale: 600)
                appState.selectedTimeRange = CMTimeRange(start: startTime, duration: clipDuration)
                appState.keyFrameTime = startTime
                editorAsset = asset
                showEditor = true
            }
        }
    }
}

// Glass Navigation Background
// 使用主背景色 midnightBlack (#0E0F12) 与毛玻璃效果，增强细节
struct GlassNavBackground: View {
    var body: some View {
        ZStack {
            // 使用主背景色 midnightBlack，透明度 0.85（与原型一致）
            AppTheme.midnightBlack.opacity(0.85)
            
            // 毛玻璃模糊效果
            .background(.ultraThinMaterial)
            
            // 底部边框，增加层次感
            VStack {
                Spacer()
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.08),
                                Color.white.opacity(0.0)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 1)
            }
        }
    }
}

// Bottom Navigation Bar Component
struct BottomNavigationBar: View {
    @Binding var selectedTab: VideoSelectionView.Tab
    let onHistoryTap: () -> Void
    let onSettingsTap: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            // Top border
            Rectangle()
                .fill(Color.white.opacity(0.05))
                .frame(height: 1)
            
            HStack(spacing: 0) {
                // Convert Tab
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selectedTab = .convert
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "video.fill")
                            .font(.system(size: 26))
                            .foregroundColor(selectedTab == .convert ? AppTheme.iosBlue : AppTheme.systemGray)
                            .symbolEffect(.bounce, value: selectedTab == .convert)
                        Text("Convert")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(selectedTab == .convert ? AppTheme.iosBlue : AppTheme.systemGray)
                            .tracking(0.5)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(EnhancedButtonStyle(scale: 0.95, hapticStyle: .light))
                
                // History Tab
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selectedTab = .history
                    }
                    onHistoryTap()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: selectedTab == .history ? "clock.fill" : "clock")
                            .font(.system(size: 26))
                            .foregroundColor(selectedTab == .history ? AppTheme.iosBlue : AppTheme.systemGray)
                            .symbolEffect(.bounce, value: selectedTab == .history)
                        Text("History")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(selectedTab == .history ? AppTheme.iosBlue : AppTheme.systemGray)
                            .tracking(0.5)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(EnhancedButtonStyle(scale: 0.95, hapticStyle: .light))
                
                // Settings Tab
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selectedTab = .settings
                    }
                    onSettingsTap()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "gearshape.fill")
                            .font(.system(size: 26))
                            .foregroundColor(selectedTab == .settings ? AppTheme.iosBlue : AppTheme.systemGray)
                            .symbolEffect(.bounce, value: selectedTab == .settings)
                        Text("Settings")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(selectedTab == .settings ? AppTheme.iosBlue : AppTheme.systemGray)
                            .tracking(0.5)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(EnhancedButtonStyle(scale: 0.95, hapticStyle: .light))
            }
            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
            .padding(.top, 9) // 减少 3px (12 -> 9)
            .padding(.bottom, 5) // 减少 3px (8 -> 5)
            .frame(maxWidth: AppTheme.Layout.maxContentWidth) // Match prototype max-w-md
            .frame(maxWidth: .infinity) // Center on larger screens
        }
        .background(
            GlassNavBackground()
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

// Scale Button Style for iOS-like press effect (保留向后兼容)
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

struct RecentVideoThumbnail: View {
    let asset: PHAsset
    let onTap: () -> Void
    @State private var thumbnail: UIImage?
    @State private var durationString: String = ""
    
    var body: some View {
        Button(action: onTap) {
            RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium)
                .aspectRatio(3/4, contentMode: .fit)
                .foregroundColor(AppTheme.graphiteGray)
                .overlay(
                    Group {
                        if let thumbnail = thumbnail {
                            Image(uiImage: thumbnail)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .layoutPriority(-1)
                                .transition(.opacity)
                        } else {
                            // 扫光占位符
                            AppTheme.graphiteGray
                                .shimmer()
                        }
                    }
                )
                .clipped()
                .overlay(
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Text(durationString)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(
                                    ZStack {
                                        Color.black.opacity(0.6)
                                        .background(.ultraThinMaterial)
                                    }
                                )
                                .cornerRadius(AppTheme.CornerRadius.small)
                                .padding(.trailing, 10)
                                .padding(.bottom, 10)
                        }
                    }
                )
                .cornerRadius(AppTheme.CornerRadius.medium)
        }
        .buttonStyle(ScaleButtonStyle())
        .onAppear {
            loadData()
        }
    }
    
    private func loadData() {
        durationString = MediaLibraryService.shared.getDurationString(for: asset)
        
        Task {
            // Calculate size dynamically or fixed
            // 使用高分辨率缩略图以获得最清晰的显示（优先体验）
            if let image = await MediaLibraryService.shared.generateThumbnail(for: asset, size: CGSize(width: 1200, height: 1600)) {
                await MainActor.run {
                    thumbnail = image
                }
            }
        }
    }
}

#if false
#Preview {
    VideoSelectionView()
}
#endif
