//
//  livesnapApp.swift
//  livesnap
//
//  Created by Example Author on 2026/1/8.
//

import SwiftUI

@main
struct livesnapApp: App {
    // 使用 @ObservedObject 而不是 @StateObject，因为 StorageManager 是单例
    @ObservedObject private var storage = StorageManager.shared
    @State private var showSplash = true

    init() {
        // 应用启动时的初始化
        // 延迟执行文件清理，避免在初始化时出现问题
        DispatchQueue.main.async {
            VideoProcessor.cleanupOldTempFiles(all: false)
        }
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                // 主视图
                VideoSelectionView()
                    .preferredColorScheme(.dark)
                    .opacity(showSplash ? 0 : 1)
                    .onAppear {
                        // 迁移旧数据（如果需要）
                        Task { @MainActor in
                            storage.migrateIfNeeded()

                            // 自动清理（如果启用）
                            if storage.autoCleanupEnabled {
                                VideoProcessor.cleanupOldTempFiles()
                            }
                        }
                    }
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)) { _ in
                        // 处理内存警告
                        VideoProcessor.cleanupOldTempFiles(all: false)
                    }
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                        // 应用进入前台时，验证订阅状态，确保购买资格不会丢失
                        Task { @MainActor in
                            await StoreKitManager.shared.checkPurchases()
                        }
                    }

                // 启动动画（覆盖在主视图之上）
                if showSplash {
                    SplashScreenView {
                        // 动画完成后隐藏启动屏
                        showSplash = false
                    }
                    .transition(.opacity)
                    .zIndex(1) // 确保在最上层
                }
            }
        }
    }
}
