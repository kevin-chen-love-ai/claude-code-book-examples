//
//  Theme.swift
//  livesnap
//
//  LiveSnap 高级感配色方案
//

import SwiftUI

struct AppTheme {
    // 主背景色
    static let midnightBlack = Color(hex: "0E0F12")
    
    // 次背景色（卡片）
    static let graphiteGray = Color(hex: "1C1E23")
    
    // 主文字色
    static let primaryText = Color(hex: "F5F6F7")
    
    // 次级文字
    static let secondaryText = Color(hex: "9DA0A6")
    
    // 系统灰色
    static let systemGray = Color(hex: "8E8E93")
    
    // 品牌强调色
    static let iosBlue = Color(hex: "3A7BFF")
    
    // 成功色
    static let successGreen = Color(hex: "32D74B")
    
    // 警告色
    static let warningOrange = Color(hex: "FF9F0A")
    
    // 水印色（半透明白）
    static let watermarkWhite = Color.white.opacity(0.25)
    
    // 圆角规范
    struct CornerRadius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let extraLarge: CGFloat = 20
        static let card: CGFloat = 24
    }
    
    // 阴影规范 - 增强多层次阴影系统
    struct Shadow {
        static let subtle = ShadowStyle(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
        static let medium = ShadowStyle(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
        static let strong = ShadowStyle(color: Color.black.opacity(0.3), radius: 12, x: 0, y: 6)
        static let floating = ShadowStyle(color: AppTheme.iosBlue.opacity(0.3), radius: 16, x: 0, y: 8)
        
        // 新增：更精细的阴影层次
        static let card = ShadowStyle(color: Color.black.opacity(0.15), radius: 10, x: 0, y: 4)
        static let cardElevated = ShadowStyle(color: Color.black.opacity(0.25), radius: 16, x: 0, y: 8)
        static let button = ShadowStyle(color: AppTheme.iosBlue.opacity(0.4), radius: 20, x: 0, y: 10)
        static let inner = ShadowStyle(color: Color.black.opacity(0.2), radius: 4, x: 0, y: -2) // 内阴影
        static let glow = ShadowStyle(color: AppTheme.iosBlue.opacity(0.5), radius: 24, x: 0, y: 0) // 发光效果
    }
    
    // 线条规范 - 精细的边框和分隔线
    struct Border {
        static let subtle = BorderStyle(color: Color.white.opacity(0.05), width: 1)
        static let medium = BorderStyle(color: Color.white.opacity(0.08), width: 1)
        static let strong = BorderStyle(color: Color.white.opacity(0.12), width: 1)
        static let accent = BorderStyle(color: AppTheme.iosBlue.opacity(0.3), width: 1.5)
        static let divider = BorderStyle(color: Color.white.opacity(0.06), width: 0.5)
    }
    
    struct BorderStyle {
        let color: Color
        let width: CGFloat
    }
    
    struct ShadowStyle {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
    
    // 布局规范
    struct Layout {
        static let horizontalPadding: CGFloat = 16
        static let cardPadding: CGFloat = 20
        static let maxContentWidth: CGFloat = 448 // 保持原有设计

        // 按钮规范（根据视觉描述）
        struct Button {
            static let primaryHeight: CGFloat = 56 // 原型规范：52-56
            static let secondaryHeight: CGFloat = 52
            static let primaryCornerRadius: CGFloat = 16 // 原型规范：14-16
            static let secondaryCornerRadius: CGFloat = 14
        }

        // 间距规范
        struct Spacing {
            static let small: CGFloat = 8
            static let medium: CGFloat = 16
            static let large: CGFloat = 24
            static let extraLarge: CGFloat = 32
            static let section: CGFloat = 40
        }

        // 字体规范
        struct Typography {
            static let title: CGFloat = 17
            static let headline: CGFloat = 20
            static let body: CGFloat = 15
            static let caption: CGFloat = 13
            static let small: CGFloat = 11
        }
    }

    // 动画规范 - 统一动画时长，确保一致性
    struct AnimationDuration {
        static let fast: Double = 0.2
        static let normal: Double = 0.3
        static let slow: Double = 0.6

        // Spring 动画参数
        static let springResponse: Double = 0.3
        static let springDamping: Double = 0.7

        // 特效动画
        static let shimmer: Double = 2.0
        static let loading: Double = 0.6
        static let pulse: Double = 1.0
    }
}


extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

