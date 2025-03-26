package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// 定义密钥 - 在实际应用中应使用环境变量
var jwtSecret = []byte("zmd5_secret_key")

// JWTClaims 自定义JWT声明结构
type JWTClaims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken 生成JWT令牌
func GenerateToken(userID uint, username string, role string) (string, error) {
	// 设置过期时间为24小时
	expirationTime := time.Now().Add(24 * time.Hour)

	// 创建JWT声明
	claims := JWTClaims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}

	// 使用claims创建token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 使用密钥签名token并获取完整的编码后的字符串
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ParseToken 解析JWT令牌
func ParseToken(tokenString string) (*JWTClaims, error) {
	// 解析token
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("无效的token签名方法")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	// 验证token
	if !token.Valid {
		return nil, errors.New("无效的token")
	}

	// 获取声明
	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return nil, errors.New("无法获取token声明")
	}

	return claims, nil
}

// ValidateToken 验证token并返回用户信息
func ValidateToken(tokenString string) (uint, string, string, error) {
	claims, err := ParseToken(tokenString)
	if err != nil {
		return 0, "", "", err
	}

	return claims.UserID, claims.Username, claims.Role, nil
}
