package admin

import (
	"time"
	"zmd5/db"
	"zmd5/db/dbModel"

	"github.com/gofiber/fiber/v2"
)

// Stats 返回系统统计信息
// @Summary 获取系统统计信息
// @Description 获取用户数量、MD5记录数量等系统统计信息
// @Tags 管理员
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/admin/stats [get]
func Stats(c *fiber.Ctx) error {
	// 获取数据库连接
	database := db.PG

	// 用户统计
	var totalUsers int64
	database.Model(&dbModel.User{}).Count(&totalUsers)

	// 活跃用户（过去7天有更新的用户）
	var activeUsers int64
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	database.Model(&dbModel.User{}).Where("updated_at > ?", sevenDaysAgo).Count(&activeUsers)

	// MD5记录统计
	var md5Records int64
	database.Model(&dbModel.Md5{}).Count(&md5Records)

	// 今日新增记录
	var todayRecords int64
	today := time.Now().Format("2006-01-02")
	database.Model(&dbModel.Md5{}).Where("DATE(created_at) = ?", today).Count(&todayRecords)

	// 获取系统状态（这里可以根据实际情况判断系统状态）
	systemStatus := "正常"

	// 获取服务器信息
	// 这里简单返回PostgreSQL数据库版本作为示例
	var dbVersion string
	database.Raw("SELECT version()").Scan(&dbVersion)

	stats := fiber.Map{
		"total_users":    totalUsers,
		"active_users":   activeUsers,
		"md5_records":    md5Records,
		"today_records":  todayRecords,
		"system_status":  systemStatus,
		"database_info":  dbVersion,
		"last_refreshed": time.Now().Format("2006-01-02 15:04:05"),
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   stats,
	})
}
