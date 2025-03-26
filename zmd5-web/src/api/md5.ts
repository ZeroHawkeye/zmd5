import { ApiResponse, HistoryResponse } from '../types/index'
import { getAuthHeaders } from './auth'

// API基础URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// MD5加密结果类型
export interface EncryptResult {
  original: string
  hash32: string
  hash32Upper: string
  hash16: string
  hash16Upper: string
  hash8: string
  hash8Upper: string
  hash128: string
  success: boolean
}

// MD5解密结果类型
export interface DecryptResult {
  original: string
  hash32: string
  hash32Upper: string
  hash16: string
  hash16Upper: string
  hash128: string
}

// 加密API接口
export const encrypt = async (text: string): Promise<ApiResponse<EncryptResult>> => {
  try {
    const response = await fetch(`${API_URL}/api/md5/encrypt`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text })
    })

    return await response.json()
  } catch (error) {
    console.error('MD5加密请求错误:', error)
    return {
      code: 500,
      msg: error as string,
      data: undefined
    }
  }
}

// 解密API接口
export const decrypt = async (hash: string): Promise<ApiResponse<DecryptResult>> => {
  try {
    const response = await fetch(`${API_URL}/api/md5/decrypt`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: hash })
    })

    return await response.json()
  } catch (error) {
    console.error('MD5解密请求错误:', error)
    return {
      code: 500,
      msg: '网络错误，请稍后再试',
      data: undefined
    }
  }
}

// 获取历史记录
export const getHistory = async (page: number, pageSize: number): Promise<ApiResponse<HistoryResponse>> => {
  try {
    const response = await fetch(`${API_URL}/api/user/md5/history?page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
      headers: getAuthHeaders()
    })

    return await response.json()
  } catch (error) {
    console.error('获取历史记录错误:', error)
    return {
      code: 500,
      msg: '网络错误，请稍后再试',
      data: undefined
    }
  }
}

// 本地MD5计算（备用方案，需要安装md5库）
export const calculateMD5Locally = (text: string): EncryptResult => {
  // 注意：这里需要安装md5库，但根据要求我们不自动安装
  // 如果要使用，请安装: npm install md5 @types/md5

  // 模拟计算，实际使用时应替换为真实计算
  const mockHash32 = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)).join('')
  const mockHash16 = mockHash32.substring(8, 24)
  const mockHash8 = mockHash32.substring(0, 8)
  const mockHash128 = Array.from({ length: 128 }, () =>
    Math.floor(Math.random() * 2)).join('')

  return {
    original: text,
    hash32: mockHash32,
    hash32Upper: mockHash32.toUpperCase(),
    hash16: mockHash16,
    hash16Upper: mockHash16.toUpperCase(),
    hash8: mockHash8,
    hash8Upper: mockHash8.toUpperCase(),
    hash128: mockHash128,
    success: true
  }
} 