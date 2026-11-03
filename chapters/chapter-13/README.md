# 第 13 章 测试：用 Claude Code 写出真正有效的测试

## 配套文件

- `source-files/.gitignore`
- `source-files/.mvn/wrapper/maven-wrapper.properties`
- `source-files/mvnw`
- `source-files/mvnw.cmd`
- `source-files/pom.xml`
- `source-files/src/main/java/com/example/cli/CsvTransformCli.java`
- `source-files/src/main/java/com/example/payment/ReconciliationService.java`
- `source-files/src/main/java/com/example/service/DiscountService.java`
- `source-files/src/main/java/com/example/service/OrderService.java`
- `source-files/src/main/java/com/example/util/ValidatePassword.java`
- `source-files/src/main/resources/config-schema.yml`
- `source-files/src/test/java/com/example/service/DiscountServiceTest.java`
- `source-files/src/test/java/com/example/service/OrderServiceTest.java`
- `source-files/src/test/java/com/example/util/ValidatePasswordTest.java`

## 示例验证

```bash
cd source-files
./mvnw test
```
