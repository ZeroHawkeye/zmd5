import { useState } from 'react'
import { decrypt } from '../api/md5'
import { searchRainbowTable } from '../api/rainbow'
import { DecryptRecord, DecryptStatus } from '../types/index'
import { toast } from 'sonner'
import { FaDatabase, FaSpinner } from 'react-icons/fa'

interface DecryptSectionProps {
  isLoggedIn: boolean
  onDecryptSuccess?: (record: DecryptRecord) => void
}

const DecryptSection = ({ isLoggedIn, onDecryptSuccess }: DecryptSectionProps) => {
  const [decryptText, setDecryptText] = useState('')
  const [decryptResults, setDecryptResults] = useState({
    original: '',
    hash32: '',
    hash32Upper: '',
    hash16: '',
    hash16Upper: '',
    hash128: ''
  })
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [hasResults, setHasResults] = useState(false)
  const [isRainbowDecrypting, setIsRainbowDecrypting] = useState(false)
  const [decryptFailed, setDecryptFailed] = useState(false)
  const [showRainbowButton, setShowRainbowButton] = useState(false)
  const [copyStatus, setCopyStatus] = useState({
    original: false,
    hash32: false,
    hash32Upper: false,
    hash16: false,
    hash16Upper: false,
    hash128: false
  })

  // 处理MD5解密
  const handleDecrypt = async () => {
    if (!decryptText) return

    setIsDecrypting(true)
    setHasResults(true)
    setDecryptFailed(false)
    setShowRainbowButton(true)
    setDecryptResults({
      original: '解密中...',
      hash32: '解密中...',
      hash32Upper: '解密中...',
      hash16: '解密中...',
      hash16Upper: '解密中...',
      hash128: '解密中...'
    })

    try {
      const result = await decrypt(decryptText)

      if (result.success && result.data) {
        setDecryptResults({
          original: result.data.original,
          hash32: result.data.hash32,
          hash32Upper: result.data.hash32Upper,
          hash16: result.data.hash16,
          hash16Upper: result.data.hash16Upper,
          hash128: result.data.hash128
        })

        // 如果登录状态，添加到历史记录
        if (isLoggedIn && onDecryptSuccess) {
          const newRecord: DecryptRecord = {
            id: Date.now(),
            hash: decryptText,
            result: result.data.original,
            date: new Date().toLocaleString()
          }
          onDecryptSuccess(newRecord)
        }
      } else {
        setDecryptResults({
          original: result.message || '解密失败，请稍后再试',
          hash32: '解密失败',
          hash32Upper: '解密失败',
          hash16: '解密失败',
          hash16Upper: '解密失败',
          hash128: '解密失败'
        })
        // 标记解密失败，可以使用彩虹表破解
        setDecryptFailed(true)
      }
    } catch (error) {
      console.error('解密错误:', error)
      setDecryptResults({
        original: '网络错误，请稍后再试',
        hash32: '解密失败',
        hash32Upper: '解密失败',
        hash16: '解密失败',
        hash16Upper: '解密失败',
        hash128: '解密失败'
      })
      // 标记解密失败，可以使用彩虹表破解
      setDecryptFailed(true)
    } finally {
      setIsDecrypting(false)
    }
  }

  // 处理彩虹表深度破解
  const handleRainbowDecrypt = async () => {
    if (!decryptText || !isLoggedIn) return

    setIsRainbowDecrypting(true)

    try {
      // 验证MD5格式 (32位十六进制字符)
      const md5Regex = /^[a-fA-F0-9]{32}$/
      if (!md5Regex.test(decryptText)) {
        toast.error('请输入有效的32位MD5哈希值')
        setIsRainbowDecrypting(false)
        return
      }

      const result = await searchRainbowTable(decryptText)

      if (result.success) {
        if (result.data?.plaintext) {
          // 立即找到明文
          toast.success(`已找到明文: ${result.data.plaintext}`)
          setDecryptResults({
            ...decryptResults,
            original: result.data.plaintext
          })
          
          // 添加到历史记录
          if (onDecryptSuccess) {
            const newRecord: DecryptRecord = {
              id: Date.now(),
              hash: decryptText,
              result: result.data.plaintext,
              date: new Date().toLocaleString(),
              decryptStatus: DecryptStatus.SUCCESS
            }
            onDecryptSuccess(newRecord)
          }
        } else if (result.data?.task_id) {
          // 需要异步处理，任务已创建
          toast.info('深度破解任务已创建，请稍后在个人资料页查看结果')
          
          // 添加到历史记录
          if (onDecryptSuccess) {
            const newRecord: DecryptRecord = {
              id: Date.now(),
              hash: decryptText,
              result: "后台破解中...",
              date: new Date().toLocaleString(),
              decryptStatus: DecryptStatus.IN_PROGRESS,
              taskId: result.data.task_id,
              progress: 0
            }
            onDecryptSuccess(newRecord)
          }
        }
      } else {
        toast.error(result.message || '深度破解请求失败')
      }
    } catch (error) {
      console.error('彩虹表破解错误:', error)
      toast.error('网络错误，请稍后再试')
    } finally {
      setIsRainbowDecrypting(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: keyof typeof copyStatus) => {
    if (!text || text === '解密中...' || text.includes('解密失败') || text.includes('网络错误')) return

    try {
      await navigator.clipboard.writeText(text)

      // 设置复制状态
      setCopyStatus(prev => ({ ...prev, [type]: true }))

      // 3秒后重置复制状态
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [type]: false }))
      }, 3000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <div className="card decrypt-section">
      <h2>MD5解密</h2>
      <div className="input-group">
        <input
          type="text"
          value={decryptText}
          onChange={(e) => setDecryptText(e.target.value)}
          placeholder="输入MD5哈希值（32位）"
          className="hacker-input"
          onKeyDown={(e) => e.key === 'Enter' && handleDecrypt()}
        />
        <button
          onClick={handleDecrypt}
          className={`hacker-button ${isDecrypting ? 'decrypting' : ''}`}
          disabled={isDecrypting}
        >
          {isDecrypting ? '解密中...' : '解密'}
        </button>
      </div>

      {/* 彩虹表高级破解按钮 - 只在有输入且点击解密后显示 */}
      {showRainbowButton && (
        <div className="rainbow-decrypt-section">
          {isLoggedIn ? (
            <button 
              className="rainbow-decrypt-button"
              onClick={handleRainbowDecrypt}
              disabled={isRainbowDecrypting || !decryptText}
            >
              {isRainbowDecrypting ? (
                <>
                  <FaSpinner className="spinning-icon" /> 深度破解中...
                </>
              ) : (
                <>
                  <FaDatabase /> 后台破解
                </>
              )}
            </button>
          ) : (
            <div className="login-required-message">
              <p>登录后可使用后台破解功能</p>
            </div>
          )}
        </div>
      )}

      {hasResults && (
        <div className="result-container" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gridTemplateRows: 'auto auto',
          gridTemplateAreas: 
            "'original hashThirtyTwo' 'hashSixteen hashOneTwentyEight'",
          gap: '20px',
          width: '100%' 
        }}>
          <div className="result-box" style={{ gridArea: 'original' }}>
            <div className="result-header">
              <div className="result-label">原文:</div>
              <button
                className={`copy-button ${copyStatus.original ? 'copied' : ''}`}
                onClick={() => copyToClipboard(decryptResults.original, 'original')}
                disabled={!decryptResults.original || decryptResults.original === '解密中...' || decryptResults.original.includes('解密失败') || decryptResults.original.includes('网络错误')}
              >
                {copyStatus.original ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">
              {isDecrypting ? (
                <div className="decrypt-animation">
                  <div className="scanning-line"></div>
                  <div className="decrypt-text">正在扫描数据库...</div>
                </div>
              ) : (
                decryptResults.original
              )}
            </div>
          </div>

          <div className="result-box" style={{ gridArea: 'hashThirtyTwo' }}>
            <div className="result-header">
              <div className="result-label">32位小写:</div>
              <button
                className={`copy-button ${copyStatus.hash32 ? 'copied' : ''}`}
                onClick={() => copyToClipboard(decryptResults.hash32, 'hash32')}
                disabled={!decryptResults.hash32 || decryptResults.hash32 === '解密中...' || decryptResults.hash32.includes('解密失败')}
              >
                {copyStatus.hash32 ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{decryptResults.hash32}</div>
          </div>

          <div className="result-box" style={{ gridArea: 'hashSixteen' }}>
            <div className="result-header">
              <div className="result-label">16位小写:</div>
              <button
                className={`copy-button ${copyStatus.hash16 ? 'copied' : ''}`}
                onClick={() => copyToClipboard(decryptResults.hash16, 'hash16')}
                disabled={!decryptResults.hash16 || decryptResults.hash16 === '解密中...' || decryptResults.hash16.includes('解密失败')}
              >
                {copyStatus.hash16 ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{decryptResults.hash16}</div>
          </div>

          <div className="result-box" style={{ gridArea: 'hashOneTwentyEight', width: '100%' }}>
            <div className="result-header">
              <div className="result-label">128位二进制:</div>
              <button
                className={`copy-button ${copyStatus.hash128 ? 'copied' : ''}`}
                onClick={() => copyToClipboard(decryptResults.hash128, 'hash128')}
                disabled={!decryptResults.hash128 || decryptResults.hash128 === '解密中...' || decryptResults.hash128.includes('解密失败')}
              >
                {copyStatus.hash128 ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{decryptResults.hash128}</div>
          </div>

          {!isLoggedIn && !decryptFailed && decryptResults.original && !decryptResults.original.includes('解密失败') && !decryptResults.original.includes('网络错误') && (
            <div className="login-prompt" style={{ gridColumn: '1 / span 2', textAlign: 'center' }}>
              <p>登录后可保存解密记录！</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DecryptSection 