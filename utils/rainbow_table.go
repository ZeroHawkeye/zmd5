package utils

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
)

// 生成随机字符串作为起始明文
func GenerateRandomPlaintext(length int, charset string) (string, error) {
	if length <= 0 {
		length = 8
	}
	if charset == "" {
		charset = CharsetAlphaDigits
	}

	result := make([]byte, length)
	charsetLength := big.NewInt(int64(len(charset)))

	for i := 0; i < length; i++ {
		randomIndex, err := rand.Int(rand.Reader, charsetLength)
		if err != nil {
			return "", err
		}
		result[i] = charset[randomIndex.Int64()]
	}

	return string(result), nil
}

// 从16进制字符串生成随机字节
func RandomBytesFromHex(hexStr string, length int) ([]byte, error) {
	if len(hexStr) < 2 {
		hexStr = "00"
	}

	// 使用提供的hex字符串作为种子
	seed := new(big.Int)
	seed.SetString(hexStr, 16)

	// 生成随机字节
	randomBytes := make([]byte, length)
	for i := 0; i < length; i++ {
		// 使用seed生成随机数
		randomIndex := new(big.Int).Mod(seed, big.NewInt(256))
		randomBytes[i] = byte(randomIndex.Int64())

		// 更新seed
		seed.Mul(seed, big.NewInt(33))
		seed.Add(seed, big.NewInt(int64(i)))
	}

	return randomBytes, nil
}

// 生成随机哈希用于测试
func GenerateRandomMD5() string {
	bytes := make([]byte, 16)
	_, err := rand.Read(bytes)
	if err != nil {
		// 出错时使用固定值
		return "00000000000000000000000000000000"
	}
	return hex.EncodeToString(bytes)
}
