package utils

import (
	"crypto/md5"
	"encoding/hex"
	"math/big"
	"strconv"
	"strings"
)

// 字符集常量定义
const (
	CharsetDigits      = "0123456789"                                                                                // 纯数字
	CharsetLower       = "abcdefghijklmnopqrstuvwxyz"                                                                // 小写字母
	CharsetUpper       = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"                                                                // 大写字母
	CharsetAlpha       = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"                                      // 大小写字母
	CharsetAlphaDigits = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"                            // 大小写字母+数字
	CharsetSpecial     = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?/" // 完整字符集
)

// CharsetType 对应的字符集
func GetCharset(charsetType int, charsetRange string) string {
	// 如果提供了自定义字符集范围，优先使用
	if charsetRange != "" {
		return charsetRange
	}

	// 否则根据类型选择预定义字符集
	switch charsetType {
	case 1:
		return CharsetDigits
	case 2:
		return CharsetLower
	case 3:
		return CharsetUpper
	case 4:
		return CharsetAlpha
	case 5:
		return CharsetAlphaDigits
	case 6:
		return CharsetSpecial
	default:
		return CharsetDigits
	}
}

// CalculateMD5 计算字符串的MD5哈希值
func CalculateMD5(input string) string {
	hash := md5.Sum([]byte(input))
	return hex.EncodeToString(hash[:])
}

// ReductionFunction 根据MD5哈希、当前索引、字符集等参数生成明文
// reduction是一种从哈希值映射回明文的函数，用于彩虹表攻击
// index: 表示在链中的位置，用于生成不同的规约结果
// minLen, maxLen: 生成明文的长度范围
// charset: 用于生成明文的字符集
func ReductionFunction(hash string, index, reductionFuncID, minLen, maxLen int, charset string) string {
	// 确保长度有效
	if minLen < 1 {
		minLen = 1
	}
	if maxLen < minLen {
		maxLen = minLen
	}
	if len(charset) == 0 {
		charset = CharsetDigits
	}

	// 将hash转换为大整数
	hashInt := new(big.Int)
	hashInt.SetString(hash, 16)

	// 与索引混合，确保同一个哈希在链的不同位置产生不同的明文
	indexBigInt := big.NewInt(int64(index))
	funcIDBigInt := big.NewInt(int64(reductionFuncID))

	// 不同规约函数使用不同的混合方式
	switch reductionFuncID % 5 {
	case 0:
		// 直接加法
		hashInt.Add(hashInt, indexBigInt)
	case 1:
		// 异或操作
		hashInt.Xor(hashInt, indexBigInt)
	case 2:
		// 乘法后取余
		hashInt.Mul(hashInt, indexBigInt.Add(indexBigInt, big.NewInt(1)))
	case 3:
		// 混合操作
		temp := new(big.Int).Add(hashInt, funcIDBigInt)
		hashInt.Xor(temp, indexBigInt)
	case 4:
		// 旋转位
		rotateAmount := index % 128
		temp := new(big.Int).Lsh(hashInt, uint(rotateAmount))
		hashInt.Or(temp, new(big.Int).Rsh(hashInt, uint(128-rotateAmount)))
	}

	// 计算长度 - 在最小和最大长度之间随机选择
	lenRange := maxLen - minLen + 1
	lenBigInt := new(big.Int).Mod(hashInt, big.NewInt(int64(lenRange)))
	length := minLen + int(lenBigInt.Int64())

	// 生成字符串
	var result strings.Builder
	charsetLen := big.NewInt(int64(len(charset)))

	for i := 0; i < length; i++ {
		// 取余获取字符索引
		charIndex := new(big.Int).Mod(hashInt, charsetLen)
		result.WriteByte(charset[charIndex.Int64()])

		// 更新哈希值，以生成下一个字符
		hashInt.Div(hashInt, charsetLen)

		// 如果哈希值变得太小，重新注入熵
		if hashInt.Cmp(charsetLen) < 0 {
			seedStr := strconv.Itoa(i) + hash + strconv.Itoa(index)
			newHash := md5.Sum([]byte(seedStr))
			hashInt.SetString(hex.EncodeToString(newHash[:]), 16)
		}
	}

	return result.String()
}

// GenerateChain 生成彩虹表链
// startPlain: 起始明文
// chainLength: 链长度
// reductionFuncID: 使用的规约函数ID
// minLen, maxLen: 明文长度范围
// charset: 字符集
// 返回链的最终哈希值
func GenerateChain(startPlain string, chainLength, reductionFuncID, minLen, maxLen int, charset string) (string, error) {
	currentPlain := startPlain
	var currentHash string

	for i := 0; i < chainLength; i++ {
		// 计算哈希
		currentHash = CalculateMD5(currentPlain)

		// 最后一轮不需要规约
		if i == chainLength-1 {
			break
		}

		// 应用规约函数
		currentPlain = ReductionFunction(currentHash, i, reductionFuncID, minLen, maxLen, charset)
	}

	return currentHash, nil
}

// VerifyChain 验证彩虹表链是否正确
func VerifyChain(startPlain string, endHash string, chainLength, reductionFuncID, minLen, maxLen int, charset string) bool {
	generatedEndHash, err := GenerateChain(startPlain, chainLength, reductionFuncID, minLen, maxLen, charset)
	if err != nil {
		return false
	}
	return generatedEndHash == endHash
}

// LookupHash 在彩虹表中查找哈希值对应的明文
// targetHash: 目标哈希值
// startPlain: 链的起始明文
// chainLength: 链长度
// reductionFuncID: 使用的规约函数ID
// minLen, maxLen: 明文长度范围
// charset: 字符集
func LookupHash(targetHash string, startPlain string, chainLength, reductionFuncID, minLen, maxLen int, charset string) (string, bool) {
	// 从每个可能的位置开始检查
	for i := chainLength - 1; i >= 0; i-- {
		// 从起始明文开始重建链，直到i位置
		currentPlain := startPlain
		currentHash := ""

		for j := 0; j < i; j++ {
			currentHash = CalculateMD5(currentPlain)
			currentPlain = ReductionFunction(currentHash, j, reductionFuncID, minLen, maxLen, charset)
		}

		// 计算当前位置的哈希
		currentHash = CalculateMD5(currentPlain)

		// 检查是否匹配目标哈希
		if currentHash == targetHash {
			return currentPlain, true
		}
	}

	return "", false
}
