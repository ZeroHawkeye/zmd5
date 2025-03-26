import { useState } from 'react'
import { encrypt } from '../api/md5'

const EncryptSection = () => {
  const [inputText, setInputText] = useState('')
  const [md5Results, setMd5Results] = useState({
    hash32: '',
    hash32Upper: '',
    hash16: '',
    hash16Upper: '',
    hash128: '',
    original: ''
  })
  const [loading, setLoading] = useState(false)
  const [copyStatus, setCopyStatus] = useState({
    hash32: false,
    hash32Upper: false,
    hash16: false,
    hash16Upper: false,
    hash128: false
  })
  const [hasCalculated, setHasCalculated] = useState(false)

  // MD5加密处理
  const handleEncrypt = async () => {
    if (!inputText) return
    
    setLoading(true)
    setHasCalculated(true)
    setMd5Results({
      hash32: '计算中...',
      hash32Upper: '计算中...',
      hash16: '计算中...',
      hash16Upper: '计算中...',
      hash128: '计算中...',
      original: inputText
    })
    
    try {
      const result = await encrypt(inputText)
      if (result.success && result.data) {
        setMd5Results({
          hash32: result.data.hash32,
          hash32Upper: result.data.hash32Upper,
          hash16: result.data.hash16,
          hash16Upper: result.data.hash16Upper,
          hash128: result.data.hash128,
          original: result.data.original
        })
      } else {
        setMd5Results({
          hash32: '计算失败',
          hash32Upper: '计算失败',
          hash16: '计算失败',
          hash16Upper: '计算失败',
          hash128: '计算失败',
          original: inputText
        })
      }
    } catch (error) {
      console.error('MD5加密错误:', error)
      setMd5Results({
        hash32: '计算失败',
        hash32Upper: '计算失败',
        hash16: '计算失败',
        hash16Upper: '计算失败',
        hash128: '计算失败',
        original: inputText
      })
    } finally {
      setLoading(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: keyof typeof copyStatus) => {
    if (!text || text === '计算中...' || text === '计算失败') return
    
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
    <div className="card encrypt-section">
      <h2>MD5加密</h2>
      <div className="input-group">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="输入要加密的文本"
          className="hacker-input"
          onKeyDown={(e) => e.key === 'Enter' && handleEncrypt()}
        />
        <button 
          onClick={handleEncrypt} 
          className="hacker-button"
          disabled={loading}
        >
          {loading ? '加密中...' : '加密'}
        </button>
      </div>
      
      {hasCalculated && (
        <div className="result-container">
          <div className="result-box">
            <div className="result-header">
              <div className="result-label">32位小写:</div>
              <button 
                className={`copy-button ${copyStatus.hash32 ? 'copied' : ''}`}
                onClick={() => copyToClipboard(md5Results.hash32, 'hash32')}
                disabled={!md5Results.hash32 || md5Results.hash32 === '计算中...' || md5Results.hash32 === '计算失败'}
              >
                {copyStatus.hash32 ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{md5Results.hash32}</div>
          </div>
          
          <div className="result-box">
            <div className="result-header">
              <div className="result-label">32位大写:</div>
              <button 
                className={`copy-button ${copyStatus.hash32Upper ? 'copied' : ''}`}
                onClick={() => copyToClipboard(md5Results.hash32Upper, 'hash32Upper')}
                disabled={!md5Results.hash32Upper || md5Results.hash32Upper === '计算中...' || md5Results.hash32Upper === '计算失败'}
              >
                {copyStatus.hash32Upper ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{md5Results.hash32Upper}</div>
          </div>
          
          <div className="result-box">
            <div className="result-header">
              <div className="result-label">16位小写:</div>
              <button 
                className={`copy-button ${copyStatus.hash16 ? 'copied' : ''}`}
                onClick={() => copyToClipboard(md5Results.hash16, 'hash16')}
                disabled={!md5Results.hash16 || md5Results.hash16 === '计算中...' || md5Results.hash16 === '计算失败'}
              >
                {copyStatus.hash16 ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{md5Results.hash16}</div>
          </div>
          
          <div className="result-box">
            <div className="result-header">
              <div className="result-label">16位大写:</div>
              <button 
                className={`copy-button ${copyStatus.hash16Upper ? 'copied' : ''}`}
                onClick={() => copyToClipboard(md5Results.hash16Upper, 'hash16Upper')}
                disabled={!md5Results.hash16Upper || md5Results.hash16Upper === '计算中...' || md5Results.hash16Upper === '计算失败'}
              >
                {copyStatus.hash16Upper ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{md5Results.hash16Upper}</div>
          </div>

          <div className="result-box">
            <div className="result-header">
              <div className="result-label">128位二进制:</div>
              <button 
                className={`copy-button ${copyStatus.hash128 ? 'copied' : ''}`}
                onClick={() => copyToClipboard(md5Results.hash128, 'hash128')}
                disabled={!md5Results.hash128 || md5Results.hash128 === '计算中...' || md5Results.hash128 === '计算失败'}
              >
                {copyStatus.hash128 ? '已复制!' : '复制'}
              </button>
            </div>
            <div className="result-value">{md5Results.hash128}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EncryptSection 