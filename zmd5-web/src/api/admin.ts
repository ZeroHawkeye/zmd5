import { ApiResponse, RainbowTableEntry, MD5Stats, AdminDashboardStats } from '../types/index';
import { getAuthHeaders } from './auth';
import { getRainbowTableStats } from './rainbow';

// API基础URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// 模拟数据 - 生产环境中移除
const MOCK_DATA = {
  enabled: false, // 设置为false关闭模拟
  md5Entries: [
    { id: 1, hash: 'e10adc3949ba59abbe56e057f20f883e', hash_type: 'MD5_32', plaintext: '123456', created_at: 1710488651 },
    { id: 2, hash: '25d55ad283aa400af464c76d713c07ad', hash_type: 'MD5_32', plaintext: '12345678', created_at: 1710491732 },
    { id: 3, hash: '5f4dcc3b5aa765d61d8327deb882cf99', hash_type: 'MD5_32', plaintext: 'password', created_at: 1710595501 },
    { id: 4, hash: '827ccb0eea8a706c4c34a16891f84e7b', hash_type: 'MD5_32', plaintext: '12345', created_at: 1710657019 },
    { id: 5, hash: 'd8578edf8458ce06fbc5bb76a58c5ca4', hash_type: 'MD5_32', plaintext: 'qwerty', created_at: 1710775845 },
    { id: 6, hash: 'e10adc3949ba59ab', hash_type: 'MD5_16', plaintext: '123456_16', created_at: 1710775900 },
  ],
  stats: {
    total_users: 427,
    active_users: 156,
    md5_records: 5362,
    today_records: 42,
    system_status: "正常",
    database_info: "PostgreSQL 17.2 (模拟数据)",
    last_refreshed: new Date().toISOString().replace('T', ' ').substring(0, 19)
  }
};

/**
 * 获取管理员仪表盘统计数据
 */
export const getAdminStats = async (): Promise<ApiResponse<AdminDashboardStats>> => {
  try {
    // 使用模拟数据
    if (MOCK_DATA.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return {
        success: true,
        message: '获取统计数据成功（模拟数据）',
        data: MOCK_DATA.stats
      };
    }
    
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能查看仪表盘统计数据',
        data: null,
      };
    }
    
    // 获取管理员统计数据
    const response = await fetch(`${API_URL}/api/admin/stats`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '获取管理员统计数据失败',
        data: null,
      };
    }

    const result = await response.json();
    
    // 获取彩虹表统计信息
    const rainbowStatsResult = await getRainbowTableStats();
    
    // 合并统计数据
    const combinedStats = {
      ...(result.data || {}),
      rainbow_stats: rainbowStatsResult.success ? rainbowStatsResult.data : undefined
    };

    return {
      success: result.status === 'success',
      message: result.status === 'success' ? '获取统计数据成功' : '获取统计数据失败',
      data: combinedStats
    };
  } catch (error) {
    console.error('获取管理员统计数据出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 获取彩虹表列表
 */
export const getRainbowTableEntries = async (page = 1, limit = 20): Promise<ApiResponse<RainbowTableEntry[]>> => {
  try {
    // 使用模拟数据
    if (MOCK_DATA.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 模拟分页
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedData = MOCK_DATA.md5Entries.slice(start, end);
      
      return {
        success: true,
        message: '获取彩虹表数据成功（模拟数据）',
        data: paginatedData as any
      };
    }
    
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能查看彩虹表数据',
        data: null,
      };
    }
    
    const response = await fetch(
      `${API_URL}/api/admin/rainbow/management?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: authHeaders,
      }
    );

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '获取彩虹表数据失败',
        data: null,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('获取彩虹表数据出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 添加新的彩虹表条目
 */
export const addRainbowTableEntry = async (
  hash: string,
  hash_type: 'MD5_32' | 'MD5_16',
  plaintext: string,
  chain_length: number = 1000,
  start_plaintext: string = '',
  end_hash: string = '',
  reduction_function: number = 0,
  charset_type: number = 1,
  min_length: number = 3,
  max_length: number = 8,
  charset_range: string = ''
): Promise<ApiResponse<RainbowTableEntry>> => {
  try {
    // 使用模拟数据
    if (MOCK_DATA.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 创建新条目
      const newId = MOCK_DATA.md5Entries.length + 1;
      const now = Math.floor(Date.now() / 1000); // 使用Unix时间戳(秒)
      
      const newEntry: RainbowTableEntry = {
        id: newId,
        hash,
        hash_type,
        plaintext,
        created_at: now,
        chain_length,
        start_plaintext,
        end_hash,
        reduction_function,
        charset_type,
        min_length,
        max_length,
        charset_range
      };
      
      // 添加到模拟数据
      MOCK_DATA.md5Entries.unshift(newEntry);
      
      return {
        success: true,
        message: '添加彩虹表条目成功（模拟数据）',
        data: newEntry
      };
    }
    
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能添加彩虹表条目',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/admin/rainbow/entry`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        hash, 
        hash_type, 
        plaintext,
        chain_length,
        start_plaintext,
        end_hash,
        reduction_function,
        charset_type,
        min_length,
        max_length,
        charset_range
      }),
    });

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '添加彩虹表条目失败',
        data: null,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('添加彩虹表条目出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 删除彩虹表条目
 */
export const deleteRainbowTableEntry = async (id: number): Promise<ApiResponse<null>> => {
  try {
    // 使用模拟数据
    if (MOCK_DATA.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 从模拟数据中删除
      const index = MOCK_DATA.md5Entries.findIndex(entry => entry.id === id);
      if (index !== -1) {
        MOCK_DATA.md5Entries.splice(index, 1);
      }
      
      return {
        success: true,
        message: '删除彩虹表条目成功（模拟数据）',
        data: null
      };
    }
    
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能删除彩虹表条目',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/admin/rainbow/entry/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '删除彩虹表条目失败',
        data: null,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('删除彩虹表条目出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 生成新的MD5哈希
 */
export const generateMD5 = async (texts: string[]): Promise<ApiResponse<RainbowTableEntry[]>> => {
  try {
    // 使用模拟数据
    if (MOCK_DATA.enabled) {
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 创建新条目
      const newEntries: RainbowTableEntry[] = texts.map((text, index) => {
        const newId = MOCK_DATA.md5Entries.length + index + 1;
        const now = Math.floor(Date.now() / 1000); // 使用Unix时间戳(秒)
        
        return {
          id: newId,
          hash: 'e10adc3949ba59abbe56e057f20f883e', // 模拟MD5值
          hash_type: 'MD5_32',
          plaintext: text,
          created_at: now
        };
      });
      
      // 添加到模拟数据
      MOCK_DATA.md5Entries.unshift(...newEntries);
      
      return {
        success: true,
        message: '生成MD5成功（模拟数据）',
        data: newEntries
      };
    }
    
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能生成MD5',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/admin/md5/encrypt`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plaintexts: texts }),
    });

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '生成MD5失败',
        data: null,
      };
    }

    const result = await response.json();
    
    // 检查返回数据格式
    if (!result) {
      return {
        success: false,
        message: '服务器返回数据格式错误',
        data: null,
      };
    }
    
    // 如果服务器处理成功但没有数据，创建一个空数组
    const responseData = result.data || [];
    
    // 检查added和skipped字段
    const added = typeof result.added !== 'undefined' ? result.added : 0;
    const skipped = typeof result.skipped !== 'undefined' ? result.skipped : 0;
    
    // 转换后端返回的数据格式为前端需要的格式
    return {
      success: true,
      message: result.message || '生成MD5成功',
      data: Array.isArray(responseData) ? responseData.map((item: any) => ({
        id: item.ID || Date.now() + Math.random(), // 使用ID或生成临时ID
        hash: item.md5 || '',
        hash_type: 'MD5_32',
        plaintext: item.plaintext || '',
        created_at: Math.floor(Date.now() / 1000)
      })) : [],
      added,
      skipped
    };
  } catch (error) {
    console.error('生成MD5出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 获取所有MD5记录
 */
export const getAllMD5Records = async (
  page: number,
  pageSize: number,
  search: string = '',
  type: 'all' | 'plaintext' | 'md5' = 'all'
): Promise<ApiResponse<any>> => {
  try {
    const authHeaders = getAuthHeaders();
    const response = await fetch(`${API_URL}/api/admin/md5/management?page=${page}&page_size=${pageSize}&search=${search}&type=${type}`, {
      headers: authHeaders
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取MD5记录失败:', error);
    return {
      success: false,
      message: '获取MD5记录失败'
    };
  }
};

/**
 * 删除MD5记录
 */
export const deleteMD5Record = async (id: number): Promise<ApiResponse<null>> => {
  try {
    const response = await fetch(`${API_URL}/api/admin/md5/records/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('删除MD5记录失败:', error);
    return {
      success: false,
      message: '删除MD5记录失败'
    };
  }
};

// 上传文件生成MD5
export const uploadFile = async (formData: FormData): Promise<ApiResponse<any>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能上传文件',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/admin/md5/upload`, {
      method: 'POST',
      headers: {
        'Authorization': authHeaders['Authorization']
      },
      body: formData,
    });

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      // 获取错误详情
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        message: errorData?.error || '上传文件失败',
        data: null,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('上传文件出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 获取任务管理列表
 */
export const getTaskManagement = async (
  page: number = 1,
  pageSize: number = 10,
  status: number = 0
): Promise<ApiResponse<{
  total: number;
  tasks: Array<{
    id: number;
    user_id: number;
    hash: string;
    plain_text: string;
    type: number;
    status: number;
    decrypt_status: number;
    progress: number;
    created_at: string;
    updated_at: string;
    tables_searched: number;
    total_tables: number;
    chains_searched: number;
    reduction_attempts: number;
  }>;
}>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能查看任务列表',
        data: null,
      };
    }
    
    const response = await fetch(
      `${API_URL}/api/admin/task/management?page=${page}&page_size=${pageSize}&status=${status}`,
      {
        method: 'GET',
        headers: authHeaders,
      }
    );

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '获取任务列表失败',
        data: null,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('获取任务列表出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 取消任务
 */
export const cancelTask = async (taskId: number): Promise<ApiResponse<null>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能取消任务',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/admin/task/cancel/${taskId}`, {
      method: 'POST',
      headers: authHeaders,
    });

    if (!response.ok) {
      // 特殊处理401错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '取消任务失败',
        data: null,
      };
    }

    return await response.json();
  } catch (error) {
    console.error('取消任务出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};
