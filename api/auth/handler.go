package auth

import (
	"zmd5/db"
	"zmd5/db/dbModel"
	"zmd5/utils"

	"github.com/gofiber/fiber/v2"
)

// LoginRequest 登录请求结构
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// RegisterRequest 注册请求结构
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse 登录响应结构
type LoginResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Token   string `json:"token,omitempty"`
	User    *User  `json:"user,omitempty"`
}

// User 用户信息
type User struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// Login 处理用户登录
func Login(c *fiber.Ctx) error {
	var request LoginRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(LoginResponse{
			Code:    fiber.StatusBadRequest,
			Message: "无效的请求参数",
		})
	}

	// 验证用户名和密码是否为空
	if request.Username == "" || request.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(LoginResponse{
			Code:    fiber.StatusBadRequest,
			Message: "用户名和密码不能为空",
		})
	}

	// 查询用户
	var user dbModel.User
	result := db.PG.Where("username = ?", request.Username).First(&user)
	if result.Error != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(LoginResponse{
			Code:    fiber.StatusUnauthorized,
			Message: "用户名或密码错误",
		})
	}

	// 验证密码
	if !utils.CheckPasswordHash(request.Password, user.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(LoginResponse{
			Code:    fiber.StatusUnauthorized,
			Message: "用户名或密码错误",
		})
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(LoginResponse{
			Code:    fiber.StatusInternalServerError,
			Message: "生成token失败",
		})
	}

	// 更新用户token
	user.Token = token
	db.PG.Save(&user)

	// 登录成功，返回用户信息和token
	return c.Status(fiber.StatusOK).JSON(LoginResponse{
		Code:    fiber.StatusOK,
		Message: "登录成功",
		Token:   token,
		User: &User{
			ID:       user.ID,
			Username: user.Username,
			Role:     user.Role,
		},
	})
}

// Register 处理用户注册
func Register(c *fiber.Ctx) error {
	var request RegisterRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(LoginResponse{
			Code:    fiber.StatusBadRequest,
			Message: "无效的请求参数",
		})
	}

	// 验证用户名和密码是否为空
	if request.Username == "" || request.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(LoginResponse{
			Code:    fiber.StatusBadRequest,
			Message: "用户名和密码不能为空",
		})
	}

	// 检查用户名是否已存在
	var existingUser dbModel.User
	result := db.PG.Where("username = ?", request.Username).First(&existingUser)
	if result.Error == nil {
		return c.Status(fiber.StatusConflict).JSON(LoginResponse{
			Code:    fiber.StatusConflict,
			Message: "用户名已存在",
		})
	}

	// 加密密码
	hashedPassword, err := utils.EncryptPassword(request.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(LoginResponse{
			Code:    fiber.StatusInternalServerError,
			Message: "密码加密失败",
		})
	}

	// 创建新用户
	newUser := dbModel.User{
		Username: request.Username,
		Password: hashedPassword,
		Role:     "user", // 默认为普通用户角色
	}

	if err := db.PG.Create(&newUser).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(LoginResponse{
			Code:    fiber.StatusInternalServerError,
			Message: "用户创建失败",
		})
	}

	// 生成JWT令牌
	token, err := utils.GenerateToken(newUser.ID, newUser.Username, newUser.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(LoginResponse{
			Code:    fiber.StatusInternalServerError,
			Message: "生成token失败",
		})
	}

	// 更新用户token
	newUser.Token = token
	db.PG.Save(&newUser)

	// 注册成功
	return c.Status(fiber.StatusCreated).JSON(LoginResponse{
		Code:    fiber.StatusCreated,
		Message: "注册成功",
		Token:   token,
		User: &User{
			ID:       newUser.ID,
			Username: newUser.Username,
			Role:     newUser.Role,
		},
	})
}

// StatusResponse 状态检查响应结构
type StatusResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	IsAuth  bool   `json:"isAuth"`
	User    *User  `json:"user,omitempty"`
}

// Status 检查用户认证状态
func Status(c *fiber.Ctx) error {
	// 从请求头中获取认证token
	authHeader := c.Get("Authorization")

	if authHeader == "" {
		return c.Status(fiber.StatusOK).JSON(StatusResponse{
			Status:  fiber.StatusOK,
			Message: "未登录",
			IsAuth:  false,
		})
	}

	// 提取token
	tokenString := ""
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	} else {
		tokenString = authHeader // 兼容直接传入token的情况
	}

	// 验证token
	userID, username, role, err := utils.ValidateToken(tokenString)
	if err != nil {
		return c.Status(fiber.StatusOK).JSON(StatusResponse{
			Status:  fiber.StatusOK,
			Message: "无效的token或会话已过期",
			IsAuth:  false,
		})
	}

	// 返回用户信息
	return c.Status(fiber.StatusOK).JSON(StatusResponse{
		Status:  fiber.StatusOK,
		Message: "已登录",
		IsAuth:  true,
		User: &User{
			ID:       userID,
			Username: username,
			Role:     role,
		},
	})
}

// LogoutResponse 退出登录响应结构
type LogoutResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
}

// Logout 处理用户退出登录
func Logout(c *fiber.Ctx) error {
	// 从请求头中获取认证token
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusBadRequest).JSON(LogoutResponse{
			Status:  fiber.StatusBadRequest,
			Message: "未提供认证token",
		})
	}

	// 提取token
	tokenString := ""
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	} else {
		tokenString = authHeader
	}

	// 验证token
	userID, _, _, err := utils.ValidateToken(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(LogoutResponse{
			Status:  fiber.StatusUnauthorized,
			Message: "无效的token或会话已过期",
		})
	}

	// 查找用户并清除token
	var user dbModel.User
	if err := db.PG.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(LogoutResponse{
			Status:  fiber.StatusInternalServerError,
			Message: "用户不存在",
		})
	}

	// 清除用户token
	user.Token = ""
	if err := db.PG.Save(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(LogoutResponse{
			Status:  fiber.StatusInternalServerError,
			Message: "退出登录失败",
		})
	}

	return c.Status(fiber.StatusOK).JSON(LogoutResponse{
		Status:  fiber.StatusOK,
		Message: "退出登录成功",
	})
}
