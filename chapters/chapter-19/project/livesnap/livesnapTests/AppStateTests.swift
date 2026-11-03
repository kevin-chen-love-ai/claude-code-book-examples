//
//  AppStateTests.swift
//  livesnapTests
//
//  AppState 单元测试
//

import XCTest
import AVFoundation
@testable import livesnap

@MainActor
final class AppStateTests: XCTestCase {
    var appState: AppState!
    
    override func setUpWithError() throws {
        appState = AppState()
    }
    
    override func tearDownWithError() throws {
        appState = nil
    }
    
    // MARK: - 状态管理测试
    
    /// 测试处理状态
    func testProcessingState() {
        // 由于 AppState 和测试类都是 @MainActor，可以直接同步操作
        appState.isProcessing = true
        appState.processingProgress = 0.5
        appState.processingStatus = "Processing..."
        
        XCTAssertTrue(appState.isProcessing, "处理状态应该被设置")
        XCTAssertEqual(appState.processingProgress, 0.5, accuracy: 0.01, "处理进度应该被设置")
        XCTAssertEqual(appState.processingStatus, "Processing...", "处理状态文本应该被设置")
    }
    
    /// 测试错误状态
    func testErrorState() {
        let errorMessage = "Test error"
        appState.processingError = errorMessage
        
        XCTAssertEqual(appState.processingError, errorMessage, "错误信息应该被设置")
        
        appState.processingError = nil
        XCTAssertNil(appState.processingError, "错误信息应该被清除")
    }
    
    /// 测试导出成功状态
    func testExportSuccessState() {
        let assetID = "test-asset-id"
        appState.exportedLivePhotoAssetID = assetID
        appState.showExportSuccess = true
        
        XCTAssertEqual(appState.exportedLivePhotoAssetID, assetID, "导出的 Live Photo Asset ID 应该被设置")
        XCTAssertTrue(appState.showExportSuccess, "导出成功状态应该被设置")
    }
    
    // MARK: - 编辑参数测试
    
    /// 测试时间范围设置
    func testTimeRange() {
        let timeRange = CMTimeRange(
            start: CMTime(seconds: 1.0, preferredTimescale: 600),
            duration: CMTime(seconds: 3.0, preferredTimescale: 600)
        )
        
        appState.selectedTimeRange = timeRange
        XCTAssertNotNil(appState.selectedTimeRange, "时间范围应该被设置")
        if let range = appState.selectedTimeRange {
            XCTAssertEqual(range.start.seconds, 1.0, accuracy: 0.01, "时间范围开始时间应该正确")
            XCTAssertEqual(range.duration.seconds, 3.0, accuracy: 0.01, "时间范围持续时间应该正确")
        }
    }
    
    /// 测试关键帧时间设置
    func testKeyFrameTime() {
        let keyFrameTime = CMTime(seconds: 2.0, preferredTimescale: 600)
        appState.keyFrameTime = keyFrameTime
        
        XCTAssertEqual(appState.keyFrameTime.seconds, 2.0, accuracy: 0.01, "关键帧时间应该被设置")
    }
    
    /// 测试宽高比设置
    func testAspectRatio() {
        appState.aspectRatio = .lockScreen
        XCTAssertEqual(appState.aspectRatio, .lockScreen, "宽高比应该被设置为锁屏")
        
        appState.aspectRatio = .original
        XCTAssertEqual(appState.aspectRatio, .original, "宽高比应该被设置为原始")
    }
    
    /// 测试裁剪参数
    func testCropParameters() {
        appState.cropScale = 1.5
        appState.cropOffset = CGSize(width: 10, height: 20)
        
        XCTAssertEqual(appState.cropScale, 1.5, accuracy: 0.01, "裁剪缩放应该被设置")
        XCTAssertEqual(appState.cropOffset.width, 10, accuracy: 0.01, "裁剪偏移宽度应该被设置")
        XCTAssertEqual(appState.cropOffset.height, 20, accuracy: 0.01, "裁剪偏移高度应该被设置")
    }
}
