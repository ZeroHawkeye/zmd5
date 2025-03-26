// 解密历史记录类型定义
export interface DecryptRecord {
  id: number
  hash: string
  result: string
  date: string
  decryptStatus?: number
  taskId?: number
  progress?: number // 解密进度百分比
}

// 用户类型定义
export interface User {
  id?: number
  username: string
  role?: string
  avatar?: string
  created_at?: number
  token?: string
}

// API 响应类型
export interface ApiResponse<T> {
  status?: number | string
  message?: string
  isAuth?: boolean
  user?: T | null
  code?: number
  success?: boolean
  msg?: string
  data?: T | null
  token?: string
  // MD5生成特有的字段
  added?: number
  skipped?: number
  // 分页信息
  total?: number
}

// 登录请求类型
export interface LoginRequest {
  username: string
  password: string
}

// 注册请求类型
export interface RegisterRequest {
  username: string
  password: string
}

// MD5彩虹表条目类型
export interface RainbowTableEntry {
  id: number
  hash: string
  hash_type: 'MD5_32' | 'MD5_16'  // 哈希类型：32位或16位
  plaintext: string
  created_at: number
  // 以下是与后端对应的扩展字段
  chain_length?: number         // 哈希链长度
  start_plaintext?: string      // 起始明文
  end_hash?: string             // 结束哈希
  reduction_function?: number   // 使用的规约函数编号
  charset_type?: number         // 字符集类型
  min_length?: number           // 最小长度
  max_length?: number           // 最大长度
  charset_range?: string        // 字符集范围
}

// 彩虹表统计信息
export interface RainbowTableStats {
  total_chains: number
  total_charsets: number
  coverage_estimate: number
  average_chain_length: number
}

// MD5库统计信息
export interface MD5Stats {
  total_entries: number
  recent_additions: number
  success_rate: number
}

// 管理员仪表盘统计数据
export interface AdminDashboardStats {
  total_users: number
  active_users: number
  md5_records: number
  today_records: number
  system_status: string
  database_info: string
  last_refreshed: string
  rainbow_stats?: RainbowTableStats // 彩虹表统计信息
}

// 解密结果类型定义
export interface DecryptResult {
  original: string
  hash32: string
  hash32Upper: string
  hash16: string
  hash16Upper: string
  hash128: string
}

// 历史记录类型定义
export interface HistoryRecord {
  id: number
  userId: number
  type: 'encrypt' | 'decrypt'
  input: string
  output: string
  createdAt: string
  // 解密状态（0:未开始, 1:进行中, 2:解密成功, 3:解密失败）
  decryptStatus?: number
}

// 解密状态枚举
export enum DecryptStatus {
  NOT_STARTED = 0,
  IN_PROGRESS = 1,
  SUCCESS = 2,
  FAILED = 3
}

// 解密任务状态响应
export interface TaskStatusResponse {
  success: boolean
  status: 'not_started' | 'in_progress' | 'success' | 'failed' | 'unknown'
  message: string
  plaintext?: string
  hash?: string
  progress?: number
  tables_searched?: number   // 已搜索的彩虹表数量
  total_tables?: number      // 总彩虹表数量
  chains_searched?: number   // 已搜索的链数量
  reduction_attempts?: number // 规约函数应用次数
}

export interface HistoryResponse {
  total: number
  page: number
  pageSize: number
  records: HistoryRecord[]
} 