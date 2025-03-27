import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import App from '../App';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import RainbowTable from '../components/admin/RainbowTable';
import GenerateMD5 from '../components/admin/GenerateMD5';
import MD5Management from '../components/admin/MD5Management';
import TaskManagement from '../pages/admin/TaskManagement';
import { User } from '../types/index';

// 错误边界组件
const ErrorBoundary = () => {
  return (
    <div className="error-container">
      <h1>出错了！</h1>
      <p>抱歉，页面加载时发生了一些问题。</p>
      <button onClick={() => window.location.href = '/'}>返回首页</button>
    </div>
  );
};

// 管理员路由保护组件
const AdminRoute = ({ 
  children,
  currentUser
}: { 
  children: React.ReactNode;
  currentUser: User | null;
}) => {
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// 创建路由配置
const createAppRouter = (currentUser: User | null) => {
  return createBrowserRouter([
    {
      path: '/',
      element: <App />,
      errorElement: <ErrorBoundary />,
      children: [
        {
          path: '',
          index: true,
        },
        {
          path: 'profile',
          element: <Outlet />,
        },
      ]
    },
    {
      path: '/admin',
      element: (
        <AdminRoute currentUser={currentUser}>
          <AdminLayout />
        </AdminRoute>
      ),
      errorElement: <ErrorBoundary />,
      children: [
        {
          path: '',
          element: <AdminDashboard />,
        },
        {
          path: 'rainbow-table',
          element: <RainbowTable />,
        },
        {
          path: 'generate-md5',
          element: <GenerateMD5 />,
        },
        // 后台md5管理
        {
          path: 'md5-management',
          element: <MD5Management />,
        },
        // 任务管理
        {
          path: 'task-management',
          element: <TaskManagement />,
        },
      ],
    },
  ]);
};

export default createAppRouter; 