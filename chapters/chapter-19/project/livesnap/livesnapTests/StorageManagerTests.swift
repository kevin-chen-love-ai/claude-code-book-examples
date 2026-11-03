//
//  StorageManagerTests.swift
//  livesnapTests
//
//  StorageManager 单元测试
//

import XCTest
@testable import livesnap

@MainActor
final class StorageManagerTests: XCTestCase {
    var storage: StorageManager!
    
    override func setUpWithError() throws {
        storage = StorageManager.shared
    }
    
    override func tearDownWithError() throws {
        // 清理测试数据
        storage.isProUser = false
        storage.purchasedProductIDs = []
        storage.historyAssetIDs = []
    }
    
    // MARK: - Pro 用户状态测试
    
    /// 测试 Pro 用户状态保存和加载
    func testProUserStatus() {
        // 设置 Pro 用户
        storage.isProUser = true
        XCTAssertTrue(storage.isProUser, "Pro 用户状态应该被保存")
        
        // 重置状态
        storage.isProUser = false
        XCTAssertFalse(storage.isProUser, "Pro 用户状态应该被清除")
    }
    
    /// 测试购买产品 ID 保存和加载
    func testPurchasedProductIDs() {
        let testIDs: Set<String> = ["com.example.livesnap.pro.monthly"]
        
        storage.purchasedProductIDs = testIDs
        XCTAssertEqual(storage.purchasedProductIDs, testIDs, "购买产品 ID 应该被保存")
        
        storage.purchasedProductIDs = []
        XCTAssertTrue(storage.purchasedProductIDs.isEmpty, "购买产品 ID 应该被清除")
    }
    
    // MARK: - 历史记录测试
    
    /// 测试历史记录保存和加载
    func testHistoryAssetIDs() {
        let testIDs = ["asset1", "asset2", "asset3"]
        
        storage.historyAssetIDs = testIDs
        XCTAssertEqual(storage.historyAssetIDs, testIDs, "历史记录应该被保存")
        
        storage.historyAssetIDs = []
        XCTAssertTrue(storage.historyAssetIDs.isEmpty, "历史记录应该被清除")
    }
    
    // MARK: - 设置测试
    
    /// 测试高分辨率导出设置
    func testHighResExportEnabled() {
        storage.highResExportEnabled = true
        XCTAssertTrue(storage.highResExportEnabled, "高分辨率导出设置应该被保存")
        
        storage.highResExportEnabled = false
        XCTAssertFalse(storage.highResExportEnabled, "高分辨率导出设置应该被清除")
    }
    
    /// 测试自动清理设置
    func testAutoCleanupEnabled() {
        storage.autoCleanupEnabled = true
        XCTAssertTrue(storage.autoCleanupEnabled, "自动清理设置应该被保存")
        
        storage.autoCleanupEnabled = false
        XCTAssertFalse(storage.autoCleanupEnabled, "自动清理设置应该被清除")
    }
    
    /// 测试 60 FPS 设置
    func testUse60FPS() {
        storage.use60FPS = true
        XCTAssertTrue(storage.use60FPS, "60 FPS 设置应该被保存")
        
        storage.use60FPS = false
        XCTAssertFalse(storage.use60FPS, "60 FPS 设置应该被清除")
    }
}
