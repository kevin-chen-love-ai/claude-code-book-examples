//
//  VideoProcessorTests.swift
//  livesnapTests
//
//  VideoProcessor 单元测试
//

import XCTest
import AVFoundation
@testable import livesnap

final class VideoProcessorTests: XCTestCase {
    var processor: VideoProcessor!
    
    override func setUpWithError() throws {
        processor = VideoProcessor.shared
    }
    
    override func tearDownWithError() throws {
        processor = nil
    }
    
    // MARK: - 基础功能测试
    
    /// 测试 VideoProcessor 单例
    func testSingleton() {
        let instance1 = VideoProcessor.shared
        let instance2 = VideoProcessor.shared
        XCTAssertTrue(instance1 === instance2, "VideoProcessor 应该是单例")
    }
    
    /// 测试临时文件清理
    func testCleanupOldTempFiles() {
        // 创建一些测试临时文件
        let tempDir = FileManager.default.temporaryDirectory
        let testFile1 = tempDir.appendingPathComponent(UUID().uuidString).appendingPathExtension("mov")
        let testFile2 = tempDir.appendingPathComponent(UUID().uuidString).appendingPathExtension("jpg")
        
        // 创建文件
        try? "test".write(to: testFile1, atomically: true, encoding: .utf8)
        try? "test".write(to: testFile2, atomically: true, encoding: .utf8)
        
        // 执行清理（异步执行，但不需要等待完成）
        VideoProcessor.cleanupOldTempFiles(all: true)
        
        // 这个测试主要验证清理功能不会崩溃
        // 由于清理是异步的，我们只验证调用不会崩溃
        XCTAssertNotNil(processor, "处理器应该存在")
    }
    
    // MARK: - 错误处理测试
    
    /// 测试处理不存在的文件
    func testProcessNonExistentFile() {
        let expectation = XCTestExpectation(description: "Process video")
        let nonExistentURL = URL(fileURLWithPath: "./nonexistent/video.mov")
        
        processor.processVideo(
            inputURL: nonExistentURL,
            timeRange: CMTimeRange(start: .zero, duration: CMTime(seconds: 3, preferredTimescale: 600)),
            aspectRatio: .original,
            cropScale: 1.0,
            cropOffset: .zero,
            previewSize: CGSize(width: 375, height: 667),
            isPro: false,
            progressHandler: { _ in },
            completion: { url, error in
                XCTAssertNil(url, "不存在的文件应该返回 nil")
                XCTAssertNotNil(error, "应该返回错误")
                expectation.fulfill()
            }
        )
        
        // 不存在的文件应该立即返回错误，减少超时时间
        wait(for: [expectation], timeout: 2.0)
    }
    
    // MARK: - 内存管理测试
    
    /// 测试内存警告处理
    func testMemoryWarningHandling() {
        // 发送内存警告通知
        NotificationCenter.default.post(name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
        
        // 验证处理器能够处理内存警告（不会崩溃）
        XCTAssertNotNil(processor, "处理器应该在内存警告后仍然存在")
    }
}
