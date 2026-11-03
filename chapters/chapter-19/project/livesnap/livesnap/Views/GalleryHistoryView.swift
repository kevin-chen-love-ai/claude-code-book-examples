//
//  GalleryHistoryView.swift
//  livesnap
//
//  图库历史页面 - 增强版（支持长按编辑、批量删除）
//

import SwiftUI
import Photos
import PhotosUI

/// Wrapper for masonry layout
struct MasonryItem: Identifiable {
    let id = UUID()
    let index: Int
    let asset: PHAsset
}

struct GalleryHistoryView: View {
    @Environment(\.dismiss) var dismiss
    @State private var selectedFilter: HistoryFilter = .recent
    @State private var livePhotos: [PHAsset] = []
    @State private var showClearAlert = false
    @State private var isEditMode = false
    @State private var selectedAssets: Set<String> = []
    @State private var showDeleteConfirmation = false
    @State private var assetToEdit: PHAsset?
    @State private var showEditSheet = false

    enum HistoryFilter: String, CaseIterable {
        case recent = "Recent"
        case all = "All"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.midnightBlack.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header - 使用统一导航栏组件
                    HStack {
                        if isEditMode {
                            Button {
                                // 取消编辑模式
                                isEditMode = false
                                selectedAssets.removeAll()
                            } label: {
                                Text("Cancel")
                                    .font(.system(size: 17, weight: .medium))
                                    .foregroundColor(AppTheme.iosBlue)
                            }
                            .buttonStyle(ScaleButtonStyle())
                        } else {
                            Button {
                                dismiss()
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 18, weight: .light))
                                    .foregroundColor(AppTheme.primaryText.opacity(0.6))
                                    .frame(width: 40, height: 40)
                            }
                            .buttonStyle(ScaleButtonStyle())
                        }

                        Spacer()

                        if isEditMode {
                            Text("Select Items")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(AppTheme.primaryText)
                        } else {
                            SystemTitle(text: "History", size: 17, weight: .semibold)
                        }

                        Spacer()

                        if isEditMode {
                            // 显示已选数量
                            Text("\(selectedAssets.count)")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(AppTheme.iosBlue)
                                .frame(width: 40, height: 40)
                        } else {
                            Menu {
                                Button {
                                    isEditMode = true
                                } label: {
                                    Label("Select", systemImage: "checkmark.circle")
                                }

                                Button(role: .destructive) {
                                    clearHistory()
                                } label: {
                                    Label("Clear History", systemImage: "trash")
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .font(.system(size: 18))
                                    .foregroundColor(AppTheme.primaryText.opacity(0.6))
                                    .frame(width: 40, height: 40)
                            }
                            .buttonStyle(ScaleButtonStyle())
                        }
                    }
                    .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                    .padding(.vertical, 12)
                    .frame(maxWidth: AppTheme.Layout.maxContentWidth)
                    .frame(maxWidth: .infinity)
                    .background(
                        GlassNavBackground()
                            .ignoresSafeArea(edges: .top)
                    )

                    // Segmented Control - 使用统一组件（编辑模式时隐藏）
                    if !isEditMode {
                        SystemSegmentedControl(
                            selection: Binding(
                                get: { selectedFilter == .recent ? 0 : 1 },
                                set: { selectedFilter = $0 == 0 ? .recent : .all }
                            ),
                            items: HistoryFilter.allCases.map { $0.rawValue }
                        )
                        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                        .padding(.vertical, 12)
                    }

                    // 批量操作工具栏
                    if isEditMode && !selectedAssets.isEmpty {
                        HStack(spacing: 16) {
                            Button {
                                // 全选/取消全选
                                if selectedAssets.count == livePhotos.count {
                                    selectedAssets.removeAll()
                                } else {
                                    selectedAssets = Set(livePhotos.map { $0.localIdentifier })
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: selectedAssets.count == livePhotos.count ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 16, weight: .medium))
                                    Text(selectedAssets.count == livePhotos.count ? "Deselect All" : "Select All")
                                        .font(.system(size: 15, weight: .medium))
                                }
                                .foregroundColor(AppTheme.iosBlue)
                            }

                            Spacer()

                            Button(role: .destructive) {
                                showDeleteConfirmation = true
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "trash")
                                        .font(.system(size: 16, weight: .medium))
                                    Text("Delete (\(selectedAssets.count))")
                                        .font(.system(size: 15, weight: .medium))
                                }
                                .foregroundColor(AppTheme.warningOrange)
                            }
                        }
                        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                        .padding(.vertical, 12)
                        .background(AppTheme.graphiteGray)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    // Media Grid
                    if livePhotos.isEmpty {
                        Spacer()
                        SystemEmptyState(
                            icon: "photo.on.rectangle.angled",
                            title: "No History Yet",
                            message: "Photos you create will appear here"
                        )
                        Spacer()
                    } else {
                        ScrollView {
                            VStack(spacing: 0) {
                                // 瀑布流布局 - 保持照片原始宽高比
                                MasonryVGrid(
                                    items: Array(livePhotos.enumerated()).map { MasonryItem(index: $0.offset, asset: $0.element) },
                                    columns: 2,
                                    spacing: 8,
                                    content: { item in
                                        AspectRatioThumbnail(
                                            asset: item.asset,
                                            index: item.index,
                                            isEditMode: isEditMode,
                                            isSelected: selectedAssets.contains(item.asset.localIdentifier),
                                            onTap: {
                                                handleThumbnailTap(item.asset)
                                            },
                                            onLongPress: {
                                                handleThumbnailLongPress(item.asset)
                                            }
                                        )
                                    },
                                    getAspectRatio: { item in
                                        item.asset.aspectRatio
                                    }
                                )
                                .padding(.horizontal, 16)
                                .padding(.bottom, 20)

                                // Footer Info
                                if !isEditMode {
                                    VStack(spacing: 4) {
                                        Text("\(livePhotos.count) Photos • \(getCurrentYear())")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundColor(AppTheme.primaryText.opacity(0.4))
                                            .tracking(1)
                                    }
                                    .padding(.vertical, 32)
                                    .padding(.bottom, 100)
                                }
                            }
                        }
                    }
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            loadLivePhotos()
        }
        .onChange(of: selectedFilter) { _, _ in
            loadLivePhotos()
        }
        .alert("Clear History", isPresented: $showClearAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Clear", role: .destructive) {
                clearHistoryConfirmed()
            }
        } message: {
            Text("This will remove all history entries. The Live Photos in your library will not be affected.")
        }
        .alert("Delete Selected", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteSelectedAssets()
            }
        } message: {
            Text("Delete \(selectedAssets.count) selected item(s) from history? The Live Photos in your library will not be affected.")
        }
        .sheet(isPresented: $showEditSheet) {
            if let asset = assetToEdit {
                LivePhotoEditSheet(asset: asset)
            }
        }
        .animation(.easeInOut(duration: AppTheme.AnimationDuration.normal), value: isEditMode)
        .animation(.easeInOut(duration: AppTheme.AnimationDuration.normal), value: selectedAssets)
    }

    private func loadLivePhotos() {
        HistoryManager.shared.loadAssets(filter: selectedFilter) { assets in
            livePhotos = assets
        }
    }

    private func clearHistory() {
        showClearAlert = true
    }

    private func clearHistoryConfirmed() {
        StorageManager.shared.clearHistory()
        loadLivePhotos()
    }

    private func handleThumbnailTap(_ asset: PHAsset) {
        if isEditMode {
            // 编辑模式：切换选择状态
            if selectedAssets.contains(asset.localIdentifier) {
                selectedAssets.remove(asset.localIdentifier)
            } else {
                selectedAssets.insert(asset.localIdentifier)
            }
        } else {
            // 正常模式：查看详情（未来可扩展）
            print("View asset: \(asset.localIdentifier)")
        }
    }

    private func handleThumbnailLongPress(_ asset: PHAsset) {
        if !isEditMode {
            // 长按进入编辑模式并选中该项
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()

            assetToEdit = asset
            showEditSheet = true
        }
    }

    private func deleteSelectedAssets() {
        // 从历史记录中删除（不删除实际的 Live Photo）
        for assetID in selectedAssets {
            StorageManager.shared.removeHistoryAssetID(assetID)
        }

        selectedAssets.removeAll()
        isEditMode = false
        loadLivePhotos()

        // Haptic 反馈
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    private func getCurrentYear() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy"
        return formatter.string(from: Date())
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppTheme.systemGray.opacity(0.5))

            VStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)

                Text(message)
                    .font(.system(size: 15))
                    .foregroundColor(AppTheme.secondaryText)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.midnightBlack) // Ensure background matches
    }
}

struct LivePhotoThumbnail: View {
    let asset: PHAsset
    let index: Int
    var isEditMode: Bool = false
    var isSelected: Bool = false
    var onTap: (() -> Void)?
    var onLongPress: (() -> Void)?

    @State private var thumbnail: UIImage?

    var body: some View {
        ZStack {
            // 背景层（统一正方形容器）
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.graphiteGray.opacity(0.3))

            if let thumbnail = thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .cornerRadius(12)
            } else {
                // 加载占位符
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.iosBlue.opacity(0.5)))
            }

            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    isSelected ? AppTheme.iosBlue : Color.white.opacity(0.05),
                    lineWidth: isSelected ? 3 : 1
                )

            // 选择标记
            if isEditMode {
                VStack {
                    HStack {
                        Spacer()
                        ZStack {
                            Circle()
                                .fill(isSelected ? AppTheme.iosBlue : Color.black.opacity(0.3))
                                .frame(width: 28, height: 28)

                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                            } else {
                                Circle()
                                    .stroke(Color.white.opacity(0.6), lineWidth: 2)
                                    .frame(width: 20, height: 20)
                            }
                        }
                        .padding(8)
                    }
                    Spacer()
                }
            } else {
                // Live Badge
                VStack {
                    HStack {
                        HStack(spacing: 4) {
                            Image(systemName: "livephoto")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                            Text("Live")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .tracking(1)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.black.opacity(0.4))
                        .cornerRadius(12)

                        Spacer()
                    }
                    .padding(6)

                    Spacer()
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .onAppear {
            loadThumbnail()
        }
        .onTapGesture {
            onTap?()
        }
        .onLongPressGesture {
            onLongPress?()
        }
        .scaleEffect(isSelected ? 0.95 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
    }

    private func loadThumbnail() {
        // 使用高分辨率缩略图以获得清晰显示（优先体验）
        let size = CGSize(width: 600, height: 600)
        HistoryManager.shared.getThumbnail(for: asset, size: size) { image in
            thumbnail = image
        }
    }
}

// MARK: - Live Photo Edit Sheet

struct LivePhotoEditSheet: View {
    let asset: PHAsset
    @Environment(\.dismiss) var dismiss
    @State private var thumbnail: UIImage?

    var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.midnightBlack.ignoresSafeArea()

                VStack(spacing: 24) {
                    // 预览
                    if let thumbnail = thumbnail {
                        Image(uiImage: thumbnail)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: .infinity)
                            .cornerRadius(16)
                            .padding()
                    }

                    VStack(spacing: 12) {
                        Text("Edit Live Photo")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(AppTheme.primaryText)

                        Text("Re-edit this Live Photo with different settings")
                            .font(.system(size: 15))
                            .foregroundColor(AppTheme.secondaryText)
                            .multilineTextAlignment(.center)
                    }

                    Spacer()

                    VStack(spacing: 12) {
                        // 重新编辑按钮
                        Button {
                            // TODO: 导航到编辑页面
                            dismiss()
                        } label: {
                            HStack {
                                Image(systemName: "pencil")
                                Text("Re-edit Live Photo")
                            }
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(AppTheme.iosBlue)
                            .cornerRadius(16)
                        }

                        Button {
                            dismiss()
                        } label: {
                            Text("Cancel")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(AppTheme.primaryText)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(AppTheme.graphiteGray)
                                .cornerRadius(14)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 32)
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            loadThumbnail()
        }
    }

    private func loadThumbnail() {
        HistoryManager.shared.getThumbnail(for: asset, size: CGSize(width: 800, height: 800)) { image in
            thumbnail = image
        }
    }
}

#if false
#Preview {
    GalleryHistoryView()
}
#endif
