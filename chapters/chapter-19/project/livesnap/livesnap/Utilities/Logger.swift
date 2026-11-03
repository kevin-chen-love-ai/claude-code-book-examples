//
//  Logger.swift
//  livesnap
//
//  结构化日志系统 - 替换 print，提供分级日志和性能追踪
//

import Foundation
import os.log

/// 日志系统 - 结构化、分级、可配置
enum Logger {
    // MARK: - 基础日志方法

    /// 详细日志 - 用于调试细节
    static func verbose(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .verbose, file: file, function: function, line: line)
    }

    /// 调试日志 - 用于开发调试
    static func debug(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .debug, file: file, function: function, line: line)
    }

    /// 信息日志 - 用于一般信息
    static func info(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .info, file: file, function: function, line: line)
    }

    /// 警告日志 - 用于潜在问题
    static func warning(_ message: String, file: String = #file, function: String = #function, line: Int = #line) {
        log(message, level: .warning, file: file, function: function, line: line)
    }

    /// 错误日志 - 用于错误情况
    static func error(_ message: String, error: Error? = nil, file: String = #file, function: String = #function, line: Int = #line) {
        var fullMessage = message
        if let error = error {
            fullMessage += " | Error: \(error.localizedDescription)"
            if let recoverySuggestion = (error as? LocalizedError)?.recoverySuggestion {
                fullMessage += " | Suggestion: \(recoverySuggestion)"
            }
        }
        log(fullMessage, level: .error, file: file, function: function, line: line)
    }

    // MARK: - 性能日志

    /// 性能追踪 - 记录操作耗时
    static func performance(_ operation: String, duration: TimeInterval, file: String = #file, function: String = #function, line: Int = #line) {
        let message = "⏱ Performance: \(operation) took \(String(format: "%.3f", duration))s"
        log(message, level: .info, file: file, function: function, line: line)
    }

    /// 开始性能追踪
    static func startPerformanceTracking(_ operation: String) -> PerformanceTracker {
        return PerformanceTracker(operation: operation)
    }

    // MARK: - 业务日志

    /// 视频处理日志
    static func videoProcessing(_ message: String) {
        info("🎬 Video: \(message)")
    }

    /// Live Photo 创建日志
    static func livePhoto(_ message: String) {
        info("📸 LivePhoto: \(message)")
    }

    /// 购买相关日志
    static func purchase(_ message: String) {
        info("💰 Purchase: \(message)")
    }

    /// 存储相关日志
    static func storage(_ message: String) {
        info("💾 Storage: \(message)")
    }

    /// 用户行为日志
    static func userAction(_ message: String) {
        info("👤 User: \(message)")
    }

    // MARK: - 内部实现

    private static func log(_ message: String, level: Config.Debug.LogLevel, file: String, function: String, line: Int) {
        // 检查是否启用日志
        guard Config.Debug.enableLogging else { return }

        // 检查日志级别
        guard shouldLog(level: level) else { return }

        // 提取文件名
        let fileName = (file as NSString).lastPathComponent

        // 格式化时间
        let timestamp = dateFormatter.string(from: Date())

        // 构建日志消息
        let logMessage = "\(level.emoji) [\(timestamp)] [\(fileName):\(line)] \(function) - \(message)"

        #if DEBUG
        // Debug 模式：输出到控制台
        print(logMessage)

        // 同时使用 OSLog（更好的性能和系统集成）
        if #available(iOS 14.0, *) {
            let osLog = OSLog(subsystem: Config.App.bundleIdentifier, category: categoryForLevel(level))
            os_log("%{public}@", log: osLog, type: osLogType(for: level), logMessage)
        }
        #else
        // Release 模式：只使用 OSLog
        if #available(iOS 14.0, *) {
            let osLog = OSLog(subsystem: Config.App.bundleIdentifier, category: categoryForLevel(level))
            os_log("%{public}@", log: osLog, type: osLogType(for: level), logMessage)
        }
        #endif

        // TODO: 在生产环境中，可以将错误日志发送到分析服务（如 Firebase Crashlytics）
        if level == .error && Config.Features.analyticsEnabled {
            // 发送到分析服务
            // Analytics.logError(message)
        }
    }

    private static func shouldLog(level: Config.Debug.LogLevel) -> Bool {
        let levels: [Config.Debug.LogLevel] = [.verbose, .debug, .info, .warning, .error]
        guard let currentIndex = levels.firstIndex(of: Config.Debug.logLevel),
              let logIndex = levels.firstIndex(of: level) else {
            return true
        }
        return logIndex >= currentIndex
    }

    private static func categoryForLevel(_ level: Config.Debug.LogLevel) -> String {
        switch level {
        case .verbose: return "Verbose"
        case .debug: return "Debug"
        case .info: return "Info"
        case .warning: return "Warning"
        case .error: return "Error"
        }
    }

    private static func osLogType(for level: Config.Debug.LogLevel) -> OSLogType {
        switch level {
        case .verbose: return .debug
        case .debug: return .debug
        case .info: return .info
        case .warning: return .default
        case .error: return .error
        }
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter
    }()
}

// MARK: - Performance Tracker

/// 性能追踪器 - 自动计算和记录操作耗时
class PerformanceTracker {
    private let operation: String
    private let startTime: Date

    init(operation: String) {
        self.operation = operation
        self.startTime = Date()
        Logger.debug("Started: \(operation)")
    }

    /// 结束追踪并记录耗时
    func end() {
        let duration = Date().timeIntervalSince(startTime)
        Logger.performance(operation, duration: duration)
    }

    deinit {
        // 如果忘记调用 end()，在 deinit 时自动记录
        let duration = Date().timeIntervalSince(startTime)
        Logger.performance(operation, duration: duration)
    }
}

// MARK: - 便捷扩展

extension Logger {
    /// 记录函数进入
    static func enter(function: String = #function) {
        verbose("→ Enter \(function)")
    }

    /// 记录函数退出
    static func exit(function: String = #function) {
        verbose("← Exit \(function)")
    }

    /// 记录对象分配
    static func allocated(_ object: String) {
        verbose("✨ Allocated: \(object)")
    }

    /// 记录对象释放
    static func deallocated(_ object: String) {
        verbose("♻️ Deallocated: \(object)")
    }
}

// MARK: - 使用示例

/*
 // 基础日志
 Logger.info("App launched")
 Logger.warning("Low memory warning")
 Logger.error("Failed to process video", error: someError)

 // 性能追踪（自动计算耗时）
 let tracker = Logger.startPerformanceTracking("Video Export")
 // ... 执行耗时操作
 tracker.end() // 输出: ⏱ Performance: Video Export took 2.345s

 // 或使用自动追踪（deinit 时自动记录）
 func processVideo() {
     let tracker = Logger.startPerformanceTracking("processVideo")
     // ... 处理视频
     // tracker 会在函数结束时自动记录耗时
 }

 // 业务日志
 Logger.videoProcessing("Started processing video: \(videoURL)")
 Logger.livePhoto("Live Photo created successfully")
 Logger.purchase("User purchased monthly subscription")

 // 函数追踪
 func someFunction() {
     Logger.enter() // → Enter someFunction()
     defer { Logger.exit() } // ← Exit someFunction()
     // ...
 }
 */
