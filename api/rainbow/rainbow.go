package rainbow

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"
	"zmd5/db"
	"zmd5/db/dbModel"
	"zmd5/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RainbowTableRequest 创建彩虹表请求
type RainbowTableRequest struct {
	Count           int    `json:"count"`             // 生成链的数量
	ChainLength     int    `json:"chain_length"`      // 链长度
	ReductionFuncID int    `json:"reduction_func_id"` // 规约函数ID
	CharsetType     int    `json:"charset_type"`      // 字符集类型
	CharsetRange    string `json:"charset_range"`     // 自定义字符集
	MinLength       int    `json:"min_length"`        // 明文最小长度
	MaxLength       int    `json:"max_length"`        // 明文最大长度
}

// RainbowTableResponse 彩虹表统计响应
type RainbowTableResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message,omitempty"`
	Generated  int    `json:"generated,omitempty"`   // 成功生成的链数量
	TotalCount int64  `json:"total_count,omitempty"` // 数据库中的总链数
}

// RainbowTableSearchRequest 彩虹表查询请求
type RainbowTableSearchRequest struct {
	MD5Hash string `json:"md5_hash"` // 要查询的MD5哈希值
}

// RainbowTableSearchResponse 彩虹表查询响应
type RainbowTableSearchResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message,omitempty"`
	Plaintext string `json:"plaintext,omitempty"` // 找到的明文
	TaskID    uint   `json:"task_id,omitempty"`   // 任务ID，用于查询进度
}

// RainbowTableStatsResponse 彩虹表统计响应
type RainbowTableStatsResponse struct {
	Success            bool    `json:"success"`
	Message            string  `json:"message,omitempty"`
	TotalChains        int64   `json:"total_chains"`         // 总链数
	TotalCharsets      int64   `json:"total_charsets"`       // 使用的字符集类型数
	CoverageEstimate   float64 `json:"coverage_estimate"`    // 估计覆盖率
	AverageChainLength float64 `json:"average_chain_length"` // 平均链长度
}

// TaskProgress 存储任务进度的结构体
type TaskProgress struct {
	TaskID            uint   `json:"task_id"`            // 任务ID
	UserID            uint   `json:"user_id"`            // 用户ID
	Hash              string `json:"hash"`               // 要解密的哈希
	Progress          int    `json:"progress"`           // 进度百分比
	Status            int    `json:"status"`             // 任务状态
	PlainText         string `json:"plain_text"`         // 找到的明文
	TablesSearched    int    `json:"tables_searched"`    // 已搜索的彩虹表数量
	TotalTables       int    `json:"total_tables"`       // 总彩虹表数量
	ChainsSearched    int    `json:"chains_searched"`    // 已搜索的链数量
	ReductionAttempts int    `json:"reduction_attempts"` // 规约函数应用次数
}

// 使用map存储任务进度，以任务ID为键
var taskProgressMap = make(map[uint]*TaskProgress)
var taskProgressMutex sync.RWMutex // 用于保护map的并发访问

// 添加任务取消信号映射表
var taskCancelMap = make(map[uint]bool)
var taskCancelMutex sync.RWMutex // 用于保护取消信号map的并发访问

// 添加上次更新时间和更新频率控制
var lastDBUpdateMap = make(map[uint]time.Time)
var significantProgressThreshold = 5 // 进度变化超过5%才更新数据库

// 获取任务进度
func getTaskProgress(taskID uint) *TaskProgress {
	taskProgressMutex.RLock()
	defer taskProgressMutex.RUnlock()

	if progress, exists := taskProgressMap[taskID]; exists {
		return progress
	}
	return nil
}

// 设置任务进度
func setTaskProgress(progress *TaskProgress) {
	taskProgressMutex.Lock()
	defer taskProgressMutex.Unlock()

	taskProgressMap[progress.TaskID] = progress

	// 初始创建任务时总是同步到数据库
	syncTaskProgressToDB(progress, true)
}

// 同步任务进度到数据库
func syncTaskProgressToDB(progress *TaskProgress, forceUpdate bool) {
	// 如果不是强制更新，检查是否需要更新数据库
	if !forceUpdate {
		// 获取上次更新时间
		lastUpdate, exists := lastDBUpdateMap[progress.TaskID]

		// 检查上次更新时间是否过近（小于1秒）
		if exists && time.Since(lastUpdate) < 5*time.Second {
			// 时间间隔太短，不更新数据库
			return
		}

		// 如果任务还在进行中且进度变化不大（小于阈值），不更新数据库
		if progress.Status == dbModel.DecryptInProgress {
			// 获取当前数据库中的进度
			var record dbModel.MD5Record
			if err := db.PG.Select("progress").Where("id = ?", progress.TaskID).First(&record).Error; err == nil {
				// 如果进度变化小于阈值，不更新
				if abs(progress.Progress-record.Progress) < significantProgressThreshold {
					return
				}
			}
		}
	}

	// 更新上次更新时间
	lastDBUpdateMap[progress.TaskID] = time.Now()

	// 更新MD5Record表中的基本信息
	updates := dbModel.MD5Record{
		Progress:      progress.Progress,
		DecryptStatus: progress.Status,
	}

	// 如果有明文结果，也更新
	if progress.PlainText != "" {
		updates.PlainText = progress.PlainText
	}

	// 更新数据库
	db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", progress.TaskID).Updates(updates)

	// 只有任务结束或重要进度变更时才更新详细信息表
	if forceUpdate || progress.Status != dbModel.DecryptInProgress || progress.Progress == 100 {
		// 存储详细的任务进度信息到任务进度表
		var taskProgressRecord dbModel.TaskProgressRecord
		result := db.PG.Where("task_id = ?", progress.TaskID).First(&taskProgressRecord)

		if result.Error != nil {
			// 不存在记录，创建新记录
			taskProgressRecord = dbModel.TaskProgressRecord{
				TaskID:            progress.TaskID,
				TablesSearched:    progress.TablesSearched,
				TotalTables:       progress.TotalTables,
				ChainsSearched:    progress.ChainsSearched,
				ReductionAttempts: progress.ReductionAttempts,
			}
			db.PG.Create(&taskProgressRecord)
		} else {
			// 更新现有记录
			db.PG.Model(&taskProgressRecord).Updates(dbModel.TaskProgressRecord{
				TablesSearched:    progress.TablesSearched,
				TotalTables:       progress.TotalTables,
				ChainsSearched:    progress.ChainsSearched,
				ReductionAttempts: progress.ReductionAttempts,
			})
		}
	}
}

// 绝对值函数
func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

// 更新任务进度
func updateTaskProgress(taskID uint, update func(*TaskProgress)) {
	taskProgressMutex.Lock()
	defer taskProgressMutex.Unlock()

	if progress, exists := taskProgressMap[taskID]; exists {
		// 记录更新前的进度
		oldProgress := progress.Progress
		oldStatus := progress.Status

		// 应用更新
		update(progress)

		// 判断是否强制更新数据库
		forceUpdate := false

		// 如果状态发生变化，或进度变化显著，或达到100%，强制更新
		if oldStatus != progress.Status ||
			abs(progress.Progress-oldProgress) >= significantProgressThreshold ||
			progress.Progress == 100 {
			forceUpdate = true
		}

		// 同步到数据库，根据条件决定是否强制更新
		syncTaskProgressToDB(progress, forceUpdate)
	}
}

// 检查任务是否被取消
func isTaskCancelled(taskID uint) bool {
	taskCancelMutex.RLock()
	defer taskCancelMutex.RUnlock()

	cancelled, exists := taskCancelMap[taskID]
	return exists && cancelled
}

// 设置任务取消状态
func setTaskCancelled(taskID uint, cancelled bool) {
	taskCancelMutex.Lock()
	defer taskCancelMutex.Unlock()

	taskCancelMap[taskID] = cancelled
}

// 清除任务取消状态
func clearTaskCancelStatus(taskID uint) {
	taskCancelMutex.Lock()
	defer taskCancelMutex.Unlock()

	delete(taskCancelMap, taskID)
}

// 删除任务进度
func removeTaskProgress(taskID uint) {
	taskProgressMutex.Lock()
	defer taskProgressMutex.Unlock()

	// 从内存映射中删除任务进度
	delete(taskProgressMap, taskID)

	// 同时清理更新时间记录
	delete(lastDBUpdateMap, taskID)

	// 清理取消状态
	clearTaskCancelStatus(taskID)
}

// InitTaskProgress 从数据库加载未完成的任务
func InitTaskProgress() {
	var unfinishedTasks []dbModel.MD5Record

	// 查询所有未完成的解密任务（状态为进行中）
	db.PG.Where("decrypt_status = ?", dbModel.DecryptInProgress).Find(&unfinishedTasks)

	for _, task := range unfinishedTasks {
		// 为每个未完成任务创建内存中的进度记录
		taskProgress := &TaskProgress{
			TaskID:    task.ID,
			UserID:    task.UserID,
			Hash:      task.Hash,
			Progress:  task.Progress,
			Status:    task.DecryptStatus,
			PlainText: task.PlainText,
		}

		// 尝试加载详细进度信息
		var detailProgress dbModel.TaskProgressRecord
		if db.PG.Where("task_id = ?", task.ID).First(&detailProgress).Error == nil {
			taskProgress.TablesSearched = detailProgress.TablesSearched
			taskProgress.TotalTables = detailProgress.TotalTables
			taskProgress.ChainsSearched = detailProgress.ChainsSearched
			taskProgress.ReductionAttempts = detailProgress.ReductionAttempts
		}

		// 存入内存
		taskProgressMap[task.ID] = taskProgress

		// 恢复任务处理
		go func(hashToDecrypt string, recID uint) {
			plaintext := searchWithRainbowTable(hashToDecrypt, recID)

			// 如果找到了明文，更新记录
			if plaintext != "" && recID > 0 {
				// 更新解密记录
				db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recID).Updates(dbModel.MD5Record{
					PlainText:     plaintext,
					Status:        1, // 成功
					DecryptStatus: dbModel.DecryptSuccess,
				})

				// 更新内存中的任务进度
				updateTaskProgress(recID, func(progress *TaskProgress) {
					progress.Progress = 100
					progress.Status = dbModel.DecryptSuccess
					progress.PlainText = plaintext
				})

				// 任务完成后删除任务进度记录
				removeTaskProgress(recID)

				// 同时保存到MD5库中供后续使用
				var md5 = dbModel.Md5{
					Plaintext: plaintext,
					MD5:       hashToDecrypt,
				}
				db.PG.Create(&md5)
			} else if recID > 0 {
				// 更新为解密失败
				db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recID).Updates(dbModel.MD5Record{
					Status:        2, // 失败
					DecryptStatus: dbModel.DecryptFailed,
				})

				// 更新内存中的任务进度
				updateTaskProgress(recID, func(progress *TaskProgress) {
					progress.Progress = 100
					progress.Status = dbModel.DecryptFailed
				})

				// 任务完成后删除任务进度记录
				removeTaskProgress(recID)
			}
		}(task.Hash, task.ID)
	}

	log.Printf("已从数据库恢复%d个未完成的解密任务", len(unfinishedTasks))
}

// Generate 生成彩虹表
func Generate(c *fiber.Ctx) error {
	// 检查用户是否为管理员
	userRole := c.Locals("role")
	if userRole == nil || userRole.(string) != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "只有管理员可以生成彩虹表",
		})
	}

	var req RainbowTableRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的请求数据",
		})
	}

	// 验证请求参数
	if req.Count <= 0 {
		req.Count = 10 // 默认生成10条链
	}
	if req.ChainLength <= 0 {
		req.ChainLength = 1000 // 默认链长度1000
	}
	if req.MinLength <= 0 {
		req.MinLength = 3 // 默认最小长度3
	}
	if req.MaxLength < req.MinLength {
		req.MaxLength = req.MinLength + 5 // 默认最大长度为最小长度+5
	}

	// 获取字符集
	charset := utils.GetCharset(req.CharsetType, req.CharsetRange)

	// 成功计数
	successCount := 0

	for i := 0; i < req.Count; i++ {
		// 生成随机起始明文
		startPlaintext, err := utils.GenerateRandomPlaintext(req.MinLength, charset)
		if err != nil {
			continue
		}

		// 生成链的终止哈希
		endHash, err := utils.GenerateChain(startPlaintext, req.ChainLength, req.ReductionFuncID,
			req.MinLength, req.MaxLength, charset)
		if err != nil {
			continue
		}

		// 存储到数据库
		rainbowTable := dbModel.RainbowTable{
			ChainLength:       req.ChainLength,
			StartPlaintext:    startPlaintext,
			EndHash:           endHash,
			ReductionFunction: req.ReductionFuncID,
			CharsetType:       req.CharsetType,
			MinLength:         req.MinLength,
			MaxLength:         req.MaxLength,
			CharsetRange:      req.CharsetRange,
		}

		if err := db.PG.Create(&rainbowTable).Error; err != nil {
			continue
		}

		successCount++
	}

	// 查询总数
	var totalCount int64
	db.PG.Model(&dbModel.RainbowTable{}).Count(&totalCount)

	return c.JSON(RainbowTableResponse{
		Success:    true,
		Message:    "彩虹表生成完成",
		Generated:  successCount,
		TotalCount: totalCount,
	})
}

// Search 使用彩虹表查找哈希
func Search(c *fiber.Ctx) error {
	var req RainbowTableSearchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的请求数据",
		})
	}

	if req.MD5Hash == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "请提供要查询的MD5哈希值",
		})
	}

	// 检查用户身份，记录解密任务
	userID := c.Locals("userID")
	var recordID uint = 0

	if userID != nil {
		// 检查用户是否有正在运行的任务
		var runningTaskCount int64
		if err := db.PG.Model(&dbModel.MD5Record{}).
			Where("user_id = ? AND decrypt_status = ? AND type = 2",
				userID.(uint),
				dbModel.DecryptInProgress).
			Count(&runningTaskCount).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "检查任务状态失败",
			})
		}

		if runningTaskCount > 0 {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"success": false,
				"message": "您已有正在运行的解密任务，请等待当前任务完成后再试",
			})
		}

		// 创建MD5解密记录，状态为处理中
		record := dbModel.MD5Record{
			PlainText:     "",
			UserID:        userID.(uint),
			Hash:          req.MD5Hash,
			Type:          2,                         // 解密
			Status:        1,                         // 处理中
			DecryptStatus: dbModel.DecryptInProgress, // 解密进行中
			Progress:      0,                         // 初始进度为0
		}

		if err := db.PG.Create(&record).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "创建解密记录失败",
			})
		}

		recordID = record.ID

		// 创建内存中的任务进度记录
		taskProgress := &TaskProgress{
			TaskID:            recordID,
			UserID:            userID.(uint),
			Hash:              req.MD5Hash,
			Progress:          0,
			Status:            dbModel.DecryptInProgress,
			PlainText:         "",
			TablesSearched:    0,
			TotalTables:       0,
			ChainsSearched:    0,
			ReductionAttempts: 0,
		}
		setTaskProgress(taskProgress)
	}

	// 先快速检查数据库中是否已存在该哈希值的明文
	var existingMd5 dbModel.Md5
	var found bool = false

	// 判断哈希值长度并使用相应的查询条件
	hashLen := len(req.MD5Hash)
	if hashLen != 32 && hashLen != 16 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的MD5哈希值长度",
		})
	}

	var result *gorm.DB
	lowerHash := strings.ToLower(req.MD5Hash)
	if hashLen == 32 {
		result = db.PG.Where("LOWER(md5) = ?", lowerHash).First(&existingMd5)
	} else {
		result = db.PG.Where("LOWER(md5_16) = ?", lowerHash).First(&existingMd5)
	}

	if result.Error == nil {
		// 找到了现有的记录
		found = true
		if recordID > 0 {
			// 更新用户操作记录
			db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Updates(dbModel.MD5Record{
				PlainText:     existingMd5.Plaintext,
				Status:        1, // 成功
				DecryptStatus: dbModel.DecryptSuccess,
			})

			// 更新内存中的任务进度
			updateTaskProgress(recordID, func(progress *TaskProgress) {
				progress.Progress = 100
				progress.Status = dbModel.DecryptSuccess
				progress.PlainText = existingMd5.Plaintext
			})

			// 任务完成后删除任务进度记录
			removeTaskProgress(recordID)
		}

		return c.JSON(RainbowTableSearchResponse{
			Success:   true,
			Message:   "找到匹配的明文",
			Plaintext: existingMd5.Plaintext,
		})
	}

	// 如果快速查询没有找到结果，则启动异步处理
	if !found {
		// 启动异步处理，避免长时间阻塞请求
		go func(hashToDecrypt string, recID uint) {
			// 使用彩虹表查找
			plaintext := searchWithRainbowTable(hashToDecrypt, recID)

			// 如果找到了明文，更新记录
			if plaintext != "" && recID > 0 {
				// 更新解密记录
				db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recID).Updates(dbModel.MD5Record{
					PlainText:     plaintext,
					Status:        1, // 成功
					DecryptStatus: dbModel.DecryptSuccess,
				})

				// 更新内存中的任务进度
				updateTaskProgress(recID, func(progress *TaskProgress) {
					progress.Progress = 100
					progress.Status = dbModel.DecryptSuccess
					progress.PlainText = plaintext
				})

				// 任务完成后删除任务进度记录
				removeTaskProgress(recID)

				// 同时保存到MD5库中供后续使用
				var md5 = dbModel.Md5{
					Plaintext: plaintext,
					MD5:       hashToDecrypt,
				}
				db.PG.Create(&md5)
			} else if recID > 0 {
				// 更新为解密失败
				db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recID).Updates(dbModel.MD5Record{
					Status:        2, // 失败
					DecryptStatus: dbModel.DecryptFailed,
				})

				// 更新内存中的任务进度
				updateTaskProgress(recID, func(progress *TaskProgress) {
					progress.Progress = 100
					progress.Status = dbModel.DecryptFailed
				})

				// 任务完成后删除任务进度记录
				removeTaskProgress(recID)
			}
		}(req.MD5Hash, recordID)

		// 立即返回响应，让用户知道解密任务已经启动
		return c.JSON(RainbowTableSearchResponse{
			Success:   true,
			Message:   "解密任务已启动，请稍后查看结果",
			Plaintext: "",
			TaskID:    recordID,
		})
	}

	// 这种情况应该不会发生，但为了代码完整性添加
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"success": false,
		"message": "未知错误，请重试",
	})
}

// searchWithRainbowTable 使用彩虹表搜索哈希值对应的明文
func searchWithRainbowTable(hashToSearch string, recordID uint) string {
	// 如果recordID有效，更新任务进度为10%
	if recordID > 0 {
		// 原数据库更新
		// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 10)

		// 更新内存中的任务进度
		updateTaskProgress(recordID, func(progress *TaskProgress) {
			progress.Progress = 10
		})
	}

	// 检查任务是否已被取消
	if recordID > 0 && isTaskCancelled(recordID) {
		return ""
	}

	// 首先在数据库中查找哈希值匹配的终端哈希
	var tables []dbModel.RainbowTable
	if err := db.PG.Where("end_hash = ?", hashToSearch).Find(&tables).Error; err != nil {
		return ""
	}

	// 检查任务是否已被取消
	if recordID > 0 && isTaskCancelled(recordID) {
		return ""
	}

	// 如果recordID有效，更新任务进度为20%
	if recordID > 0 {
		// 原数据库更新
		// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 20)

		// 更新内存中的任务进度
		updateTaskProgress(recordID, func(progress *TaskProgress) {
			progress.Progress = 20
			progress.TablesSearched = 1
		})
	}

	// 如果直接找到了匹配的终端哈希，使用对应的链进行查找
	for tableIndex, table := range tables {
		// 检查任务是否已被取消
		if recordID > 0 && isTaskCancelled(recordID) {
			return ""
		}

		// 更新查找的表数量
		if recordID > 0 {
			updateTaskProgress(recordID, func(progress *TaskProgress) {
				progress.TablesSearched = tableIndex + 1
			})
		}

		charset := utils.GetCharset(table.CharsetType, table.CharsetRange)
		plaintext, found := utils.LookupHash(hashToSearch, table.StartPlaintext, table.ChainLength,
			table.ReductionFunction, table.MinLength, table.MaxLength, charset)
		if found {
			// 如果recordID有效，更新任务进度为100%
			if recordID > 0 {
				// 原数据库更新
				// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 100)

				// 更新内存中的任务进度
				updateTaskProgress(recordID, func(progress *TaskProgress) {
					progress.Progress = 100
					progress.Status = dbModel.DecryptSuccess
					progress.PlainText = plaintext
					progress.ChainsSearched++
				})

				// 任务完成后删除任务进度记录
				removeTaskProgress(recordID)
			}
			return plaintext
		}

		// 更新已搜索的链数
		if recordID > 0 {
			updateTaskProgress(recordID, func(progress *TaskProgress) {
				progress.ChainsSearched++
			})
		}
	}

	// 检查任务是否已被取消
	if recordID > 0 && isTaskCancelled(recordID) {
		return ""
	}

	// 如果没有找到直接匹配，遍历所有彩虹表
	var allTables []dbModel.RainbowTable
	if err := db.PG.Find(&allTables).Error; err != nil {
		return ""
	}

	// 检查任务是否已被取消
	if recordID > 0 && isTaskCancelled(recordID) {
		return ""
	}

	// 更新总表数和进度为30%
	if recordID > 0 {
		// 原数据库更新
		// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 30)

		// 更新内存中的任务进度
		updateTaskProgress(recordID, func(progress *TaskProgress) {
			progress.Progress = 30
			progress.TotalTables = len(allTables)
		})
	}

	// 计算每个表处理后的进度增量
	totalTables := len(allTables)
	progressStep := 0
	if totalTables > 0 && recordID > 0 {
		progressStep = 60 / totalTables // 从30%到90%，共60%的进度空间
		if progressStep < 1 {
			progressStep = 1 // 确保至少有1%的进度增量
		}
	}

	// 对每个表进行查找
	for tableIndex, table := range allTables {
		// 检查任务是否已被取消
		if recordID > 0 && isTaskCancelled(recordID) {
			return ""
		}

		// 更新进度（从30%到90%）和已搜索表数
		if recordID > 0 && progressStep > 0 {
			progress := 30 + progressStep*(tableIndex+1)
			if progress > 90 {
				progress = 90 // 最多到90%
			}

			// 原数据库更新
			// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", progress)

			// 更新内存中的任务进度
			updateTaskProgress(recordID, func(prog *TaskProgress) {
				prog.Progress = progress
				prog.TablesSearched = tableIndex + 1
			})
		}

		charset := utils.GetCharset(table.CharsetType, table.CharsetRange)

		// 从目标哈希开始，尝试重建链
		currentHash := hashToSearch
		var potentialPlaintext string

		// 尝试每个可能的位置
		for i := 0; i < table.ChainLength-1; i++ {
			// 检查任务是否已被取消
			if recordID > 0 && isTaskCancelled(recordID) {
				return ""
			}

			// 更新规约函数尝试次数
			if recordID > 0 {
				updateTaskProgress(recordID, func(progress *TaskProgress) {
					progress.ReductionAttempts++
				})
			}

			// 应用规约函数
			potentialPlaintext = utils.ReductionFunction(currentHash, i, table.ReductionFunction,
				table.MinLength, table.MaxLength, charset)

			// 重建链的其余部分
			potentialEndHash, err := utils.GenerateChain(potentialPlaintext, table.ChainLength-i-1,
				table.ReductionFunction, table.MinLength, table.MaxLength, charset)
			if err != nil {
				continue
			}

			// 检查是否匹配
			if potentialEndHash == table.EndHash {
				// 验证这个明文是否确实对应目标哈希
				if utils.CalculateMD5(potentialPlaintext) == hashToSearch {
					// 如果recordID有效，更新任务进度为100%
					if recordID > 0 {
						// 原数据库更新
						// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 100)

						// 更新内存中的任务进度
						updateTaskProgress(recordID, func(progress *TaskProgress) {
							progress.Progress = 100
							progress.Status = dbModel.DecryptSuccess
							progress.PlainText = potentialPlaintext
						})

						// 任务完成后删除任务进度记录
						removeTaskProgress(recordID)
					}
					return potentialPlaintext
				}

				// 继续搜索链中其他可能的位置
				currentPlaintext := potentialPlaintext
				for j := i; j < table.ChainLength-1; j++ {
					// 检查任务是否已被取消
					if recordID > 0 && isTaskCancelled(recordID) {
						return ""
					}

					// 更新规约函数尝试次数
					if recordID > 0 {
						updateTaskProgress(recordID, func(progress *TaskProgress) {
							progress.ReductionAttempts++
						})
					}

					currentHash = utils.CalculateMD5(currentPlaintext)
					// 检查是否找到目标哈希
					if currentHash == hashToSearch {
						// 如果recordID有效，更新任务进度为100%
						if recordID > 0 {
							// 原数据库更新
							// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 100)

							// 更新内存中的任务进度
							updateTaskProgress(recordID, func(progress *TaskProgress) {
								progress.Progress = 100
								progress.Status = dbModel.DecryptSuccess
								progress.PlainText = currentPlaintext
							})

							// 任务完成后删除任务进度记录
							removeTaskProgress(recordID)
						}
						return currentPlaintext
					}
					// 继续链的下一步
					currentPlaintext = utils.ReductionFunction(currentHash, j, table.ReductionFunction,
						table.MinLength, table.MaxLength, charset)
				}
			}

			// 如果这条链不匹配，应用下一个规约函数
			currentHash = utils.CalculateMD5(potentialPlaintext)
		}

		// 更新已搜索的链数
		if recordID > 0 {
			updateTaskProgress(recordID, func(progress *TaskProgress) {
				progress.ChainsSearched++
			})
		}
	}

	// 检查任务是否已被取消
	if recordID > 0 && isTaskCancelled(recordID) {
		return ""
	}

	// 如果recordID有效，更新任务进度为100%（即使失败也是完成了）
	if recordID > 0 {
		// 原数据库更新
		// db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", recordID).Update("progress", 100)

		// 更新内存中的任务进度
		updateTaskProgress(recordID, func(progress *TaskProgress) {
			progress.Progress = 100
			progress.Status = dbModel.DecryptFailed
		})

		// 任务完成后删除任务进度记录
		removeTaskProgress(recordID)
	}
	return ""
}

// GetStats 获取彩虹表统计信息
func GetStats(c *fiber.Ctx) error {
	var stats struct {
		TotalChains        int64
		TotalCharsets      int64
		AverageChainLength float64
	}

	// 查询总链数
	if err := db.PG.Model(&dbModel.RainbowTable{}).Count(&stats.TotalChains).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "获取统计信息失败",
		})
	}

	// 如果没有数据，返回零值结果
	if stats.TotalChains == 0 {
		return c.JSON(fiber.Map{
			"success":              true,
			"total_chains":         0,
			"total_charsets":       0,
			"coverage_estimate":    0,
			"average_chain_length": 0,
		})
	}

	// 查询不同字符集类型数量
	if err := db.PG.Model(&dbModel.RainbowTable{}).Distinct("charset_type").Count(&stats.TotalCharsets).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "获取统计信息失败",
		})
	}

	// 查询平均链长度
	if err := db.PG.Model(&dbModel.RainbowTable{}).Select("AVG(chain_length) as average_chain_length").Scan(&stats.AverageChainLength).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "获取统计信息失败",
		})
	}

	// 估算覆盖率 (这是一个非常粗略的估计，实际覆盖率计算非常复杂)
	coverageEstimate := float64(stats.TotalChains) * stats.AverageChainLength / 1000000000 * 100
	if coverageEstimate > 100 {
		coverageEstimate = 99.99
	}

	return c.JSON(fiber.Map{
		"success":              true,
		"total_chains":         stats.TotalChains,
		"total_charsets":       stats.TotalCharsets,
		"coverage_estimate":    coverageEstimate,
		"average_chain_length": stats.AverageChainLength,
	})
}

// RainbowManagement 获取彩虹表管理数据
func RainbowManagement(c *fiber.Ctx) error {
	// 检查用户是否为管理员
	userRole := c.Locals("role")
	if userRole == nil || userRole.(string) != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "只有管理员可以管理彩虹表",
		})
	}

	// 获取分页参数
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	offset := (page - 1) * limit

	// 查询总记录数
	var total int64
	if err := db.PG.Model(&dbModel.RainbowTable{}).Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "获取彩虹表总数失败",
		})
	}

	// 查询彩虹表数据
	var entries []dbModel.RainbowTable
	if err := db.PG.Offset(offset).Limit(limit).Order("id DESC").Find(&entries).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "获取彩虹表数据失败",
		})
	}

	// 转换为前端需要的格式
	var result []fiber.Map
	for _, entry := range entries {
		// 构建响应数据
		resultEntry := fiber.Map{
			"id":                 entry.ID,
			"hash":               entry.EndHash,
			"hash_type":          "MD5_32", // 默认使用32位MD5
			"plaintext":          "",       // 不再查询md5表获取明文
			"created_at":         entry.CreatedAt.Unix(),
			"chain_length":       entry.ChainLength,
			"start_plaintext":    entry.StartPlaintext,
			"end_hash":           entry.EndHash,
			"reduction_function": entry.ReductionFunction,
			"charset_type":       entry.CharsetType,
			"min_length":         entry.MinLength,
			"max_length":         entry.MaxLength,
			"charset_range":      entry.CharsetRange,
		}
		result = append(result, resultEntry)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "获取彩虹表数据成功",
		"data":    result,
		"total":   total,
	})
}

// AddRainbowTableEntry 添加新的彩虹表条目
func AddRainbowTableEntry(c *fiber.Ctx) error {
	// 检查用户是否为管理员
	userRole := c.Locals("role")
	if userRole == nil || userRole.(string) != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "只有管理员可以添加彩虹表条目",
		})
	}

	// 解析请求数据
	type AddRainbowRequest struct {
		Hash              string `json:"hash"`
		HashType          string `json:"hash_type"`
		Plaintext         string `json:"plaintext"`
		ChainLength       int    `json:"chain_length"`
		StartPlaintext    string `json:"start_plaintext"`
		EndHash           string `json:"end_hash"`
		ReductionFunction int    `json:"reduction_function"`
		CharsetType       int    `json:"charset_type"`
		MinLength         int    `json:"min_length"`
		MaxLength         int    `json:"max_length"`
		CharsetRange      string `json:"charset_range"`
	}

	var req AddRainbowRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的请求数据",
		})
	}

	// 验证必要参数
	if req.StartPlaintext == "" {
		// 如果未提供起始明文，生成一个随机明文
		charset := utils.GetCharset(req.CharsetType, req.CharsetRange)
		randomPlaintext, err := utils.GenerateRandomPlaintext(req.MinLength, charset)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "生成随机明文失败",
			})
		}
		req.StartPlaintext = randomPlaintext
	}

	// 如果未提供结束哈希，生成一个
	if req.EndHash == "" {
		// 生成链的终止哈希
		charset := utils.GetCharset(req.CharsetType, req.CharsetRange)
		endHash, err := utils.GenerateChain(req.StartPlaintext, req.ChainLength, req.ReductionFunction,
			req.MinLength, req.MaxLength, charset)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "生成终止哈希失败",
			})
		}
		req.EndHash = endHash
	}

	// 创建彩虹表条目
	rainbowTable := dbModel.RainbowTable{
		ChainLength:       req.ChainLength,
		StartPlaintext:    req.StartPlaintext,
		EndHash:           req.EndHash,
		ReductionFunction: req.ReductionFunction,
		CharsetType:       req.CharsetType,
		MinLength:         req.MinLength,
		MaxLength:         req.MaxLength,
		CharsetRange:      req.CharsetRange,
	}

	if err := db.PG.Create(&rainbowTable).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "创建彩虹表条目失败",
		})
	}

	// 如果提供了明文和哈希值，同时创建MD5记录
	if req.Plaintext != "" && req.Hash != "" && req.HashType != "" {
		md5Record := dbModel.Md5{
			Plaintext: req.Plaintext,
			MD5:       req.Hash,
		}
		// 如果是16位MD5，设置MD5_16字段
		if req.HashType == "MD5_16" {
			md5Record.MD5_16 = req.Hash
		}

		if err := db.PG.Create(&md5Record).Error; err != nil {
			// 记录错误但不中断流程
			fmt.Println("创建MD5记录失败:", err)
		}
	}

	// 构建响应数据
	responseEntry := fiber.Map{
		"id":                 rainbowTable.ID,
		"hash":               req.Hash,
		"hash_type":          req.HashType,
		"plaintext":          req.Plaintext,
		"created_at":         rainbowTable.CreatedAt.Unix(),
		"chain_length":       rainbowTable.ChainLength,
		"start_plaintext":    rainbowTable.StartPlaintext,
		"end_hash":           rainbowTable.EndHash,
		"reduction_function": rainbowTable.ReductionFunction,
		"charset_type":       rainbowTable.CharsetType,
		"min_length":         rainbowTable.MinLength,
		"max_length":         rainbowTable.MaxLength,
		"charset_range":      rainbowTable.CharsetRange,
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "彩虹表条目创建成功",
		"data":    responseEntry,
	})
}

// DeleteRainbowTableEntry 删除彩虹表条目
func DeleteRainbowTableEntry(c *fiber.Ctx) error {
	// 检查用户是否为管理员
	userRole := c.Locals("role")
	if userRole == nil || userRole.(string) != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "只有管理员可以删除彩虹表条目",
		})
	}

	// 获取ID参数
	id, err := c.ParamsInt("id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的ID参数",
		})
	}

	// 查找并删除条目
	result := db.PG.Delete(&dbModel.RainbowTable{}, id)
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "删除彩虹表条目失败",
		})
	}

	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "找不到指定的彩虹表条目",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "彩虹表条目删除成功",
	})
}

// GetTaskStatus 获取解密任务状态
func GetTaskStatus(c *fiber.Ctx) error {
	// 获取任务ID
	taskID := c.Params("id")
	if taskID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "请提供任务ID",
		})
	}

	// 将taskID转换为uint
	id, err := strconv.ParseUint(taskID, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的任务ID",
		})
	}
	taskIDUint := uint(id)

	// 首先尝试从内存中获取任务进度
	taskProgress := getTaskProgress(taskIDUint)
	if taskProgress != nil {
		// 检查用户权限（只能查看自己的任务）
		userID := c.Locals("userID")
		if userID == nil || userID.(uint) != taskProgress.UserID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"success": false,
				"message": "没有权限查看此任务",
			})
		}

		// 根据任务状态返回不同响应
		switch taskProgress.Status {
		case dbModel.DecryptNotStarted:
			return c.JSON(fiber.Map{
				"success":            true,
				"status":             "not_started",
				"message":            "任务尚未开始",
				"progress":           0,
				"tables_searched":    taskProgress.TablesSearched,
				"total_tables":       taskProgress.TotalTables,
				"chains_searched":    taskProgress.ChainsSearched,
				"reduction_attempts": taskProgress.ReductionAttempts,
			})
		case dbModel.DecryptInProgress:
			return c.JSON(fiber.Map{
				"success":            true,
				"status":             "in_progress",
				"message":            "解密进行中，请稍后再查询",
				"progress":           taskProgress.Progress,
				"tables_searched":    taskProgress.TablesSearched,
				"total_tables":       taskProgress.TotalTables,
				"chains_searched":    taskProgress.ChainsSearched,
				"reduction_attempts": taskProgress.ReductionAttempts,
			})
		case dbModel.DecryptSuccess:
			return c.JSON(fiber.Map{
				"success":            true,
				"status":             "success",
				"message":            "解密成功",
				"plaintext":          taskProgress.PlainText,
				"hash":               taskProgress.Hash,
				"progress":           100,
				"tables_searched":    taskProgress.TablesSearched,
				"total_tables":       taskProgress.TotalTables,
				"chains_searched":    taskProgress.ChainsSearched,
				"reduction_attempts": taskProgress.ReductionAttempts,
			})
		case dbModel.DecryptFailed:
			return c.JSON(fiber.Map{
				"success":            true,
				"status":             "failed",
				"message":            "解密失败，未找到匹配的明文",
				"hash":               taskProgress.Hash,
				"progress":           100,
				"tables_searched":    taskProgress.TablesSearched,
				"total_tables":       taskProgress.TotalTables,
				"chains_searched":    taskProgress.ChainsSearched,
				"reduction_attempts": taskProgress.ReductionAttempts,
			})
		default:
			return c.JSON(fiber.Map{
				"success":            true,
				"status":             "unknown",
				"message":            "未知的任务状态",
				"progress":           0,
				"tables_searched":    taskProgress.TablesSearched,
				"total_tables":       taskProgress.TotalTables,
				"chains_searched":    taskProgress.ChainsSearched,
				"reduction_attempts": taskProgress.ReductionAttempts,
			})
		}
	}

	// 如果内存中没有找到任务进度，则尝试从数据库中查询
	var record dbModel.MD5Record
	if err := db.PG.First(&record, taskID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "未找到指定任务",
		})
	}

	// 检查用户权限（只能查看自己的任务）
	userID := c.Locals("userID")
	if userID == nil || userID.(uint) != record.UserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "没有权限查看此任务",
		})
	}

	// 尝试获取任务的详细进度信息
	var detailProgress dbModel.TaskProgressRecord
	var tablesSearched, totalTables, chainsSearched, reductionAttempts int
	if db.PG.Where("task_id = ?", taskIDUint).First(&detailProgress).Error == nil {
		tablesSearched = detailProgress.TablesSearched
		totalTables = detailProgress.TotalTables
		chainsSearched = detailProgress.ChainsSearched
		reductionAttempts = detailProgress.ReductionAttempts
	}

	// 根据任务状态返回不同响应
	switch record.DecryptStatus {
	case dbModel.DecryptNotStarted:
		return c.JSON(fiber.Map{
			"success":            true,
			"status":             "not_started",
			"message":            "任务尚未开始",
			"progress":           0,
			"tables_searched":    tablesSearched,
			"total_tables":       totalTables,
			"chains_searched":    chainsSearched,
			"reduction_attempts": reductionAttempts,
		})
	case dbModel.DecryptInProgress:
		return c.JSON(fiber.Map{
			"success":            true,
			"status":             "in_progress",
			"message":            "解密进行中，请稍后再查询",
			"progress":           record.Progress,
			"tables_searched":    tablesSearched,
			"total_tables":       totalTables,
			"chains_searched":    chainsSearched,
			"reduction_attempts": reductionAttempts,
		})
	case dbModel.DecryptSuccess:
		return c.JSON(fiber.Map{
			"success":            true,
			"status":             "success",
			"message":            "解密成功",
			"plaintext":          record.PlainText,
			"hash":               record.Hash,
			"progress":           100,
			"tables_searched":    tablesSearched,
			"total_tables":       totalTables,
			"chains_searched":    chainsSearched,
			"reduction_attempts": reductionAttempts,
		})
	case dbModel.DecryptFailed:
		return c.JSON(fiber.Map{
			"success":            true,
			"status":             "failed",
			"message":            "解密失败，未找到匹配的明文",
			"hash":               record.Hash,
			"progress":           100,
			"tables_searched":    tablesSearched,
			"total_tables":       totalTables,
			"chains_searched":    chainsSearched,
			"reduction_attempts": reductionAttempts,
		})
	default:
		return c.JSON(fiber.Map{
			"success":            true,
			"status":             "unknown",
			"message":            "未知的任务状态",
			"progress":           0,
			"tables_searched":    tablesSearched,
			"total_tables":       totalTables,
			"chains_searched":    chainsSearched,
			"reduction_attempts": reductionAttempts,
		})
	}
}

// FinishTask 手动结束解密任务
func FinishTask(c *fiber.Ctx) error {
	// 获取任务ID
	taskID := c.Params("id")
	if taskID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "请提供任务ID",
		})
	}

	// 将taskID转换为uint
	id, err := strconv.ParseUint(taskID, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的任务ID",
		})
	}
	taskIDUint := uint(id)

	// 获取当前用户ID
	userID := c.Locals("userID")
	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "用户未认证",
		})
	}

	// 首先从数据库中查询任务记录，确认它存在
	var record dbModel.MD5Record
	if err := db.PG.First(&record, taskIDUint).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "未找到指定任务",
		})
	}

	// 检查用户权限（只能操作自己的任务）
	if userID.(uint) != record.UserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "没有权限操作此任务",
		})
	}

	// 检查任务状态，只有正在进行中的任务才能被手动结束
	if record.DecryptStatus != dbModel.DecryptInProgress {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "只能结束正在进行中的任务",
		})
	}

	// 更新任务状态为失败
	updates := map[string]interface{}{
		"decrypt_status": dbModel.DecryptFailed,
		"progress":       100, // 设置进度为100%表示任务已完成
	}

	if err := db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", taskIDUint).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "更新任务状态失败",
		})
	}

	// 如果任务在内存中存在，也更新内存中的状态
	taskProgress := getTaskProgress(taskIDUint)
	if taskProgress != nil {
		updateTaskProgress(taskIDUint, func(progress *TaskProgress) {
			progress.Status = dbModel.DecryptFailed
			progress.Progress = 100
		})

		// 如果任务已完成，可以考虑从内存中移除
		removeTaskProgress(taskIDUint)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "已成功结束任务",
	})
}

// TaskManagementRequest 任务管理请求参数
type TaskManagementRequest struct {
	Page     int `json:"page" query:"page"`           // 页码
	PageSize int `json:"page_size" query:"page_size"` // 每页数量
	Status   int `json:"status" query:"status"`       // 任务状态筛选
}

// TaskManagementResponse 任务管理响应
type TaskManagementResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    struct {
		Total int64 `json:"total"` // 总任务数
		Tasks []struct {
			ID            uint   `json:"id"`             // 任务ID
			UserID        uint   `json:"user_id"`        // 用户ID
			Hash          string `json:"hash"`           // MD5哈希
			PlainText     string `json:"plain_text"`     // 明文
			Type          int    `json:"type"`           // 任务类型
			Status        int    `json:"status"`         // 操作状态
			DecryptStatus int    `json:"decrypt_status"` // 解密状态
			Progress      int    `json:"progress"`       // 进度
			CreatedAt     string `json:"created_at"`     // 创建时间
			UpdatedAt     string `json:"updated_at"`     // 更新时间
			// 详细信息
			TablesSearched    int `json:"tables_searched"`    // 已搜索的彩虹表数量
			TotalTables       int `json:"total_tables"`       // 总彩虹表数量
			ChainsSearched    int `json:"chains_searched"`    // 已搜索的链数量
			ReductionAttempts int `json:"reduction_attempts"` // 规约函数应用次数
		} `json:"tasks"`
	} `json:"data"`
}

// TaskManagement 任务管理接口
func TaskManagement(c *fiber.Ctx) error {
	var req TaskManagementRequest
	if err := c.QueryParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(TaskManagementResponse{
			Success: false,
			Message: "无效的请求参数",
		})
	}

	// 设置默认值
	if req.Page < 1 {
		req.Page = 1
	}
	if req.PageSize < 1 {
		req.PageSize = 10
	}

	// 构建查询
	query := db.PG.Model(&dbModel.MD5Record{})

	// 如果指定了状态，添加状态筛选
	if req.Status > 0 {
		query = query.Where("decrypt_status = ?", req.Status)
	}

	// 获取总记录数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(TaskManagementResponse{
			Success: false,
			Message: "获取任务总数失败",
		})
	}

	// 获取分页数据
	var records []dbModel.MD5Record
	if err := query.Order("created_at DESC").
		Offset((req.Page - 1) * req.PageSize).
		Limit(req.PageSize).
		Find(&records).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(TaskManagementResponse{
			Success: false,
			Message: "获取任务列表失败",
		})
	}

	// 构建响应数据
	var tasks []struct {
		ID                uint   `json:"id"`
		UserID            uint   `json:"user_id"`
		Hash              string `json:"hash"`
		PlainText         string `json:"plain_text"`
		Type              int    `json:"type"`
		Status            int    `json:"status"`
		DecryptStatus     int    `json:"decrypt_status"`
		Progress          int    `json:"progress"`
		CreatedAt         string `json:"created_at"`
		UpdatedAt         string `json:"updated_at"`
		TablesSearched    int    `json:"tables_searched"`
		TotalTables       int    `json:"total_tables"`
		ChainsSearched    int    `json:"chains_searched"`
		ReductionAttempts int    `json:"reduction_attempts"`
	}

	for _, record := range records {
		task := struct {
			ID                uint   `json:"id"`
			UserID            uint   `json:"user_id"`
			Hash              string `json:"hash"`
			PlainText         string `json:"plain_text"`
			Type              int    `json:"type"`
			Status            int    `json:"status"`
			DecryptStatus     int    `json:"decrypt_status"`
			Progress          int    `json:"progress"`
			CreatedAt         string `json:"created_at"`
			UpdatedAt         string `json:"updated_at"`
			TablesSearched    int    `json:"tables_searched"`
			TotalTables       int    `json:"total_tables"`
			ChainsSearched    int    `json:"chains_searched"`
			ReductionAttempts int    `json:"reduction_attempts"`
		}{
			ID:            record.ID,
			UserID:        record.UserID,
			Hash:          record.Hash,
			PlainText:     record.PlainText,
			Type:          record.Type,
			Status:        record.Status,
			DecryptStatus: record.DecryptStatus,
			Progress:      record.Progress,
			CreatedAt:     record.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:     record.UpdatedAt.Format("2006-01-02 15:04:05"),
		}

		// 获取任务详细信息
		var detail dbModel.TaskProgressRecord
		if err := db.PG.Where("task_id = ?", record.ID).First(&detail).Error; err == nil {
			task.TablesSearched = detail.TablesSearched
			task.TotalTables = detail.TotalTables
			task.ChainsSearched = detail.ChainsSearched
			task.ReductionAttempts = detail.ReductionAttempts
		}

		tasks = append(tasks, task)
	}

	return c.JSON(TaskManagementResponse{
		Success: true,
		Data: struct {
			Total int64 `json:"total"`
			Tasks []struct {
				ID                uint   `json:"id"`
				UserID            uint   `json:"user_id"`
				Hash              string `json:"hash"`
				PlainText         string `json:"plain_text"`
				Type              int    `json:"type"`
				Status            int    `json:"status"`
				DecryptStatus     int    `json:"decrypt_status"`
				Progress          int    `json:"progress"`
				CreatedAt         string `json:"created_at"`
				UpdatedAt         string `json:"updated_at"`
				TablesSearched    int    `json:"tables_searched"`
				TotalTables       int    `json:"total_tables"`
				ChainsSearched    int    `json:"chains_searched"`
				ReductionAttempts int    `json:"reduction_attempts"`
			} `json:"tasks"`
		}{
			Total: total,
			Tasks: tasks,
		},
	})
}

// CancelTask 取消解密任务
func CancelTask(c *fiber.Ctx) error {
	// 获取任务ID
	taskID := c.Params("id")
	if taskID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "请提供任务ID",
		})
	}

	// 将taskID转换为uint
	id, err := strconv.ParseUint(taskID, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "无效的任务ID",
		})
	}
	taskIDUint := uint(id)

	// 获取当前用户ID
	userID := c.Locals("userID")
	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "用户未认证",
		})
	}

	// 首先从数据库中查询任务记录，确认它存在
	var record dbModel.MD5Record
	if err := db.PG.First(&record, taskIDUint).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "未找到指定任务",
		})
	}

	// 检查任务状态，只有正在进行中的任务才能被取消
	if record.DecryptStatus != dbModel.DecryptInProgress {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "只能取消正在进行中的任务",
		})
	}

	// 设置任务取消标志
	setTaskCancelled(taskIDUint, true)

	// 更新任务状态为已取消
	updates := map[string]interface{}{
		"decrypt_status": dbModel.DecryptFailed,
		"progress":       100, // 设置进度为100%表示任务已完成
	}

	if err := db.PG.Model(&dbModel.MD5Record{}).Where("id = ?", taskIDUint).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "更新任务状态失败",
		})
	}

	// 如果任务在内存中存在，也更新内存中的状态
	taskProgress := getTaskProgress(taskIDUint)
	if taskProgress != nil {
		updateTaskProgress(taskIDUint, func(progress *TaskProgress) {
			progress.Status = dbModel.DecryptFailed
			progress.Progress = 100
		})

		// 任务完成后从内存中移除
		removeTaskProgress(taskIDUint)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "已成功取消任务",
	})
}
