import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User } from '../../types/index';
import { checkAuthStatus } from '../../api/auth';
import { FiHome, FiDatabase, FiHash, FiList, FiArrowLeft, FiUser, FiActivity } from 'react-icons/fi';

const AdminLayout = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      const result = await checkAuthStatus();

      if (result.status === 200 && result.isAuth && result.user) {
        if (result.user.role !== 'admin') {
          // 非管理员用户，重定向到首页
          navigate('/', { replace: true });
          return;
        }
        setCurrentUser(result.user);
      } else {
        // 未登录，重定向到首页
        navigate('/', { replace: true });
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-matrix">
          <div className="matrix-char">Z</div>
          <div className="matrix-char">M</div>
          <div className="matrix-char">D</div>
          <div className="matrix-char">5</div>
        </div>
        <div className="loading-text">加载中...</div>
      </div>
    );
  }

  // 确定当前活动的导航项
  const isActive = (path: string) => {
    return location.pathname === path ||
      (path !== '/admin' && location.pathname.startsWith(path));
  };

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">
            <span className="admin-title-prefix">ZMD5</span>
            <span className="admin-title-text">管理控制台</span>
          </h1>
          <div className="admin-user-info">
            <FiUser className="admin-user-icon" />
            <span className="admin-username">{currentUser?.username}</span>
            <span className="admin-badge">管理员</span>
          </div>
        </div>
      </header>

      <div className="admin-container">
        <nav className="admin-sidebar">
          <ul className="admin-nav">
            <li className={isActive('/admin') ? 'active' : ''}>
              <Link to="/admin">
                <FiHome className="nav-icon" />
                <span className="nav-text">仪表盘</span>
              </Link>
            </li>
            <li className={isActive('/admin/rainbow-table') ? 'active' : ''}>
              <Link to="/admin/rainbow-table">
                <FiDatabase className="nav-icon" />
                <span className="nav-text">彩虹表管理</span>
              </Link>
            </li>
            <li className={isActive('/admin/generate-md5') ? 'active' : ''}>
              <Link to="/admin/generate-md5">
                <FiHash className="nav-icon" />
                <span className="nav-text">生成MD5</span>
              </Link>
            </li>
            <li className={isActive('/admin/md5-management') ? 'active' : ''}>
              <Link to="/admin/md5-management">
                <FiList className="nav-icon" />
                <span className="nav-text">MD5管理</span>
              </Link>
            </li>
            <li className={isActive('/admin/task-management') ? 'active' : ''}>
              <Link to="/admin/task-management">
                <FiActivity className="nav-icon" />
                <span className="nav-text">任务管理</span>
              </Link>
            </li>
            <li className="return-link">
              <Link to="/">
                <FiArrowLeft className="nav-icon" />
                <span className="nav-text">返回前台</span>
              </Link>
            </li>
          </ul>
        </nav>

        <main className="admin-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 