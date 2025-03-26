// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T | null;
  status?: number;
  code?: number;
  msg?: string;
  // MD5生成特有的字段
  added?: number;
  skipped?: number;
} 