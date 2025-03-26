package admin

import (
	"zmd5/db"
	"zmd5/db/dbModel"

	"github.com/gofiber/fiber/v2"
)

// MD5ManagementRequest 定义分页请求参数
type MD5ManagementRequest struct {
	Page     int    `query:"page"`
	PageSize int    `query:"pageSize"`
	Search   string `query:"search"`
	Type     string `query:"type"`
}

// MD5ManagementResponse 定义响应结构
type MD5ManagementResponse struct {
	Total    int64         `json:"total"`
	Records  []dbModel.Md5 `json:"records"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
}

// MD5Management 获取MD5记录（支持分页）
func MD5Management(c *fiber.Ctx) error {
	// 解析请求参数
	req := new(MD5ManagementRequest)
	if err := c.QueryParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "请求参数错误",
		})
	}

	// 设置默认分页参数
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 100 {
		req.PageSize = 20 // 默认每页20条
	}

	// 构建查询条件
	query := db.PG.Model(&dbModel.Md5{})

	// 如果有搜索条件，添加搜索过滤
	if req.Search != "" {
		switch req.Type {
		case "plaintext":
			query = query.Where("plaintext LIKE ?", "%"+req.Search+"%")
		case "md5":
			query = query.Where("md5 LIKE ? OR md5_16 LIKE ?", "%"+req.Search+"%", "%"+req.Search+"%")
		default:
			// 默认搜索所有字段
			query = query.Where("plaintext LIKE ? OR md5 LIKE ? OR md5_16 LIKE ?",
				"%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
		}
	}

	// 获取总记录数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "获取记录总数失败",
		})
	}

	// 获取分页数据
	var records []dbModel.Md5
	offset := (req.Page - 1) * req.PageSize

	if err := query.Offset(offset).Limit(req.PageSize).Order("id DESC").Find(&records).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "获取MD5记录失败",
		})
	}

	// 构建响应
	response := MD5ManagementResponse{
		Total:    total,
		Records:  records,
		Page:     req.Page,
		PageSize: req.PageSize,
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "获取MD5记录成功",
		"data":    response,
	})
}

// DeleteMD5Record 删除指定ID的MD5记录
func DeleteMD5Record(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "请提供记录ID",
		})
	}

	// 查找并删除记录
	result := db.PG.Delete(&dbModel.Md5{}, id)
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "删除MD5记录失败",
		})
	}

	// 如果没有找到记录
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "找不到指定ID的记录",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "成功删除MD5记录",
	})
}
