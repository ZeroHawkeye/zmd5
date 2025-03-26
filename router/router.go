package router

import (
	"zmd5/api/admin"
	"zmd5/api/auth"
	"zmd5/api/md5"
	"zmd5/api/rainbow"
	"zmd5/api/user"
	"zmd5/middleware"

	"github.com/gofiber/fiber/v2"
)

// SetupRoutes 配置所有路由
func SetupRoutes(app *fiber.App) {
	// API 路由组
	api := app.Group("/api")

	// 配置管理员路由（需要管理员权限）
	adminRoutes := api.Group("/admin")
	adminRoutes.Use(middleware.AdminAuth())
	adminRoutes.Get("/stats", admin.Stats)
	// 管理员根据明文生成md5值
	adminRoutes.Post("/md5/encrypt", admin.Encrypt)
	// 文件上传生成md5值
	adminRoutes.Post("/md5/upload", admin.Upload)
	// 管理员md5管理
	adminRoutes.Get("/md5/management", admin.MD5Management)
	// 管理员删除MD5记录
	adminRoutes.Delete("/md5/records/:id", admin.DeleteMD5Record)
	// 彩虹表生成（仅管理员）
	adminRoutes.Post("/rainbow/generate", rainbow.Generate)
	// 彩虹表管理
	adminRoutes.Get("/rainbow/management", rainbow.RainbowManagement)
	// 添加彩虹表条目
	adminRoutes.Post("/rainbow/entry", rainbow.AddRainbowTableEntry)
	// 删除彩虹表条目
	adminRoutes.Delete("/rainbow/entry/:id", rainbow.DeleteRainbowTableEntry)

	// 配置用户相关路由（需要JWT认证）
	userRoutes := api.Group("/user")
	userRoutes.Use(middleware.JWTAuth())
	// 获取用户解密历史信息
	userRoutes.Get("/md5/history", user.GetHistory)

	// 不需要鉴权的路由
	authRoutes := api.Group("/auth")
	authRoutes.Post("/login", auth.Login)
	authRoutes.Post("/register", auth.Register)
	authRoutes.Get("/status", auth.Status)
	// 退出登录
	authRoutes.Post("/logout", auth.Logout)

	// md5路由组（可选认证）
	md5Routes := api.Group("/md5")
	md5Routes.Use(middleware.OptionalJWTAuth())
	md5Routes.Post("/encrypt", md5.Encrypt)
	md5Routes.Post("/decrypt", md5.Decrypt)

	// 彩虹表路由组
	rainbowRoutes := api.Group("/rainbow")
	rainbowRoutes.Use(middleware.JWTAuth())
	rainbowRoutes.Post("/search", rainbow.Search)
	rainbowRoutes.Get("/stats", rainbow.GetStats)
	// 查询解密任务状态
	rainbowRoutes.Get("/task/:id", rainbow.GetTaskStatus)
	// 结束解密任务
	rainbowRoutes.Post("/task/:id/finish", rainbow.FinishTask)
}
