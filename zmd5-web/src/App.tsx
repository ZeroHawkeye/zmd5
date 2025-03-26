import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { checkAuthStatus, login, logout, register } from './api/auth'
import { getHistory } from './api/md5'
import './App.css'
import Footer from './components/Footer'
import Header from './components/Header'
import LoginModal from './components/LoginModal'
import MainSection from './components/MainSection'
import MatrixBackground from './components/MatrixBackground'
import ProfileSection from './components/ProfileSection'
import { DecryptRecord, User } from './types/index'

function App() {
  // 登录状态管理
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false) // 加载状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null) // 错误消息

  // 解密历史记录
  const [decryptHistory, setDecryptHistory] = useState<DecryptRecord[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // 获取当前路由位置
  const location = useLocation();
  // 导航函数
  const navigate = useNavigate();

  // 检查当前是否在个人中心页面
  const isProfilePage = location.pathname === '/profile';

  // 检查用户登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const result = await checkAuthStatus();
      if (result.status === 200 && result.isAuth && result.user) {
        setIsLoggedIn(true);
        setCurrentUser(result.user);
        // 获取历史记录
        fetchHistory(1);
      } else if (isProfilePage) {
        // 如果未登录但访问的是profile页面，重定向到首页
        navigate('/', { replace: true });
      }
    };

    checkAuth();
  }, [isProfilePage, navigate]);

  // 获取解密历史记录
  const fetchHistory = async (page: number) => {
    setIsLoading(true)
    try {
      const result = await getHistory(page, 10)
      if (result.code === 200 && result.data) {
        const history: DecryptRecord[] = result.data.records.map(record => {
          const isDecrypt = record.type === 'decrypt'
          // 解密状态
          let decryptStatus = undefined

          // 检查是否是解密记录并根据状态设置对应的状态码
          if (isDecrypt) {
            // 如果是解密记录且有decryptStatus字段，使用该字段值
            if (record.hasOwnProperty('decryptStatus')) {
              decryptStatus = record.decryptStatus
            }
          }

          return {
            id: record.id,
            hash: isDecrypt ? record.input : record.output,
            result: isDecrypt ? record.output : record.input,
            date: record.createdAt,
            decryptStatus,
            taskId: record.id  // 添加taskId字段，用于查询任务状态
          }
        })
        setDecryptHistory(history)
        setTotalPages(result.data.total)
      }
    } catch (error) {
      console.error('获取历史记录失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理登录
  const handleLogin = async (username: string, password: string) => {
    if (!username || !password) {
      setErrorMessage('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await login({ username, password });

      if (result.code === 200 && result.user) {
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setCurrentUser(result.user);
        fetchHistory(1);
      } else {
        setErrorMessage(result.message || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('登录错误:', error);
      setErrorMessage('网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 处理注册
  const handleRegister = async (username: string, password: string) => {
    if (!username || !password) {
      setErrorMessage('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await register({ username, password });
      if (result.success && result.data) {
        // 注册成功，自动登录
        setIsLoggedIn(true);
        setCurrentUser(result.data);
        setShowLoginModal(false);
        fetchHistory(1);
        // 添加页面刷新
        window.location.reload();
      } else {
        setErrorMessage(result.message || '注册失败，请稍后重试');
      }
    } catch (error) {
      console.error('注册错误:', error);
      setErrorMessage('网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 处理登出
  const handleLogout = async () => {
    setLoading(true);

    try {
      await logout();
      setIsLoggedIn(false);
      setCurrentUser(null);
      navigate('/'); // 退出后返回首页
      setDecryptHistory([]);
    } catch (error) {
      console.error('登出错误:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理解密成功
  const handleDecryptSuccess = (record: DecryptRecord) => {
    setDecryptHistory(prev => [record, ...prev]);
  };

  // 更新解密记录
  const updateDecryptRecord = (updatedRecord: DecryptRecord) => {
    setDecryptHistory(prev =>
      prev.map(record =>
        record.id === updatedRecord.id ? updatedRecord : record
      )
    );
  };

  // 清除错误消息
  const clearError = () => {
    setErrorMessage(null);
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchHistory(page)
  }

  // 处理切换到个人中心
  const handleProfileClick = () => {
    navigate('/profile');
  }

  // 处理返回首页
  const handleReturnHome = () => {
    navigate('/');
  }

  return (
    <div className="app-container">
      <MatrixBackground />

      <div className="content">
        <Header
          isLoggedIn={isLoggedIn}
          currentUser={currentUser}
          onLoginClick={() => setShowLoginModal(true)}
          onProfileClick={handleProfileClick}
        />

        {/* 基于路由路径显示主界面或个人中心 */}
        {isProfilePage ? (
          <ProfileSection
            currentUser={currentUser}
            decryptHistory={decryptHistory}
            onLogout={handleLogout}
            onPageChange={handlePageChange}
            currentPage={currentPage}
            totalPages={totalPages}
            updateRecord={updateDecryptRecord}
            onReturnHome={handleReturnHome}
          />
        ) : (
          <MainSection
            isLoggedIn={isLoggedIn}
            onDecryptSuccess={handleDecryptSuccess}
          />
        )}

        <Footer />
      </div>

      {/* 登录弹窗 */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
          onRegister={handleRegister}
          loading={loading}
          error={errorMessage}
          onClearError={clearError}
        />
      )}

      {/* Toaster组件 */}
      <Toaster position="top-right" richColors />
    </div>
  )
}

export default App
