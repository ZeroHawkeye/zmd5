package md5

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strings"
	"zmd5/db"
	"zmd5/db/dbModel"

	"github.com/gofiber/fiber/v2"
)

type MD5Request struct {
	Text string `json:"text"`
}

type MD5HashData struct {
	Original    string `json:"original,omitempty"`
	Hash32      string `json:"hash32,omitempty"`      // 32位小写
	Hash32Upper string `json:"hash32Upper,omitempty"` // 32位大写
	Hash16      string `json:"hash16,omitempty"`      // 16位小写
	Hash16Upper string `json:"hash16Upper,omitempty"` // 16位大写
	Hash8       string `json:"hash8,omitempty"`       // 8位小写
	Hash8Upper  string `json:"hash8Upper,omitempty"`  // 8位大写
	Hash128     string `json:"hash128,omitempty"`     // 128位二进制字符串
}

type MD5Response struct {
	Success bool         `json:"success"`
	Message string       `json:"message,omitempty"`
	Data    *MD5HashData `json:"data,omitempty"`
}

// Encrypt 处理MD5加密请求
func Encrypt(c *fiber.Ctx) error {
	var req MD5Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的请求数据",
		})
	}

	if req.Text == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "请提供要加密的文本",
		})
	}

	// 计算MD5哈希
	hash := md5.Sum([]byte(req.Text))
	hashString := hex.EncodeToString(hash[:])
	hashStringUpper := strings.ToUpper(hashString)

	// 生成128位二进制字符串
	var hash128 strings.Builder
	for _, b := range hash {
		hash128.WriteString(strings.Replace(strings.Replace(
			fmt.Sprintf("%08b", b), " ", "0", -1), "\n", "", -1))
	}

	response := MD5Response{
		Success: true,
		Data: &MD5HashData{
			Original:    req.Text,
			Hash32:      hashString,
			Hash32Upper: hashStringUpper,
			Hash16:      hashString[8:24],
			Hash16Upper: hashStringUpper[8:24],
			Hash128:     hash128.String(),
		},
	}

	// 查询是否已存在相同的MD5值
	var existingMd5 dbModel.Md5
	result := db.PG.Where("md5 = ? OR md5_16 = ?", response.Data.Hash32, response.Data.Hash16).First(&existingMd5)

	// 如果记录不存在,则创建新记录
	if result.Error != nil {
		var md5 = dbModel.Md5{
			Plaintext: req.Text,
			MD5:       response.Data.Hash32,
			MD5_16:    response.Data.Hash16,
		}

		if err := db.PG.Create(&md5).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "保存记录失败",
			})
		}
	}

	// 保存操作记录到数据库
	// 检查用户是否登录
	userID := c.Locals("user_id")
	if userID != nil {
		record := dbModel.MD5Record{
			PlainText: req.Text,
			UserID:    userID.(uint),        // 直接使用 uint 类型
			Hash:      response.Data.Hash32, // 使用32位小写作为标准存储格式
			Type:      1,                    // 加密
		}

		if err := db.PG.Create(&record).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "保存记录失败",
			})
		}
	}

	return c.JSON(response)
}

// Decrypt 处理MD5解密请求
func Decrypt(c *fiber.Ctx) error {
	var req MD5Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的请求数据",
		})
	}

	if req.Text == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "请提供要解密的哈希值",
		})
	}

	// 检查输入的哈希值长度
	inputHash := strings.ToLower(req.Text)
	var md5Record dbModel.Md5
	var err error

	switch len(inputHash) {
	case 32:
		// 32位MD5
		err = db.PG.Where("LOWER(md5) = ?", inputHash).First(&md5Record).Error
	case 16:
		// 16位MD5
		err = db.PG.Where("LOWER(md5_16) = ?", inputHash).First(&md5Record).Error
	default:
		return c.JSON(MD5Response{
			Success: false,
			Message: "无效的MD5哈希值长度,应为16位或32位",
			Data: &MD5HashData{
				Hash32: req.Text,
			},
		})
	}

	if err != nil {
		return c.JSON(MD5Response{
			Success: false,
			Message: "未找到对应的原文",
			Data: &MD5HashData{
				Hash32: req.Text,
			},
		})
	}

	// 计算所有格式的哈希值
	hash := md5.Sum([]byte(md5Record.Plaintext))
	hashString := hex.EncodeToString(hash[:])
	hashStringUpper := strings.ToUpper(hashString)

	var hash128 strings.Builder
	for _, b := range hash {
		hash128.WriteString(strings.Replace(strings.Replace(
			fmt.Sprintf("%08b", b), " ", "0", -1), "\n", "", -1))
	}

	// 保存解密记录
	userID := c.Locals("user_id")
	if userID != nil {
		record := dbModel.MD5Record{
			PlainText: md5Record.Plaintext,
			UserID:    userID.(uint), // 直接使用 uint 类型
			Hash:      inputHash,
			Status:    2,
			Type:      2, // 解密
		}

		if err := db.PG.Create(&record).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "保存记录失败",
			})
		}
	}

	return c.JSON(MD5Response{
		Success: true,
		Data: &MD5HashData{
			Original:    md5Record.Plaintext,
			Hash32:      hashString,
			Hash32Upper: hashStringUpper,
			Hash16:      hashString[8:24],
			Hash16Upper: hashStringUpper[8:24],
			Hash128:     hash128.String(),
		},
	})
}
