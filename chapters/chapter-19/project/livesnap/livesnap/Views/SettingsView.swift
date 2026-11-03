//
//  SettingsView.swift
//  livesnap
//
//  设置页面
//

import SwiftUI
import MessageUI
import StoreKit

struct SettingsView: View {
    @Environment(\.dismiss) var dismiss
    @ObservedObject var appState: AppState
    @StateObject private var storeKitManager = StoreKitManager.shared
    @StateObject private var storage = StorageManager.shared
    @State private var cacheSize: String = "0 MB"
    @State private var showPrivacyPolicy = false
    @State private var showTermsOfService = false
    @State private var showProUpgrade = false
    @State private var showClearCacheAlert = false
    @State private var showMailComposer = false
    @State private var canSendMail = false
    @State private var showShareSheet = false
    
    // App version info
    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
    
    @State private var isCleaningCache = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.midnightBlack.ignoresSafeArea()
                
                        ScrollView {
                            VStack(spacing: 0) {
                                // Content Container ...
                                VStack(spacing: 0) {
                                    // Header - 使用统一导航栏组件
                                    SystemNavHeader(
                                        title: "Settings",
                                        leadingAction: { dismiss() }
                                    )
                                    
                                    Text("Settings")
                                        .font(.system(size: 32, weight: .bold))
                                        .foregroundColor(AppTheme.primaryText)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                                        .padding(.top, 16)
                                        .padding(.bottom, 24)

                                    // Subscription Status Card
                                    if appState.isProUser {
                                        ProStatusCard()
                                            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                                    } else {
                                        UpgradePromptCard(action: { showProUpgrade = true })
                                            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                                    }

                                    // Account & Subscription Section
                                    SettingsSection(title: "Account") {
                                        if appState.isProUser {
                                            Button {
                                                // Open subscription management in App Store
                                                if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                                                    UIApplication.shared.open(url)
                                                }
                                            } label: {
                                                SettingsRow(
                                                    icon: "creditcard",
                                                    iconColor: AppTheme.iosBlue,
                                                    title: "Manage Subscription",
                                                    trailing: {
                                                        Image(systemName: "arrow.up.right")
                                                            .font(.system(size: 14))
                                                            .foregroundColor(AppTheme.systemGray)
                                                    }
                                                )
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                        } else {
                                            Button {
                                                showProUpgrade = true
                                            } label: {
                                                SettingsRow(
                                                    icon: "star.circle.fill",
                                                    iconColor: Color(hex: "FFD700"),
                                                    title: "Upgrade to Pro",
                                                    trailing: {
                                                        Image(systemName: "chevron.right")
                                                            .font(.system(size: 16))
                                                            .foregroundColor(AppTheme.systemGray)
                                                    }
                                                )
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                        }

                                        Button {
                                            restorePurchases()
                                        } label: {
                                            SettingsRow(
                                                icon: "arrow.triangle.2.circlepath",
                                                iconColor: .green,
                                                title: "Restore Purchases",
                                                showDivider: false,
                                                trailing: {
                                                    Image(systemName: "chevron.right")
                                                        .font(.system(size: 16))
                                                        .foregroundColor(AppTheme.systemGray)
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }

                                    // Export Settings Section
                                    SettingsSection(title: "Export Settings") {
                                        SettingsRow(
                                            icon: "photo.fill",
                                            iconColor: AppTheme.iosBlue,
                                            title: "High-Resolution Export",
                                            badge: appState.isProUser ? nil : "PRO",
                                            trailing: {
                                                if appState.isProUser {
                                                    Toggle("", isOn: $storage.highResExportEnabled)
                                                        .labelsHidden()
                                                        .tint(AppTheme.iosBlue)
                                                } else {
                                                    Button {
                                                        showProUpgrade = true
                                                    } label: {
                                                        Image(systemName: "lock.fill")
                                                            .font(.system(size: 14))
                                                            .foregroundColor(AppTheme.systemGray)
                                                    }
                                                }
                                            }
                                        )

                                        SettingsRow(
                                            icon: "speedometer",
                                            iconColor: .purple,
                                            title: "60 FPS Conversion",
                                            badge: appState.isProUser ? nil : "PRO",
                                            showDivider: false,
                                            trailing: {
                                                if appState.isProUser {
                                                    Toggle("", isOn: $storage.use60FPS)
                                                        .labelsHidden()
                                                        .tint(AppTheme.iosBlue)
                                                } else {
                                                    Button {
                                                        showProUpgrade = true
                                                    } label: {
                                                        Image(systemName: "lock.fill")
                                                            .font(.system(size: 14))
                                                            .foregroundColor(AppTheme.systemGray)
                                                    }
                                                }
                                            }
                                        )
                                    }
                                    
                                    // Storage & Performance Section
                                    SettingsSection(title: "Storage & Performance") {
                                        Button {
                                            if !isCleaningCache {
                                                showClearCacheAlert = true
                                            }
                                        } label: {
                                            SettingsRow(
                                                icon: "trash",
                                                iconColor: .gray,
                                                title: "Clear Cache",
                                                trailing: {
                                                    if isCleaningCache {
                                                        ProgressView()
                                                            .scaleEffect(0.8)
                                                    } else {
                                                        Text(cacheSize)
                                                            .font(.system(size: 14))
                                                            .foregroundColor(AppTheme.systemGray)
                                                    }
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                        .disabled(isCleaningCache)
                                        
                                        SettingsRow(
                                            icon: "arrow.clockwise",
                                            iconColor: .orange,
                                            title: "Auto-cleanup",
                                            showDivider: false, // 最后一个行不显示分隔线
                                            trailing: {
                                                Toggle("", isOn: $storage.autoCleanupEnabled)
                                                    .labelsHidden()
                                                    .tint(AppTheme.iosBlue)
                                            }
                                        )
                                    }
                                    
                                    // Support Section
                                    SettingsSection(title: "Support") {
                                        Button {
                                            if canSendMail {
                                                showMailComposer = true
                                            } else {
                                                if let url = URL(string: "mailto:support@example.com") {
                                                    UIApplication.shared.open(url)
                                                }
                                            }
                                        } label: {
                                            SettingsRow(
                                                icon: "envelope.fill",
                                                iconColor: AppTheme.iosBlue,
                                                title: "Contact Support",
                                                trailing: {
                                                    Image(systemName: "chevron.right")
                                                        .font(.system(size: 16))
                                                        .foregroundColor(AppTheme.systemGray)
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())

                                        Button {
                                            rateApp()
                                        } label: {
                                            SettingsRow(
                                                icon: "star.fill",
                                                iconColor: .orange,
                                                title: "Rate on App Store",
                                                trailing: {
                                                    Image(systemName: "arrow.up.right")
                                                        .font(.system(size: 14))
                                                        .foregroundColor(AppTheme.systemGray)
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())

                                        Button {
                                            shareApp()
                                        } label: {
                                            SettingsRow(
                                                icon: "square.and.arrow.up",
                                                iconColor: .green,
                                                title: "Share with Friends",
                                                showDivider: false,
                                                trailing: {
                                                    Image(systemName: "chevron.right")
                                                        .font(.system(size: 16))
                                                        .foregroundColor(AppTheme.systemGray)
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }

                                    // Legal Section
                                    SettingsSection(title: "Legal") {
                                        Button {
                                            showPrivacyPolicy = true
                                        } label: {
                                            SettingsRow(
                                                icon: "hand.raised.fill",
                                                iconColor: .blue,
                                                title: "Privacy Policy",
                                                trailing: {
                                                    Image(systemName: "arrow.up.right")
                                                        .font(.system(size: 14))
                                                        .foregroundColor(AppTheme.systemGray)
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())

                                        Button {
                                            showTermsOfService = true
                                        } label: {
                                            SettingsRow(
                                                icon: "doc.text.fill",
                                                iconColor: .gray,
                                                title: "Terms of Service",
                                                showDivider: false,
                                                trailing: {
                                                    Image(systemName: "arrow.up.right")
                                                        .font(.system(size: 14))
                                                        .foregroundColor(AppTheme.systemGray)
                                                }
                                            )
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }

                                    // About Section
                                    SettingsSection(title: "About") {
                                        SettingsRow(
                                            icon: "info.circle.fill",
                                            iconColor: .gray,
                                            title: "Version",
                                            showDivider: false,
                                            trailing: {
                                                Text("\(appVersion) (\(buildNumber))")
                                                    .font(.system(size: 15))
                                                    .foregroundColor(AppTheme.systemGray)
                                            }
                                        )
                                    }
                                    
#if DEBUG
                                    // Debug Section
                                    SettingsSection(title: "Developer") {
                                        SettingsRow(
                                            icon: "ladybug.fill",
                                            iconColor: .purple,
                                            title: "Simulate Pro Access",
                                            showDivider: false, // 最后一个行不显示分隔线
                                            trailing: {
                                                Toggle("", isOn: $appState.isProUser)
                                                    .labelsHidden()
                                                    .tint(AppTheme.iosBlue)
                                                    .onChange(of: appState.isProUser) { _, isPro in
                                                        storage.highResExportEnabled = isPro
                                                    }
                                            }
                                        )
                                    }
#endif


                                    // Footer - Simple copyright notice
                                    VStack(spacing: 12) {
                                        HStack(spacing: 8) {
                                            Image(systemName: "livephoto")
                                                .font(.system(size: 18))
                                                .foregroundColor(AppTheme.primaryText.opacity(0.4))
                                            Text("LiveSnap")
                                                .font(.system(size: 16, weight: .bold))
                                                .foregroundColor(AppTheme.primaryText.opacity(0.5))
                                        }

                                        Text("© 2025 LiveSnap Studio. All rights reserved.")
                                            .font(.system(size: 11))
                                            .foregroundColor(AppTheme.primaryText.opacity(0.35))
                                            .multilineTextAlignment(.center)

                                        Text("Made with ❤️ for creators")
                                            .font(.system(size: 11))
                                            .foregroundColor(AppTheme.primaryText.opacity(0.3))
                                    }
                                    .padding(.top, 40)
                                    .padding(.bottom, 40)
                                }
                                .frame(maxWidth: AppTheme.Layout.maxContentWidth) // Match prototype max-w-md
                                .frame(maxWidth: .infinity) // Center on larger screens
                            }
                        }
            }
            .navigationBarHidden(true)
            .onAppear {
                checkMailAvailability()
                loadCacheSize()
                loadSettings()
                checkProStatus()
            }
            .sheet(isPresented: $showProUpgrade) {
                ProUpgradeView(appState: appState)
            }
            .sheet(isPresented: $showPrivacyPolicy) {
                PrivacyPolicyView()
            }
            .sheet(isPresented: $showTermsOfService) {
                TermsOfServiceView()
            }
            .sheet(isPresented: $showMailComposer) {
                MailComposeView(
                    recipients: ["support@example.com"],
                    subject: "Livesnap Support Request"
                )
            }
            .sheet(isPresented: $showShareSheet) {
                ShareSheet(activityItems: [
                    "Check out Livesnap - the best way to create high-quality Live Photos from videos!",
                    URL(string: "https://apps.apple.com/app/id0000000000")!
                ])
            }
            .alert("Clear Cache", isPresented: $showClearCacheAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Clear", role: .destructive) {
                    clearCache()
                }
            } message: {
                Text("This will clear all cached files. This action cannot be undone.")
            }
        }
    }
    
    private func checkMailAvailability() {
        canSendMail = MFMailComposeViewController.canSendMail()
    }
    
    private func loadCacheSize() {
        // 异步计算缓存大小
        Task {
            let size = await storage.calculateTotalCacheSize()
            let formatter = ByteCountFormatter()
            formatter.allowedUnits = [.useMB, .useGB]
            formatter.countStyle = .file
            let sizeString = formatter.string(fromByteCount: size)
            await MainActor.run {
                self.cacheSize = sizeString
            }
        }
    }
    
    nonisolated private func calculateDirectorySize(at url: URL) -> Int64? {
        guard let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey], options: []) else {
            return nil
        }
        
        var totalSize: Int64 = 0
        for case let fileURL as URL in enumerator {
            if let fileSize = try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                totalSize += Int64(fileSize)
            }
        }
        return totalSize
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useKB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
    
    private func clearCache() {
        isCleaningCache = true
        
        Task {
            // 模拟一点延迟，让用户感觉到处理过程
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
            
            await storage.clearAllCache()
            
            await MainActor.run {
                // 更新缓存大小
                self.cacheSize = "0 MB"
                self.isCleaningCache = false
            }
        }
    }
    
    private func loadSettings() {
        // StorageManager handles loading automatically via @Published properties
        // 确保自动清理逻辑触发（如果启用）
        storage.performAutoCleanupIfNeeded()
    }
    
    private func checkProStatus() {
        Task {
            await storeKitManager.checkPurchases()
            await MainActor.run {
                appState.isProUser = storeKitManager.isProUser
            }
        }
    }
    
    private func rateApp() {
        if let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
            // iOS 18+ 使用新的 API
            if #available(iOS 18.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
            
            // 延迟 2 秒检查，如果评论弹窗没出来（目前没法直接检测，只能采取冗余策略），
            // 或者作为保险，提供一个直接跳转到 App Store 写评价的 URL。
            // 在实际产品中，通常直接提供链接是最稳妥的。
            let appStoreID = "0000000000"
            if let url = URL(string: "https://itunes.apple.com/app/id\(appStoreID)?action=write-review") {
                UIApplication.shared.open(url)
            }
        }
    }
    
    private func shareApp() {
        // 使用 SwiftUI 的 sheet 来显示分享界面，避免在已有 sheet 时再次显示
        showShareSheet = true
    }
    
    private func restorePurchases() {
        Task {
            await storeKitManager.restorePurchases()
            await MainActor.run {
                appState.isProUser = storeKitManager.isProUser
            }
        }
    }
}

import StoreKit

// WebView for Privacy Policy and Terms
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.backgroundColor = UIColor(AppTheme.midnightBlack)
        webView.scrollView.backgroundColor = UIColor(AppTheme.midnightBlack)
        webView.isOpaque = false
        webView.load(URLRequest(url: url))
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // 页面加载完成
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("WebView error: \(error.localizedDescription)")
        }
    }
}

// WebView with Navigation wrapper for sheet presentation
struct WebViewSheet: View {
    let url: URL
    let title: String
    @Environment(\.dismiss) var dismiss
    @State private var isLoading = true
    
    var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.midnightBlack.ignoresSafeArea()
                
                WebView(url: url)
                
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.iosBlue))
                        .scaleEffect(1.2)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AppTheme.midnightBlack, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(AppTheme.primaryText.opacity(0.6))
                    }
                }
            }
            .onAppear {
                // 模拟加载延迟
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    isLoading = false
                }
            }
        }
    }
}

// Mail Compose View
struct MailComposeView: UIViewControllerRepresentable {
    let recipients: [String]
    let subject: String
    @Environment(\.dismiss) var dismiss
    
    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let composer = MFMailComposeViewController()
        composer.mailComposeDelegate = context.coordinator
        composer.setToRecipients(recipients)
        composer.setSubject(subject)
        return composer
    }
    
    func updateUIViewController(_ uiViewController: MFMailComposeViewController, context: Context) {
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let parent: MailComposeView
        
        init(_ parent: MailComposeView) {
            self.parent = parent
        }
        
        func mailComposeController(_ controller: MFMailComposeViewController, didFinishWith result: MFMailComposeResult, error: Error?) {
            parent.dismiss()
        }
    }
}

// Share Sheet View
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]
    @Environment(\.dismiss) var dismiss
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, _, _, _ in
            dismiss()
        }
        return controller
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {
    }
}

struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Section 标题 - 按照 iOS 规范，应该在左侧有 padding
            Text(title.uppercased())
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(AppTheme.primaryText.opacity(0.6))
                .tracking(0.5)
                .padding(.horizontal, AppTheme.Layout.horizontalPadding)
                .padding(.top, 24)
                .padding(.bottom, 6)
            
            // 内容容器
            VStack(spacing: 0) {
                content
            }
            .background(AppTheme.graphiteGray)
            .cornerRadius(AppTheme.CornerRadius.medium)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium)
                    .stroke(AppTheme.Border.subtle.color, lineWidth: AppTheme.Border.subtle.width)
            )
            .padding(.horizontal, AppTheme.Layout.horizontalPadding)
        }
    }
}

struct SettingsRow<Trailing: View>: View {
    let icon: String
    let iconColor: Color
    let title: String
    let badge: String?
    let showDivider: Bool
    @ViewBuilder let trailing: Trailing
    
    init(
        icon: String,
        iconColor: Color,
        title: String,
        badge: String? = nil,
        showDivider: Bool = true,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.badge = badge
        self.showDivider = showDivider
        self.trailing = trailing()
    }
    
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 16) {
                // 图标 - 按照 iOS 规范，图标应该有固定的尺寸和圆角
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 32, height: 32)
                    .background(
                        ZStack {
                            iconColor
                            // 微妙的渐变叠加
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.1),
                                    Color.white.opacity(0.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        }
                    )
                    .cornerRadius(8) // iOS 规范：图标圆角通常是 8pt
                
                // 标题和徽章
                HStack(spacing: 8) {
                    Text(title)
                        .font(.system(size: 17, weight: .regular)) // iOS 规范：设置行字体通常是 17pt regular
                        .foregroundColor(AppTheme.primaryText)
                    
                    if let badge = badge {
                        SystemBadge(text: badge, type: .gold)
                    }
                }
                
                Spacer()
                
                // 尾部内容（Toggle、Chevron 等）
                trailing
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12) // iOS 规范：设置行垂直 padding 通常是 12pt
            
            // 分隔线 - 按照 iOS 规范，应该在图标右侧开始，最后一个行不显示
            if showDivider {
                HStack(spacing: 0) {
                    // 左侧留白（图标宽度 + spacing）
                    Spacer()
                        .frame(width: 48) // 32 (icon) + 16 (spacing)
                    
                    // 分隔线从图标右侧开始
                    Rectangle()
                        .fill(AppTheme.Border.divider.color)
                        .frame(height: AppTheme.Border.divider.width)
                }
                .padding(.horizontal, 16)
            }
        }
    }
}

// MARK: - Subscription Status Cards

struct ProStatusCard: View {
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 16) {
                // Pro Icon
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(hex: "FFD700"),
                                    Color(hex: "FFA500")
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 56, height: 56)

                    Image(systemName: "crown.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text("Pro Member")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(AppTheme.primaryText)

                        SystemBadge(text: "ACTIVE", type: .success)
                    }

                    Text("All premium features unlocked")
                        .font(.system(size: 14))
                        .foregroundColor(AppTheme.secondaryText)
                }

                Spacer()
            }
            .padding(20)
        }
        .background(
            ZStack {
                // Base gradient
                LinearGradient(
                    colors: [
                        Color(hex: "FFD700").opacity(0.1),
                        Color(hex: "FFA500").opacity(0.05)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                // Border gradient
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                Color(hex: "FFD700").opacity(0.3),
                                Color(hex: "FFA500").opacity(0.2)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.5
                    )
            }
        )
        .cornerRadius(16)
    }
}

struct UpgradePromptCard: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack(spacing: 16) {
                    // Upgrade Icon
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        AppTheme.iosBlue,
                                        AppTheme.iosBlue.opacity(0.7)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 56, height: 56)

                        Image(systemName: "sparkles")
                            .font(.system(size: 24))
                            .foregroundColor(.white)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Upgrade to Pro")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(AppTheme.primaryText)

                        Text("Unlock all features & remove watermark")
                            .font(.system(size: 14))
                            .foregroundColor(AppTheme.secondaryText)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.iosBlue)
                }
                .padding(20)
            }
            .background(
                ZStack {
                    // Base color
                    AppTheme.graphiteGray

                    // Border
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(AppTheme.iosBlue.opacity(0.3), lineWidth: 1.5)
                }
            )
            .cornerRadius(16)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#if false
#Preview {
    SettingsView(appState: AppState())
}
#endif
