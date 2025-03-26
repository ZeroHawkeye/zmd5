package main

import (
	"log"
	"os"
	"zmd5/api/rainbow"
	"zmd5/db"
	"zmd5/router"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	// 加载环境变量
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "production"
	}

	// 根据环境加载对应的 .env 文件
	if env == "production" {
		godotenv.Load(".env.production")
	} else {
		godotenv.Load(".env")
	}

	// 初始化数据库
	db.InitDB()

	// 从数据库初始化未完成的任务
	rainbow.InitTaskProgress()

	// 创建Fiber应用
	app := fiber.New(fiber.Config{
		AppName:   "ZMd5解密工具",
		BodyLimit: 1024 * 1024 * 2000, // 设置为2GB
	})

	// 中间件
	app.Use(logger.New())

	// 从环境变量获取 CORS 配置
	allowOrigins := os.Getenv("CORS_ORIGIN")
	if allowOrigins == "" {
		allowOrigins = "http://localhost:5173"
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, x-csrf-token, x-requested-with",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// 设置路由
	router.SetupRoutes(app)

	// 启动服务器
	log.Printf("服务器启动在 http://localhost:9700 (环境: %s)", env)
	log.Fatal(app.Listen(":9700"))
}
