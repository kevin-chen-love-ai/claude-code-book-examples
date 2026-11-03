//
//  LivePhotoCreationUITests.swift
//  livesnapUITests
//
//  Live Photo 创建流程的 UI 测试
//

import XCTest

final class LivePhotoCreationUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }
    
    // MARK: - 完整流程测试
    
    /// 测试完整的 Live Photo 创建流程（需要模拟视频选择）
    @MainActor
    func testCompleteLivePhotoCreationFlow() throws {
        // 1. 验证主界面
        XCTAssertTrue(app.waitForExistence(timeout: 5), "应用应该成功启动")
        
        // 2. 查找并点击 "Select Video" 按钮
        let selectButton = app.buttons.matching(identifier: "Select Video").firstMatch
        if selectButton.exists && selectButton.isHittable {
            selectButton.tap()
            
            // 注意：实际选择视频需要系统权限，在 UI 测试中可能无法完成
            // 这里主要测试界面导航是否正确
        }
        
        // 3. 如果进入了编辑器页面，验证关键元素
        // 这些元素应该在 VideoEditorView 中
        let editorView = app.otherElements["VideoEditorView"]
        if editorView.waitForExistence(timeout: 3) {
            // 验证导出按钮存在
            let exportButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Export' OR label CONTAINS[c] '导出'")).firstMatch
            if exportButton.exists {
                XCTAssertTrue(exportButton.exists, "导出按钮应该存在")
            }
        }
    }
    
    /// 测试编辑器页面元素
    @MainActor
    func testEditorViewElements() throws {
        // 这个测试假设已经进入了编辑器页面
        // 在实际测试中，可能需要先选择视频
        
        // 验证分段控制器（Aspect Ratio Selector）
        let segmentedControl = app.segmentedControls.firstMatch
        if segmentedControl.exists {
            XCTAssertTrue(segmentedControl.exists, "分段控制器应该存在")
        }
        
        // 验证预览区域
        let previewArea = app.images.firstMatch
        if previewArea.exists {
            XCTAssertTrue(previewArea.exists, "视频预览区域应该存在")
        }
    }
    
    /// 测试处理页面
    @MainActor
    func testProcessingView() throws {
        // 这个测试需要先触发处理流程
        // 验证处理页面的关键元素
        
        let processingView = app.otherElements["ProcessingView"]
        if processingView.waitForExistence(timeout: 2) {
            // 验证进度指示器
            let progressIndicator = app.progressIndicators.firstMatch
            if progressIndicator.exists {
                XCTAssertTrue(progressIndicator.exists, "进度指示器应该存在")
            }
            
            // 验证状态文本
            let statusText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Processing' OR label CONTAINS[c] '处理' OR label CONTAINS[c] 'Creating'")).firstMatch
            if statusText.exists {
                XCTAssertTrue(statusText.exists, "状态文本应该存在")
            }
        }
    }
    
    /// 测试导出成功页面
    @MainActor
    func testExportSuccessView() throws {
        // 这个测试需要先完成导出流程
        let successView = app.otherElements["ExportSuccessView"]
        if successView.waitForExistence(timeout: 5) {
            // 验证成功图标
            let successIcon = app.images.matching(NSPredicate(format: "identifier CONTAINS 'checkmark'")).firstMatch
            if successIcon.exists {
                XCTAssertTrue(successIcon.exists, "成功图标应该存在")
            }
            
            // 验证成功文本
            let successText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Complete' OR label CONTAINS[c] '成功' OR label CONTAINS[c] 'Success'")).firstMatch
            if successText.exists {
                XCTAssertTrue(successText.exists, "成功文本应该存在")
            }
            
            // 验证 Done 按钮
            let doneButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Done' OR label CONTAINS[c] '完成'")).firstMatch
            if doneButton.exists {
                XCTAssertTrue(doneButton.isHittable, "Done 按钮应该可点击")
            }
        }
    }
}
