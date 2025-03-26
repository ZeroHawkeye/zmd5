import { useState } from 'react';
import { generateMD5, uploadFile } from '../../api/admin';
import { toast } from 'sonner';
import '../../styles/admin/GenerateMD5.css';

// 定义返回的MD5数据结构
interface MD5Record {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: null | string;
  plaintext: string;
  md5: string;
  md5_16: string;
}

// 定义API响应结构
interface MD5Response {
  success: boolean;
  message?: string;
  data?: any[];
  added?: number;
  skipped?: number;
}

const GenerateMD5 = () => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MD5Record[]>([]);
  const [operationStats, setOperationStats] = useState<{added: number, skipped: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 处理生成MD5
  const handleGenerateMD5 = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError('请输入要生成MD5的文本');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    setOperationStats(null);
    
    try {
      const textArray = text.split(/[,\s\n]+/).filter(item => item.trim());
      const result = await generateMD5(textArray) as MD5Response;
      
      if (result && result.success) {
        setSuccess(true);
        setSuccessMessage(result.message || '成功生成MD5');
        
        if (typeof result.added !== 'undefined' || typeof result.skipped !== 'undefined') {
          setOperationStats({
            added: result.added || 0,
            skipped: result.skipped || 0
          });
        }
        
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          try {
            const backendData = result.data.map((item: any) => {
              if (!item) return null;
              
              if (item.ID) {
                return item;
              } else {
                return {
                  ID: item.id || Date.now(),
                  CreatedAt: new Date().toISOString(),
                  UpdatedAt: new Date().toISOString(),
                  DeletedAt: null,
                  plaintext: item.plaintext || '',
                  md5: item.hash || item.md5 || '',
                  md5_16: item.hash_16 || item.md5_16 || (item.hash ? item.hash.substring(8, 24) : '') || (item.md5 ? item.md5.substring(8, 24) : '')
                };
              }
            }).filter(Boolean);
            
            if (backendData.length > 0) {
              setHistory(prev => [...backendData, ...prev]);
            }
          } catch (mapError) {
            console.error('处理返回数据时出错:', mapError);
          }
        }
        
        setText('');
      } else {
        setError((result && result.message) || '生成MD5失败');
      }
    } catch (err) {
      setError('生成MD5时发生错误');
      console.error('生成MD5出错:', err);
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('请选择要上传的文件');
      return;
    }
    
    setUploading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await uploadFile(formData);
      
      if (result && result.success) {
        setSuccess(true);
        setSuccessMessage(result.message || '文件上传成功，正在后台处理');
        setFile(null);
      } else {
        setError((result && result.message) || '文件上传失败');
      }
    } catch (err) {
      setError('文件上传时发生错误');
      console.error('文件上传出错:', err);
    } finally {
      setUploading(false);
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  // 处理拖放
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success('复制成功！');
      })
      .catch((err) => {
        console.error('复制失败:', err);
        toast.error('复制失败，请手动复制');
      });
  };

  return (
    <div className="generate-md5 space-y-6">
      <h2 className="text-2xl font-bold">生成MD5哈希</h2>
      
      {/* 文件上传区域 */}
      <div className="upload-section">
        <div className="upload-container">
          <h3 className="upload-title">文件上传</h3>
          <div 
            className={`upload-area ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-input"
              onChange={handleFileChange}
              disabled={uploading}
              className="file-input"
            />
            <div className="upload-content">
              {file ? (
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <button 
                    className="remove-file"
                    onClick={() => setFile(null)}
                  >
                    移除
                  </button>
                </div>
              ) : (
                <>
                  <div className="upload-icon">📁</div>
                  <p className="upload-text">拖放文件到这里或点击选择文件</p>
                  <p className="upload-hint">支持任意文件类型</p>
                </>
              )}
            </div>
          </div>
          
          <button 
            className={`upload-button ${uploading ? 'uploading' : ''}`}
            onClick={handleFileUpload}
            disabled={uploading || !file}
          >
            {uploading ? (
              <>
                <span className="spinner"></span>
                上传中...
              </>
            ) : (
              '开始上传'
            )}
          </button>
        </div>
      </div>

      <div className="divider">
        <span>或</span>
      </div>
      
      {/* 文本输入区域 */}
      <div className="text-input-section">
        <h3 className="text-input-title">文本输入</h3>
        <form onSubmit={handleGenerateMD5} className="text-input-form">
          <div className="text-input-container">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入要生成MD5哈希的文本"
              rows={5}
              disabled={loading}
              className="text-input"
            />
          </div>
          
          {error && (
            <div className="error-message">{error}</div>
          )}
          {success && (
            <div className="success-message">
              <p>{successMessage}</p>
              {operationStats && (
                <p className="operation-stats">
                  新增: {operationStats.added} | 跳过: {operationStats.skipped}
                </p>
              )}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading || !text.trim()}
            className={`submit-button ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                生成中...
              </>
            ) : (
              '生成MD5'
            )}
          </button>
        </form>
      </div>
      
      {history.length > 0 && (
        <div className="history-section">
          <h3 className="history-title">生成历史 ({history.length})</h3>
          <div className="history-list">
            {history.map((item, index) => (
              <div key={index} className="history-item">
                <div className="history-content">
                  <div className="history-text">
                    <span className="label">原文：</span>
                    {item.plaintext}
                  </div>
                  <div className="history-text">
                    <span className="label">MD5 (32位)：</span>
                    {item.md5}
                  </div>
                  <div className="history-text">
                    <span className="label">MD5 (16位)：</span>
                    {item.md5_16}
                  </div>
                  <div className="history-time">
                    创建时间：{new Date(item.CreatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <button 
                  className="copy-button"
                  onClick={() => copyToClipboard(item.md5)}
                >
                  复制MD5
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateMD5; 