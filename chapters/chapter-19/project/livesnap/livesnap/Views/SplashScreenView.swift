//
//  SplashScreenView.swift
//  livesnap
//
//  LiveSnap 启动动画页面 - 带有光影渐变效果的 Logo 动画
//

import SwiftUI

struct SplashScreenView: View {
    @State private var phase: CGFloat = 0
    @State private var logoScale: CGFloat = 0.5
    @State private var logoOpacity: Double = 0
    @State private var glowIntensity: Double = 0
    @State private var shimmerOffset: CGFloat = -2
    @State private var textOpacity: Double = 0
    @State private var textLetterSpacing: CGFloat = -5

    let onComplete: () -> Void

    var body: some View {
        ZStack {
            // 背景渐变
            GradientBackground(style: .midnight)
                .ignoresSafeArea()

            // 动态环境光效
            LightEffect(position: .topLeading, color: AppTheme.iosBlue, intensity: 0.15)
                .offset(x: -100, y: -100)
                .opacity(glowIntensity)

            LightEffect(position: .bottomTrailing, color: Color(hex: "6a0572"), intensity: 0.1)
                .offset(x: 100, y: 100)
                .opacity(glowIntensity)

            VStack(spacing: 32) {
                // Logo 图标
                ZStack {
                    // 外层发光光圈（多层）
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        AppTheme.iosBlue.opacity(0.4 - Double(index) * 0.1),
                                        Color.clear
                                    ],
                                    center: .center,
                                    startRadius: 0,
                                    endRadius: 80 + CGFloat(index) * 20
                                )
                            )
                            .frame(width: 160 + CGFloat(index) * 40, height: 160 + CGFloat(index) * 40)
                            .blur(radius: 20 + CGFloat(index) * 10)
                            .opacity(glowIntensity * (1.0 - Double(index) * 0.3))
                    }

                    // Logo 主体容器
                    ZStack {
                        // 背景渐变圆
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        AppTheme.iosBlue,
                                        Color(hex: "0051D5"),
                                        Color(hex: "6a0572").opacity(0.8)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 120, height: 120)

                        // 动态旋转渐变边框
                        Circle()
                            .strokeBorder(
                                AngularGradient(
                                    colors: [
                                        AppTheme.iosBlue,
                                        Color(hex: "00d9f5"),
                                        Color(hex: "6a0572"),
                                        AppTheme.iosBlue
                                    ],
                                    center: .center,
                                    angle: .degrees(phase * 360)
                                ),
                                lineWidth: 3
                            )
                            .frame(width: 120, height: 120)
                            .blur(radius: 1)

                        // 顶部高光
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color.white.opacity(0.5),
                                        Color.clear
                                    ],
                                    center: UnitPoint(x: 0.3, y: 0.3),
                                    startRadius: 0,
                                    endRadius: 60
                                )
                            )
                            .frame(width: 120, height: 120)
                            .blendMode(.overlay)

                        // LivePhoto 图标
                        Image(systemName: "livephoto")
                            .font(.system(size: 56, weight: .light))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [
                                        .white,
                                        Color.white.opacity(0.9)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)

                        // 扫光效果
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.clear,
                                        Color.white.opacity(0.3),
                                        Color.white.opacity(0.6),
                                        Color.white.opacity(0.3),
                                        Color.clear
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: 40, height: 200)
                            .rotationEffect(.degrees(-45))
                            .offset(x: shimmerOffset * 100)
                            .mask(
                                Circle()
                                    .frame(width: 120, height: 120)
                            )
                    }
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)
                }
                .frame(height: 200)

                // LiveSnap 文字
                VStack(spacing: 8) {
                    Text("LiveSnap")
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    .white,
                                    Color.white.opacity(0.9),
                                    Color(hex: "00d9f5").opacity(0.7)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .tracking(textLetterSpacing)
                        .shadow(color: AppTheme.iosBlue.opacity(0.5), radius: 20, x: 0, y: 10)
                        .opacity(textOpacity)

                    Text("Create magical Live Photos")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(.white.opacity(0.6))
                        .tracking(1)
                        .opacity(textOpacity * 0.8)
                }
            }
        }
        .onAppear {
            startAnimation()
        }
    }

    private func startAnimation() {
        // 第一阶段：Logo 淡入和缩放 (0-0.6s)
        withAnimation(.spring(response: 0.8, dampingFraction: 0.6)) {
            logoScale = 1.0
            logoOpacity = 1.0
        }

        // 光晕逐渐出现 (0-0.8s)
        withAnimation(.easeOut(duration: 0.8)) {
            glowIntensity = 1.0
        }

        // 第二阶段：旋转渐变边框持续旋转 (0.3s 后开始)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            withAnimation(.linear(duration: 3.0).repeatForever(autoreverses: false)) {
                phase = 1.0
            }
        }

        // 第三阶段：扫光效果 (0.5s 后开始)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            withAnimation(.easeInOut(duration: 1.2)) {
                shimmerOffset = 2.0
            }
        }

        // 第四阶段：文字淡入 (0.8s 后开始)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeOut(duration: 0.6)) {
                textOpacity = 1.0
                textLetterSpacing = 2.0
            }
        }

        // 第五阶段：光晕呼吸效果 (1.0s 后开始)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                glowIntensity = 0.7
            }
        }

        // 完成动画，延迟 2.5 秒后关闭启动屏
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            // 淡出动画
            withAnimation(.easeOut(duration: 0.4)) {
                logoOpacity = 0
                textOpacity = 0
                glowIntensity = 0
            }

            // 完成后回调
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                onComplete()
            }
        }
    }
}

#if false
#Preview {
    SplashScreenView(onComplete: {})
}
#endif
