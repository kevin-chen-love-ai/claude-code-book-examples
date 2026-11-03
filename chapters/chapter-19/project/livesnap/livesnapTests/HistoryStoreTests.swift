//
//  HistoryStoreTests.swift
//  livesnapTests
//
//  HistoryStore 单元测试
//

import XCTest
@testable import livesnap

@MainActor
final class HistoryStoreTests: XCTestCase {
    var historyStore: HistoryStore!
    
    override func setUpWithError() throws {
        historyStore = HistoryStore.shared
    }
    
    override func tearDownWithError() throws {
        // 清理测试数据 - 通过 StorageManager 清理
        let storage = StorageManager.shared
        storage.historyAssetIDs = []
    }
    
    // MARK: - 历史记录保存测试
    
    /// 测试保存历史记录
    func testSaveHistory() {
        let assetID = "test-asset-id-1"
        historyStore.save(assetID: assetID)
        
        let storage = StorageManager.shared
        let history = storage.historyAssetIDs
        XCTAssertTrue(history.contains(assetID), "历史记录应该包含保存的 Asset ID")
    }
    
    /// 测试保存多个历史记录
    func testSaveMultipleHistory() {
        let assetIDs = ["asset1", "asset2", "asset3"]
        
        for assetID in assetIDs {
            historyStore.save(assetID: assetID)
        }
        
        let storage = StorageManager.shared
        let history = storage.historyAssetIDs
        // 历史记录可能包含之前的记录，所以只检查是否包含新添加的
        for assetID in assetIDs {
            XCTAssertTrue(history.contains(assetID), "历史记录应该包含 \(assetID)")
        }
    }
    
    /// 测试历史记录去重
    func testHistoryDeduplication() {
        let assetID = "duplicate-asset-id"
        
        // 保存相同的 Asset ID 多次
        historyStore.save(assetID: assetID)
        historyStore.save(assetID: assetID)
        historyStore.save(assetID: assetID)
        
        let storage = StorageManager.shared
        let history = storage.historyAssetIDs
        let count = history.filter { $0 == assetID }.count
        XCTAssertEqual(count, 1, "历史记录应该去重，相同的 Asset ID 只保存一次")
    }
}
