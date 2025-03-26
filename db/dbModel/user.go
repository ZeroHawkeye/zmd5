package dbModel

import "gorm.io/gorm"

type User struct {
	gorm.Model
	Username string `gorm:"unique"`
	Password string `json:"-"`
	Role     string `gorm:"default:user"`
	Token    string
}
