//
//  VisualComponents.swift
//  livesnap
//
//  统一视觉组件库 - 确保所有页面视觉风格一致
//

import SwiftUI

// MARK: - 统一导航栏背景
// 注意：GlassNavBackground 已在 VideoSelectionView 中定义，这里不再重复定义

// MARK: - 高级感扫光动效 (Shimmer Effect)
struct ShimmerEffect: ViewModifier {
    @State private var phase: CGFloat = 0
    let duration: Double
    let delay: Double
    
    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    ZStack {
                        // 扫光渐变
                        LinearGradient(
                            colors: [
                                .clear,
                                .white.opacity(0.1),
                                .white.opacity(0.4),
                                .white.opacity(0.1),
                                .clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 0.4) // 扫光带宽度
                        .offset(x: -geometry.size.width * 0.5 + phase * (geometry.size.width * 2))
                    }
                }
                .mask(content)
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: duration)
                        .repeatForever(autoreverses: false)
                        .delay(delay)
                ) {
                    phase = 1
                }
            }
    }
}

extension View {
    /// 添加扫面扫光效果
    func shimmer(duration: Double = 2.0, delay: Double = 1.0) -> some View {
        self.modifier(ShimmerEffect(duration: duration, delay: delay))
    }
}

// MARK: - 增强的按钮样式（带 Haptic 反馈和精细动画）
struct EnhancedButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    var hapticStyle: UIImpactFeedbackGenerator.FeedbackStyle? = .soft
    
    private static var previousPressedStates: [UUID: Bool] = [:]
    private let id = UUID()
    
    func makeBody(configuration: Configuration) -> some View {
        let isPressed = configuration.isPressed
        
        // 触发 haptic 反馈（只在按下时触发一次）
        if isPressed, let hapticStyle = hapticStyle {
            let wasPreviouslyPressed = Self.previousPressedStates[id] ?? false
            if !wasPreviouslyPressed {
                let generator = UIImpactFeedbackGenerator(style: hapticStyle)
                generator.prepare()
                generator.impactOccurred()
                Self.previousPressedStates[id] = true
            }
        } else {
            Self.previousPressedStates[id] = false
        }
        
        return configuration.label
            .scaleEffect(isPressed ? scale : 1.0)
            .opacity(isPressed ? 0.9 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: isPressed)
    }
}

// MARK: - 统一主按钮样式
struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isEnabled: Bool = true
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.9)
                } else {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold, design: .default))
                        .foregroundColor(.white)
                        .tracking(-0.2) // 精细的字符间距
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56) // 原型规范：52-56
            .background(
                Group {
                    if isEnabled {
                        AppTheme.iosBlue
                    } else {
                        AppTheme.iosBlue.opacity(0.5)
                    }
                }
            )
            .cornerRadius(16) // 原型规范：14-16
            // 多层阴影效果，增加质感
            .shadow(
                color: AppTheme.Shadow.button.color,
                radius: AppTheme.Shadow.button.radius,
                x: AppTheme.Shadow.button.x,
                y: AppTheme.Shadow.button.y
            )
            .shadow(
                color: AppTheme.Shadow.glow.color,
                radius: AppTheme.Shadow.glow.radius,
                x: AppTheme.Shadow.glow.x,
                y: AppTheme.Shadow.glow.y
            )
            // 内层边框，增加精致感
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.25), // 增强顶部高光
                                Color.white.opacity(0.05)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shimmer(duration: 3.0, delay: 2.0) // 添加周期性扫光
        }
        .disabled(!isEnabled || isLoading)
        .buttonStyle(EnhancedButtonStyle(scale: 0.97, hapticStyle: .medium))
    }
}

// MARK: - 统一次按钮样式
struct SecondaryButton: View {
    let title: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .medium, design: .default))
                .foregroundColor(AppTheme.primaryText)
                .tracking(-0.2)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(
                    ZStack {
                        AppTheme.graphiteGray
                        // 微妙的渐变叠加
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.03),
                                Color.white.opacity(0.0)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
                )
                .cornerRadius(14)
                // 边框和阴影
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(AppTheme.Border.medium.color, lineWidth: AppTheme.Border.medium.width)
                )
                .shadow(
                    color: AppTheme.Shadow.subtle.color,
                    radius: AppTheme.Shadow.subtle.radius,
                    x: AppTheme.Shadow.subtle.x,
                    y: AppTheme.Shadow.subtle.y
                )
        }
        .buttonStyle(EnhancedButtonStyle(scale: 0.98, hapticStyle: .light))
    }
}

// MARK: - 统一卡片样式（带微妙的交互效果和精细细节）
struct SystemCard<Content: View>: View {
    let content: Content
    var padding: CGFloat = AppTheme.Layout.cardPadding
    var isInteractive: Bool = false
    var elevation: CardElevation = .normal
    
    @State private var isPressed: Bool = false
    
    enum CardElevation {
        case normal
        case elevated
    }
    
    init(padding: CGFloat = AppTheme.Layout.cardPadding, isInteractive: Bool = false, elevation: CardElevation = .normal, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.isInteractive = isInteractive
        self.elevation = elevation
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(padding)
            .background(
                ZStack {
                    // 基础背景
                    AppTheme.graphiteGray
                    
                    // 背景噪点/纹理效果 (微妙的细节)
                    Color.white.opacity(0.01)
                        .blendMode(.overlay)
                    
                    // 微妙的渐变叠加（增加深度感）
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.03),
                            Color.white.opacity(0.0)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            )
            .cornerRadius(AppTheme.CornerRadius.card)
            // 多层边框效果
            .overlay(
                ZStack {
                    // 外层边框（更亮）
                    RoundedRectangle(cornerRadius: AppTheme.CornerRadius.card)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(isPressed && isInteractive ? 0.15 : 0.1),
                                    Color.white.opacity(isPressed && isInteractive ? 0.08 : 0.05)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.0
                        )
                    
                    // 内层极细高光边框 (catch light)
                    RoundedRectangle(cornerRadius: AppTheme.CornerRadius.card)
                        .stroke(Color.white.opacity(0.05), lineWidth: 0.5)
                        .padding(0.5)
                    
                    // 内层边框（更暗，增加深度）
                    RoundedRectangle(cornerRadius: AppTheme.CornerRadius.card - 1)
                        .stroke(Color.black.opacity(0.3), lineWidth: 0.5)
                        .padding(0.5)
                }
            )
            // 阴影效果（根据 elevation）
            .shadow(
                color: elevation == .elevated ? AppTheme.Shadow.cardElevated.color : AppTheme.Shadow.card.color,
                radius: elevation == .elevated ? AppTheme.Shadow.cardElevated.radius : AppTheme.Shadow.card.radius,
                x: elevation == .elevated ? AppTheme.Shadow.cardElevated.x : AppTheme.Shadow.card.x,
                y: elevation == .elevated ? AppTheme.Shadow.cardElevated.y : AppTheme.Shadow.card.y
            )
            .scaleEffect(isPressed && isInteractive ? 0.99 : 1.0)
            .opacity(isPressed && isInteractive ? 0.95 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isPressed)
            .onTapGesture {
                if isInteractive {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                }
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if isInteractive {
                            isPressed = true
                        }
                    }
                    .onEnded { _ in
                        if isInteractive {
                            isPressed = false
                        }
                    }
            )
    }
}

// MARK: - 统一标题样式
struct SystemTitle: View {
    let text: String
    var size: CGFloat = 17
    var weight: Font.Weight = .semibold
    var lineHeight: CGFloat? = nil
    var useGradient: Bool = false
    
    var body: some View {
        if useGradient {
            Text(text)
                .font(.system(size: size, weight: weight, design: .default))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            AppTheme.primaryText,
                            AppTheme.primaryText.opacity(0.8)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .tracking(-0.5)
                .lineSpacing(lineHeight != nil ? lineHeight! - size : 0)
        } else {
            Text(text)
                .font(.system(size: size, weight: weight, design: .default))
                .foregroundColor(AppTheme.primaryText)
                .tracking(-0.4) // 精细的字符间距调整
                .lineSpacing(lineHeight != nil ? lineHeight! - size : 0) // 可选的行高调整
        }
    }
}

// MARK: - 统一副标题样式
struct SystemSubtitle: View {
    let text: String
    var size: CGFloat = 14
    var lineHeight: CGFloat? = nil
    
    var body: some View {
        Text(text)
            .font(.system(size: size, design: .default))
            .foregroundColor(AppTheme.secondaryText)
            .lineSpacing(lineHeight != nil ? lineHeight! - size : 0)
    }
}

// MARK: - 统一标签样式（用于 PRO 等）- 增强细节
struct SystemBadge: View {
    let text: String
    var type: BadgeType = .blue
    
    enum BadgeType {
        case blue
        case premium
        case gold
        case success
    }

    private var gradientColors: [Color] {
        switch type {
        case .blue:
            return [AppTheme.iosBlue, AppTheme.iosBlue.opacity(0.7)]
        case .premium:
            return [Color(hex: "FF3B30"), Color(hex: "FF2D55")] // iOS Red gradient
        case .gold:
            return [Color(hex: "FFD700"), Color(hex: "FFA500")] // Gold/Orange gradient
        case .success:
            return [Color(hex: "34C759"), Color(hex: "30D158")] // iOS Green gradient
        }
    }
    
    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .bold, design: .default))
            .foregroundColor(.white)
            .tracking(1.5)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                ZStack {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: gradientColors,
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    
                    // Gloss overlay
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    .white.opacity(0.35),
                                    .white.opacity(0.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
            )
            .overlay(
                Capsule()
                    .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
            )
            .shadow(color: gradientColors[0].opacity(0.3), radius: 6, x: 0, y: 3)
            .onAppear {
                if type == .premium || type == .gold {
                    // Premium/Gold 徽章默认带扫光
                }
            }
            .shimmer(duration: 2.5, delay: 1.5)
    }
}

// MARK: - 统一导航栏头部
struct SystemNavHeader: View {
    let title: String
    let leadingAction: (() -> Void)?
    let trailingAction: (() -> Void)?
    let trailingTitle: String?
    
    init(
        title: String,
        leadingAction: (() -> Void)? = nil,
        trailingAction: (() -> Void)? = nil,
        trailingTitle: String? = nil
    ) {
        self.title = title
        self.leadingAction = leadingAction
        self.trailingAction = trailingAction
        self.trailingTitle = trailingTitle
    }
    
    var body: some View {
        HStack(spacing: 12) {
            if let leadingAction = leadingAction {
                Button {
                    leadingAction()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .light))
                        .foregroundColor(AppTheme.primaryText.opacity(0.6))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(EnhancedButtonStyle(scale: 0.92, hapticStyle: .light))
            } else {
                Spacer()
                    .frame(width: 40)
            }
            
            Spacer()
            
            SystemTitle(text: title, size: 17, weight: .semibold)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            
            Spacer()
            
            if let trailingAction = trailingAction {
                if let trailingTitle = trailingTitle {
                    Button {
                        trailingAction()
                    } label: {
                        Text(trailingTitle)
                            .font(.system(size: 17, weight: .medium))
                            .foregroundColor(AppTheme.iosBlue)
                            .tracking(-0.2)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .buttonStyle(EnhancedButtonStyle(scale: 0.95, hapticStyle: .light))
                    .frame(width: 60) // 固定宽度，避免超出边界
                } else {
                    Button {
                        trailingAction()
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 18))
                            .foregroundColor(AppTheme.primaryText.opacity(0.6))
                            .frame(width: 40, height: 40)
                    }
                    .buttonStyle(EnhancedButtonStyle(scale: 0.92, hapticStyle: .light))
                }
            } else {
                Spacer()
                    .frame(width: 40)
            }
        }
        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
        .padding(.top, 12) // 顶部 padding，确保内容不被 Dynamic Island 遮挡
        .padding(.bottom, 12)
        .frame(maxWidth: AppTheme.Layout.maxContentWidth)
        .frame(maxWidth: .infinity)
        .background(
            GlassNavBackground()
                .ignoresSafeArea(edges: .top)
        )
    }
}

// MARK: - 统一分段控制器样式（带精细动画）
struct SystemSegmentedControl: View {
    @Binding var selection: Int
    let items: [String]
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selection = index
                    }
                    // 轻触觉反馈
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                } label: {
                    Text(item)
                        .font(.system(size: 14, weight: .medium, design: .default))
                        .foregroundColor(selection == index ? AppTheme.primaryText : AppTheme.primaryText.opacity(0.5))
                        .tracking(-0.2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            Group {
                                if selection == index {
                                    ZStack {
                                        // 选中状态的背景
                                        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.small)
                                            .fill(
                                                LinearGradient(
                                                    colors: [
                                                        Color.white.opacity(0.12),
                                                        Color.white.opacity(0.08)
                                                    ],
                                                    startPoint: .topLeading,
                                                    endPoint: .bottomTrailing
                                                )
                                            )
                                        
                                        // 内层高光
                                        RoundedRectangle(cornerRadius: AppTheme.CornerRadius.small - 1)
                                            .fill(Color.white.opacity(0.05))
                                            .padding(1)
                                    }
                                } else {
                                    Color.clear
                                }
                            }
                        )
                        .cornerRadius(AppTheme.CornerRadius.small)
                        .overlay(
                            Group {
                                if selection == index {
                                    RoundedRectangle(cornerRadius: AppTheme.CornerRadius.small)
                                        .stroke(
                                            LinearGradient(
                                                colors: [
                                                    Color.white.opacity(0.2),
                                                    Color.white.opacity(0.1)
                                                ],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            ),
                                            lineWidth: 0.5
                                        )
                                }
                            }
                        )
                        .shadow(
                            color: selection == index ? Color.black.opacity(0.2) : Color.clear,
                            radius: selection == index ? 4 : 0,
                            x: 0,
                            y: selection == index ? 2 : 0
                        )
                }
                .buttonStyle(EnhancedButtonStyle(scale: 0.98, hapticStyle: nil)) // 已在按钮中处理 haptic
            }
        }
        .padding(4)
        .background(
            ZStack {
                AppTheme.graphiteGray
                // 微妙的渐变叠加
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.02),
                        Color.white.opacity(0.0)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        )
        .cornerRadius(AppTheme.CornerRadius.medium)
        // 多层边框效果
        .overlay(
            ZStack {
                // 外层边框
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.08),
                                Color.white.opacity(0.04)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: AppTheme.Border.medium.width
                    )
                
                // 内层边框（增加深度）
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium - 1)
                    .stroke(Color.black.opacity(0.2), lineWidth: 0.5)
                    .padding(0.5)
            }
        )
        .shadow(
            color: AppTheme.Shadow.subtle.color,
            radius: AppTheme.Shadow.subtle.radius,
            x: AppTheme.Shadow.subtle.x,
            y: AppTheme.Shadow.subtle.y
        )
    }
}

// MARK: - 统一空状态视图（带微妙的呼吸动画）
struct SystemEmptyState: View {
    let icon: String
    let title: String
    let message: String
    
    @State private var iconScale: CGFloat = 1.0
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppTheme.systemGray.opacity(0.5))
                .scaleEffect(iconScale)
                .onAppear {
                    withAnimation(
                        Animation.easeInOut(duration: 2.0)
                            .repeatForever(autoreverses: true)
                    ) {
                        iconScale = 0.95
                    }
                }
            
            VStack(spacing: 8) {
                SystemTitle(text: title, size: 17, weight: .semibold)
                SystemSubtitle(text: message)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - 统一设置行样式
struct SystemSettingsRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let trailing: AnyView?
    
    init(
        icon: String,
        iconColor: Color = AppTheme.iosBlue,
        title: String,
        @ViewBuilder trailing: () -> some View = { EmptyView() }
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.trailing = AnyView(trailing())
    }
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(iconColor)
                .frame(width: 40, height: 40)
                .background(AppTheme.graphiteGray)
                .cornerRadius(20)
            
            SystemTitle(text: title, size: 16, weight: .medium)
            
            Spacer()
            
            if let trailing = trailing {
                trailing
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
    }
}

// MARK: - 统一内容容器（带最大宽度限制）
struct SystemContentContainer<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .frame(maxWidth: AppTheme.Layout.maxContentWidth)
            .frame(maxWidth: .infinity)
    }
}

// MARK: - 分隔线组件（精细的视觉分隔）
struct SystemDivider: View {
    var color: Color = AppTheme.Border.divider.color
    var width: CGFloat = AppTheme.Border.divider.width
    var padding: CGFloat = AppTheme.Layout.horizontalPadding
    
    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [
                        Color.clear,
                        color,
                        Color.clear
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(height: width)
            .padding(.horizontal, padding)
    }
}

// MARK: - 页面过渡动画
extension View {
    /// 添加页面进入动画
    func pageTransition() -> some View {
        self
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .move(edge: .bottom).combined(with: .scale(scale: 0.98))),
                removal: .opacity.combined(with: .move(edge: .top))
            ))
            .animation(.spring(response: 0.4, dampingFraction: 0.85), value: UUID())
    }
}

// MARK: - iOS 17+ 安全区域适配
extension View {
    /// 统一的安全区域背景填充
    func systemBackground() -> some View {
        self.background(AppTheme.midnightBlack.ignoresSafeArea(.all))
    }
    
    /// 统一的页面容器（带安全区域和最大宽度）
    func systemPageContainer() -> some View {
        self
            .systemBackground()
            .frame(maxWidth: AppTheme.Layout.maxContentWidth)
            .frame(maxWidth: .infinity)
    }
}
