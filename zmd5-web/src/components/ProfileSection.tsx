import { User, DecryptRecord, DecryptStatus } from '../types/index'
import { FaUserSecret, FaLock, FaUnlock, FaSync, FaSpinner, FaCheck, FaTimesCircle, FaSearch, FaInfoCircle, FaHome, FaRandom, FaProjectDiagram, FaRedoAlt, FaStop, FaExclamationTriangle } from 'react-icons/fa'
import { useEffect, useState, useRef } from 'react'
import { getTaskStatus, searchRainbowTable, finishTask } from '../api/rainbow'
import { toast } from 'sonner'
import '../styles/ProfileSection.css'

interface ProfileSectionProps {
  currentUser: User | null
  decryptHistory: DecryptRecord[]
  onLogout: () => void
  onPageChange: (page: number) => void
  currentPage: number
  totalPages: number
  updateRecord: (updatedRecord: DecryptRecord) => void
  onReturnHome: () => void
}

// Popconfirm组件参数类型
interface PopconfirmProps {
  title: string;
  message: string;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// 自定义Popconfirm组件
const Popconfirm = ({ title, message, visible, onConfirm, onCancel }: PopconfirmProps) => {
  // 用于焦点管理
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  
  // 当弹窗显示时，给确认按钮设置焦点并添加键盘监听
  useEffect(() => {
    if (visible) {
      // 设置焦点
      confirmButtonRef.current?.focus();
      
      // 键盘事件处理
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter') {
          onConfirm();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, onConfirm, onCancel]);
  
  if (!visible) return null;
  
  return (
    <div className="popconfirm" onClick={onCancel}>
      <div 
        className="popconfirm-content" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popconfirm-title"
      >
        <div className="popconfirm-header">
          <FaExclamationTriangle className="warning-icon" />
          <h3 id="popconfirm-title">{title}</h3>
        </div>
        <div className="popconfirm-body">
          <p>{message}</p>
        </div>
        <div className="popconfirm-actions">
          <button className="hacker-button cancel-button" onClick={onCancel}>
            取消
          </button>
          <button 
            className="hacker-button confirm-button" 
            onClick={onConfirm}
            ref={confirmButtonRef}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileSection = ({
  currentUser,
  decryptHistory,
  onLogout,
  onPageChange,
  currentPage,
  totalPages,
  updateRecord,
  onReturnHome
}: ProfileSectionProps) => {
  // 存储解密进度查询的ID集合
  const [pollingTasks, setPollingTasks] = useState<{ [key: number]: NodeJS.Timeout }>({})
  // 存储正在处理中的解密任务
  const [pendingTasks, setPendingTasks] = useState<{ [key: number]: boolean }>({})

  // 添加彩虹表破解MD5相关状态
  const [md5Input, setMd5Input] = useState('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState('')

  // 添加任务详情状态
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  const [taskDetails, setTaskDetails] = useState<{
    status: string,
    plaintext?: string,
    message?: string,
    progress?: number,
    tables_searched?: number,
    total_tables?: number,
    chains_searched?: number,
    reduction_attempts?: number
  } | null>(null)
  const [isLoadingTaskDetails, setIsLoadingTaskDetails] = useState(false)
  
  // 添加Popconfirm相关状态
  const [popconfirmVisible, setPopconfirmVisible] = useState(false);
  const [taskIdToFinish, setTaskIdToFinish] = useState<number | null>(null);

  // 新增：获取规约尝试次数的格式化文本
  const getReductionAttemptsText = (attempts?: number) => {
    if (!attempts) return '0 次';

    if (attempts > 10000) {
      return `${(attempts / 10000).toFixed(2)} 万次`;
    } else if (attempts > 1000) {
      return `${(attempts / 1000).toFixed(2)} 千次`;
    }

    return `${attempts} 次`;
  }

  const getOperationType = (record: DecryptRecord) => {
    // 通过比较hash和result的长度来判断操作类型
    return record.hash.length === 32 ? '解密操作' : '加密操作'
  }

  const getOperationIcon = (record: DecryptRecord) => {
    return record.hash.length === 32 ?
      <FaUnlock className="history-icon" /> :
      <FaLock className="history-icon" />
  }

  // 获取解密状态显示
  const getDecryptStatusDisplay = (record: DecryptRecord) => {
    if (!record.decryptStatus || record.hash.length !== 32) {
      return null
    }

    switch (record.decryptStatus) {
      case DecryptStatus.NOT_STARTED:
        return (
          <div className="decrypt-status not-started">
            <FaSync /> <span>未开始</span>
          </div>
        )
      case DecryptStatus.IN_PROGRESS:
        // 显示进度条，默认进度为0
        const progress = record.progress || 0
        return (
          <div className="decrypt-status in-progress">
            <div className="progress-container">
              <FaSpinner className="spinning" /> <span>解密中... {progress}%</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
        )
      case DecryptStatus.SUCCESS:
        return (
          <div className="decrypt-status success">
            <FaCheck /> <span>解密成功</span>
          </div>
        )
      case DecryptStatus.FAILED:
        return (
          <div className="decrypt-status failed">
            <FaTimesCircle /> <span>解密失败</span>
          </div>
        )
      default:
        return null
    }
  }

  // 处理MD5破解提交
  const handleDecryptSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证输入
    if (!md5Input) {
      setDecryptError('请输入需要破解的MD5哈希值')
      return
    }

    // 验证MD5格式 (32位十六进制字符)
    const md5Regex = /^[a-fA-F0-9]{32}$/
    if (!md5Regex.test(md5Input)) {
      setDecryptError('请输入有效的32位MD5哈希值')
      return
    }

    setIsDecrypting(true)
    setDecryptError('')

    try {
      // 使用API函数发送解密请求
      const result = await searchRainbowTable(md5Input)

      if (result.success) {
        if (result.data?.plaintext) {
          // 立即找到明文，使用toast替代alert
          toast.success(`已找到明文: ${result.data.plaintext}`)
          // 刷新历史记录
          onPageChange(1)
        } else if (result.data?.task_id) {
          // 需要异步处理，任务已创建，使用toast替代alert
          toast.info('解密任务已创建，请稍后查看历史记录获取结果')
          // 刷新历史记录
          onPageChange(1)
        }
      } else {
        setDecryptError(result.message || '解密请求失败')
      }
    } catch (error) {
      console.error('解密请求错误:', error)
      setDecryptError('网络错误，请稍后再试')
    } finally {
      setIsDecrypting(false)
      setMd5Input('')
    }
  }

  // 处理查询任务状态
  const handleCheckTaskStatus = async (taskId: number) => {
    try {
      // 设置加载状态
      setIsLoadingTaskDetails(true)

      // 展开或折叠任务详情
      if (expandedTaskId === taskId) {
        setExpandedTaskId(null)
        setTaskDetails(null)
        setIsLoadingTaskDetails(false)
        return
      }

      setExpandedTaskId(taskId)

      // 调用API查询任务状态
      const response = await getTaskStatus(taskId)

      if (response.success && response.data) {
        const { status, plaintext, message, progress, reduction_attempts } = response.data

        // 设置任务详情
        setTaskDetails({
          status,
          plaintext,
          message,
          progress,
          reduction_attempts
        })

        // 找到对应的记录
        const updatedRecord = decryptHistory.find(r => r.id === taskId || r.taskId === taskId)

        if (updatedRecord) {
          // 根据状态更新记录
          if (status === 'success') {
            // 更新记录
            updateRecord({
              ...updatedRecord,
              result: plaintext || updatedRecord.result,
              decryptStatus: DecryptStatus.SUCCESS,
              progress: 100
            })
          } else if (status === 'failed') {
            // 更新记录状态
            updateRecord({
              ...updatedRecord,
              decryptStatus: DecryptStatus.FAILED,
              progress: 100
            })
          } else if (status === 'in_progress') {
            // 更新记录状态和进度
            updateRecord({
              ...updatedRecord,
              decryptStatus: DecryptStatus.IN_PROGRESS,
              progress: progress || 0
            })
          } else {
            // 更新记录状态
            updateRecord({
              ...updatedRecord,
              progress: progress || 0
            })
          }
        }
      } else {
        setTaskDetails({
          status: 'error',
          message: '查询任务状态失败'
        })
      }
    } catch (error) {
      console.error('查询任务状态错误:', error)
      setTaskDetails({
        status: 'error',
        message: '网络错误，请稍后再试'
      })
    } finally {
      setIsLoadingTaskDetails(false)
    }
  }

  // 添加刷新任务状态功能
  const handleRefreshTaskStatus = async (taskId: number) => {
    try {
      setIsLoadingTaskDetails(true)

      // 调用API查询任务状态
      const response = await getTaskStatus(taskId)

      if (response.success && response.data) {
        const { status, plaintext, message, progress, reduction_attempts, tables_searched, total_tables, chains_searched } = response.data

        // 设置任务详情
        setTaskDetails({
          status,
          plaintext,
          message,
          progress,
          reduction_attempts,
          tables_searched,
          total_tables,
          chains_searched
        })

        // 找到对应的记录
        const updatedRecord = decryptHistory.find(r => r.id === taskId || r.taskId === taskId)

        if (updatedRecord) {
          // 根据状态更新记录
          if (status === 'success') {
            // 更新记录
            updateRecord({
              ...updatedRecord,
              result: plaintext || updatedRecord.result,
              decryptStatus: DecryptStatus.SUCCESS,
              progress: 100
            })
          } else if (status === 'failed') {
            // 更新记录状态
            updateRecord({
              ...updatedRecord,
              decryptStatus: DecryptStatus.FAILED,
              progress: 100
            })
          } else if (status === 'in_progress') {
            // 更新记录状态和进度
            updateRecord({
              ...updatedRecord,
              decryptStatus: DecryptStatus.IN_PROGRESS,
              progress: progress || 0
            })
          } else {
            // 更新记录状态
            updateRecord({
              ...updatedRecord,
              progress: progress || 0
            })
          }
        }
      } else {
        setTaskDetails({
          status: 'error',
          message: '刷新任务状态失败'
        })
      }
    } catch (error) {
      console.error('刷新任务状态错误:', error)
      setTaskDetails({
        status: 'error',
        message: '网络错误，请稍后再试'
      })
    } finally {
      setIsLoadingTaskDetails(false)
    }
  }

  // 处理结束任务功能
  const handleFinishTask = async (taskId: number) => {
    // 显示确认对话框
    setTaskIdToFinish(taskId);
    setPopconfirmVisible(true);
  };
  
  // 确认结束任务
  const confirmFinishTask = async () => {
    // 隐藏确认对话框
    setPopconfirmVisible(false);
    
    if (taskIdToFinish === null) return;
    
    try {
      setIsLoadingTaskDetails(true);
      
      // 调用结束任务接口
      const response = await finishTask(taskIdToFinish);
      
      if (response.success) {
        toast.success('任务已成功结束');
        
        // 刷新任务状态
        await handleRefreshTaskStatus(taskIdToFinish);
        
        // 更新对应的记录
        const updatedRecord = decryptHistory.find(r => r.id === taskIdToFinish || r.taskId === taskIdToFinish);
        if (updatedRecord) {
          updateRecord({
            ...updatedRecord,
            decryptStatus: DecryptStatus.FAILED,
            progress: 100
          });
        }
      } else {
        toast.error(response.message || '结束任务失败');
      }
    } catch (error) {
      console.error('结束任务错误:', error);
      toast.error('网络错误，请稍后再试');
    } finally {
      setIsLoadingTaskDetails(false);
      setTaskIdToFinish(null);
    }
  };
  
  // 取消结束任务
  const cancelFinishTask = () => {
    setPopconfirmVisible(false);
    setTaskIdToFinish(null);
  };

  return (
    <div className="profile-section-container">
      {/* 添加Popconfirm组件 */}
      <Popconfirm
        title="结束任务确认"
        message="确定要结束此任务吗？一旦结束，任务将无法继续进行。"
        visible={popconfirmVisible}
        onConfirm={confirmFinishTask}
        onCancel={cancelFinishTask}
      />
      
      <div className="profile-section">
        <div className="profile-header">
          <div className="profile-title-actions">
            <button className="hacker-button return-button ml-3" onClick={onReturnHome}>
              <FaHome /> 返回首页
            </button>
            <h2>个人中心</h2>
          </div>
          <button className="hacker-button logout-button" onClick={onLogout}>
            退出登录
          </button>
        </div>

        <div className="card user-profile">
          <div className="profile-info">
            <div className="large-avatar">
              <FaUserSecret className="default-avatar" />
            </div>
            <div className="profile-details">
              <h3>{currentUser?.username}</h3>
              <p>操作次数: {decryptHistory.length}</p>
            </div>
          </div>
        </div>

        {/* 添加彩虹表破解MD5功能 */}
        <div className="card decrypt-form">
          <h3>彩虹表破解</h3>
          <p className="decrypt-description">
            通过彩虹表技术尝试破解MD5哈希值还原为原始明文
          </p>

          <form onSubmit={handleDecryptSubmit} className="rainbow-decrypt-form">
            <div className="input-group">
              <input
                type="text"
                value={md5Input}
                onChange={(e) => setMd5Input(e.target.value)}
                placeholder="输入32位MD5哈希值..."
                className="decrypt-input"
                disabled={isDecrypting}
              />
              <button
                type="submit"
                className="hacker-button decrypt-button"
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  <>
                    <FaSpinner className="spinning" /> 处理中...
                  </>
                ) : (
                  <>
                    <FaSearch /> 破解
                  </>
                )}
              </button>
            </div>

            {decryptError && (
              <div className="error-message">
                {decryptError}
              </div>
            )}

            <p className="decrypt-note">
              注: 破解过程可能需要一些时间，结果将显示在历史记录中
            </p>
          </form>
        </div>

        <div className="card decrypt-history" style={{ maxHeight: '900px' }}>
          <h3>操作历史记录</h3>
          {decryptHistory.length > 0 ? (
            <>
              <div className="history-list" style={{ maxHeight: '700px', overflowY: 'auto' }}>
                {decryptHistory.map((record, index) => (
                  <div
                    key={record.id}
                    className={`history-item ${index === 0 ? 'latest-item' : ''}`}
                    style={{
                      animationDelay: `${index * 0.05}s`
                    }}
                  >
                    <div className="history-header">
                      <div className="history-type">
                        {getOperationIcon(record)}
                        <span>{getOperationType(record)}</span>
                        {index === 0 && <span className="new-tag">新</span>}
                      </div>
                      <div className="history-time">
                        <span>{record.date}</span>
                      </div>
                    </div>

                    <div className="history-content">
                      <div className="history-main-data">
                        <div className="history-hash">
                          <span className="label">{record.hash.length === 32 ? '哈希值:' : '原文:'}</span>
                          <div className="value-container">
                            <span className="value hash-value">{record.hash}</span>
                            <button
                              className="copy-button"
                              onClick={() => {
                                navigator.clipboard.writeText(record.hash);
                                toast.success('已复制到剪贴板');
                              }}
                              title="复制到剪贴板"
                            >
                              <FaCheck className="copy-icon" />
                            </button>
                          </div>
                        </div>
                        <div className="history-result">
                          <span className="label">{record.hash.length === 32 ? '结果:' : '哈希值:'}</span>
                          <div className="value-container">
                            <span className="value result-value">{record.result || '解密中...'}</span>
                            {record.result && (
                              <button
                                className="copy-button"
                                onClick={() => {
                                  navigator.clipboard.writeText(record.result || '');
                                  toast.success('已复制到剪贴板');
                                }}
                                title="复制到剪贴板"
                              >
                                <FaCheck className="copy-icon" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {getDecryptStatusDisplay(record)}

                      {/* 添加查询任务状态按钮 */}
                      {!record.hash && (
                        <div className="task-actions">
                          <button
                            className={`hacker-button small-button ${expandedTaskId === (record.taskId || record.id) ? 'active' : ''}`}
                            onClick={() => handleCheckTaskStatus(record.taskId || record.id)}
                          >
                            {expandedTaskId === (record.taskId || record.id) ? (
                              <><FaInfoCircle /> 隐藏详情</>
                            ) : (
                              <><FaInfoCircle /> 任务详情</>
                            )}
                          </button>

                          {/* 展开的任务详情 */}
                          {expandedTaskId === (record.taskId || record.id) && (
                            <div className="task-details">
                              {isLoadingTaskDetails ? (
                                <div className="loading-details">
                                  <FaSpinner className="spinning" /> 加载详情中...
                                </div>
                              ) : (
                                taskDetails && (
                                  <div className="task-details-content">
                                    <div className="details-header">
                                      <h4>任务详情</h4>
                                      <div className="details-buttons">
                                        <button
                                          className="refresh-button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleRefreshTaskStatus(record.taskId || record.id);
                                          }}
                                          title="刷新任务状态"
                                        >
                                          <FaRedoAlt className={isLoadingTaskDetails ? "spinning" : ""} />
                                          <span>{isLoadingTaskDetails ? "刷新中" : "刷新"}</span>
                                        </button>
                                        
                                        {/* 添加结束任务按钮，仅显示在进行中的任务 */}
                                        {taskDetails.status === 'in_progress' && (
                                          <button
                                            className="stop-button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleFinishTask(record.taskId || record.id);
                                            }}
                                            title="结束任务"
                                            disabled={isLoadingTaskDetails}
                                          >
                                            <FaStop className="stop-icon" />
                                            <span>结束任务</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="details-grid">
                                      <div className="detail-item">
                                        <span className="detail-label">
                                          <FaInfoCircle className="detail-icon" /> 状态:
                                        </span>
                                        <span className={`detail-value status-${taskDetails.status}`}>
                                          {taskDetails.status === 'success' && '成功'}
                                          {taskDetails.status === 'failed' && '失败'}
                                          {taskDetails.status === 'in_progress' && '进行中'}
                                          {taskDetails.status === 'error' && '错误'}
                                          {!['success', 'failed', 'in_progress', 'error'].includes(taskDetails.status) && taskDetails.status}
                                        </span>
                                      </div>

                                      {taskDetails.progress !== undefined && (
                                        <div className="detail-item progress-item">
                                          <span className="detail-label">
                                            <FaSpinner className="detail-icon" /> 进度:
                                          </span>
                                          <span className="detail-value highlight-value">
                                            {taskDetails.progress}%
                                          </span>
                                          <div className="progress-bar detail-progress">
                                            <div
                                              className="progress-fill"
                                              style={{
                                                width: `${taskDetails.progress}%`,
                                                background: `linear-gradient(90deg, var(--primary-neon) ${taskDetails.progress}%, var(--primary-dark) ${taskDetails.progress}%)`
                                              }}
                                            ></div>
                                          </div>
                                        </div>
                                      )}

                                      {taskDetails.plaintext && (
                                        <div className="detail-item plaintext-item">
                                          <span className="detail-label">
                                            <FaUnlock className="detail-icon" /> 明文:
                                          </span>
                                          <div className="plaintext-container">
                                            <span className="detail-value highlight-value">
                                              {taskDetails.plaintext}
                                            </span>
                                            <button
                                              className="copy-button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(taskDetails.plaintext || '');
                                                toast.success('明文已复制到剪贴板');
                                              }}
                                              title="复制明文"
                                            >
                                              <FaCheck className="copy-icon" />
                                            </button>
                                          </div>
                                          <div className="detail-explanation">
                                            <FaInfoCircle className="info-icon" />
                                            <span className="explanation-text">成功解密的原始明文内容</span>
                                          </div>
                                        </div>
                                      )}

                                      <div className="details-section">
                                        {taskDetails.tables_searched !== undefined && taskDetails.total_tables !== undefined && (
                                          <div className="detail-item">
                                            <span className="detail-label">
                                              <FaSearch className="detail-icon" /> 彩虹表:
                                            </span>
                                            <span className="detail-value highlight-value">
                                              已搜索 {taskDetails.tables_searched} / 共 {taskDetails.total_tables} 张表
                                            </span>
                                            <div className="detail-explanation">
                                              <FaInfoCircle className="info-icon" />
                                              <span className="explanation-text">已经搜索的彩虹表数量和总彩虹表数量</span>
                                            </div>
                                          </div>
                                        )}

                                        {taskDetails.chains_searched !== undefined && (
                                          <div className="detail-item">
                                            <span className="detail-label">
                                              <FaProjectDiagram className="detail-icon" /> 哈希链:
                                            </span>
                                            <span className="detail-value highlight-value">
                                              已搜索 {taskDetails.chains_searched} 条链
                                            </span>
                                            <div className="detail-explanation">
                                              <FaInfoCircle className="info-icon" />
                                              <span className="explanation-text">已搜索的彩虹表哈希链数量，每条链包含多个哈希值</span>
                                            </div>
                                          </div>
                                        )}

                                        {taskDetails.reduction_attempts !== undefined && (
                                          <div className="detail-item">
                                            <span className="detail-label">
                                              <FaRandom className="detail-icon" /> 规约尝试:
                                            </span>
                                            <span className="detail-value highlight-value">
                                              {getReductionAttemptsText(taskDetails.reduction_attempts)}
                                            </span>
                                            <div className="detail-explanation">
                                              <FaInfoCircle className="info-icon" />
                                              <span className="explanation-text">规约函数尝试次数表示系统在彩虹表攻击过程中计算哈希链的次数</span>
                                            </div>
                                          </div>
                                        )}

                                        {taskDetails.message && (
                                          <div className="detail-item">
                                            <span className="detail-label">
                                              <FaInfoCircle className="detail-icon" /> 消息:
                                            </span>
                                            <span className="detail-value">{taskDetails.message}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* 添加彩虹表攻击原理说明 */}
                                      <div className="rainbow-attack-info">
                                        <h5>彩虹表攻击原理</h5>
                                        <p>
                                          彩虹表是一种时间-空间权衡的密码学攻击方式，用于破解哈希值。
                                          系统通过预先计算的哈希链
                                          和规约函数（<strong>尝试次数: {getReductionAttemptsText(taskDetails.reduction_attempts)}</strong>）
                                          来尝试还原MD5哈希对应的原始明文。
                                        </p>
                                        <div className="attack-steps">
                                          <div className="step"><span className="step-num">1</span> 搜索彩虹表</div>
                                          <div className="step-arrow">→</div>
                                          <div className="step"><span className="step-num">2</span> 查找匹配链</div>
                                          <div className="step-arrow">→</div>
                                          <div className="step"><span className="step-num">3</span> 应用规约函数</div>
                                          <div className="step-arrow">→</div>
                                          <div className="step"><span className="step-num">4</span> 重建哈希链</div>
                                          <div className="step-arrow">→</div>
                                          <div className="step"><span className="step-num">5</span> 获取明文</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-history">
              <p>暂无操作记录</p>
            </div>
          )}
        </div>

        {/* 将分页移到卡片外部 */}
        {decryptHistory.length > 0 && totalPages > 0 && (
          <div className="pagination-wrapper">
            <div className="pagination">
              <button
                className="hacker-button"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <span className="page-info">
                第 {currentPage} 页 / 共 {Math.ceil(totalPages / 10)} 页
              </span>
              <button
                className="hacker-button"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalPages / 10)}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileSection 