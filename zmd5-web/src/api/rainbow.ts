import { ApiResponse } from '../types';
import { getAuthHeaders } from '../api/auth';

// API基础URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * 生成彩虹表
 * @param count 生成链数量
 * @param chainLength 链长度
 * @param reductionFuncID 规约函数ID
 * @param charsetType 字符集类型
 * @param charsetRange 字符集范围
 * @param minLength 最小长度
 * @param maxLength 最大长度
 * @returns 
 */
export const generateRainbowTable = async (
  count: number = 10,
  chainLength: number = 1000,
  reductionFuncID: number = 0,
  charsetType: number = 1,
  charsetRange: string = '',
  minLength: number = 3,
  maxLength: number = 8
): Promise<ApiResponse<{generated: number, total_count: number}>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要管理员权限才能生成彩虹表',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/admin/rainbow/generate`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        count,
        chain_length: chainLength,
        reduction_func_id: reductionFuncID,
        charset_type: charsetType,
        charset_range: charsetRange,
        min_length: minLength,
        max_length: maxLength
      }),
    });

    if (!response.ok) {
      // 特殊处理401/403错误
      if (response.status === 401) {
        return {
          success: false,
          message: '没有管理员权限或登录已过期',
          data: null,
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          message: '只有管理员可以生成彩虹表',
          data: null,
        };
      }
      
      return {
        success: false,
        message: '生成彩虹表失败',
        data: null,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      message: result.message || '彩虹表生成完成',
      data: {
        generated: result.generated || 0,
        total_count: result.total_count || 0
      }
    };
  } catch (error) {
    console.error('生成彩虹表出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 获取彩虹表统计信息
 * @returns 彩虹表统计信息，包括总链数、字符集类型数、覆盖率估计和平均链长度
 */
export const getRainbowTableStats = async (): Promise<ApiResponse<{
  total_chains: number;
  total_charsets: number;
  coverage_estimate: number;
  average_chain_length: number;
}>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/rainbow/stats`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      return {
        success: false,
        message: '获取彩虹表统计信息失败',
        data: null,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      message: result.message || '获取彩虹表统计信息成功',
      data: {
        total_chains: result.total_chains || 0,
        total_charsets: result.total_charsets || 0,
        coverage_estimate: result.coverage_estimate || 0,
        average_chain_length: result.average_chain_length || 0
      }
    };
  } catch (error) {
    console.error('获取彩虹表统计信息出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
};

/**
 * 获取解密任务状态
 * @param taskId 任务ID
 * @returns 任务状态信息
 */
export const getTaskStatus = async (taskId: number): Promise<ApiResponse<any>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/rainbow/task/${taskId}`, {
      method: 'GET',
      headers: authHeaders
    });

    if (!response.ok) {
      return {
        success: false,
        message: '获取任务状态失败',
        data: null,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      message: result.message || '获取任务状态成功',
      data: {
        success: result.success,
        status: result.status,
        message: result.message,
        plaintext: result.plaintext,
        hash: result.hash,
        progress: result.progress,
        tables_searched: result.tables_searched,
        total_tables: result.total_tables,
        chains_searched: result.chains_searched,
        reduction_attempts: result.reduction_attempts
      }
    };
  } catch (error) {
    console.error('获取任务状态出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null
    };
  }
};

/**
 * 结束解密任务
 * @param taskId 任务ID
 * @returns 操作结果
 */
export const finishTask = async (taskId: number): Promise<ApiResponse<null>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    const response = await fetch(`${API_URL}/api/rainbow/task/${taskId}/finish`, {
      method: 'POST',
      headers: authHeaders
    });

    if (!response.ok) {
      // 错误处理
      let errorMessage = '结束任务失败';
      try {
        const result = await response.json();
        errorMessage = result.message || errorMessage;
      } catch (e) {
        // 如果无法解析响应JSON，使用默认错误消息
      }
      
      return {
        success: false,
        message: errorMessage,
        data: null,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      message: result.message || '任务已成功结束',
      data: null
    };
  } catch (error) {
    console.error('结束任务出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null
    };
  }
};

/**
 * 彩虹表搜索 - 尝试解密MD5哈希值
 * @param md5Hash 要解密的MD5哈希值
 * @returns 解密结果，包含明文或任务ID
 */
export const searchRainbowTable = async (md5Hash: string): Promise<ApiResponse<{
  plaintext?: string;
  task_id?: number;
}>> => {
  try {
    const authHeaders = getAuthHeaders();
    
    // 检查是否有认证令牌
    if (!authHeaders['Authorization']) {
      return {
        success: false,
        message: '需要登录才能使用彩虹表解密功能',
        data: null,
      };
    }
    
    const response = await fetch(`${API_URL}/api/rainbow/search`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        md5_hash: md5Hash
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      return {
        success: result.success,
        message: result.message || '解密请求失败',
        data: null,
      };
    }

    const result = await response.json();
    return {
      success: result.success,
      message: result.message || '解密请求已处理',
      data: {
        plaintext: result.plaintext,
        task_id: result.task_id
      }
    };
  } catch (error) {
    console.error('彩虹表搜索出错:', error);
    return {
      success: false,
      message: '网络错误，请稍后再试',
      data: null,
    };
  }
}; 