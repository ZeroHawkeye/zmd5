package user

import (
	"zmd5/db"
	"zmd5/db/dbModel"

	"github.com/gofiber/fiber/v2"
)

// HistoryResponse 定义历史记录响应结构
type HistoryResponse struct {
	Total    int64           `json:"total"`    // 总记录数
	Page     int             `json:"page"`     // 当前页码
	PageSize int             `json:"pageSize"` // 每页大小
	Records  []HistoryRecord `json:"records"`  // 历史记录列表
}

// HistoryRecord 定义单条历史记录结构
type HistoryRecord struct {
	ID            uint   `json:"id"`
	UserID        uint   `json:"userId"`
	Type          string `json:"type"`          // "encrypt" 或 "decrypt"
	Input         string `json:"input"`         // 输入值
	Output        string `json:"output"`        // 输出值
	CreatedAt     string `json:"createdAt"`     // 创建时间
	DecryptStatus int    `json:"decryptStatus"` // 解密状态
}

// GetHistory 处理获取用户历史记录的请求
func GetHistory(c *fiber.Ctx) error {
	// 从JWT中获取用户ID
	userID := c.Locals("userID").(uint)

	// 获取分页参数
	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("pageSize", 10)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	// 计算偏移量
	offset := (page - 1) * pageSize

	var total int64
	var records []dbModel.MD5Record

	// 获取总记录数
	db.PG.Model(&dbModel.MD5Record{}).Where("user_id = ?", userID).Count(&total)

	// 查询记录
	db.PG.Model(&dbModel.MD5Record{}).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&records)

	// 转换为响应格式
	historyRecords := make([]HistoryRecord, len(records))
	for i, record := range records {
		historyRecords[i] = HistoryRecord{
			ID:            record.ID,
			UserID:        userID,
			Type:          getTypeString(record.Type),
			Input:         record.PlainText,
			Output:        record.Hash,
			CreatedAt:     record.CreatedAt.Format("2006-01-02 15:04:05"),
			DecryptStatus: record.DecryptStatus,
		}
	}

	// 返回响应
	return c.JSON(fiber.Map{
		"code": 200,
		"data": HistoryResponse{
			Total:    total,
			Page:     page,
			PageSize: pageSize,
			Records:  historyRecords,
		},
		"msg": "获取历史记录成功",
	})
}

// getTypeString 将类型数字转换为字符串
func getTypeString(typeNum int) string {
	if typeNum == 1 {
		return "encrypt"
	}
	return "decrypt"
}
