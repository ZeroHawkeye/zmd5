package dbModel

import "gorm.io/gorm"

type Md5 struct {
	gorm.Model
	// 明文
	Plaintext string `json:"plaintext"`
	// 32位md5
	MD5 string `json:"md5" gorm:"index"`
	// 16位md5
	MD5_16 string `json:"md5_16"`
}

// MD5Record 存储MD5加密记录
type MD5Record struct {
	gorm.Model
	PlainText string `json:"plain_text" gorm:"type:text"`
	UserID    uint   `json:"user_id" gorm:"index"`
	Hash      string `json:"hash" gorm:"type:varchar(32);index"`
	// Type 1: 加密, 2: 解密
	Type int `json:"type" gorm:"type:int;default:1"`
	// 操作状态（1:成功, 2:失败）
	Status int `json:"status" gorm:"type:int;default:1"`
	// 解密状态（0:未开始, 1:进行中, 2:解密成功, 3:解密失败）
	DecryptStatus int `json:"decrypt_status" gorm:"type:int;default:0"`
	// 解密进度百分比（0-100）
	Progress int `json:"progress" gorm:"type:int;default:0"`
}

// 解密状态常量
const (
	DecryptNotStarted = 0 // 未开始解密
	DecryptInProgress = 1 // 解密进行中
	DecryptSuccess    = 2 // 解密成功
	DecryptFailed     = 3 // 解密失败
)

// TaskProgressRecord 存储任务进度的详细信息
type TaskProgressRecord struct {
	gorm.Model
	TaskID            uint `json:"task_id" gorm:"index;unique"` // 关联的MD5Record任务ID
	TablesSearched    int  `json:"tables_searched"`             // 已搜索的彩虹表数量
	TotalTables       int  `json:"total_tables"`                // 总彩虹表数量
	ChainsSearched    int  `json:"chains_searched"`             // 已搜索的链数量
	ReductionAttempts int  `json:"reduction_attempts"`          // 规约函数应用次数
}

// RainbowTable 优化的彩虹表结构
type RainbowTable struct {
	gorm.Model
	// 哈希链长度
	ChainLength int `json:"chain_length" gorm:"type:int;default:1000"`
	// 起始明文
	StartPlaintext string `json:"start_plaintext" gorm:"type:text;not null"`
	// 结束哈希
	EndHash string `json:"end_hash" gorm:"type:varchar(32);index:idx_end_hash;not null"`
	// 使用的规约函数编号
	ReductionFunction int `json:"reduction_function" gorm:"type:int"`
	// 字符集类型 (例如: 1=纯数字, 2=小写字母, 3=大写字母, 4=混合)
	CharsetType int `json:"charset_type" gorm:"type:int;default:1"`
	// 最小长度
	MinLength int `json:"min_length" gorm:"type:int;default:3"`
	// 最大长度
	MaxLength int `json:"max_length" gorm:"type:int;default:8"`
	// 字符集范围 (例如: "0-9" 或 "a-z")
	CharsetRange string `json:"charset_range" gorm:"type:varchar(100)"`
}
