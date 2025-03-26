import { useEffect, useState } from 'react';
import { getAllMD5Records, deleteMD5Record } from '../../api/admin';

// MD5记录类型定义
interface MD5Record {
  ID: number;
  plaintext: string;
  md5: string;
  md5_16: string;
  created_at: string;
}

// 分页响应类型
interface MD5Response {
  total: number;
  records: MD5Record[];
  page: number;
  pageSize: number;
}

const MD5Management = () => {
  const [records, setRecords] = useState<MD5Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'plaintext' | 'md5'>('all');
  
  // 加载MD5记录
  const loadRecords = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAllMD5Records(pageNum, pageSize, searchTerm, filterType);
      if ((result.status === 'success' || result.success) && result.data) {
        const responseData = result.data as MD5Response;
        setRecords(responseData.records);
        setTotalRecords(responseData.total);
        setPage(responseData.page);
      } else {
        setError(result.message || '获取MD5记录失败');
      }
    } catch (err) {
      setError('获取MD5记录时发生错误');
      console.error('获取MD5记录出错:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 首次加载
  useEffect(() => {
    loadRecords(1);
  }, []);
  
  // 更新页面大小时重新加载
  useEffect(() => {
    loadRecords(page);
  }, [pageSize]);
  
  // 删除记录
  const handleDeleteRecord = async (id: number) => {
    if (!confirm('确定要删除这条MD5记录吗？')) {
      return;
    }
    
    try {
      const result = await deleteMD5Record(id);
      if (result.status === 'success' || result.success) {
        // 从列表中移除
        setRecords(prev => prev.filter(record => record.ID !== id));
        // 如果当前页没有记录了，但不是第一页，则加载上一页
        if (records.length === 1 && page > 1) {
          loadRecords(page - 1);
        }
      } else {
        alert(result.message || '删除记录失败');
      }
    } catch (err) {
      alert('删除记录时发生错误');
      console.error('删除MD5记录出错:', err);
    }
  };
  
  // 处理页码变化
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadRecords(newPage);
  };
  
  // 处理搜索
  const handleSearch = () => {
    setPage(1); // 重置到第一页
    loadRecords(1);
  };
  
  // 处理重置
  const handleReset = () => {
    setSearchTerm('');
    setFilterType('all');
    setPage(1);
    loadRecords(1);
  };
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };
  
  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
    });
  };
  
  return (
    <div className="md5-management">
      <h2>MD5管理</h2>
      
      {/* 搜索和过滤 */}
      <div className="search-filter">
        <div className="filter-controls">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as 'all' | 'plaintext' | 'md5')}
            className="filter-type"
          >
            <option value="all">全部</option>
            <option value="plaintext">明文</option>
            <option value="md5">MD5哈希</option>
          </select>
          
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索MD5或明文..."
            className="search-input"
          />
          
          <button onClick={handleSearch} className="search-button">搜索</button>
          <button onClick={handleReset} className="reset-button">重置</button>
        </div>
      </div>
      
      {/* 错误提示 */}
      {error && <div className="error-message">{error}</div>}
      
      {/* 加载中 */}
      {loading && <div className="loading-spinner">加载中...</div>}
      
      {/* MD5记录表格 */}
      {!loading && (
        <div className="md5-table-container">
          <table className="md5-table">
            <thead>
              <tr>
                <th style={{ width: '5%' }}>ID</th>
                <th style={{ width: '30%' }}>明文</th>
                <th style={{ width: '25%' }}>32位MD5</th>
                <th style={{ width: '20%' }}>16位MD5</th>
                <th style={{ width: '10%' }}>创建时间</th>
                <th style={{ width: '10%' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? (
                records.map(record => (
                  <tr key={record.ID}>
                    <td>{record.ID}</td>
                    <td>
                      <div className="text-cell">
                        <span className="text-ellipsis">{record.plaintext}</span>
                        <button 
                          onClick={() => copyToClipboard(record.plaintext)} 
                          className="copy-button"
                          title="复制明文"
                        >
                          <span className="icon">⎘</span>
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="text-cell">
                        <span className="text-ellipsis code-font">{record.md5}</span>
                        <button 
                          onClick={() => copyToClipboard(record.md5)} 
                          className="copy-button"
                          title="复制32位MD5"
                        >
                          <span className="icon">⎘</span>
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="text-cell">
                        <span className="text-ellipsis code-font">{record.md5_16}</span>
                        <button 
                          onClick={() => copyToClipboard(record.md5_16)} 
                          className="copy-button"
                          title="复制16位MD5"
                        >
                          <span className="icon">⎘</span>
                        </button>
                      </div>
                    </td>
                    <td className="timestamp">{formatDate(record.created_at)}</td>
                    <td>
                      <button 
                        onClick={() => handleDeleteRecord(record.ID)} 
                        className="delete-button"
                      >
                        <span className="icon">✕</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="no-records">没有找到MD5记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* 分页控件 */}
      {!loading && totalRecords > 0 && (
        <div className="pagination">
          <button 
            onClick={() => handlePageChange(1)} 
            disabled={page === 1}
            className="page-button"
          >
            首页
          </button>
          <button 
            onClick={() => handlePageChange(page - 1)} 
            disabled={page === 1}
            className="page-button"
          >
            上一页
          </button>
          <span className="page-info">
            第 {page} 页，共 {Math.ceil(totalRecords / pageSize)} 页
          </span>
          <button 
            onClick={() => handlePageChange(page + 1)} 
            disabled={page >= Math.ceil(totalRecords / pageSize)}
            className="page-button"
          >
            下一页
          </button>
          <button 
            onClick={() => handlePageChange(Math.ceil(totalRecords / pageSize))} 
            disabled={page >= Math.ceil(totalRecords / pageSize)}
            className="page-button"
          >
            末页
          </button>
        </div>
      )}
      
      {/* 总记录数 */}
      {!loading && (
        <div className="total-records">
          总共 {totalRecords} 条记录
        </div>
      )}
      
      {/* 组件样式 */}
      <style>{`
        .md5-management {
          padding: 20px;
          background-color: #121212;
          color: #e0e0e0;
          font-family: 'Consolas', 'Courier New', monospace;
        }
        
        h2 {
          margin-bottom: 20px;
          font-size: 1.8rem;
          color: #00ff00;
          text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
          letter-spacing: 1px;
          border-bottom: 1px solid #00ff00;
          padding-bottom: 10px;
        }
        
        .search-filter {
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #1a1a1a;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #333;
          box-shadow: 0 0 10px rgba(0, 255, 0, 0.1);
        }
        
        .filter-controls {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        
        .filter-type, .search-input {
          padding: 10px 14px;
          border: 1px solid #444;
          background-color: #222;
          color: #00ff00;
          border-radius: 4px;
          transition: all 0.3s;
          box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
          outline: none;
        }
        
        .filter-type:focus, .search-input:focus {
          border-color: #00ff00;
          box-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
        }
        
        .search-button, .reset-button {
          padding: 10px 16px;
          background-color: #222;
          color: #00ff00;
          border: 1px solid #444;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: bold;
        }
        
        .search-button:hover, .reset-button:hover {
          background-color: #333;
          border-color: #00ff00;
          box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
          transform: translateY(-2px);
        }
        
        .search-button:active, .reset-button:active {
          transform: translateY(0);
        }
        
        .search-input {
          width: 250px;
        }
        
        .error-message {
          padding: 12px;
          background-color: rgba(255, 0, 0, 0.1);
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: #ff6b6b;
          border-radius: 4px;
          margin-bottom: 20px;
          font-family: 'Consolas', monospace;
          position: relative;
        }
        
        .error-message:before {
          content: "ERROR";
          position: absolute;
          top: -10px;
          left: 10px;
          background-color: #121212;
          padding: 0 5px;
          font-size: 0.8rem;
          color: #ff0000;
        }
        
        .loading-spinner {
          text-align: center;
          padding: 30px;
          color: #00ff00;
          font-size: 1.2rem;
          position: relative;
        }
        
        .loading-spinner:after {
          content: "";
          display: inline-block;
          width: 20px;
          margin-left: 5px;
          animation: loadingDots 1.5s infinite;
        }
        
        @keyframes loadingDots {
          0% { content: "."; }
          33% { content: ".."; }
          66% { content: "..."; }
          100% { content: "."; }
        }
        
        .md5-table-container {
          overflow-x: auto;
          margin-bottom: 20px;
          background-color: #1a1a1a;
          border-radius: 6px;
          border: 1px solid #333;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .md5-table-container::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        .md5-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.9rem;
        }
        
        .md5-table th, .md5-table td {
          border: none;
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #333;
        }
        
        .md5-table th {
          background-color: #222;
          font-weight: bold;
          color: #00ff00;
          letter-spacing: 1px;
          text-transform: uppercase;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 1px 0 #333;
        }
        
        .md5-table tbody tr {
          transition: background-color 0.3s, transform 0.2s;
        }
        
        .md5-table tr:nth-child(even) {
          background-color: #1d1d1d;
        }
        
        .md5-table tr:hover {
          background-color: #252525;
          transform: scale(1.01);
          box-shadow: 0 0 15px rgba(0, 255, 0, 0.1);
          position: relative;
          z-index: 5;
        }
        
        .text-cell {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        
        .text-ellipsis {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: calc(100% - 40px);
        }
        
        .code-font {
          font-family: 'Courier New', monospace;
          color: #00c3ff;
          letter-spacing: 1px;
        }
        
        .timestamp {
          color: #888;
          font-size: 0.85rem;
          font-style: italic;
        }
        
        .copy-button {
          min-width: 30px;
          height: 30px;
          background-color: transparent;
          color: #00ff00;
          border: 1px solid #444;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: all 0.3s;
        }
        
        .copy-button:hover {
          background-color: #333;
          opacity: 1;
          transform: scale(1.1);
          box-shadow: 0 0 8px rgba(0, 255, 0, 0.4);
        }
        
        .delete-button {
          width: 30px;
          height: 30px;
          background-color: transparent;
          color: #ff3b3b;
          border: 1px solid #444;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          transition: all 0.3s;
        }
        
        .delete-button:hover {
          background-color: rgba(255, 0, 0, 0.1);
          opacity: 1;
          border-color: #ff3b3b;
          transform: scale(1.1);
          box-shadow: 0 0 8px rgba(255, 0, 0, 0.4);
        }
        
        .icon {
          font-size: 14px;
          display: inline-block;
        }
        
        .no-records {
          text-align: center;
          padding: 30px;
          color: #888;
          font-style: italic;
          background-color: #1a1a1a;
        }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 25px;
          flex-wrap: wrap;
          padding: 10px;
          background-color: #1a1a1a;
          border-radius: 6px;
          border: 1px solid #333;
        }
        
        .page-button {
          padding: 8px 14px;
          background-color: #222;
          color: #00ff00;
          border: 1px solid #444;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
          min-width: 40px;
          text-align: center;
        }
        
        .page-button:disabled {
          background-color: #1a1a1a;
          color: #444;
          cursor: not-allowed;
          border-color: #333;
        }
        
        .page-button:not(:disabled):hover {
          background-color: #333;
          transform: translateY(-2px);
          box-shadow: 0 2px 5px rgba(0, 255, 0, 0.2);
        }
        
        .page-button:not(:disabled):active {
          transform: translateY(0);
        }
        
        .page-info {
          font-size: 0.9rem;
          color: #888;
          background-color: #222;
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid #333;
        }
        
        .total-records {
          text-align: right;
          font-size: 0.9rem;
          color: #888;
          margin-top: 15px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default MD5Management; 