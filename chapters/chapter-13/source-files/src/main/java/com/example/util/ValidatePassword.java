package com.example.util;

/**
 * 密码校验工具
 * 书中示例：ch13 13.4.2 TDD 工作流实操（以密码验证函数为例）
 * 规格：至少 8 位，且至少各包含一个大写字母、小写字母、数字、特殊字符。
 */
public class ValidatePassword {

    public static boolean validatePassword(String password) {
        if (password == null || password.length() < 8) return false;
        if (!password.matches(".*[A-Z].*")) return false;        // 大写字母
        if (!password.matches(".*[a-z].*")) return false;        // 小写字母
        if (!password.matches(".*[0-9].*")) return false;        // 数字
        if (!password.matches(".*[^A-Za-z0-9].*")) return false; // 特殊字符
        return true;
    }
}
