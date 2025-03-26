import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import createAppRouter from "./router";
import "./index.css";
import { User } from "./types/index";
import { checkAuthStatus } from "./api/auth";

// 应用入口组件
const AppRoot = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 在挂载时检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await checkAuthStatus();
        if (result.status === 200 && result.isAuth && result.user) {
          setCurrentUser(result.user);
        }
      } catch (error) {
        console.error("检查登录状态失败:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">系统初始化中...</div>
      </div>
    );
  }

  // 创建路由
  const router = createAppRouter(currentUser);

  return <RouterProvider router={router} />;
};

ReactDOM.createRoot(document.getElementById("root")!).render(<AppRoot />);
