//
//  StoreKitManager.swift
//  livesnap
//
//  StoreKit 2 订阅管理
//

import Foundation
import Combine
import StoreKit

@MainActor
class StoreKitManager: ObservableObject {
    static let shared = StoreKitManager()
    
    @Published var isProUser = false {
        didSet {
            storage.isProUser = isProUser
        }
    }
    
    @Published var availableProducts: [Product] = []
    @Published var purchasedProductIDs: Set<String> = [] {
        didSet {
            storage.purchasedProductIDs = purchasedProductIDs
        }
    }
    
    private let storage = StorageManager.shared
    // 支持月付和年付
    private let productIDs = Config.IAP.allProductIDs
    
    private init() {
        // 从存储中加载购买状态（优先从 iCloud 加载，确保持久化）
        isProUser = storage.isProUser
        purchasedProductIDs = storage.purchasedProductIDs
        
        print("📱 StoreKitManager initialized - Pro User: \(isProUser), Products: \(purchasedProductIDs)")
        
        Task {
            await loadProducts()
            // 始终检查 StoreKit 订阅状态，确保与服务器同步
            await checkPurchases()
            
            // 如果 StoreKit 中有有效订阅，但本地没有，则同步
            // 如果本地有购买记录，也验证一次确保有效性
            await verifyAndSyncPurchaseStatus()
        }
    }
    
    /// 验证并同步购买状态，确保购买资格不会丢失
    private func verifyAndSyncPurchaseStatus() async {
        // 检查 StoreKit 中的有效订阅
        var activeSubscriptions: Set<String> = []
        
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                // 检查订阅是否仍然有效
                if let expirationDate = transaction.expirationDate {
                    if expirationDate > Date() {
                        // 订阅仍然有效
                        activeSubscriptions.insert(transaction.productID)
                        print("✅ Active subscription found: \(transaction.productID), expires: \(expirationDate)")
                    } else {
                        print("⚠️ Subscription expired: \(transaction.productID)")
                    }
                } else {
                    // 非订阅产品（如一次性购买），始终有效
                    activeSubscriptions.insert(transaction.productID)
                    print("✅ Non-subscription product found: \(transaction.productID)")
                }
            }
        }
        
        // 如果 StoreKit 中有有效订阅，更新本地状态
        if !activeSubscriptions.isEmpty {
            await MainActor.run {
                // 合并 StoreKit 和本地存储的购买记录
                let mergedProducts = purchasedProductIDs.union(activeSubscriptions)
                purchasedProductIDs = mergedProducts
                isProUser = true
                print("✅ Synced purchase status - Active products: \(mergedProducts)")
            }
        } else if !purchasedProductIDs.isEmpty {
            // 如果本地有购买记录但 StoreKit 中没有，保留本地记录（可能是模拟购买或网络问题）
            print("⚠️ Local purchase records exist but no active StoreKit subscriptions found")
            print("   Keeping local records: \(purchasedProductIDs)")
        }
    }
    
    /// 加载产品信息
    func loadProducts() async {
        do {
            let products = try await Product.products(for: productIDs)
            availableProducts = products
        } catch {
            print("Failed to load products: \(error)")
        }
    }
    
    /// 检查购买状态（确保购买资格不会丢失）
    func checkPurchases() async {
        var foundProductIDs: Set<String> = []
        var hasActiveSubscription = false
        
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                let productID = transaction.productID
                foundProductIDs.insert(productID)
                
                // 检查订阅是否仍然有效
                if let expirationDate = transaction.expirationDate {
                    if expirationDate > Date() {
                        hasActiveSubscription = true
                        print("✅ Active subscription: \(productID), expires: \(expirationDate)")
                    } else {
                        print("⚠️ Subscription expired: \(productID), expired: \(expirationDate)")
                    }
                } else {
                    // 非订阅产品（如一次性购买），始终有效
                    hasActiveSubscription = true
                    print("✅ Non-subscription product: \(productID)")
                }
            }
        }
        
        // 更新状态：合并 StoreKit 和本地存储的购买记录，确保不会丢失
        await MainActor.run {
            // 合并：保留本地记录和 StoreKit 记录
            let mergedProducts = purchasedProductIDs.union(foundProductIDs)
            purchasedProductIDs = mergedProducts
            
            // 如果有任何有效的购买记录（本地或 StoreKit），就是 Pro 用户
            isProUser = !mergedProducts.isEmpty || hasActiveSubscription
            
            print("📊 Purchase status - StoreKit: \(foundProductIDs), Local: \(purchasedProductIDs), Merged: \(mergedProducts), Pro: \(isProUser)")
        }
        
        // 保存最后检查时间
        storage.saveLastPurchaseCheckDate(Date())
    }
    
    /// 购买产品（确保购买资格持久化）
    func purchase(_ product: Product) async throws -> Bool {
        let result = try await product.purchase()
        
        switch result {
        case .success(let verification):
            switch verification {
            case .verified(let transaction):
                let productID = transaction.productID
                
                // 立即保存到 iCloud 和本地存储，确保持久化
                storage.addPurchasedProductID(productID)
                purchasedProductIDs.insert(productID)
                isProUser = true
                
                // 完成交易
                await transaction.finish()
                
                // 再次验证，确保状态已保存
                await verifyAndSyncPurchaseStatus()
                
                print("✅ Purchase successful: \(productID), Pro status saved to iCloud")
                return true
            case .unverified:
                print("❌ Purchase verification failed")
                return false
            }
        case .userCancelled:
            print("⚠️ User cancelled purchase")
            return false
        case .pending:
            print("⏳ Purchase pending")
            return false
        @unknown default:
            return false
        }
    }
    
    /// 恢复购买
    func restorePurchases() async {
        try? await AppStore.sync()
        await checkPurchases()
    }

    // MARK: - 统一 Pro 状态验证

    /// 统一的 Pro 用户验证方法
    /// 推荐在所有需要检查 Pro 状态的地方使用此方法，确保逻辑一致
    var isProUserVerified: Bool {
        return isProUser && !purchasedProductIDs.isEmpty
    }

    /// 检查特定功能是否可用（Pro功能）
    func canUseProFeature() -> Bool {
        return isProUserVerified
    }

    /// 获取Pro功能的描述文本
    func getProFeatureDescription(feature: ProFeature) -> String {
        switch feature {
        case .noWatermark:
            return "Remove watermark"
        case .highResolution:
            return "Export in high resolution"
        case .fps60:
            return "Export at 60 FPS"
        case .batchProcessing:
            return "Batch process videos"
        }
    }

    /// 获取升级提示文案
    func getUpgradePrompt(for feature: ProFeature) -> String {
        let description = getProFeatureDescription(feature: feature)
        return "Upgrade to Pro to unlock \(description)"
    }

    enum ProFeature {
        case noWatermark
        case highResolution
        case fps60
        case batchProcessing
    }
}
