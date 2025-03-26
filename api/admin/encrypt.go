package admin

import (
	"crypto/md5"
	"encoding/hex"
	"zmd5/db"
	"zmd5/db/dbModel"

	"github.com/gofiber/fiber/v2"
)

type EncryptRequest struct {
	Plaintexts []string `json:"plaintexts"`
}

// Encrypt 批量处理明文并存储MD5值
func Encrypt(c *fiber.Ctx) error {
	var req EncryptRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "请求格式错误",
		})
	}

	if len(req.Plaintexts) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "明文数组不能为空",
		})
	}

	// 从请求中获取所有明文
	plaintexts := req.Plaintexts

	// 查询已存在的明文
	var existingRecords []dbModel.Md5
	if err := db.PG.Where("plaintext IN ?", plaintexts).Find(&existingRecords).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "查询数据库失败",
		})
	}

	// 创建已存在明文的映射，方便快速查找
	existingPlaintextMap := make(map[string]bool)
	for _, record := range existingRecords {
		existingPlaintextMap[record.Plaintext] = true
	}

	// 只处理不存在的明文
	var md5Records []dbModel.Md5
	var skippedCount int

	for _, plaintext := range plaintexts {
		// 检查明文是否已存在
		if existingPlaintextMap[plaintext] {
			skippedCount++
			continue
		}

		// 计算32位MD5
		hasher := md5.New()
		hasher.Write([]byte(plaintext))
		md5Str := hex.EncodeToString(hasher.Sum(nil))

		// 16位MD5是32位MD5的中间16位
		md5_16 := md5Str[8:24]

		md5Records = append(md5Records, dbModel.Md5{
			Plaintext: plaintext,
			MD5:       md5Str,
			MD5_16:    md5_16,
		})
	}

	// 如果没有需要新增的记录，直接返回
	if len(md5Records) == 0 {
		return c.JSON(fiber.Map{
			"message": "所有明文已存在，无需创建新记录",
			"skipped": skippedCount,
			"added":   0,
		})
	}

	// 批量插入记录
	if err := db.PG.Create(&md5Records).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "数据保存失败",
		})
	}

	return c.JSON(fiber.Map{
		"message": "成功处理并保存MD5记录",
		"skipped": skippedCount,
		"added":   len(md5Records),
		"data":    md5Records,
	})
}
