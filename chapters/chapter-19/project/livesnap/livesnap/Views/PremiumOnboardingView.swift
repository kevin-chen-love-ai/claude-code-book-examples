//
//  PremiumOnboardingView.swift
//  livesnap
//
//  Pro 引导页面
//

import SwiftUI

struct PremiumOnboardingView: View {
    @Environment(\.dismiss) var dismiss
    @State private var showProUpgrade = false
    
    var body: some View {
        ZStack {
            AppTheme.midnightBlack.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Livesnap")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppTheme.primaryText.opacity(0.6))
                    
                    Spacer()
                    
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 18))
                            .foregroundColor(AppTheme.primaryText.opacity(0.6))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                
                Spacer()
                
                // iPhone Mockup
                ZStack {
                    // Glow Effect
                    Circle()
                        .fill(AppTheme.iosBlue.opacity(0.1))
                        .frame(width: 256, height: 256)
                        .blur(radius: 100)
                    
                    // iPhone Frame
                    VStack(spacing: 0) {
                        // Status Bar
                        HStack {
                            Text("9:41")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                            
                            Spacer()
                            
                            HStack(spacing: 4) {
                                Image(systemName: "signal.bars")
                                    .font(.system(size: 10))
                                Image(systemName: "wifi")
                                    .font(.system(size: 10))
                                Image(systemName: "battery.100")
                                    .font(.system(size: 10))
                            }
                            .foregroundColor(.white)
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                        
                        // Mock Image
                        RoundedRectangle(cornerRadius: 0)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color(hex: "FF6B9D"),
                                        Color(hex: "C44569")
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(maxWidth: .infinity)
                            .overlay(
                                VStack {
                                    Spacer()
                                    Image(systemName: "hand.tap.fill")
                                        .font(.system(size: 32))
                                        .foregroundColor(.white.opacity(0.8))
                                        .padding(20)
                                        .background(Color.white.opacity(0.1))
                                        .cornerRadius(40)
                                        .scaleEffect(1.1)
                                    Spacer()
                                }
                            )
                    }
                    .frame(width: 160, height: 320)
                    .background(Color(hex: "1C1C1E"))
                    .cornerRadius(48)
                    .overlay(
                        RoundedRectangle(cornerRadius: 48)
                            .stroke(Color.black.opacity(0.3), lineWidth: 8)
                    )
                    .rotationEffect(.degrees(-4))
                    .shadow(color: AppTheme.iosBlue.opacity(0.1), radius: 50, x: 0, y: 0)
                }
                .padding(.bottom, 32)
                
                // Text Content
                VStack(spacing: 12) {
                    Text("Bring your Lock Screen\nto life")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(AppTheme.primaryText)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                    
                    Text("Long press to preview")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(AppTheme.primaryText.opacity(0.6))
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
                
                Spacer()
                
                // Action Button
                VStack(spacing: 16) {
                    Button {
                        showProUpgrade = true
                    } label: {
                        Text("Get Started")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(AppTheme.iosBlue)
                            .cornerRadius(28)
                            .shadow(color: AppTheme.iosBlue.opacity(0.3), radius: 20, x: 0, y: 10)
                    }
                    .padding(.horizontal, 24)
                    
                    Text("Premium conversion engine included")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(AppTheme.primaryText.opacity(0.3))
                        .tracking(1)
                }
                .padding(.bottom, 40)
                
                // Home Indicator
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.white.opacity(0.2))
                    .frame(width: 128, height: 6)
                    .padding(.bottom, 8)
            }
        }
        .sheet(isPresented: $showProUpgrade) {
            ProUpgradeView(appState: AppState())
        }
    }
}

#if false
#Preview {
    PremiumOnboardingView()
}
#endif
