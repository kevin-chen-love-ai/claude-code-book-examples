# 项目概述

这是一个 Spring Boot + Java 的 REST API 项目，提供用户管理和订单管理功能。

## 技术栈

- 框架：Spring Boot 3.x + Java 17
- 数据库：PostgreSQL，Spring Data JPA（Repository 接口继承 JpaRepository）
- 认证：JWT，jjwt 库（不是 java-jwt），token 放 Authorization header
- 日志：SLF4J + Logback（从 Lombok 的 @Slf4j 或 LoggerFactory 获取 logger）
- 测试：JUnit 5 + AssertJ（不是 TestNG）

## 目录结构

src/main/java/com/example/
├── controller/  HTTP 接口，每个资源一个 Controller（UserController.java / OrderController.java）
├── service/     业务逻辑，Controller 只调用 Service，不直接操作数据库
├── repository/  数据访问层，继承 JpaRepository
├── config/      配置类（SecurityConfig.java / WebMvcConfig.java）
├── entity/      JPA 实体类
└── exception/   自定义异常和全局异常处理

## 重要约定

- 所有异常通过 @ControllerAdvice 统一处理，不在 Controller 层 try/catch
- Service 层返回数据或抛出自定义异常，不返回 ResponseEntity
- 数据库操作只在 repository/service 层，不在 Controller 层
- 所有 public 方法必须加 @Transactional（读操作可省略）

## 禁止事项

- 不要在 Controller 层直接调用 Repository，必须通过 Service 层
- 不要使用 System.out.println，统一使用 SLF4J logger
- 不要引入新的 Maven 依赖，先和我确认
- 不要修改 src/main/resources/application.yml，除非明确讨论过

## 常用命令

```bash
./mvnw spring-boot:run   # 启动开发服务器
./mvnw test              # 运行测试
./mvnw test -Dtest=UserServiceTest  # 运行单个测试类
./mvnw verify            # 完整构建（含测试、代码检查）
./mvnw flyway:migrate    # 数据库迁移
```
