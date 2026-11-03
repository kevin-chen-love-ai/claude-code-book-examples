# 第 2 章 需求表达的艺术：怎样让 Claude Code 准确理解意图

## 配套文件

- `source-files/.gitignore`
- `source-files/.mvn/wrapper/maven-wrapper.properties`
- `source-files/mvnw`
- `source-files/mvnw.cmd`
- `source-files/pom.xml`
- `source-files/src/main/java/com/example/config/LoggingFilter.java`
- `source-files/src/main/java/com/example/config/RateLimitConfig.java`
- `source-files/src/main/java/com/example/controller/DashboardController.java`
- `source-files/src/main/java/com/example/controller/OrderController.java`
- `source-files/src/main/java/com/example/controller/ProductController.java`
- `source-files/src/main/java/com/example/controller/UserController.java`
- `source-files/src/main/java/com/example/controller/UserProfileController.java`
- `source-files/src/main/java/com/example/repository/OrderRepository.java`
- `source-files/src/main/java/com/example/service/ExportService.java`
- `source-files/src/main/java/com/example/service/OrderService.java`
- `source-files/src/main/java/com/example/service/TokenService.java`
- `source-files/src/main/java/com/example/service/UserService.java`
- `source-files/src/main/java/com/example/util/DateUtil.java`
- `source-files/src/main/resources/db/migration/V2__add_order_indexes.sql`
- `source-files/src/main/resources/logback-spring.xml`
- `source-files/src/main/resources/schema.sql`

## 示例验证

```bash
cd source-files
./mvnw test
```
