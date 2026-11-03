//
//  PrivacyPolicyView.swift
//  livesnap
//
//  隐私政策页面
//

import SwiftUI

struct PrivacyPolicyView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.midnightBlack.ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Content Container with max width
                        VStack(alignment: .leading, spacing: 24) {
                            // Header - 使用统一组件
                            VStack(alignment: .leading, spacing: 8) {
                                SystemTitle(text: "Privacy Policy", size: 32, weight: .bold)
                                
                                SystemSubtitle(text: "Last updated: \(formatDate())")
                            }
                            .padding(.bottom, 8)
                            
                            Divider()
                                .background(Color.white.opacity(0.1))
                            
                            // Introduction
                            SectionView(
                                title: "Introduction",
                                content: """
                                Livesnap ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
                                """
                            )
                            
                            // Section 1
                            SectionView(
                                title: "1. Information We Collect",
                                content: """
                                Livesnap is designed with privacy in mind:
                                
                                • **Videos and Photos**: The App accesses your photo library only to allow you to select videos for conversion. All processing happens locally on your device.
                                
                                • **No Data Collection**: We do not collect, store, or transmit your videos, photos, or personal information to our servers or third parties.
                                
                                • **App Usage Data**: We may collect anonymous usage statistics (such as app crashes) through Apple's standard analytics tools to improve the App's performance.
                                """
                            )
                            
                            // Section 2
                            SectionView(
                                title: "2. How We Use Your Information",
                                content: """
                                Since we do not collect personal information:
                                
                                • All video processing occurs entirely on your device
                                • Your videos never leave your device
                                • We do not use your information for advertising or marketing
                                • We do not share your information with third parties
                                """
                            )
                            
                            // Section 3
                            SectionView(
                                title: "3. Local Processing",
                                content: """
                                Livesnap processes all videos locally on your device using Apple's AVFoundation framework. This means:
                                
                                • Your videos are processed entirely on your iPhone or iPad
                                • No data is uploaded to external servers
                                • No internet connection is required for video processing
                                • Your content remains private and secure
                                """
                            )
                            
                            // Section 4
                            SectionView(
                                title: "4. Photo Library Access",
                                content: """
                                The App requires access to your photo library to:
                                
                                • Allow you to select videos for conversion
                                • Save completed Live Photos to your library
                                
                                You can revoke this access at any time through your device's Settings > Privacy & Security > Photos.
                                """
                            )
                            
                            // Section 5
                            SectionView(
                                title: "5. Subscription Information",
                                content: """
                                If you purchase a Pro subscription:
                                
                                • Payment processing is handled entirely by Apple
                                • We receive only anonymized purchase receipts from Apple
                                • We do not have access to your payment information
                                • Subscription status is stored locally on your device
                                """
                            )
                            
                            // Section 6
                            SectionView(
                                title: "6. Third-Party Services",
                                content: """
                                Livesnap uses the following third-party services:
                                
                                • **Apple App Store**: For app distribution and in-app purchases
                                • **Apple Analytics**: For anonymous crash reporting and app performance metrics
                                
                                These services are governed by their respective privacy policies.
                                """
                            )
                            
                            // Section 7
                            SectionView(
                                title: "7. Data Security",
                                content: """
                                We take your privacy seriously:
                                
                                • All processing happens on your device
                                • No data transmission occurs
                                • Temporary files created during processing are automatically deleted
                                • We follow Apple's security best practices
                                """
                            )
                            
                            // Section 8
                            SectionView(
                                title: "8. Children's Privacy",
                                content: """
                                Livesnap is not intended for children under the age of 13. We do not knowingly collect information from children. If you believe we have inadvertently collected information from a child, please contact us immediately.
                                """
                            )
                            
                            // Section 9
                            SectionView(
                                title: "9. Changes to This Policy",
                                content: """
                                We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the "Last updated" date at the top of this policy. We encourage you to review this policy periodically.
                                """
                            )
                            
                            // Section 10
                            SectionView(
                                title: "10. Contact Us",
                                content: """
                                If you have any questions about this Privacy Policy, please contact us at:
                                
                                Email: support@example.com
                                
                                We are committed to addressing your privacy concerns promptly and transparently.
                                """
                            )
                            
                            // Footer
                            VStack(spacing: 8) {
                                Divider()
                                    .background(Color.white.opacity(0.1))
                                
                                Text("© 2024 Livesnap. All rights reserved.")
                                    .font(.system(size: 12))
                                    .foregroundColor(AppTheme.systemGray)
                            }
                            .padding(.top, 16)
                        }
                        .frame(maxWidth: 448) // Match prototype max-w-md
                        .frame(maxWidth: .infinity) // Center on larger screens
                        .padding(.horizontal, 24)
                        .padding(.vertical, 32)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 18, weight: .light))
                            .foregroundColor(AppTheme.primaryText.opacity(0.4))
                    }
                    .buttonStyle(ScaleButtonStyle())
                }
            }
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }
    
    private func formatDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "January 1, 2024"
        return formatter.string(from: Date())
    }
}

#if false
#Preview {
    PrivacyPolicyView()
}
#endif
