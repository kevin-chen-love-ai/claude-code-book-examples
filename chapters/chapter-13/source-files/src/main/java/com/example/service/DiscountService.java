package com.example.service;

import java.math.BigDecimal;

/**
 * 折扣服务
 * 书中示例：ch13 测试覆盖的三大陷阱（13.1 节）
 *
 * 注意：以下 calculateDiscount 方法是 ch13 的测试示例目标，
 * 展示了表面覆盖、冗余测试和漏测关键场景的典型被测代码。
 */
public class DiscountService {

    public BigDecimal calculateDiscount(BigDecimal price, String userType) {
        if ("vip".equals(userType)) return price.multiply(BigDecimal.valueOf(0.8));
        if ("member".equals(userType)) return price.multiply(BigDecimal.valueOf(0.9));
        return price;
    }
}
