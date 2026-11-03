package com.example.service;

import com.example.entity.Order;
import com.example.entity.CheckoutRequest;
import com.example.entity.Product;
import com.example.entity.Inventory;
import com.example.repository.OrderRepository;
import com.example.repository.ProductRepository;
import com.example.repository.InventoryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 结账服务
 * 书中示例：ch12 综合重构场景（12.6 节）
 *
 * 注意：以下 checkout 方法是 ch12 的"重构前"示例，
 * 展示了一个 300 行、嵌套 CompletableFuture、使用 Java 8 早期写法的"问题方法"。
 * 书中的五步重构流程演示如何把它改造为现代 Java 风格。
 */
@Service
public class CheckoutService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public CheckoutService(OrderRepository orderRepository,
                           ProductRepository productRepository,
                           InventoryRepository inventoryRepository,
                           PaymentService paymentService,
                           NotificationService notificationService,
                           UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.inventoryRepository = inventoryRepository;
        this.paymentService = paymentService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    /**
     * 重构前的"问题方法"示例。
     * 问题：
     * 1. 300+ 行，做了太多事情（上帝函数）
     * 2. CompletableFuture 链嵌套过深
     * 3. 使用 Java 8 早期写法（匿名内部类、手动 null 检查）
     */
    public CompletableFuture<Order> checkout(CheckoutRequest request) {
        // 参数校验（内联）
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        if (request.getUserId() == null) {
            throw new IllegalArgumentException("userId is required");
        }
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("items is required");
        }

        return userRepository.findById(request.getUserId())
            .thenCompose(user -> {
                if (user == null) {
                    return CompletableFuture.failedFuture(
                        new IllegalArgumentException("user not found")
                    );
                }
                return CompletableFuture.completedFuture(user);
            })
            .thenCompose(user -> {
                // 库存检查（嵌套在 thenCompose 里）
                List<CompletableFuture<Void>> inventoryChecks = request.getItems().stream()
                    .map(item -> inventoryRepository.findByProductId(item.getProductId())
                        .thenCompose(inventory -> {
                            if (inventory == null) {
                                return CompletableFuture.failedFuture(
                                    new IllegalArgumentException("product not found")
                                );
                            }
                            if (inventory.getStock() < item.getQuantity()) {
                                return CompletableFuture.failedFuture(
                                    new InsufficientStockException(item.getProductId())
                                );
                            }
                            inventory.reserve(item.getQuantity());
                            return inventoryRepository.save(inventory)
                                .thenApply(saved -> null);
                        }))
                    .toList();
                return CompletableFuture.allOf(inventoryChecks.toArray(new CompletableFuture[0]))
                    .thenApply(v -> user);
            })
            .thenCompose(user -> {
                // 创建订单（嵌套在 thenCompose 里）
                Order order = new Order();
                order.setUserId(request.getUserId());
                order.setStatus("PENDING");

                BigDecimal total = BigDecimal.ZERO;
                for (CheckoutRequest.Item item : request.getItems()) {
                    Product product = productRepository.findById(item.getProductId())
                        .join()
                        .orElseThrow(() -> new IllegalArgumentException("product not found"));
                    total = total.add(product.getPrice()
                        .multiply(BigDecimal.valueOf(item.getQuantity())));
                    order.addItem(product, item.getQuantity());
                }
                order.setTotalAmount(total);
                return orderRepository.save(order);
            })
            .thenCompose(order -> {
                // 支付处理（嵌套在 thenCompose 里）
                return paymentService.charge(order.getId(), order.getTotalAmount())
                    .thenCompose(result -> {
                        if (result.isSuccess()) {
                            order.setStatus("PAID");
                            order.setPaymentId(result.getTransactionId());
                            return orderRepository.save(order)
                                .thenCompose(savedOrder -> {
                                    // 发送通知（嵌套在 thenCompose 里）
                                    return CompletableFuture.allOf(
                                        notificationService.sendEmail(
                                            request.getUserId(),
                                            "Order Confirmed",
                                            "Your order " + savedOrder.getId() + " is confirmed."
                                        ),
                                        notificationService.sendWarehouseMessage(
                                            savedOrder.getId(),
                                            savedOrder.getItems()
                                        )
                                    ).thenApply(v -> savedOrder);
                                });
                        } else {
                            order.setStatus("PAYMENT_FAILED");
                            return orderRepository.save(order)
                                .thenCompose(savedOrder -> {
                                    // 回滚库存
                                    List<CompletableFuture<Void>> rollbacks = request.getItems().stream()
                                        .map(item -> inventoryRepository.findByProductId(item.getProductId())
                                            .thenCompose(inventory -> {
                                                inventory.release(item.getQuantity());
                                                return inventoryRepository.save(inventory)
                                                    .thenApply(saved -> null);
                                            }))
                                        .toList();
                                    return CompletableFuture.allOf(rollbacks.toArray(new CompletableFuture[0]))
                                        .thenApply(v -> savedOrder);
                                });
                        }
                    });
            })
            .whenComplete((order, err) -> {
                if (err != null) {
                    System.err.println("Checkout failed: " + err.getMessage());
                } else {
                    System.out.println("Checkout completed: " + order.getId());
                }
            });
    }
}
