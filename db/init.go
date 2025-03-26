package db

import (
	"fmt"
	"log"
	"os"
	"time"
	"zmd5/db/dbModel"
	"zmd5/utils"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var PG *gorm.DB

func InitDB() {
	dsn := "host=localhost user=zero password=012359Clown dbname=zmd5base port=5431 sslmode=disable TimeZone=Asia/Shanghai"

	// 创建自定义日志配置，禁用SQL查询日志
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
		logger.Config{
			SlowThreshold:             time.Second,  // 慢SQL阈值
			LogLevel:                  logger.Error, // 只记录错误
			IgnoreRecordNotFoundError: true,         // 忽略ErrRecordNotFound错误
			Colorful:                  false,        // 禁用彩色输出
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		panic("failed to connect database")
	}
	db.AutoMigrate(&dbModel.User{}, &dbModel.Md5{}, &dbModel.MD5Record{}, &dbModel.RainbowTable{}, &dbModel.TaskProgressRecord{})
	PG = db

	// 初始化管理员账户
	initAdmin()
}

// initAdmin 初始化管理员账户
func initAdmin() {
	var adminCount int64
	PG.Model(&dbModel.User{}).Where("role = ?", "admin").Count(&adminCount)

	// 如果不存在管理员，则创建默认管理员账户
	if adminCount == 0 {
		defaultPassword := "012359Clown"
		encryptedPassword, err := utils.EncryptPassword(defaultPassword)
		if err != nil {
			fmt.Println("管理员密码加密失败:", err)
			return
		}

		admin := dbModel.User{
			Username: "clown",
			Password: encryptedPassword,
			Role:     "admin",
		}

		result := PG.Create(&admin)
		if result.Error != nil {
			fmt.Println("创建管理员账户失败:", result.Error)
			return
		}

		fmt.Println("已创建默认管理员账户，用户名: clown，密码: 012359Clown")
	}
}
