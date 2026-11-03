package com.example.service;

import com.example.entity.Order;
import com.example.entity.OrderRequest;
import com.example.entity.Product;
import com.example.entity.Inventory;
import com.example.repository.OrderRepository;
import com.example.repository.ProductRepository;
import com.example.repository.InventoryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * 订单服务
 * 书中示例：ch01（测试覆盖分析）、ch04（导航示例）、ch12（上帝函数拆分）
 *
 * 注意：以下 processOrder 方法是 ch12 的"重构前"示例，
 * 展示了典型的"上帝函数"反模式（180+行，做太多事情）。
 * 书中的重构流程演示如何把它拆分成多个职责单一的方法。
 */
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final PaymentService paymentService;
    private final NotificationService notificationService;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        InventoryRepository inventoryRepository,
                        PaymentService paymentService,
                        NotificationService notificationService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.paymentService = paymentService;
        this.notificationService = notificationService;
    }

    /**
     * 重构前的"上帝函数"示例。
     * 这个方法做了：参数校验、库存检查、创建订单、支付处理、发送通知。
     * ch12 演示如何把它拆分成 validateOrderRequest、reserveInventory、
     * calculateOrderTotal、createOrderRecord、sendOrderNotifications 等方法。
     */
    public Order processOrder(OrderRequest request) {
        // 1. 参数校验（约 15 行）
        if (request.getUserId() == null) {
            throw new IllegalArgumentException("userId is required");
        }
        if (request.getProductIds() == null || request.getProductIds().isEmpty()) {
            throw new IllegalArgumentException("productIds is required");
        }
        if (request.getShippingAddress() == null || request.getShippingAddress().isBlank()) {
            throw new IllegalArgumentException("shippingAddress is required");
        }
        for (Long productId : request.getProductIds()) {
            if (productId == null || productId <= 0) {
                throw new IllegalArgumentException("invalid productId: " + productId);
            }
        }

        // 2. 库存检查（约 20 行）
        for (Long productId : request.getProductIds()) {
            Inventory inventory = inventoryRepository.findByProductId(productId);
            if (inventory == null) {
                throw new IllegalArgumentException("product not found: " + productId);
            }
            if (inventory.getStock() < request.getQuantity(productId)) {
                throw new InsufficientStockException(productId);
            }
            inventory.reserve(request.getQuantity(productId));
            inventoryRepository.save(inventory);
        }

        // 3. 创建订单记录（约 25 行）
        Order order = new Order();
        order.setUserId(request.getUserId());
        order.setShippingAddress(request.getShippingAddress());

        BigDecimal total = BigDecimal.ZERO;
        for (Long productId : request.getProductIds()) {
            Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("product not found: " + productId));
            total = total.add(product.getPrice()
                .multiply(BigDecimal.valueOf(request.getQuantity(productId))));
            order.addItem(product, request.getQuantity(productId));
        }
        order.setTotalAmount(total);
        order.setStatus("PENDING");
        orderRepository.save(order);

        // 4. 支付处理（约 30 行）
        try {
            PaymentResult paymentResult = paymentService.charge(order.getId(), total);
            if (paymentResult.isSuccess()) {
                order.setStatus("PAID");
                order.setPaymentId(paymentResult.getTransactionId());
            } else {
                order.setStatus("PAYMENT_FAILED");
                // 回滚库存
                for (Long productId : request.getProductIds()) {
                    Inventory inventory = inventoryRepository.findByProductId(productId);
                    inventory.release(request.getQuantity(productId));
                    inventoryRepository.save(inventory);
                }
            }
        } catch (PaymentException e) {
            order.setStatus("PAYMENT_FAILED");
            throw new RuntimeException("Payment failed", e);
        }
        orderRepository.save(order);

        // 5. 发送通知（约 20 行）
        if ("PAID".equals(order.getStatus())) {
            notificationService.sendEmail(
                request.getUserId(),
                "Order Confirmed",
                "Your order " + order.getId() + " has been confirmed."
            );
            notificationService.sendWarehouseMessage(
                order.getId(),
                order.getItems()
            );
        }

        return order;
    }
}
