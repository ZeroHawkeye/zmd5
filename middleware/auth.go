package middleware

import (
	"fmt"
	"strings"
	"zmd5/utils"

	"github.com/gofiber/fiber/v2"
)

// JWTAuth 是JWT认证中间件
func JWTAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 获取认证头
		authHeader := c.Get("Authorization")

		// 检查是否存在认证头
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"status":  fiber.StatusUnauthorized,
				"message": "未提供认证令牌",
			})
		}

		// 提取token
		tokenString := ""
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		} else {
			tokenString = authHeader // 兼容直接传入token的情况
		}

		// 验证token
		userID, username, role, err := utils.ValidateToken(tokenString)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"status":  fiber.StatusUnauthorized,
				"message": "无效的认证令牌或令牌已过期",
			})
		}

		// 将用户信息存储在上下文中，以便后续使用
		c.Locals("userID", userID)
		c.Locals("username", username)
		c.Locals("role", role)

		// 继续处理请求
		return c.Next()
	}
}

// AdminAuth 是管理员认证中间件
func AdminAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 获取认证头
		authHeader := c.Get("Authorization")

		// 检查是否存在认证头
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"status":  fiber.StatusUnauthorized,
				"message": "未提供认证令牌",
			})
		}

		// 提取token
		tokenString := ""
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		} else {
			tokenString = authHeader // 兼容直接传入token的情况
		}

		// 验证token
		userID, username, role, err := utils.ValidateToken(tokenString)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"status":  fiber.StatusUnauthorized,
				"message": "无效的认证令牌或令牌已过期",
			})
		}

		// 检查用户角色是否为管理员
		if role != "admin" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"status":  fiber.StatusForbidden,
				"message": "需要管理员权限",
			})
		}

		// 将用户信息存储在上下文中，以便后续使用
		c.Locals("userID", userID)
		c.Locals("username", username)
		c.Locals("role", role)

		// 继续处理请求
		return c.Next()
	}
}

// OptionalJWTAuth 是可选的JWT认证中间件
// 不强制要求用户登录，但如果提供了有效的token则会解析用户信息
func OptionalJWTAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 获取认证头
		authHeader := c.Get("Authorization")

		// 如果没有认证头，继续处理请求
		if authHeader == "" {
			fmt.Println("OptionalJWTAuth 没有认证头")
			return c.Next()
		}

		// 提取token
		tokenString := ""
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		} else {
			tokenString = authHeader // 兼容直接传入token的情况
		}

		// 验证token
		userID, username, role, err := utils.ValidateToken(tokenString)
		if err != nil {
			fmt.Println("OptionalJWTAuth token无效:", err)
			// 如果token无效，继续处理请求但不设置用户信息
			return c.Next()
		}
		// 将用户信息存储在上下文中，以便后续使用
		c.Locals("user_id", userID)
		c.Locals("username", username)
		c.Locals("role", role)

		// 继续处理请求
		return c.Next()
	}
}
