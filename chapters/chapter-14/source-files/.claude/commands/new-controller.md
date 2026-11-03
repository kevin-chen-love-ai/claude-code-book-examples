# /new-controller

## 参数

$ARGUMENTS — Controller 名和基础路径，格式：`Controller名 [基础路径]`

## 步骤

1. 解析 $ARGUMENTS，第一个词是 Controller 名，第二个词是基础路径（默认为 /api/）
2. 创建 Controller 文件骨架（带 @RestController、@RequestMapping 注解）
3. 创建对应的 Service 接口和实现类骨架
4. 创建对应的单元测试文件骨架
5. 输出创建的文件列表

## 项目约定

- 所有 Controller 异常通过 @ControllerAdvice 全局处理，不在 Controller 里 try-catch
- Service 层方法返回业务对象或 Optional，不返回 ResponseEntity
- 数据库操作只在 Repository 层
- JWT token 通过 Spring Security 过滤器解析，认证信息在 SecurityContextHolder

## 用法示例

/new-controller UserController /api/users
/new-controller OrderController /api/orders
/new-controller ProductController
