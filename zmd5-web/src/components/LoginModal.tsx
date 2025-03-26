import { useState, useEffect } from 'react'
import './LoginModal.css'

interface LoginModalProps {
  onClose: () => void
  onLogin: (username: string, password: string) => void
  onRegister?: (username: string, password: string) => void
  loading?: boolean
  error?: string | null
  onClearError?: () => void
}

const LoginModal = ({ 
  onClose, 
  onLogin, 
  onRegister,
  loading = false, 
  error = null, 
  onClearError 
}: LoginModalProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)

  // 当输入变化时清除错误
  useEffect(() => {
    if (error && onClearError) {
      onClearError();
    }
  }, [username, password]);

  const handleSubmit = () => {
    if (username && password) {
      if (isRegisterMode && onRegister) {
        onRegister(username, password)
      } else {
        onLogin(username, password)
      }
    }
  }

  return (
    <div className="modal-overlay">
      <div className="login-modal card">
        <div className="modal-header">
          <h3>{isRegisterMode ? '注册' : '登录'}</h3>
          <button 
            className="close-button" 
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>
        
        <div className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-group">
            <label>用户名</label>
            <input 
              type="text" 
              className="hacker-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入代号"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input 
              type="password" 
              className="hacker-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="输入访问密码"
              disabled={loading}
            />
          </div>
          <button 
            className={`hacker-button login-submit ${loading ? 'loading' : ''}`} 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '正在处理...' : (isRegisterMode ? '注册账号' : '进入系统')}
          </button>
        </div>
        
        <div className="login-footer">
          <p>
            {isRegisterMode ? '已有账号？' : '没有账号？'}
            <button 
              className="switch-mode-button"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              disabled={loading}
            >
              {isRegisterMode ? '立即登录' : '立即注册'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginModal 