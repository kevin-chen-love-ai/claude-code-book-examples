//
//  Config.swift
//  livesnap
//
//  配置管理系统 - 集中管理所有配置常量
//

import Foundation
import CoreGraphics

enum Config {
    // MARK: - App Info

    enum App {
        static let name = "LiveSnap"
        static let bundleIdentifier = "com.example.livesnap"
        static let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        static let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    // MARK: - In-App Purchase

    enum IAP {
        static let monthlyProductID = "com.example.livesnap.pro.monthly"
        static let yearlyProductID = "com.example.livesnap.pro.yearly"

        static let monthlyPrice = "$4.99"
        static let yearlyPrice = "$49.99"

        static let allProductIDs = [monthlyProductID, yearlyProductID]

        // 免费用户限制
        enum Free {
            static let maxExportsBeforeWatermark = 3 // 前3次无水印
            static let watermarkOpacityLight: CGFloat = 0.15 // 轻度水印
            static let watermarkOpacityStandard: CGFloat = 0.25 // 标准水印
        }
    }

    // MARK: - Video Processing

    enum Processing {
        // 时长限制
        static let minDuration: TimeInterval = 0.5
        static let maxDuration: TimeInterval = 6.0
        static let recommendedDurationRange: ClosedRange<TimeInterval> = 1.5...3.0

        // FPS 设置
        static let defaultFPS = 30
        static let proFPS = 60
        static let minFPS = 24
        static let maxFPS = 60

        // 分辨率设置
        static let freeMaxDimension: CGFloat = 1920 // 1080p
        static let proMaxDimension: CGFloat = 3840 // 4K
        static let lockScreenWidth: CGFloat = 1080
        static let lockScreenHeight: CGFloat = 1920

        // 质量设置
        static let freeCompressionQuality: CGFloat = 0.8
        static let proCompressionQuality: CGFloat = 0.95
        static let keyFrameQuality: CGFloat = 0.9

        // 超时设置
        static let exportTimeout: TimeInterval = 120 // 2分钟
        static let processingTimeout: TimeInterval = 300 // 5分钟

        // 水印设置
        enum Watermark {
            static let text = "LIVESNAP"
            static let fontSize: CGFloat = 24
            static let opacity: CGFloat = 0.25
            static let rightPadding: CGFloat = 120
            static let bottomPadding: CGFloat = 60
        }
    }

    // MARK: - Cache Management

    enum Cache {
        // 缩略图缓存
        static let thumbnailCountLimit = 100
        static let thumbnailMemorySizeLimit = 100 * 1024 * 1024 // 100MB

        // 临时文件清理
        static let tempFileRetentionPeriod: TimeInterval = 24 * 60 * 60 // 24小时
        static let autoCleanupInterval: TimeInterval = 60 * 60 // 1小时

        // 图片生成器缓存
        static let imageGeneratorCacheLimit = 10
    }

    // MARK: - Animation

    enum Animation {
        static let fast: Double = 0.2
        static let normal: Double = 0.3
        static let slow: Double = 0.6

        static let spring = (response: 0.3, dampingFraction: 0.7)
        static let bouncy = (response: 0.4, dampingFraction: 0.6)

        static let shimmerDuration: Double = 2.0
        static let shimmerDelay: Double = 1.0

        static let loadingDuration: Double = 0.6
        static let loadingStaggerDelay: Double = 0.2
    }

    // MARK: - UI Settings

    enum UI {
        // 进度更新频率
        static let progressUpdateInterval: TimeInterval = 0.1

        // 网格布局
        static let historyGridColumns = 3
        static let historyGridSpacing: CGFloat = 8

        // 缩略图大小
        static let thumbnailSizeSmall = CGSize(width: 200, height: 200)
        static let thumbnailSizeMedium = CGSize(width: 400, height: 400)
        static let thumbnailSizeLarge = CGSize(width: 600, height: 600)

        // 时间轴
        static let timelineThumbnailCount = 10
        static let timelineMinWidth: CGFloat = 60

        // 预览
        static let previewMaxWidth: CGFloat = 400
        static let previewAspectRatio: CGFloat = 9 / 16
    }

    // MARK: - Storage Keys

    enum StorageKeys {
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
        static let firstLaunchDate = "livesnap.first_launch_date"
        static let lastLaunchDate = "livesnap.last_launch_date"

        // 统计数据
        static let totalExports = "livesnap.stats.total_exports"
        static let totalDuration = "livesnap.stats.total_duration"
        static let lastExportDate = "livesnap.stats.last_export_date"
    }

    // MARK: - URLs

    enum URLs {
        static let privacyPolicy = "https://example.com/privacy"
        static let termsOfService = "https://example.com/terms"
        static let support = "mailto:support@example.com"
        static let website = "https://example.com"
        static let appStore = "https://apps.apple.com/app/id0000000000" // 替换为实际 ID
    }

    // MARK: - Features Flags

    enum Features {
        static let batchProcessingEnabled = true
        static let historyEditingEnabled = true
        static let shareEnabled = true
        static let analyticsEnabled = false // 设置为 true 时启用分析
        static let debugMenuEnabled = false

        #if DEBUG
        static let showDebugInfo = true
        #else
        static let showDebugInfo = false
        #endif
    }

    // MARK: - Limits

    enum Limits {
        static let maxHistoryCount = 1000
        static let maxBatchSelection = 50
        static let maxVideoFileSize: Int64 = 500 * 1024 * 1024 // 500MB

        // 转化触发点
        static let upgradePromptAfterExports = 3
        static let upgradePromptAfterDays = 7
    }

    // MARK: - Notifications

    enum Notifications {
        static let purchaseStatusChanged = "LiveSnapPurchaseStatusChanged"
        static let historyUpdated = "LiveSnapHistoryUpdated"
        static let exportCompleted = "LiveSnapExportCompleted"
        static let exportFailed = "LiveSnapExportFailed"
    }

    // MARK: - Debug

    enum Debug {
        static let enableLogging = true
        static let logLevel: LogLevel = .info

        enum LogLevel {
            case verbose
            case debug
            case info
            case warning
            case error

            var emoji: String {
                switch self {
                case .verbose: return "💬"
                case .debug: return "🐛"
                case .info: return "ℹ️"
                case .warning: return "⚠️"
                case .error: return "❌"
                }
            }
        }
    }
}

// MARK: - Helper Extensions

extension Config {
    /// 检查是否为免费用户的第N次导出
    static func shouldShowLightWatermark(exportCount: Int) -> Bool {
        return exportCount >= IAP.Free.maxExportsBeforeWatermark && exportCount < Config.Limits.upgradePromptAfterExports + 7
    }

    /// 获取水印透明度
    static func watermarkOpacity(for exportCount: Int) -> CGFloat {
        if exportCount < IAP.Free.maxExportsBeforeWatermark {
            return 0 // 无水印
        } else if shouldShowLightWatermark(exportCount: exportCount) {
            return IAP.Free.watermarkOpacityLight
        } else {
            return IAP.Free.watermarkOpacityStandard
        }
    }

    /// 检查是否应显示升级提示
    static func shouldShowUpgradePrompt(exportCount: Int) -> Bool {
        return exportCount == IAP.Free.maxExportsBeforeWatermark ||
               exportCount == Limits.upgradePromptAfterExports ||
               exportCount % 10 == 0
    }
}
