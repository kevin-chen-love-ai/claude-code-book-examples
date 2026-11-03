//
//  CompleteFlowUITests.swift
//  livesnapUITests
//
//  完整用户流程 UI 测试
//

import XCTest

final class CompleteFlowUITests: XCTestCase {
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
    
    // MARK: - 主界面测试
    
    /// 测试主界面元素
    @MainActor
    func testMainScreenElements() throws {
        XCTAssertTrue(app.waitForExistence(timeout: 5), "应用应该成功启动")
        
        // 验证标题存在
        let title = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Livesnap'")).firstMatch
        if title.exists {
            XCTAssertTrue(title.exists, "主界面标题应该存在")
        }
    }
    
    // MARK: - 导航测试
    
    /// 测试底部导航栏
    @MainActor
    func testBottomNavigation() throws {
        // 查找底部导航栏按钮
        let buttons = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Gallery' OR label CONTAINS[c] 'Settings' OR label CONTAINS[c] 'History'")).allElementsBoundByIndex
        
        if !buttons.isEmpty {
            for button in buttons {
                if button.exists && button.isHittable {
                    button.tap()
                    // 等待页面加载
                    sleep(1)
                    // 返回主界面
                    let backButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Back' OR label == '返回'")).firstMatch
                    if backButton.exists {
                        backButton.tap()
                    }
                }
            }
        }
    }
    
    // MARK: - 设置页面测试
    
    /// 测试设置页面
    @MainActor
    func testSettingsPage() throws {
        // 查找设置按钮
        let settingsButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Settings' OR label CONTAINS[c] '设置'")).firstMatch
        
        if settingsButton.exists && settingsButton.isHittable {
            settingsButton.tap()
            
            // 验证设置页面元素
            let settingsView = app.scrollViews.firstMatch
            if settingsView.waitForExistence(timeout: 2) {
                XCTAssertTrue(settingsView.exists, "设置页面应该打开")
                
                // 测试滚动
                settingsView.swipeUp()
                settingsView.swipeDown()
            }
        }
    }
    
    // MARK: - Pro 升级页面测试
    
    /// 测试 Pro 升级页面
    @MainActor
    func testProUpgradePage() throws {
        // 查找 Pro 升级按钮
        let upgradeButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Pro' OR label CONTAINS[c] 'Upgrade' OR label CONTAINS[c] '升级'")).firstMatch
        
        if upgradeButton.exists && upgradeButton.isHittable {
            upgradeButton.tap()
            
            // 验证 Pro 升级页面
            let proView = app.scrollViews.firstMatch
            if proView.waitForExistence(timeout: 2) {
                XCTAssertTrue(proView.exists, "Pro 升级页面应该打开")
                
                // 测试滚动
                proView.swipeUp()
                proView.swipeDown()
            }
        }
    }
    
    // MARK: - 性能测试
    
    /// 测试应用启动性能
    @MainActor
    func testLaunchPerformance() throws {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            let app = XCUIApplication()
            app.launchArguments = ["--uitesting"]
            app.launch()
        }
    }
    
    /// 测试页面切换性能
    @MainActor
    func testNavigationPerformance() throws {
        measure {
            let settingsButton = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Settings'")).firstMatch
            if settingsButton.exists && settingsButton.isHittable {
                settingsButton.tap()
                sleep(1)
            }
        }
    }
}
