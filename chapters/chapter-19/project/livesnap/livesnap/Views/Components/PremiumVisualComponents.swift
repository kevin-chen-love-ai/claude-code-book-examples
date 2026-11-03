//
//  PremiumVisualComponents.swift
//  livesnap
//
//  高级视觉组件库 - 光影渐变、玻璃态、动态效果
//

import SwiftUI

// MARK: - 渐变背景系统

/// 多层次渐变背景 - 替代单调的纯色背景
struct GradientBackground: View {
    var style: BackgroundStyle = .midnight

    enum BackgroundStyle {
        case midnight      // 午夜渐变
        case cosmic        // 宇宙渐变
        case aurora        // 极光渐变
        case subtle        // 微妙渐变
    }

    var body: some View {
        ZStack {
            // 基础背景色
            AppTheme.midnightBlack

            // 第一层：径向渐变（营造深度）
            RadialGradient(
                colors: gradientColors,
                center: .topLeading,
                startRadius: 0,
                endRadius: 800
            )
            .opacity(gradientOpacity)
            .blendMode(.softLight)

            // 第二层：线性渐变（方向感）
            LinearGradient(
                colors: [
                    Color.white.opacity(0.03),
                    Color.clear,
                    Color.black.opacity(0.1)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // 第三层：噪点纹理（增加质感）
            Color.white
                .opacity(0.015)
                .blendMode(.overlay)
        }
        .ignoresSafeArea()
    }

    private var gradientColors: [Color] {
        switch style {
        case .midnight:
            return [
                Color(hex: "1a1d2e").opacity(0.3),
                Color(hex: "16213e").opacity(0.2),
                AppTheme.midnightBlack
            ]
        case .cosmic:
            return [
                AppTheme.iosBlue.opacity(0.15),
                Color(hex: "6a0572").opacity(0.1),
                AppTheme.midnightBlack
            ]
        case .aurora:
            return [
                Color(hex: "00f5a0").opacity(0.08),
                Color(hex: "00d9f5").opacity(0.06),
                AppTheme.midnightBlack
            ]
        case .subtle:
            return [
                Color.white.opacity(0.05),
                Color.clear,
                AppTheme.midnightBlack
            ]
        }
    }

    private var gradientOpacity: Double {
        switch style {
        case .midnight: return 0.8
        case .cosmic: return 0.6
        case .aurora: return 0.5
        case .subtle: return 1.0
        }
    }
}

// MARK: - 玻璃态卡片

/// 玻璃态卡片 - 毛玻璃效果 + 半透明边框
struct GlassmorphicCard<Content: View>: View {
    let content: Content
    var padding: CGFloat = 20
    var blur: CGFloat = 10
    var opacity: Double = 0.15

    init(padding: CGFloat = 20, blur: CGFloat = 10, opacity: Double = 0.15, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.blur = blur
        self.opacity = opacity
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(
                ZStack {
                    // 毛玻璃背景
                    Color.white
                        .opacity(opacity)
                        .background(.ultraThinMaterial)

                    // 渐变叠加（增加深度）
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.1),
                            Color.white.opacity(0.05)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            )
            .cornerRadius(20)
            .overlay(
                // 渐变边框
                RoundedRectangle(cornerRadius: 20)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.3),
                                Color.white.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.5
                    )
            )
            .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
    }
}

// MARK: - 高级按钮样式

/// 渐变发光按钮 - 带动态光效
struct PremiumButton: View {
    let title: String
    let action: () -> Void
    var style: ButtonStyleType = .primary
    var isLoading: Bool = false

    @State private var isPressed = false
    @State private var glowOpacity: Double = 0.5

    enum ButtonStyleType {
        case primary      // 蓝色渐变
        case premium      // 金色渐变
        case destructive  // 红色渐变
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.9)
                } else {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(
                ZStack {
                    // 主渐变背景
                    LinearGradient(
                        colors: gradientColors,
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

                    // 发光层（呼吸效果）
                    LinearGradient(
                        colors: gradientColors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .opacity(glowOpacity)
                    .blur(radius: 20)
                }
            )
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.4),
                                Color.white.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: gradientColors[0].opacity(0.3), radius: 15, x: 0, y: 8)
            .shadow(color: gradientColors[1].opacity(0.2), radius: 25, x: 0, y: 12)
            .scaleEffect(isPressed ? 0.97 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
        }
        .disabled(isLoading)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    isPressed = true
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                }
                .onEnded { _ in
                    isPressed = false
                }
        )
        .onAppear {
            // 呼吸发光动画
            withAnimation(
                Animation.easeInOut(duration: 2.0)
                    .repeatForever(autoreverses: true)
            ) {
                glowOpacity = 0.8
            }
        }
    }

    private var gradientColors: [Color] {
        switch style {
        case .primary:
            return [AppTheme.iosBlue, Color(hex: "0051D5")]
        case .premium:
            return [Color(hex: "FFD700"), Color(hex: "FFA500")]
        case .destructive:
            return [Color(hex: "FF3B30"), Color(hex: "C41E3A")]
        }
    }
}

// MARK: - 动画渐变边框

/// 动画渐变边框 - 旋转的彩虹边框
struct AnimatedGradientBorder: ViewModifier {
    @State private var rotation: Double = 0
    var lineWidth: CGFloat = 2
    var cornerRadius: CGFloat = 16

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(
                        AngularGradient(
                            colors: [
                                AppTheme.iosBlue,
                                Color(hex: "00d9f5"),
                                Color(hex: "00f5a0"),
                                AppTheme.iosBlue
                            ],
                            center: .center,
                            angle: .degrees(rotation)
                        ),
                        lineWidth: lineWidth
                    )
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 3.0)
                        .repeatForever(autoreverses: false)
                ) {
                    rotation = 360
                }
            }
    }
}

extension View {
    func animatedGradientBorder(lineWidth: CGFloat = 2, cornerRadius: CGFloat = 16) -> some View {
        self.modifier(AnimatedGradientBorder(lineWidth: lineWidth, cornerRadius: cornerRadius))
    }
}

// MARK: - 光效组件

/// 动态光效 - 模拟环境光
struct LightEffect: View {
    var position: LightPosition = .topLeading
    var color: Color = AppTheme.iosBlue
    var intensity: Double = 0.3

    @State private var offset: CGFloat = 0

    enum LightPosition {
        case topLeading, topTrailing, bottomLeading, bottomTrailing, center
    }

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        color.opacity(intensity),
                        color.opacity(intensity * 0.5),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: 200
                )
            )
            .frame(width: 400, height: 400)
            .blur(radius: 60)
            .offset(x: offset, y: offset)
            .animation(
                Animation.easeInOut(duration: 8.0)
                    .repeatForever(autoreverses: true),
                value: offset
            )
            .onAppear {
                offset = 50
            }
    }
}

// MARK: - 纹理背景

/// 纹理背景 - 添加噪点和细节
struct TexturedBackground: View {
    var intensity: Double = 0.02

    var body: some View {
        ZStack {
            // 基础背景
            AppTheme.midnightBlack

            // 噪点层
            Image(systemName: "circle.grid.cross.fill")
                .resizable(resizingMode: .tile)
                .opacity(intensity)
                .blendMode(.overlay)

            // 微妙的渐变
            LinearGradient(
                colors: [
                    Color.white.opacity(0.01),
                    Color.clear,
                    Color.black.opacity(0.02)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

// MARK: - 增强卡片（带内外阴影）

/// 立体卡片 - 内外阴影组合，更强的立体感
struct ElevatedCard<Content: View>: View {
    let content: Content
    var padding: CGFloat = 20
    var isInteractive: Bool = false

    @State private var isPressed = false

    init(padding: CGFloat = 20, isInteractive: Bool = false, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.isInteractive = isInteractive
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(
                ZStack {
                    // 基础背景
                    AppTheme.graphiteGray

                    // 渐变叠加
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.05),
                            Color.clear,
                            Color.black.opacity(0.1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    // 顶部高光
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.1),
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .center
                    )
                }
            )
            .cornerRadius(24)
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.2),
                                Color.white.opacity(0.05)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            // 外阴影（抬升感）
            .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
            .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
            // 内阴影效果（通过overlay模拟）
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(Color.black.opacity(0.2), lineWidth: 0.5)
                    .blur(radius: 2)
                    .offset(y: 1)
                    .mask(RoundedRectangle(cornerRadius: 24).fill(LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom)))
            )
            .scaleEffect(isPressed && isInteractive ? 0.98 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isPressed)
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

// MARK: - 渐变文字

/// 渐变文字效果
struct GradientText: View {
    let text: String
    var size: CGFloat = 17
    var weight: Font.Weight = .bold
    var colors: [Color] = [AppTheme.iosBlue, Color(hex: "00d9f5")]

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: weight))
            .foregroundStyle(
                LinearGradient(
                    colors: colors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }
}

// MARK: - 发光效果

/// 发光效果修饰符
struct GlowEffect: ViewModifier {
    var color: Color = AppTheme.iosBlue
    var radius: CGFloat = 10

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(0.6), radius: radius, x: 0, y: 0)
            .shadow(color: color.opacity(0.3), radius: radius * 2, x: 0, y: 0)
    }
}

extension View {
    func glowEffect(color: Color = AppTheme.iosBlue, radius: CGFloat = 10) -> some View {
        self.modifier(GlowEffect(color: color, radius: radius))
    }
}

// MARK: - 浮动动画

/// 浮动动画效果
struct FloatingAnimation: ViewModifier {
    @State private var isFloating = false
    var amplitude: CGFloat = 10
    var duration: Double = 2.0

    func body(content: Content) -> some View {
        content
            .offset(y: isFloating ? -amplitude : amplitude)
            .animation(
                Animation.easeInOut(duration: duration)
                    .repeatForever(autoreverses: true),
                value: isFloating
            )
            .onAppear {
                isFloating = true
            }
    }
}

extension View {
    func floatingAnimation(amplitude: CGFloat = 10, duration: Double = 2.0) -> some View {
        self.modifier(FloatingAnimation(amplitude: amplitude, duration: duration))
    }
}

// MARK: - 使用示例

#if DEBUG
struct PremiumVisualComponents_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            // 渐变背景
            GradientBackground(style: .cosmic)

            ScrollView {
                VStack(spacing: 32) {
                    // 玻璃态卡片
                    GlassmorphicCard {
                        VStack(alignment: .leading, spacing: 12) {
                            GradientText(text: "Glassmorphic Card", size: 20)
                            Text("This is a beautiful glassmorphic card with blur effect")
                                .font(.system(size: 14))
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }

                    // 高级按钮
                    VStack(spacing: 16) {
                        PremiumButton(title: "Primary Button", action: {}, style: .primary)
                        PremiumButton(title: "Premium Button", action: {}, style: .premium)
                        PremiumButton(title: "Destructive Button", action: {}, style: .destructive)
                    }

                    // 立体卡片
                    ElevatedCard(isInteractive: true) {
                        VStack(spacing: 12) {
                            Text("Elevated Card")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundColor(AppTheme.primaryText)
                            Text("With inner and outer shadows")
                                .font(.system(size: 14))
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    }

                    // 动画边框
                    VStack {
                        Text("Animated Border")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(AppTheme.primaryText)
                            .padding()
                    }
                    .background(AppTheme.graphiteGray)
                    .cornerRadius(16)
                    .animatedGradientBorder()
                }
                .padding()
            }
        }
    }
}
#endif
