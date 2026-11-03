//
//  MasonryLayout.swift
//  livesnap
//
//  瀑布流布局组件 - 保持照片原始宽高比，最大化利用空间
//

import SwiftUI
import Photos

/// 瀑布流布局 - 支持不同宽高比的图片混排
struct MasonryVGrid<Content: View, Item: Identifiable>: View {
    let items: [Item]
    let columns: Int
    let spacing: CGFloat
    let content: (Item) -> Content
    let getAspectRatio: (Item) -> CGFloat

    init(
        items: [Item],
        columns: Int = 2,
        spacing: CGFloat = 8,
        @ViewBuilder content: @escaping (Item) -> Content,
        getAspectRatio: @escaping (Item) -> CGFloat
    ) {
        self.items = items
        self.columns = columns
        self.spacing = spacing
        self.content = content
        self.getAspectRatio = getAspectRatio
    }

    var body: some View {
        GeometryReader { geometry in
            let availableWidth = geometry.size.width - CGFloat(columns - 1) * spacing
            let columnWidth = availableWidth / CGFloat(columns)

            Color.clear
                .overlay(
                    MasonryLayoutView(
                        items: items,
                        columns: columns,
                        columnWidth: columnWidth,
                        spacing: spacing,
                        content: content,
                        getAspectRatio: getAspectRatio
                    ),
                    alignment: .top
                )
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// 内部瀑布流布局视图
private struct MasonryLayoutView<Content: View, Item: Identifiable>: View {
    let items: [Item]
    let columns: Int
    let columnWidth: CGFloat
    let spacing: CGFloat
    let content: (Item) -> Content
    let getAspectRatio: (Item) -> CGFloat

    var body: some View {
        let columnItems = distributeItems()

        HStack(alignment: .top, spacing: spacing) {
            ForEach(0..<columns, id: \.self) { columnIndex in
                LazyVStack(spacing: spacing) {
                    ForEach(columnItems[columnIndex]) { item in
                        content(item)
                            .frame(width: columnWidth)
                    }
                }
            }
        }
    }

    /// 将items分配到各列，使各列高度尽量平衡
    private func distributeItems() -> [[Item]] {
        var columnItems: [[Item]] = Array(repeating: [], count: columns)
        var columnHeights: [CGFloat] = Array(repeating: 0, count: columns)

        for item in items {
            // 找到当前高度最小的列
            let minHeightIndex = columnHeights.enumerated().min(by: { $0.element < $1.element })?.offset ?? 0

            // 将item添加到该列
            columnItems[minHeightIndex].append(item)

            // 更新该列的高度
            let aspectRatio = getAspectRatio(item)
            let itemHeight = columnWidth / aspectRatio
            columnHeights[minHeightIndex] += itemHeight + spacing
        }

        return columnItems
    }
}

/// 带原始宽高比的照片缩略图
struct AspectRatioThumbnail: View {
    let asset: PHAsset
    let index: Int
    var isEditMode: Bool = false
    var isSelected: Bool = false
    var onTap: (() -> Void)?
    var onLongPress: (() -> Void)?

    @State private var thumbnail: UIImage?
    @State private var aspectRatio: CGFloat = 1.0

    var body: some View {
        ZStack {
            // 背景（加载时显示）
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.graphiteGray.opacity(0.3))

            if let thumbnail = thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .aspectRatio(aspectRatio, contentMode: .fill)
                    .clipped()
                    .cornerRadius(12)
            } else {
                // 加载占位符
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.iosBlue.opacity(0.5)))
            }

            // 边框
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
        .aspectRatio(aspectRatio, contentMode: .fit)
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
        // 获取asset的原始宽高比
        let pixelWidth = CGFloat(asset.pixelWidth)
        let pixelHeight = CGFloat(asset.pixelHeight)

        if pixelWidth > 0 && pixelHeight > 0 {
            aspectRatio = pixelWidth / pixelHeight
        }

        // 加载缩略图
        let size = CGSize(width: 600, height: 600 / aspectRatio)
        HistoryManager.shared.getThumbnail(for: asset, size: size) { image in
            thumbnail = image
        }
    }
}

/// 扩展PHAsset以获取宽高比
extension PHAsset {
    var aspectRatio: CGFloat {
        let width = CGFloat(pixelWidth)
        let height = CGFloat(pixelHeight)
        return width > 0 && height > 0 ? width / height : 1.0
    }
}
