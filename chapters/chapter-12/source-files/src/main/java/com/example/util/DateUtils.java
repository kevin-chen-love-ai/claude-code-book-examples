package com.example.util;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;

/**
 * 日期工具类
 * 书中示例：ch12 遗留 Java 代码现代化（12.4 节）
 *
 * 注意：以下代码是 ch12 的"重构前"示例，展示了典型的遗留 Java 风格：
 * - 使用线程不安全的 SimpleDateFormat
 * - 手动 null 检查
 * - 命令式 for 循环处理集合
 * - 返回 null 表示"找不到"
 *
 * 书中的现代化流程演示如何把它改为：
 * - DateTimeFormatter（线程安全）
 * - Optional 替代 null
 * - Stream API 替代 for 循环
 */
public class DateUtils {

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd");

    /**
     * 遗留写法：返回 null 表示解析失败
     */
    public static Date parseDate(String str) {
        if (str == null || str.isEmpty()) {
            return null;
        }
        try {
            return DATE_FORMAT.parse(str);
        } catch (ParseException e) {
            return null;
        }
    }

    /**
     * 遗留写法：命令式 for 循环过滤和转换
     */
    public static List<String> formatDates(List<Date> dates) {
        List<String> result = new ArrayList<>();
        if (dates == null) {
            return result;
        }
        for (Date date : dates) {
            if (date != null) {
                String formatted = DATE_FORMAT.format(date);
                if (formatted.startsWith("2024")) {
                    result.add(formatted);
                }
            }
        }
        return result;
    }

    /**
     * 遗留写法：匿名内部类实现 Comparator
     */
    public static List<Date> sortDates(List<Date> dates) {
        if (dates == null) {
            return new ArrayList<>();
        }
        List<Date> copy = new ArrayList<>(dates);
        Collections.sort(copy, new Comparator<Date>() {
            @Override
            public int compare(Date d1, Date d2) {
                if (d1 == null && d2 == null) {
                    return 0;
                }
                if (d1 == null) {
                    return 1;
                }
                if (d2 == null) {
                    return -1;
                }
                return d1.compareTo(d2);
            }
        });
        return copy;
    }
}
