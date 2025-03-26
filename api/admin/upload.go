package admin

import (
	"bufio"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
	"zmd5/db"
	"zmd5/db/dbModel"

	"context"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"
)

const (
	batchSize  = 1000  // 每批处理的数据量
	maxWorkers = 5     // 最大工作协程数
	chunkSize  = 10000 // 文件分块处理大小
)

// Upload 处理文件上传和批量导入
func Upload(c *fiber.Ctx) error {
	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "请选择要上传的文件",
		})
	}

	// 创建临时目录
	tempDir := "temp_uploads"
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		log.Printf("创建临时目录失败: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "服务器内部错误，请稍后重试",
		})
	}

	// 生成唯一的临时文件名
	tempFileName := filepath.Join(tempDir, fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename))

	// 保存上传的文件
	if err := c.SaveFile(file, tempFileName); err != nil {
		log.Printf("保存文件失败: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "保存文件失败，请稍后重试",
		})
	}

	// 启动后台处理协程
	go processFile(tempFileName)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "文件上传成功，正在后台处理",
	})
}

// processFile 处理上传的文件
func processFile(filePath string) {
	defer func() {
		// 处理完成后删除临时文件
		os.Remove(filePath)
	}()

	file, err := os.Open(filePath)
	if err != nil {
		fmt.Printf("打开文件失败: %v\n", err)
		return
	}
	defer file.Close()

	// 创建上下文和工作组
	ctx := context.Background()
	g, ctx := errgroup.WithContext(ctx)

	// 创建信号量限制并发
	sem := semaphore.NewWeighted(int64(maxWorkers))

	// 创建读取器和扫描器
	reader := bufio.NewReader(file)
	scanner := bufio.NewScanner(reader)

	// 使用更大的缓冲区
	const maxCapacity = 512 * 1024 // 512KB
	buf := make([]byte, maxCapacity)
	scanner.Buffer(buf, maxCapacity)

	var chunkID int
	var records []dbModel.Md5

	// 处理每一行数据
	for scanner.Scan() {
		line := scanner.Text()
		// 尝试按逗号分割
		parts := strings.Split(line, ",")
		if len(parts) == 1 {
			// 如果不是逗号分割，则整行作为一个值
			parts = []string{line}
		}

		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}

			md5Hash := calculateMD5(part)
			md5Record := dbModel.Md5{
				Plaintext: part,
				MD5:       md5Hash,
				MD5_16:    md5Hash[8:24], // 16位MD5
			}

			records = append(records, md5Record)

			// 当记录达到块大小时，启动一个工作协程处理这个块
			if len(records) >= chunkSize {
				// 复制当前记录集以避免竞争条件
				recordsToProcess := make([]dbModel.Md5, len(records))
				copy(recordsToProcess, records)
				currentChunkID := chunkID

				// 等待获取信号量
				if err := sem.Acquire(ctx, 1); err != nil {
					fmt.Printf("无法获取信号量: %v\n", err)
					continue
				}

				g.Go(func() error {
					defer sem.Release(1)
					return processChunk(recordsToProcess, currentChunkID)
				})

				// 重置记录集和增加块ID
				records = make([]dbModel.Md5, 0, chunkSize)
				chunkID++
			}
		}
	}

	// 处理剩余的记录
	if len(records) > 0 {
		recordsToProcess := make([]dbModel.Md5, len(records))
		copy(recordsToProcess, records)
		currentChunkID := chunkID

		if err := sem.Acquire(ctx, 1); err != nil {
			fmt.Printf("无法获取信号量: %v\n", err)
		} else {
			g.Go(func() error {
				defer sem.Release(1)
				return processChunk(recordsToProcess, currentChunkID)
			})
		}
	}

	// 等待所有处理完成
	if err := g.Wait(); err != nil {
		fmt.Printf("处理文件时出错: %v\n", err)
	}
}

// processChunk 处理一个数据块，使用事务和批处理
func processChunk(records []dbModel.Md5, chunkID int) error {
	startTime := time.Now()
	fmt.Printf("开始处理块 #%d, 包含 %d 条记录\n", chunkID, len(records))

	// 将大块分成小批次处理
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}

		batch := records[i:end]
		if err := processBatch(batch); err != nil {
			fmt.Printf("处理批次失败 (块 #%d, 批次 %d-%d): %v\n", chunkID, i, end, err)
		}
	}

	fmt.Printf("完成处理块 #%d, 耗时: %v\n", chunkID, time.Since(startTime))
	return nil
}

// processBatch 处理单个批次，使用事务
func processBatch(batch []dbModel.Md5) error {
	// 开始事务
	tx := db.PG.Begin()
	if tx.Error != nil {
		return fmt.Errorf("无法开始事务: %v", tx.Error)
	}

	// 确保事务结束
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 提取明文和MD5值，用于查询
	plaintexts := make([]string, 0, len(batch))
	md5s := make([]string, 0, len(batch))
	plaintextMap := make(map[string]bool)
	md5Map := make(map[string]bool)

	// 使用map去重，减少查询负担
	for _, record := range batch {
		if !plaintextMap[record.Plaintext] {
			plaintexts = append(plaintexts, record.Plaintext)
			plaintextMap[record.Plaintext] = true
		}
		if !md5Map[record.MD5] {
			md5s = append(md5s, record.MD5)
			md5Map[record.MD5] = true
		}
	}

	// 分批次查询已存在的明文记录，减少一次查询的数据量
	const queryBatchSize = 200
	existingMap := make(map[string]bool)

	// 查询明文
	for i := 0; i < len(plaintexts); i += queryBatchSize {
		end := i + queryBatchSize
		if end > len(plaintexts) {
			end = len(plaintexts)
		}

		var existingPlaintexts []string
		if err := tx.Model(&dbModel.Md5{}).Where("plaintext IN ?", plaintexts[i:end]).
			Pluck("plaintext", &existingPlaintexts).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("查询明文失败: %v", err)
		}

		for _, p := range existingPlaintexts {
			existingMap[p] = true
		}
	}

	// 查询MD5
	for i := 0; i < len(md5s); i += queryBatchSize {
		end := i + queryBatchSize
		if end > len(md5s) {
			end = len(md5s)
		}

		var existingMD5s []string
		if err := tx.Model(&dbModel.Md5{}).Where("md5 IN ?", md5s[i:end]).
			Pluck("md5", &existingMD5s).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("查询MD5失败: %v", err)
		}

		for _, m := range existingMD5s {
			existingMap[m] = true
		}
	}

	// 过滤出不存在的记录
	var newRecords []dbModel.Md5
	for _, record := range batch {
		if !existingMap[record.Plaintext] && !existingMap[record.MD5] {
			newRecords = append(newRecords, record)
		}
	}

	// 批量保存新记录
	if len(newRecords) > 0 {
		// 使用较小的批量插入大小，避免过大的事务
		if err := tx.CreateInBatches(newRecords, 200).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("批量保存失败: %v", err)
		}
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

// calculateMD5 计算字符串的MD5值
func calculateMD5(text string) string {
	hash := md5.New()
	hash.Write([]byte(text))
	return hex.EncodeToString(hash.Sum(nil))
}
