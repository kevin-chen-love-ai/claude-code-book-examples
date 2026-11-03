package com.example.mcp;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Scanner;

/**
 * 简化版 MCP Server 示例：暴露 get_order_status 工具
 * 基于 JSON-RPC 2.0 over stdio
 * 书中位置：ch16 16.11.2
 *
 * 依赖：com.fasterxml.jackson.core:jackson-databind
 */
public class OrderStatusMcpServer {

    private static final ObjectMapper mapper = new ObjectMapper();

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        while (scanner.hasNextLine()) {
            String line = scanner.nextLine().trim();
            if (line.isEmpty()) {
                continue;
            }
            try {
                JsonNode request = mapper.readTree(line);
                JsonNode response = handleRequest(request);
                if (response != null) {          // 通知（无 id）不回复
                    System.out.println(mapper.writeValueAsString(response));
                    System.out.flush();          // stdio 模式必须手动 flush
                }
            } catch (JsonProcessingException e) {
                // 只有 JSON 本身解析失败才是 -32700，此时拿不到 id
                System.out.println(
                        "{\"jsonrpc\":\"2.0\",\"id\":null,"
                                + "\"error\":{\"code\":-32700,\"message\":\"Parse error\"}}");
                System.out.flush();
            }
        }
    }

    private static JsonNode handleRequest(JsonNode request) {
        String method = request.path("method").asText();
        // 通知没有 id，按 JSON-RPC 规范不能回复，直接忽略（如 notifications/initialized）
        if (!request.has("id")) {
            return null;
        }
        int id = request.path("id").asInt(-1);

        switch (method) {
            case "initialize":
                return createResponse(id, createInitializeResult());
            case "tools/list":
                return createResponse(id, createToolsListResult());
            case "tools/call":
                try {
                    return createResponse(id, handleToolCall(request.path("params")));
                } catch (Exception e) {
                    // 工具执行失败：返回带 isError 的结果（保留 id），而不是崩溃
                    return createResponse(id, toolError(e.getMessage()));
                }
            default:
                return createErrorResponse(id, -32601, "Method not found: " + method);
        }
    }

    private static ObjectNode createResponse(int id, JsonNode result) {
        ObjectNode response = mapper.createObjectNode();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.set("result", result);
        return response;
    }

    private static ObjectNode createErrorResponse(int id, int code, String message) {
        ObjectNode response = mapper.createObjectNode();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        ObjectNode error = response.putObject("error");
        error.put("code", code);
        error.put("message", message);
        return response;
    }

    private static ObjectNode createInitializeResult() {
        ObjectNode result = mapper.createObjectNode();
        // protocolVersion 必须是字符串（日期格式），不能是对象
        result.put("protocolVersion", "2024-11-05");
        result.putObject("capabilities").putObject("tools");
        ObjectNode serverInfo = result.putObject("serverInfo");
        serverInfo.put("name", "order-status-server");
        serverInfo.put("version", "1.0.0");
        return result;
    }

    private static ObjectNode createToolsListResult() {
        ObjectNode result = mapper.createObjectNode();
        ArrayNode tools = result.putArray("tools");
        ObjectNode tool = tools.addObject();
        tool.put("name", "get_order_status");
        tool.put("description", "获取订单状态");
        ObjectNode schema = tool.putObject("inputSchema");
        schema.put("type", "object");
        ObjectNode properties = schema.putObject("properties");
        properties.putObject("orderId").put("type", "string");
        schema.putArray("required").add("orderId");
        return result;
    }

    private static ObjectNode handleToolCall(JsonNode params) {
        String name = params.path("name").asText();
        if (!"get_order_status".equals(name)) {
            throw new IllegalArgumentException("Unknown tool: " + name);
        }
        String orderId = params.path("arguments").path("orderId").asText();
        String status = fetchOrderStatus(orderId);

        ObjectNode result = mapper.createObjectNode();
        ObjectNode textContent = result.putArray("content").addObject();
        textContent.put("type", "text");
        textContent.put("text", status);
        return result;
    }

    // 工具出错时按 MCP 约定返回 isError 结果，让 Claude 看到失败原因并自行处理
    private static ObjectNode toolError(String message) {
        ObjectNode result = mapper.createObjectNode();
        ObjectNode textContent = result.putArray("content").addObject();
        textContent.put("type", "text");
        textContent.put("text", "工具执行失败：" + message);
        result.put("isError", true);
        return result;
    }

    private static String fetchOrderStatus(String orderId) {
        // 实际项目中这里调用内部 API 或查询数据库
        return "{\"orderId\":\"" + orderId + "\",\"status\":\"shipped\"}";
    }
}
