//
//  BrandHeader.swift
//  livesnap
//
//  品牌头部组件 - LiveSnap Logo + Slogan
//  精心设计的品牌展示，包含光影效果和微妙动画
//

import SwiftUI

struct BrandHeader: View {
    @State private var glowOpacity: Double = 0.4
    @State private var sloganOpacity: Double = 0
    @State private var logoScale: CGFloat = 0.98

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Logo 部分：图标 + 文字
            HStack(spacing: 8) {
                // LivePhoto 图标
                ZStack {
                    // 外层发光光圈
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    AppTheme.iosBlue.opacity(glowOpacity * 0.6),
                                    Color.clear
                                ],
                                center: .center,
                                startRadius: 0,
                                endRadius: 20
                            )
                        )
                        .frame(width: 40, height: 40)
                        .blur(radius: 6)

                    // 图标容器
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    AppTheme.iosBlue,
                                    AppTheme.iosBlue.opacity(0.8)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 28, height: 28)
                        .overlay(
                            // 顶部高光
                            Circle()
                                .fill(
                                    RadialGradient(
                                        colors: [
                                            Color.white.opacity(0.4),
                                            Color.clear
                                        ],
                                        center: UnitPoint(x: 0.3, y: 0.3),
                                        startRadius: 0,
                                        endRadius: 14
                                    )
                                )
                        )
                        .shadow(color: AppTheme.iosBlue.opacity(0.4), radius: 8, x: 0, y: 2)

                    // LivePhoto 图标
                    Image(systemName: "livephoto")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                }
                .scaleEffect(logoScale)

                // LiveSnap 文字
                Text("LiveSnap")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                AppTheme.primaryText,
                                AppTheme.primaryText.opacity(0.9),
                                AppTheme.primaryText.opacity(0.85)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: AppTheme.iosBlue.opacity(0.15), radius: 8, x: 0, y: 2)

                Spacer()
            }

            // Slogan 部分：精美的副标题
            HStack(spacing: 6) {
                // 装饰性小图标
                Image(systemName: "sparkle")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                AppTheme.iosBlue.opacity(0.7),
                                Color(hex: "00d9f5").opacity(0.6)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Turn videos into magical Live Photos")
                    .font(.system(size: 12, weight: .medium, design: .default))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                AppTheme.primaryText.opacity(0.6),
                                AppTheme.primaryText.opacity(0.5)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .tracking(0.3)

                Spacer()
            }
            .opacity(sloganOpacity)
        }
        .onAppear {
            // 微妙的呼吸动画
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                glowOpacity = 0.7
                logoScale = 1.0
            }

            // Slogan 淡入
            withAnimation(.easeOut(duration: 0.8).delay(0.3)) {
                sloganOpacity = 1.0
            }
        }
    }
}

// MARK: - Premium Brand Header (更高级的版本，带更多效果)

struct PremiumBrandHeader: View {
    @State private var glowIntensity: Double = 0.4
    @State private var shimmerOffset: CGFloat = -2
    @State private var particleOffset: CGFloat = 0
    @State private var sloganOpacity: Double = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Logo 主体
            HStack(spacing: 10) {
                // 高级图标设计
                ZStack {
                    // 多层发光光圈
                    ForEach(0..<2) { index in
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        AppTheme.iosBlue.opacity(glowIntensity * (0.5 - Double(index) * 0.15)),
                                        Color.clear
                                    ],
                                    center: .center,
                                    startRadius: 0,
                                    endRadius: 22 + CGFloat(index) * 12
                                )
                            )
                            .frame(width: 44 + CGFloat(index) * 24, height: 44 + CGFloat(index) * 24)
                            .blur(radius: 8 + CGFloat(index) * 4)
                    }

                    // 主图标容器
                    ZStack {
                        // 渐变背景
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        AppTheme.iosBlue,
                                        Color(hex: "0051D5"),
                                        AppTheme.iosBlue.opacity(0.85)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 32, height: 32)

                        // 动态边框
                        Circle()
                            .strokeBorder(
                                AngularGradient(
                                    colors: [
                                        AppTheme.iosBlue.opacity(0.8),
                                        Color(hex: "00d9f5").opacity(0.6),
                                        AppTheme.iosBlue.opacity(0.8)
                                    ],
                                    center: .center,
                                    angle: .degrees(particleOffset * 360)
                                ),
                                lineWidth: 1.5
                            )
                            .frame(width: 32, height: 32)
                            .blur(radius: 0.5)

                        // 顶部高光
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color.white.opacity(0.5),
                                        Color.clear
                                    ],
                                    center: UnitPoint(x: 0.35, y: 0.35),
                                    startRadius: 0,
                                    endRadius: 16
                                )
                            )
                            .frame(width: 32, height: 32)
                            .blendMode(.overlay)

                        // 图标
                        Image(systemName: "livephoto")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white)
                            .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)

                        // 扫光效果
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.clear,
                                        Color.white.opacity(0.25),
                                        Color.white.opacity(0.5),
                                        Color.white.opacity(0.25),
                                        Color.clear
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: 20, height: 50)
                            .rotationEffect(.degrees(-45))
                            .offset(x: shimmerOffset * 40)
                            .mask(
                                Circle()
                                    .frame(width: 32, height: 32)
                            )
                    }
                    .shadow(color: AppTheme.iosBlue.opacity(0.5), radius: 12, x: 0, y: 4)
                    .shadow(color: AppTheme.iosBlue.opacity(0.3), radius: 20, x: 0, y: 8)
                }
                .frame(width: 44, height: 44)

                // LiveSnap 主标题
                Text("LiveSnap")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                AppTheme.primaryText,
                                AppTheme.primaryText.opacity(0.95),
                                Color(hex: "00d9f5").opacity(0.3)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: AppTheme.iosBlue.opacity(0.2), radius: 10, x: 0, y: 3)

                Spacer()
            }

            // Slogan 副标题（精简版）
            HStack(spacing: 6) {
                // 精简装饰图标
                Image(systemName: "sparkles")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                AppTheme.iosBlue.opacity(0.7),
                                Color(hex: "00d9f5").opacity(0.6)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Video to Live Photo")
                    .font(.system(size: 12, weight: .medium, design: .default))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                AppTheme.primaryText.opacity(0.65),
                                AppTheme.primaryText.opacity(0.5)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .tracking(0.3)

                Spacer()
            }
            .opacity(sloganOpacity)
        }
        .onAppear {
            // 光晕呼吸
            withAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: true)) {
                glowIntensity = 0.8
            }

            // 边框旋转
            withAnimation(.linear(duration: 8.0).repeatForever(autoreverses: false)) {
                particleOffset = 1.0
            }

            // 扫光效果
            withAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: false).delay(1.0)) {
                shimmerOffset = 2.0
            }

            // Slogan 淡入
            withAnimation(.easeOut(duration: 1.0).delay(0.5)) {
                sloganOpacity = 1.0
            }
        }
    }
}

// MARK: - Premium Pro Badge (独立组件，使用高级样式)

struct PremiumProBadge: View {
    @State private var glowIntensity: Double = 0.3

    var body: some View {
        HStack(spacing: 3) {
            // 装饰性圆点
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(hex: "FFD700"),
                            Color(hex: "FFA500")
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: 2
                    )
                )
                .frame(width: 4, height: 4)
                .shadow(color: Color(hex: "FFD700").opacity(glowIntensity), radius: 3, x: 0, y: 0)

            Text("PRO")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(0.8)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(hex: "FFD700"),
                            Color(hex: "FFA500")
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(
            ZStack {
                // 背景渐变
                RoundedRectangle(cornerRadius: 6)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(hex: "1a1a1a"),
                                Color(hex: "0a0a0a")
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                // 金色边框
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color(hex: "FFD700").opacity(0.6),
                                Color(hex: "FFA500").opacity(0.4)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )

                // 内部发光
                RoundedRectangle(cornerRadius: 6)
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(hex: "FFD700").opacity(glowIntensity * 0.5),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: 20
                        )
                    )
            }
        )
        .shadow(color: Color(hex: "FFD700").opacity(0.3), radius: 4, x: 0, y: 2)
        .onAppear {
            // 微妙的呼吸光效
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                glowIntensity = 0.6
            }
        }
    }
}

// MARK: - 预览

#if false
#Preview("Standard Brand Header") {
    ZStack {
        AppTheme.midnightBlack.ignoresSafeArea()
        VStack {
            BrandHeader()
                .padding()
            Spacer()
        }
    }
}

#Preview("Premium Brand Header") {
    ZStack {
        GradientBackground(style: .midnight)
        VStack {
            PremiumBrandHeader()
                .padding()
            Spacer()
        }
    }
}

#Preview("Premium Pro Badge") {
    ZStack {
        AppTheme.midnightBlack.ignoresSafeArea()
        VStack {
            HStack {
                Text("LiveSnap")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(AppTheme.primaryText)

                PremiumProBadge()

                Spacer()
            }
            .padding()
            Spacer()
        }
    }
}
#endif
