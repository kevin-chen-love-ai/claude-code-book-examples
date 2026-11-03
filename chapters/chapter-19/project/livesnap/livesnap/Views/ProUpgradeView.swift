//
//  ProUpgradeView.swift
//  livesnap
//
//  Pro 升级页面 - 支持月付和年付
//

import SwiftUI
import StoreKit
import Combine

struct ProUpgradeView: View {
    @ObservedObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @StateObject private var storeKitManager = StoreKitManager.shared
    @State private var selectedPlan: SubscriptionPlan = .yearly
    @State private var isPurchasing = false
    @State private var showPrivacyPolicy = false
    @State private var showTermsOfService = false
    @State private var isLoadingProducts = true
    @State private var showSimulatePurchaseAlert = false
    @StateObject private var storage = StorageManager.shared
    
    enum SubscriptionPlan: String, CaseIterable {
        case monthly = "monthly"
        case yearly = "yearly"
        
        var productID: String {
            switch self {
            case .monthly: return "com.example.livesnap.pro.monthly"
            case .yearly: return "com.example.livesnap.pro.yearly"
            }
        }
        
        var title: String {
            switch self {
            case .monthly: return "Monthly"
            case .yearly: return "Yearly"
            }
        }
        
        var subtitle: String {
            switch self {
            case .monthly: return "Cancel anytime"
            case .yearly: return "Best Value"
            }
        }
    }
    
    var body: some View {
        ZStack {
            // Enhanced Background with premium gradient
            GradientBackground(style: .cosmic)

            // Premium light effects
            LightEffect(position: .topLeading, color: Color(hex: "FFD700"), intensity: 0.2)
                .offset(x: -100, y: -100)

            LightEffect(position: .bottomTrailing, color: AppTheme.iosBlue, intensity: 0.15)
                .offset(x: 100, y: 100)
            
            ScrollView {
                VStack(spacing: 0) {
                    // Content Container with max width (matching prototype max-w-md ≈ 448px)
                    VStack(spacing: 0) {
                        // Header Content - Enhanced with premium styling
                        VStack(spacing: 12) {
                            // Pro Badge with shimmer
                            SystemBadge(text: "PRO ACCESS", type: .premium)
                                .padding(.top, 24)
                                .shimmer(duration: 2.5, delay: 1.0)

                            // Gradient title
                            GradientText(
                                text: "Unlock Full Power",
                                size: 34,
                                weight: .bold,
                                colors: [
                                    Color.white,
                                    Color(hex: "FFD700").opacity(0.8)
                                ]
                            )
                            .multilineTextAlignment(.center)

                            Text("Experience LiveSnap without limits.")
                                .font(.system(size: 17))
                                .foregroundColor(Color.white.opacity(0.6))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                                .padding(.top, 4)
                        }
                        .padding(.bottom, 48)
                        
                        // Features Grid
                        VStack(spacing: 24) {
                            FeatureRow(icon: "sparkles", title: "Original 4K Quality", subtitle: "Export with zero compression")
                            FeatureRow(icon: "scissors", title: "Smart Crop & Zoom", subtitle: "Perfect framing for Lock Screen")
                            FeatureRow(icon: "checkmark.seal.fill", title: "No Watermark", subtitle: "Clean, professional exports")
                        }
                        .padding(.horizontal, 32)
                        .padding(.bottom, 48)
                        
                        // Subscription Plans
                        VStack(spacing: 16) {
                            ForEach(SubscriptionPlan.allCases, id: \.self) { plan in
                                SubscriptionPlanCard(
                                    plan: plan,
                                    isSelected: selectedPlan == plan,
                                    products: storeKitManager.availableProducts,
                                    onSelect: {
                                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                            selectedPlan = plan
                                        }
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 32)
                        
                        // Disclaimer
                        Text("Subscription auto-renews. Cancel anytime in Settings.")
                            .font(.system(size: 12))
                            .foregroundColor(Color.white.opacity(0.3))
                            .multilineTextAlignment(.center)
                            .padding(.bottom, 100)
                    }
                    .frame(maxWidth: AppTheme.Layout.maxContentWidth) // Match prototype max-w-md
                    .frame(maxWidth: .infinity) // Center on larger screens
                }
            }
            .safeAreaInset(edge: .top) {
                // Fixed Top Header - 使用统一导航栏组件，兼容灵动岛
                SystemNavHeader(
                    title: "",
                    leadingAction: { dismiss() },
                    trailingAction: { restorePurchases() },
                    trailingTitle: "Restore"
                )
            }
            .safeAreaInset(edge: .bottom) {
                // Sticky Subscribe Button - Premium style
                VStack(spacing: 16) {
                    PremiumButton(
                        title: buttonTitle,
                        action: { purchaseSubscription() },
                        style: .premium,
                        isLoading: isPurchasing
                    )
                    .disabled(isLoadingProducts)
                    
                    HStack(spacing: 24) {
                        Button("Terms") { showTermsOfService = true }
                        Button("Privacy") { showPrivacyPolicy = true }
                        // 模拟付费按钮（开发/测试用）
                        #if DEBUG
                        Button("Simulate") { 
                            showSimulatePurchaseAlert = true
                        }
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.iosBlue.opacity(0.8))
                        #endif
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.5))
                }
                .frame(maxWidth: AppTheme.Layout.maxContentWidth) // Match prototype max-w-md
                .frame(maxWidth: .infinity) // Center on larger screens
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 32)
                .background(
                    LinearGradient(
                        colors: [
                            Color(hex: "1A1A1A").opacity(0),
                            Color(hex: "1A1A1A")
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .overlay(
                        VisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
                    )
                )
            }
            .onAppear {
                Task {
                    await storeKitManager.loadProducts()
                    await MainActor.run { isLoadingProducts = false }
                }
            }
            .sheet(isPresented: $showPrivacyPolicy) {
                PrivacyPolicyView()
            }
            .sheet(isPresented: $showTermsOfService) {
                TermsOfServiceView()
            }
            .alert("Simulate Purchase", isPresented: $showSimulatePurchaseAlert) {
                Button("Yearly") {
                    simulatePurchase(productID: "com.example.livesnap.pro.yearly")
                }
                Button("Monthly") {
                    simulatePurchase(productID: "com.example.livesnap.pro.monthly")
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This will simulate a purchase for testing. The Pro status will be saved to iCloud and persist even after app deletion.")
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var buttonTitle: String {
        if let product = storeKitManager.availableProducts.first(where: { $0.id == selectedPlan.productID }) {
            return "Subscribe for \(product.displayPrice)"
        }
        return selectedPlan == .monthly ? "Subscribe for $4.99/month" : "Subscribe for Yearly"
    }
    
    // MARK: - Helper Functions
    
    private func purchaseSubscription() {
        isPurchasing = true
        Task {
            guard let product = storeKitManager.availableProducts.first(where: { $0.id == selectedPlan.productID }) else {
                await MainActor.run { 
                    isPurchasing = false 
                    print("⚠️ Product not available: \(selectedPlan.productID)")
                }
                return
            }
            
            do {
                let success = try await storeKitManager.purchase(product)
                await MainActor.run {
                    if success {
                        // StoreKitManager 已经更新了 isProUser，这里同步到 appState
                        appState.isProUser = storeKitManager.isProUser
                        // 延迟一下再关闭，确保状态已更新
                        Task {
                            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5秒
                            dismiss()
                        }
                    }
                    isPurchasing = false
                }
            } catch {
                print("❌ Purchase failed: \(error.localizedDescription)")
                await MainActor.run { isPurchasing = false }
            }
        }
    }
    
    private func restorePurchases() {
        Task {
            await storeKitManager.restorePurchases()
            await MainActor.run {
                appState.isProUser = storeKitManager.isProUser
            }
        }
    }
    
    /// 模拟购买（用于测试）
    private func simulatePurchase(productID: String) {
        print("🎮 Simulating subscription purchase: \(productID)")
        
        // 使用 StorageManager 的模拟购买功能
        storage.simulatePurchase(productID: productID)
        
        // 同步状态
        Task { @MainActor in
            storeKitManager.purchasedProductIDs.insert(productID)
            storeKitManager.isProUser = true
            appState.isProUser = true
            
            // 延迟一下再关闭，确保状态已更新
            try? await Task.sleep(nanoseconds: 300_000_000) // 0.3秒
            dismiss()
        }
    }
}

// MARK: - Components

struct FeatureRow: View {
    let icon: String
    let title: String
    let subtitle: String
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(AppTheme.iosBlue) // Tint Gold or Blue
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.08))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundColor(Color.white.opacity(0.6))
            }
            Spacer()
        }
    }
}

struct SubscriptionPlanCard: View {
    let plan: ProUpgradeView.SubscriptionPlan
    let isSelected: Bool
    let products: [Product]
    let onSelect: () -> Void
    
    // Helper to get price string
    private var priceString: String {
        if let product = products.first(where: { $0.id == plan.productID }) {
            return product.displayPrice
        }
        // Fallback display
        switch plan {
        case .monthly: return "$4.99"
        case .yearly: return "$49.99"
        }
    }
    
    // Helper to get period string
    private var periodString: String {
        switch plan {
        case .monthly: return "/ month"
        case .yearly: return "/ year"
        }
    }
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                // Radio Circle
                ZStack {
                    Circle()
                        .stroke(isSelected ? AppTheme.iosBlue : Color.white.opacity(0.3), lineWidth: 2)
                        .frame(width: 20, height: 20)
                    
                    if isSelected {
                        Circle()
                            .fill(AppTheme.iosBlue)
                            .frame(width: 10, height: 10)
                    }
                }
                .padding(.trailing, 8)
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(plan.title)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white)
                        
                        if plan == .yearly {
                            Text("Best Value")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(AppTheme.iosBlue)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(AppTheme.iosBlue.opacity(0.2))
                                .cornerRadius(4)
                        }
                    }
                    
                    Text(plan.subtitle)
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.5))
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text(priceString)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                    
                    Text(periodString)
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.5))
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(isSelected ? AppTheme.iosBlue.opacity(0.1) : Color.white.opacity(0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? AppTheme.iosBlue : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

// Blur view helper
struct VisualEffectView: UIViewRepresentable {
    var effect: UIVisualEffect?
    func makeUIView(context: UIViewRepresentableContext<Self>) -> UIVisualEffectView { UIVisualEffectView() }
    func updateUIView(_ uiView: UIVisualEffectView, context: UIViewRepresentableContext<Self>) { uiView.effect = effect }
}

#if false
#Preview {
    ProUpgradeView(appState: AppState())
}
#endif
