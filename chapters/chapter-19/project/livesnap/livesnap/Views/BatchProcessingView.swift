//
//  BatchProcessingView.swift
//  livesnap
//
//  批量处理进度视图
//

import SwiftUI

struct BatchProcessingView: View {
    let total: Int
    let current: Int
    let progress: Double
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ZStack {
            AppTheme.midnightBlack.ignoresSafeArea(.all)
            
            VStack(spacing: 0) {
                Spacer()
                
                // Progress Ring（增强版 - 带渐变和光晕效果）
                ZStack {
                    // 背景圆环
                    Circle()
                        .stroke(AppTheme.iosBlue.opacity(0.1), lineWidth: 8)
                        .frame(width: 224, height: 224)
                    
                    // 进度圆环（带渐变）
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    AppTheme.iosBlue,
                                    AppTheme.iosBlue.opacity(0.7)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .frame(width: 224, height: 224)
                        .rotationEffect(.degrees(-90))
                        .shadow(color: AppTheme.iosBlue.opacity(0.3), radius: 8, x: 0, y: 0)
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: progress)
                    
                    // 文字信息
                    VStack(spacing: 8) {
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: 36, weight: .bold, design: .default))
                            .foregroundColor(AppTheme.primaryText)
                            .contentTransition(.numericText())
                        
                        Text("\(current) / \(total)")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                .padding(.bottom, 48)
                
                // Status Text（增强版 - 带精细动画）
                VStack(spacing: 8) {
                    Text("Converting Videos...")
                        .font(.system(size: 24, weight: .semibold, design: .default))
                        .foregroundColor(AppTheme.primaryText)
                        .tracking(-0.3)
                    
                    Text("Processing video \(current) of \(total)")
                        .font(.system(size: 16, design: .default))
                        .foregroundColor(AppTheme.secondaryText)
                        .tracking(-0.2)
                }
                .padding(.bottom, 48)
                
                Spacer()
                
                // Cancel Button
                Button {
                    dismiss()
                } label: {
                    Text("Cancel")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppTheme.secondaryText)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(24)
                }
                .padding(.bottom, 48)
            }
            .padding(.horizontal, 32)
        }
    }
}

#if false
#Preview {
    BatchProcessingView(total: 5, current: 2, progress: 0.4)
}
#endif
