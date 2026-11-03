package com.example.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 折扣服务单元测试
 * 书中示例：ch13 测试覆盖的三大陷阱（13.1 节）
 *
 * 注意：以下测试演示了“表面覆盖”陷阱与对应的正确写法。
 * 书中的 13.1 节逐行分析了这些测试的问题。
 */
class DiscountServiceTest {

    private final DiscountService discountService = new DiscountService();

    // [反例] 表面覆盖（覆盖率 100%，但没用）
    @Test
    void runsWithoutError() {
        BigDecimal result = discountService.calculateDiscount(
            BigDecimal.valueOf(100), "vip");
        assertNotNull(result);  // 只验证有返回值，不验证对不对
    }

    // [正例] 有用的测试：验证具体值
    // 注意：BigDecimal.equals() 会比较精度（scale），如果实现返回 80.0 而预期是 80，equals 会失败。
    // 生产代码中建议用 compareTo() == 0 比较，测试中确保精度一致即可。
    @Test
    void vipGets20PercentOff() {
        BigDecimal result = discountService.calculateDiscount(
            BigDecimal.valueOf(100), "vip");
        assertEquals(0, result.compareTo(BigDecimal.valueOf(80)));
    }

    @Test
    void memberGets10PercentOff() {
        BigDecimal result = discountService.calculateDiscount(
            BigDecimal.valueOf(100), "member");
        assertEquals(0, result.compareTo(BigDecimal.valueOf(90)));
    }

    @Test
    void regularGetsNoDiscount() {
        BigDecimal result = discountService.calculateDiscount(
            BigDecimal.valueOf(100), "regular");
        assertEquals(0, result.compareTo(BigDecimal.valueOf(100)));
    }

    @Test
    void unknownTypeDefaultsToFullPrice() {
        BigDecimal result = discountService.calculateDiscount(
            BigDecimal.valueOf(100), "unknown");
        assertEquals(0, result.compareTo(BigDecimal.valueOf(100)));
    }
}
