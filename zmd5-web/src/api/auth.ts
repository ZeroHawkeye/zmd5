import { ApiResponse, LoginRequest, RegisterRequest, User } from '../types/index';

// API基础URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 模拟数据 - 生产环境中移除
const MOCK_AUTH = {
  enabled: false, // 设置为false关闭模拟，使用真实API
  users: [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'user', password: 'user123', role: 'user' }
  ],
  currentUser: null as User | null
};

/**
 * 获取认证头信息
 * @returns 包含认证Token的头信息
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return {
    'Content-Type': 'application/json',
  };
};

/**
 * 设置认证Token
 * @param token 认证Token
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

/**
 * 清除认证Token
 */
export const clearAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

/**
 * 用户登录
 * @param credentials 登录凭据
 * @returns 登录结果和用户信息
 */
export async function login(credentials: LoginRequest): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
      credentials: 'include', // 包含 cookies，用于 session 认证
    });

    const data = await response.json();
    
    // 如果登录成功并返回了token，保存token到localStorage
    if (data.code === 200 && data.token) {
      setAuthToken(data.token);
    }
    
    // 直接返回后端的响应格式
    return data;
  } catch (error) {
    console.error('登录错误:', error);
    return {
      status: 500,
      message: '网络错误，请稍后再试',
      isAuth: false,
      user: null,
    };
  }
}

/**
 * 用户注册
 * @param credentials 注册信息
 * @returns 注册结果和用户信息
 */
export async function register(credentials: RegisterRequest): Promise<ApiResponse<User>> {
  try {
    // 使用模拟数据
    if (MOCK_AUTH.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 检查用户名是否已存在
      if (MOCK_AUTH.users.some(u => u.username === credentials.username)) {
        return {
          success: false,
          message: '用户名已存在（模拟数据）',
          data: null
        };
      }
      
      // 添加新用户
      MOCK_AUTH.users.push({
        username: credentials.username,
        password: credentials.password,
        role: 'user' // 默认为普通用户
      });
      
      // 创建用户对象
      const userData: User = {
        username: credentials.username,
        avatar: '👨‍💻', // 默认头像
        role: 'user',
        created_at: Date.now()
      };
      
      return {
        success: true,
        message: '注册成功（模拟数据）',
        data: userData
      };
    }
    
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || '注册请求失败',
        data: null,
      };
    }
    
    // 保存token
    if (data && data.token) {
      setAuthToken(data.token);
    }
    
    // 处理后端返回数据，将其转换为前端期望的格式
    if (data && data.user) {
      const userData: User = {
        username: data.user.username,
        avatar: '👨‍💻', // 默认头像
        role: data.user.role,
        created_at: Date.now()
      };
      
      return {
        success: true,
        message: data.message || '注册成功',
        data: userData,
      };
    }

    return {
      success: false,
      message: data.Message || '注册失败，未获取到用户信息',
      data: null
    };
  } catch (error) {
    console.error('注册错误:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
}

/**
 * 检查当前登录状态
 * @returns 用户信息，如果已登录
 */
export async function checkAuthStatus(): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`${API_URL}/api/auth/status`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include', // 包含 cookies，用于 session 认证
    });

    const data = await response.json();
    
    // 直接返回后端的响应格式
    return data;
  } catch (error) {
    console.error('检查登录状态错误:', error);
    return {
      status: 500,
      message: '网络错误，请稍后再试',
      isAuth: false,
      user: null,
    };
  }
}

/**
 * 用户登出
 * @returns 操作结果
 */
export async function logout(): Promise<ApiResponse<null>> {
  try {
    // 使用模拟数据
    if (MOCK_AUTH.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 清除当前用户
      MOCK_AUTH.currentUser = null;
      
      // 清除token
      clearAuthToken();
      
      return {
        success: true,
        message: '已登出（模拟数据）',
        data: null
      };
    }
    
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include', // 包含 cookies，用于 session 认证
    });

    // 无论服务器响应如何，清除本地认证信息
    clearAuthToken();
    
    if (!response.ok) {
      return {
        success: true,  // 即使服务器端失败，客户端也算注销成功
        message: '已登出',
        data: null,
      };
    }

    const data: ApiResponse<any> = await response.json();
    
    return {
      success: true,
      message: data.message || '已登出',
      data: null,
    };
  } catch (error) {
    console.error('登出错误:', error);
    
    // 即使网络错误，也清除本地认证信息
    clearAuthToken();
    
    return {
      success: true,  // 即使发生错误，客户端也算注销成功
      message: '已登出',
      data: null,
    };
  }
} 