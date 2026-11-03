package com.example.util;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 密码校验测试
 * 书中示例：ch13 13.4.2 TDD 工作流实操
 * 覆盖：有效密码、长度不足、缺少大写、缺少小写、缺少数字、缺少特殊字符、null 输入
 */
class ValidatePasswordTest {

    @Test
    void validPassword() {
        assertTrue(ValidatePassword.validatePassword("Hello1World!"));
    }

    @Test
    void tooShort() {
        assertFalse(ValidatePassword.validatePassword("Ab1!"));
    }

    @Test
    void missingUppercase() {
        assertFalse(ValidatePassword.validatePassword("hello1world!"));
    }

    @Test
    void missingLowercase() {
        assertFalse(ValidatePassword.validatePassword("HELLO1WORLD!"));
    }

    @Test
    void missingDigit() {
        assertFalse(ValidatePassword.validatePassword("HelloWorld!"));
    }

    @Test
    void missingSpecialChar() {
        assertFalse(ValidatePassword.validatePassword("Hello1World"));
    }

    @Test
    void nullPassword() {
        assertFalse(ValidatePassword.validatePassword(null));
    }
}
