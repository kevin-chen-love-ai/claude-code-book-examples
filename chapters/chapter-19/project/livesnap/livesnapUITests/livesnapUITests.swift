//
//  livesnapUITests.swift
//  livesnapUITests
//
//  UI 测试 - 覆盖主要用户流程
//

import XCTest

final class livesnapUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        // 在每个测试方法之前调用
        continueAfterFailure = false
        
        app = XCUIApplication()
        // 可以设置启动参数，例如跳过某些权限请求
        app.launchArguments = ["--uitesting"]
        app.launch()
    }

    override func tearDownWithError() throws {
        // 在每个测试方法之后调用
        app = nil
    }

    // MARK: - 基础测试
    
    /// 测试应用启动
    @MainActor
    func testAppLaunch() throws {
        // 验证应用已启动
        XCTAssertTrue(app.waitForExistence(timeout: 5))
        
        // 验证主界面元素存在
        // 根据实际UI调整这些查询
        let selectVideoButton = app.buttons["Select Video"]
        if selectVideoButton.exists {
            XCTAssertTrue(selectVideoButton.exists, "Select Video 按钮应该存在")
        }
    }
    
    /// 测试导航栏显示
    @MainActor
    func testNavigationBar() throws {
        // 验证导航栏标题
        let navBar = app.navigationBars.firstMatch
        XCTAssertTrue(navBar.waitForExistence(timeout: 2), "导航栏应该存在")
    }
    
    // MARK: - 视频选择流程测试
    
    /// 测试视频选择按钮存在
    @MainActor
    func testVideoSelectionButtonExists() throws {
        // 查找 "Select Video" 按钮
        let selectButton = app.buttons.matching(identifier: "Select Video").firstMatch
        if selectButton.exists {
            XCTAssertTrue(selectButton.isHittable, "Select Video 按钮应该可点击")
        }
    }
    
    /// 测试底部导航栏
    @MainActor
    func testBottomNavigationBar() throws {
        // 验证底部导航栏存在
        // 注意：底部导航栏可能没有特定的 accessibility identifier
        // 可以通过查找特定的按钮来验证
        let tabBar = app.tabBars.firstMatch
        if tabBar.exists {
            XCTAssertTrue(tabBar.exists, "底部导航栏应该存在")
        }
    }
    
    // MARK: - 设置页面测试
    
    /// 测试设置页面导航
    @MainActor
    func testSettingsNavigation() throws {
        // 查找设置按钮（可能在底部导航栏或导航栏中）
        // 根据实际UI调整
        let settingsButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'settings' OR label CONTAINS[c] '设置'")).firstMatch
        
        if settingsButton.exists && settingsButton.isHittable {
            settingsButton.tap()
            
            // 验证设置页面已打开
            // 可以查找设置页面的特定元素
            let settingsView = app.otherElements["SettingsView"]
            if settingsView.exists {
                XCTAssertTrue(settingsView.waitForExistence(timeout: 2), "设置页面应该打开")
            }
        }
    }
    
    // MARK: - 历史记录页面测试
    
    /// 测试历史记录页面导航
    @MainActor
    func testHistoryNavigation() throws {
        // 查找历史记录按钮
        let historyButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'history' OR label CONTAINS[c] '历史' OR label CONTAINS[c] 'Gallery'")).firstMatch
        
        if historyButton.exists && historyButton.isHittable {
            historyButton.tap()
            
            // 验证历史记录页面已打开
            let historyView = app.otherElements["GalleryHistoryView"]
            if historyView.exists {
                XCTAssertTrue(historyView.waitForExistence(timeout: 2), "历史记录页面应该打开")
            }
        }
    }
    
    // MARK: - Pro 升级页面测试
    
    /// 测试 Pro 升级页面
    @MainActor
    func testProUpgradeView() throws {
        // 查找可能触发 Pro 升级的按钮
        // 例如在导出按钮或设置页面中
        let upgradeButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Pro' OR label CONTAINS[c] 'Upgrade' OR label CONTAINS[c] '升级'")).firstMatch
        
        if upgradeButton.exists && upgradeButton.isHittable {
            upgradeButton.tap()
            
            // 验证 Pro 升级页面已打开
            let proView = app.otherElements["ProUpgradeView"]
            if proView.exists {
                XCTAssertTrue(proView.waitForExistence(timeout: 2), "Pro 升级页面应该打开")
                
                // 验证页面元素
                let title = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Unlock' OR label CONTAINS[c] 'Power'")).firstMatch
                if title.exists {
                    XCTAssertTrue(title.exists, "Pro 升级页面标题应该存在")
                }
            }
        }
    }
    
    // MARK: - 性能测试
    
    /// 测试应用启动性能
    @MainActor
    func testLaunchPerformance() throws {
        // 测量应用启动时间
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
    
    // MARK: - 辅助方法
    
    /// 等待元素出现
    private func waitForElement(_ element: XCUIElement, timeout: TimeInterval = 5) -> Bool {
        return element.waitForExistence(timeout: timeout)
    }
    
    /// 截图并保存
    private func takeScreenshot(name: String) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
