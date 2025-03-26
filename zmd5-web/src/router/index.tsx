import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../components/admin/AdminDashboard';
import RainbowTable from '../components/admin/RainbowTable';
import GenerateMD5 from '../components/admin/GenerateMD5';
import MD5Management from '../components/admin/MD5Management';
import { User } from '../types/index';

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
      children: [
        {
          path: '',
          index: true,
        },
        {
          path: 'profile',
          element: <App />,
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
      ],
    },
  ]);
};

export default createAppRouter; 