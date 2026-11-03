//
//  StorageManager.swift
//  livesnap
//
//  统一存储管理器 - 集中管理所有应用数据存储（仅限本地存储）
//

import Foundation
import Combine

/// 统一存储管理器
/// 管理所有应用数据的持久化存储（本地），包括：
/// - 购买资格和订阅状态
/// - 历史记录
/// - 用户设置
/// - 其他应用状态
@MainActor
class StorageManager: ObservableObject {
    static let shared = StorageManager()
    
    // MARK: - Storage Keys
    
    private struct Keys {
        // 购买相关
        static let purchasedProductIDs = "livesnap.purchased_product_ids"
        static let isProUser = "livesnap.is_pro_user"
        static let lastPurchaseCheckDate = "livesnap.last_purchase_check_date"
        
        // 历史记录
        static let historyAssetIDs = "livesnap.history_asset_ids"
        static let historyLastUpdated = "livesnap.history_last_updated"
        
        // 用户设置
        static let highResExportEnabled = "livesnap.settings.high_res_export"
        static let autoCleanupEnabled = "livesnap.settings.auto_cleanup"
        static let use60FPS = "livesnap.settings.use_60fps"
        
        // 应用状态
        static let hasCompletedOnboarding = "livesnap.has_completed_onboarding"
        static let lastAppVersion = "livesnap.last_app_version"
        static let conversionCount = "livesnap.conversion_count"
    }
    
    // MARK: - Published Properties
    
    @Published var isProUser: Bool {
        didSet {
            if oldValue != isProUser {
                UserDefaults.standard.set(isProUser, forKey: Keys.isProUser)
            }
        }
    }
    
    @Published var purchasedProductIDs: Set<String> {
        didSet {
            if oldValue != purchasedProductIDs {
                UserDefaults.standard.set(Array(purchasedProductIDs), forKey: Keys.purchasedProductIDs)
            }
        }
    }
    
    @Published var historyAssetIDs: [String] {
        didSet {
            if oldValue != historyAssetIDs {
                UserDefaults.standard.set(historyAssetIDs, forKey: Keys.historyAssetIDs)
                UserDefaults.standard.set(Date(), forKey: Keys.historyLastUpdated)
            }
        }
    }
    
    @Published var highResExportEnabled: Bool {
        didSet {
            if oldValue != highResExportEnabled {
                UserDefaults.standard.set(highResExportEnabled, forKey: Keys.highResExportEnabled)
            }
        }
    }
    
    @Published var autoCleanupEnabled: Bool {
        didSet {
            if oldValue != autoCleanupEnabled {
                UserDefaults.standard.set(autoCleanupEnabled, forKey: Keys.autoCleanupEnabled)
            }
        }
    }
    
    @Published var use60FPS: Bool {
        didSet {
            if oldValue != use60FPS {
                UserDefaults.standard.set(use60FPS, forKey: Keys.use60FPS)
            }
        }
    }
    
    // MARK: - Private Properties
    
    // MARK: - Initialization
    
    private init() {
        let defaults = UserDefaults.standard
        
        // 加载所有存储的数据
        self.isProUser = defaults.bool(forKey: Keys.isProUser)
        
        if let array = defaults.array(forKey: Keys.purchasedProductIDs) as? [String] {
            self.purchasedProductIDs = Set(array)
        } else {
            self.purchasedProductIDs = []
        }
        
        self.historyAssetIDs = defaults.stringArray(forKey: Keys.historyAssetIDs) ?? []
        self.highResExportEnabled = defaults.bool(forKey: Keys.highResExportEnabled)
        self.autoCleanupEnabled = defaults.bool(forKey: Keys.autoCleanupEnabled)
        self.use60FPS = defaults.bool(forKey: Keys.use60FPS)
        
        print("📱 StorageManager initialized - Pro User: \(self.isProUser), Products: \(self.purchasedProductIDs)")
    }
    
    // MARK: - Purchase Management
    
    /// 添加购买的产品 ID
    func addPurchasedProductID(_ productID: String) {
        purchasedProductIDs.insert(productID)
        isProUser = true
    }
    
    /// 移除购买的产品 ID
    func removePurchasedProductID(_ productID: String) {
        purchasedProductIDs.remove(productID)
        // 如果没有任何购买记录，则不是 Pro 用户
        if purchasedProductIDs.isEmpty {
            isProUser = false
        }
    }
    
    /// 清除所有购买记录（用于测试或重置）
    func clearPurchaseData() {
        purchasedProductIDs.removeAll()
        isProUser = false
        UserDefaults.standard.removeObject(forKey: Keys.lastPurchaseCheckDate)
        UserDefaults.standard.removeObject(forKey: Keys.isProUser)
        UserDefaults.standard.removeObject(forKey: Keys.purchasedProductIDs)
    }
    
    /// 模拟购买（用于测试，直接设置为 Pro 用户）
    func simulatePurchase(productID: String) {
        print("🎮 Simulating purchase for: \(productID)")
        addPurchasedProductID(productID)
    }
    
    /// 保存最后检查购买状态的日期
    func saveLastPurchaseCheckDate(_ date: Date) {
        UserDefaults.standard.set(date, forKey: Keys.lastPurchaseCheckDate)
    }
    
    /// 加载最后检查购买状态的日期
    func loadLastPurchaseCheckDate() -> Date? {
        return UserDefaults.standard.object(forKey: Keys.lastPurchaseCheckDate) as? Date
    }
    
    // MARK: - History Management
    
    /// 添加历史记录项
    func addHistoryAssetID(_ assetID: String) {
        var ids = historyAssetIDs
        // 防止重复，确保最新的在最前面
        if let index = ids.firstIndex(of: assetID) {
            ids.remove(at: index)
        }
        ids.insert(assetID, at: 0)
        historyAssetIDs = ids
    }
    
    /// 移除历史记录项
    func removeHistoryAssetID(_ assetID: String) {
        if let index = historyAssetIDs.firstIndex(of: assetID) {
            historyAssetIDs.remove(at: index)
        }
    }
    
    /// 清除所有历史记录
    func clearHistory() {
        historyAssetIDs = []
        UserDefaults.standard.removeObject(forKey: Keys.historyLastUpdated)
    }
    
    /// 获取历史记录最后更新时间
    func getHistoryLastUpdated() -> Date? {
        return UserDefaults.standard.object(forKey: Keys.historyLastUpdated) as? Date
    }
    
    // MARK: - App State Management
    
    /// 保存是否完成引导
    func saveHasCompletedOnboarding(_ value: Bool) {
        UserDefaults.standard.set(value, forKey: Keys.hasCompletedOnboarding)
    }
    
    /// 加载是否完成引导
    func loadHasCompletedOnboarding() -> Bool {
        return UserDefaults.standard.bool(forKey: Keys.hasCompletedOnboarding)
    }
    
    /// 保存最后使用的应用版本
    func saveLastAppVersion(_ version: String) {
        UserDefaults.standard.set(version, forKey: Keys.lastAppVersion)
    }
    
    /// 加载最后使用的应用版本
    func loadLastAppVersion() -> String? {
        return UserDefaults.standard.string(forKey: Keys.lastAppVersion)
    }
    
    /// 增加转换计数
    func incrementConversionCount() {
        let count = getConversionCount() + 1
        UserDefaults.standard.set(count, forKey: Keys.conversionCount)
    }
    
    /// 获取转换计数
    func getConversionCount() -> Int {
        return UserDefaults.standard.integer(forKey: Keys.conversionCount)
    }
    
    /// 重置转换计数
    func resetConversionCount() {
        UserDefaults.standard.removeObject(forKey: Keys.conversionCount)
    }
    
    // MARK: - 存储清理与计算
    
    /// 计算应用占用的总缓存大小（Caches + Tmp）
    func calculateTotalCacheSize() async -> Int64 {
        guard let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return 0
        }
        let tempURL = FileManager.default.temporaryDirectory
        
        let cacheSize = await calculateDirectorySize(at: cacheURL)
        let tempSize = await calculateDirectorySize(at: tempURL)
        
        return cacheSize + tempSize
    }
    
    /// 执行全面的缓存清理
    func clearAllCache() async {
        guard let cacheURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return
        }
        let tempURL = FileManager.default.temporaryDirectory
        
        // 清理 Caches
        if let contents = try? FileManager.default.contentsOfDirectory(at: cacheURL, includingPropertiesForKeys: nil) {
            for fileURL in contents {
                try? FileManager.default.removeItem(at: fileURL)
            }
        }
        
        // 清理 Tmp
        if let contents = try? FileManager.default.contentsOfDirectory(at: tempURL, includingPropertiesForKeys: nil) {
            for fileURL in contents {
                // 清理常见临时文件扩展名
                if ["mov", "jpg", "jpeg", "png", "tmp"].contains(fileURL.pathExtension.lowercased()) {
                    try? FileManager.default.removeItem(at: fileURL)
                }
            }
        }
    }
    
    /// 如果启用，则执行自动清理
    func performAutoCleanupIfNeeded() {
        guard autoCleanupEnabled else { return }
        
        // 延迟执行以避免在启动时占用过多资源
        DispatchQueue.global(qos: .background).asyncAfter(deadline: .now() + 2.0) {
            VideoProcessor.cleanupOldTempFiles(all: true)
        }
    }
    
    private func calculateDirectorySize(at url: URL) async -> Int64 {
        return await Task.detached {
            guard let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey], options: [.skipsHiddenFiles]) else {
                return Int64(0)
            }
            
            var totalSize: Int64 = 0
            for case let fileURL as URL in enumerator {
                if let fileSize = try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                    totalSize += Int64(fileSize)
                }
            }
            return totalSize
        }.value
    }
    
    // MARK: - Migration & Cleanup
    
    /// 迁移旧数据（如果需要）
    func migrateIfNeeded() {
        let oldHistoryKey = "livesnap_history_asset_ids"
        if let oldHistory = UserDefaults.standard.stringArray(forKey: oldHistoryKey), !oldHistory.isEmpty {
            historyAssetIDs = oldHistory
            UserDefaults.standard.removeObject(forKey: oldHistoryKey)
        }
    }
    
    /// 清除所有数据（用于测试或重置）
    func clearAllData() {
        let keys = [
            Keys.purchasedProductIDs,
            Keys.isProUser,
            Keys.lastPurchaseCheckDate,
            Keys.historyAssetIDs,
            Keys.historyLastUpdated,
            Keys.highResExportEnabled,
            Keys.autoCleanupEnabled,
            Keys.use60FPS,
            Keys.hasCompletedOnboarding,
            Keys.lastAppVersion,
            Keys.conversionCount
        ]
        
        for key in keys {
            UserDefaults.standard.removeObject(forKey: key)
        }
        
        // 重置所有属性
        isProUser = false
        purchasedProductIDs = []
        historyAssetIDs = []
        highResExportEnabled = true
        autoCleanupEnabled = false
        use60FPS = false
    }
}
