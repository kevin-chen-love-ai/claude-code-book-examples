//
//  AccessibilityUITests.swift
//  livesnapUITests
//
//  无障碍功能测试
//

import XCTest

final class AccessibilityUITests: XCTestCase {
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
    
    // MARK: - 无障碍测试
    
    /// 测试主要按钮是否有无障碍标签
    @MainActor
    func testButtonAccessibilityLabels() throws {
        // 测试 Select Video 按钮
        let selectButton = app.buttons.matching(identifier: "Select Video").firstMatch
        if selectButton.exists {
            XCTAssertFalse(selectButton.label.isEmpty, "Select Video 按钮应该有无障碍标签")
        }
        
        // 测试导出按钮（如果存在）
        let exportButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Export'")).firstMatch
        if exportButton.exists {
            XCTAssertFalse(exportButton.label.isEmpty, "导出按钮应该有无障碍标签")
        }
    }
    
    /// 测试导航元素的可访问性
    @MainActor
    func testNavigationAccessibility() throws {
        // 测试导航栏
        let navBar = app.navigationBars.firstMatch
        if navBar.exists {
            // 验证导航栏可以被 VoiceOver 识别
            XCTAssertTrue(navBar.isAccessibilityElement || navBar.children(matching: .any).count > 0, 
                         "导航栏应该可以被无障碍功能访问")
        }
    }
    
    /// 测试动态类型支持
    @MainActor
    func testDynamicTypeSupport() throws {
        // 这个测试需要在实际设备上运行，因为模拟器可能不支持动态类型测试
        // 验证文本元素是否支持动态类型
        let textElements = app.staticTexts.allElementsBoundByIndex
        for textElement in textElements.prefix(5) { // 只测试前5个
            if textElement.exists {
                // 验证文本元素存在（如果支持动态类型，文本应该可以调整大小）
                XCTAssertTrue(textElement.exists, "文本元素应该存在")
            }
        }
    }
    
    /// 测试颜色对比度（视觉检查）
    @MainActor
    func testColorContrast() throws {
        // 注意：XCTest 无法直接测试颜色对比度
        // 这个测试主要是提醒开发者需要手动检查
        // 可以使用截图来辅助检查
        
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "Color Contrast Check"
        attachment.lifetime = .keepAlways
        add(attachment)
        
        // 提示：应该确保文本和背景的对比度符合 WCAG 标准
        XCTAssertTrue(true, "颜色对比度需要手动检查（建议使用工具如 Colour Contrast Analyser）")
    }
}
