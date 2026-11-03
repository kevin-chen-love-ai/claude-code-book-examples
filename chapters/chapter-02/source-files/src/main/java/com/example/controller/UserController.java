package com.example.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户管理控制器
 * 书中示例：ch08 完整纠偏场景（权限校验）
 * 覆盖：需求偏离、逻辑漏洞、副作用损坏的纠偏过程
 */
@RestController
@RequestMapping("/users")
public class UserController {

    /**
     * 删除用户接口
     * 权限规则：
     * 1. 管理员可删除任何用户
     * 2. 普通用户只能删除自己
     * 3. 未登录用户返回 401
     * 4. 无权限返回 403
     */
    @DeleteMapping("/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        boolean isAdmin = authentication.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        String currentUserId = authentication.getName();

        if (isAdmin || currentUserId.equals(userId.toString())) {
            // 执行删除逻辑
            return ResponseEntity.ok().build();
        }

        return ResponseEntity.status(403).build();
    }
}
