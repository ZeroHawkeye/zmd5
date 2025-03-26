import { User } from '../types/index'

interface HeaderProps {
  isLoggedIn: boolean
  currentUser: User | null
  onLoginClick: () => void
  onProfileClick: () => void
}

const Header = ({ isLoggedIn, currentUser, onLoginClick, onProfileClick }: HeaderProps) => {
  // 处理管理后台跳转
  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = '/admin';
  };

  return (
    <header className="header">
      <div className="glitch-container">
        <h1 className="glitch" data-text="ZMD5">ZMD5</h1>
        <p className="subtitle">高级MD5加密与解密工具</p>
      </div>
      
      <div className="user-area">
        {isLoggedIn && currentUser ? (
          <div className="user-controls">
            <div className="user-info" onClick={onProfileClick}>
              <span className="user-name">{currentUser.username}</span>
            </div>
            
            {/* 管理员入口 */}
            {currentUser.role === 'admin' && (
              <a href="/admin" className="admin-link" onClick={handleAdminClick}>
                管理后台
              </a>
            )}
          </div>
        ) : (
          <button 
            className="login-button hacker-button" 
            onClick={onLoginClick}
          >
            登录
          </button>
        )}
      </div>
    </header>
  )
}

export default Header 