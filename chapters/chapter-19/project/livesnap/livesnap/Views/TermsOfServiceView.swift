//
//  TermsOfServiceView.swift
//  livesnap
//
//  服务条款页面
//

import SwiftUI

struct TermsOfServiceView: View {
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
                                SystemTitle(text: "Terms of Service", size: 32, weight: .bold)
                                
                                SystemSubtitle(text: "Last updated: \(formatDate())")
                            }
                            .padding(.bottom, 8)
                            
                            Divider()
                                .background(Color.white.opacity(0.1))
                            
                            // Section 1
                            SectionView(
                                title: "1. Acceptance of Terms",
                                content: """
                                By downloading, installing, or using Livesnap ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
                                """
                            )
                            
                            // Section 2
                            SectionView(
                                title: "2. Description of Service",
                                content: """
                                Livesnap is a mobile application that allows users to convert videos into Live Photos. The App processes videos locally on your device and does not upload or store your content on external servers.
                                """
                            )
                            
                            // Section 3
                            SectionView(
                                title: "3. User Responsibilities",
                                content: """
                                You are responsible for:
                                • Ensuring you have the right to use any videos you process through the App
                                • Complying with all applicable laws and regulations
                                • Maintaining the security of your device and account
                                • Not using the App for any illegal or unauthorized purpose
                                """
                            )
                            
                            // Section 4
                            SectionView(
                                title: "4. Subscription and Payment",
                                content: """
                                Livesnap offers both free and premium subscription options:
                                • Free users can convert videos with watermarks
                                • Pro subscribers receive watermark-free exports and higher quality processing
                                • Subscriptions are managed through the Apple App Store
                                • Payments are processed by Apple, not Livesnap
                                • Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period
                                """
                            )
                            
                            // Section 5
                            SectionView(
                                title: "5. Refund Policy",
                                content: """
                                All purchases are final. Refunds are handled through Apple's standard refund policy. If you have questions about a refund, please contact Apple Support.
                                """
                            )
                            
                            // Section 6
                            SectionView(
                                title: "6. Intellectual Property",
                                content: """
                                The App and its original content, features, and functionality are owned by Livesnap and are protected by international copyright, trademark, and other intellectual property laws.
                                """
                            )
                            
                            // Section 7
                            SectionView(
                                title: "7. Privacy",
                                content: """
                                Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information. Livesnap processes all videos locally on your device and does not transmit your content to external servers.
                                """
                            )
                            
                            // Section 8
                            SectionView(
                                title: "8. Limitation of Liability",
                                content: """
                                Livesnap is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the App, including but not limited to data loss or device damage.
                                """
                            )
                            
                            // Section 9
                            SectionView(
                                title: "9. Changes to Terms",
                                content: """
                                We reserve the right to modify these Terms of Service at any time. We will notify users of significant changes through the App or via email. Continued use of the App after changes constitutes acceptance of the new terms.
                                """
                            )
                            
                            // Section 10
                            SectionView(
                                title: "10. Contact Information",
                                content: """
                                If you have any questions about these Terms of Service, please contact us at:
                                
                                Email: support@example.com
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

struct SectionView: View {
    let title: String
    let content: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(AppTheme.primaryText)
            
            Text(content)
                .font(.system(size: 15))
                .foregroundColor(AppTheme.secondaryText)
                .lineSpacing(4)
        }
    }
}

#if false
#Preview {
    TermsOfServiceView()
}
#endif
