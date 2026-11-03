//
//  AppIconPreview.swift
//  livesnap
//
//  LiveSnap App Icon 设计预览
//  可以截图后用于 App Store 或找设计师参考
//

import SwiftUI

struct AppIconPreview: View {
    @State private var glowIntensity: Double = 0.6
    @State private var rotation: Double = 0

    var body: some View {
        VStack(spacing: 40) {
            Text("LiveSnap App Icon Preview")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.white)

            // 1024x1024 标准尺寸预览
            AppIconDesign(size: 300)
                .frame(width: 300, height: 300)

            // 尺寸说明
            VStack(spacing: 12) {
                Text("Standard Size: 1024 x 1024 pt")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))

                Text("Export this design at @3x resolution")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.5))
            }

            // 不同尺寸预览
            HStack(spacing: 20) {
                VStack(spacing: 8) {
                    AppIconDesign(size: 80)
                        .frame(width: 80, height: 80)
                    Text("80pt")
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.5))
                }

                VStack(spacing: 8) {
                    AppIconDesign(size: 60)
                        .frame(width: 60, height: 60)
                    Text("60pt")
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.5))
                }

                VStack(spacing: 8) {
                    AppIconDesign(size: 40)
                        .frame(width: 40, height: 40)
                    Text("40pt")
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.midnightBlack)
    }
}

// MARK: - App Icon 设计

struct AppIconDesign: View {
    let size: CGFloat
    @State private var glowIntensity: Double = 0.6
    @State private var rotation: Double = 0

    // 根据尺寸动态计算元素大小
    private var iconSize: CGFloat { size * 0.5 }
    private var glowRadius: CGFloat { size * 0.15 }
    private var borderWidth: CGFloat { size * 0.015 }
    private var cornerRadius: CGFloat { size * 0.225 } // iOS 图标圆角比例约 22.5%

    var body: some View {
        ZStack {
            // 背景渐变
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: "1a1d29"), // 深蓝灰
                            Color(hex: "0E0F12"), // 午夜黑
                            Color(hex: "000000")  // 纯黑
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            // 径向渐变光效
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    RadialGradient(
                        colors: [
                            AppTheme.iosBlue.opacity(0.25),
                            Color(hex: "6a0572").opacity(0.15),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: size * 0.6
                    )
                )
                .blendMode(.screen)

            // 主图标容器
            ZStack {
                // 外层光晕（呼吸效果）
                ForEach(0..<3) { index in
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    AppTheme.iosBlue.opacity(glowIntensity * (0.4 - Double(index) * 0.1)),
                                    Color.clear
                                ],
                                center: .center,
                                startRadius: 0,
                                endRadius: iconSize * 0.6 + CGFloat(index) * glowRadius
                            )
                        )
                        .frame(width: iconSize + CGFloat(index) * glowRadius * 2,
                               height: iconSize + CGFloat(index) * glowRadius * 2)
                        .blur(radius: glowRadius * 0.5 + CGFloat(index) * 2)
                }

                // 主圆形背景
                ZStack {
                    // 渐变背景
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    AppTheme.iosBlue,
                                    Color(hex: "0051D5"),
                                    Color(hex: "003DA5"),
                                    AppTheme.iosBlue.opacity(0.9)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: iconSize, height: iconSize)

                    // 动态旋转边框
                    Circle()
                        .strokeBorder(
                            AngularGradient(
                                colors: [
                                    AppTheme.iosBlue.opacity(0.9),
                                    Color(hex: "00d9f5").opacity(0.7),
                                    Color(hex: "6a0572").opacity(0.6),
                                    AppTheme.iosBlue.opacity(0.9)
                                ],
                                center: .center,
                                angle: .degrees(rotation)
                            ),
                            lineWidth: borderWidth * 2
                        )
                        .frame(width: iconSize, height: iconSize)
                        .blur(radius: 0.5)

                    // 顶部高光
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color.white.opacity(0.6),
                                    Color.white.opacity(0.3),
                                    Color.clear
                                ],
                                center: UnitPoint(x: 0.35, y: 0.35),
                                startRadius: 0,
                                endRadius: iconSize * 0.5
                            )
                        )
                        .frame(width: iconSize, height: iconSize)
                        .blendMode(.overlay)

                    // LivePhoto 图标
                    Image(systemName: "livephoto")
                        .font(.system(size: iconSize * 0.45, weight: .medium))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.4), radius: iconSize * 0.03, x: 0, y: iconSize * 0.01)
                }
                .shadow(color: AppTheme.iosBlue.opacity(0.6), radius: glowRadius * 1.5, x: 0, y: size * 0.015)
                .shadow(color: AppTheme.iosBlue.opacity(0.4), radius: glowRadius * 2.5, x: 0, y: size * 0.025)
            }

            // 顶部整体高光叠加
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.08),
                            Color.clear,
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .center
                    )
                )
                .blendMode(.overlay)

            // 底部阴影叠加
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.clear,
                            Color.clear,
                            Color.black.opacity(0.3)
                        ],
                        startPoint: .center,
                        endPoint: .bottom
                    )
                )
                .blendMode(.multiply)
        }
        .frame(width: size, height: size)
        .shadow(color: .black.opacity(0.4), radius: size * 0.03, x: 0, y: size * 0.02)
        .onAppear {
            // 光晕呼吸动画
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                glowIntensity = 0.9
            }

            // 边框旋转动画
            withAnimation(.linear(duration: 8.0).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
    }
}

// MARK: - 扁平化设计版本（备选）

struct AppIconDesignFlat: View {
    let size: CGFloat

    private var iconSize: CGFloat { size * 0.55 }
    private var cornerRadius: CGFloat { size * 0.225 }

    var body: some View {
        ZStack {
            // 纯渐变背景（无光效）
            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            AppTheme.iosBlue,
                            Color(hex: "0051D5"),
                            Color(hex: "003DA5")
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            // LivePhoto 图标（简化版）
            Image(systemName: "livephoto")
                .font(.system(size: iconSize * 0.5, weight: .semibold))
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.3), radius: size * 0.015, x: 0, y: size * 0.01)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - 预览

#if false
#Preview("Premium Icon Design") {
    AppIconPreview()
}

#Preview("Icon Sizes") {
    ZStack {
        AppTheme.midnightBlack.ignoresSafeArea()
        VStack(spacing: 30) {
            HStack(spacing: 30) {
                AppIconDesign(size: 120)
                AppIconDesignFlat(size: 120)
            }
            Text("Premium (Left) vs Flat (Right)")
                .font(.system(size: 14))
                .foregroundColor(.white.opacity(0.7))
        }
    }
}
#endif
