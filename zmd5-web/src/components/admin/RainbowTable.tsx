import React, { useEffect, useState } from 'react';
import { deleteRainbowTableEntry, getRainbowTableEntries } from '../../api/admin';
import { generateRainbowTable } from '../../api/rainbow';
import '../../styles/admin/RainbowTable.css';
import { RainbowTableEntry } from '../../types/index';
import MatrixBackground from './MatrixBackground';

const RainbowTable = () => {
  const [entries, setEntries] = useState<RainbowTableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // 新增条目表单
  const [addingEntry, setAddingEntry] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [startPlaintext, setStartPlaintext] = useState('');
  const [endHash, setEndHash] = useState('');
  const [reductionFunction, setReductionFunction] = useState(0);
  const [charsetType, setCharsetType] = useState(1);
  const [minLength, setMinLength] = useState(3);
  const [maxLength, setMaxLength] = useState(8);
  const [charsetRange, setCharsetRange] = useState('');
  const [chainCount, setChainCount] = useState(10);
  const [chainLength, setChainLength] = useState(1000);
  
  // 添加表单展开/收起状态，默认为收起
  const [formExpanded, setFormExpanded] = useState(false);

  // 切换表单展开/收起状态
  const toggleForm = () => {
    setFormExpanded(!formExpanded);
  };

  // 展开详情的行ID集合
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // 切换详情显示
  const toggleDetails = (id: number) => {
    if (expandedRows.includes(id)) {
      setExpandedRows(prev => prev.filter(i => i !== id));
    } else {
      setExpandedRows(prev => [...prev, id]);
    }
  };

  // 获取字符集类型名称
  const getCharsetTypeName = (type: number) => {
    switch (type) {
      case 1:
        return '纯数字';
      case 2:
        return '小写字母';
      case 3:
        return '大写字母';
      case 4:
        return '混合';
      default:
        return '-';
    }
  };

  // 加载彩虹表数据
  const loadEntries = async (pageNum = 1) => {
    setLoading(true);
    setError(null);

    try {
      const result = await getRainbowTableEntries(pageNum, limit);
      if (result.success && result.data) {
        // 确保数据是数组
        const entriesData = result.data as RainbowTableEntry[];
        let newEntries;
        if (pageNum === 1) {
          newEntries = entriesData;
          setEntries(entriesData);
        } else {
          newEntries = [...entries, ...entriesData];
          setEntries(newEntries);
        }
        setTotal(result.total || 0);
        setHasMore(entriesData.length === limit && newEntries.length < (result.total ?? Infinity));
      } else {
        setError(result.message || '获取彩虹表数据失败');
      }
    } catch (err) {
      setError('获取彩虹表数据时发生错误');
      console.error('获取彩虹表数据出错:', err);
    } finally {
      setLoading(false);
    }
  };

  // 首次加载
  useEffect(() => {
    loadEntries(1);
  }, []);

  // 生成彩虹表
  const handleGenerateRainbowTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAddingEntry(true);

    try {
      const result = await generateRainbowTable(
        chainCount,
        chainLength,
        reductionFunction,
        charsetType,
        charsetRange,
        minLength,
        maxLength
      );

      if (result.success) {
        // 生成成功，刷新列表
        loadEntries(1);
        // 显示成功消息
        alert(`彩虹表生成成功！生成了${result.data?.generated || 0}条链，数据库中共有${result.data?.total_count || 0}条链。`);
        // 重置某些字段
        setChainCount(10);
        setChainLength(1000);
        setReductionFunction(0);
      } else {
        setFormError(result.message || '生成彩虹表失败');
      }
    } catch (err) {
      setFormError('生成彩虹表时发生错误');
      console.error('生成彩虹表出错:', err);
    } finally {
      setAddingEntry(false);
    }
  };

  // 删除条目
  const handleDeleteEntry = async (id: number) => {
    if (!confirm('确定要删除这个条目吗？')) {
      return;
    }

    try {
      const result = await deleteRainbowTableEntry(id);
      if (result.success) {
        // 从列表中移除
        setEntries(prev => prev.filter(entry => entry.id !== id));
        // 更新总数
        setTotal(prev => prev - 1);
      } else {
        alert(result.message || '删除条目失败');
      }
    } catch (err) {
      alert('删除条目时发生错误');
      console.error('删除彩虹表条目出错:', err);
    }
  };

  // 加载更多
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadEntries(nextPage);
    }
  };

  return (
    <div className="rainbow-table-container">
      <MatrixBackground opacity={0.07} />

      <div className="rainbow-table">
        <h2>彩虹表管理</h2>

        {/* 添加新条目表单 */}
        <div className="form-header">
          <h3 onClick={toggleForm} className="form-toggle">
            创建新彩虹表 <span className="toggle-icon">{formExpanded ? '▼' : '►'}</span>
          </h3>
        </div>
        
        {formExpanded && (
          <div className="add-entry-form">
            {formError && <div className="form-error">{formError}</div>}

            <form onSubmit={handleGenerateRainbowTable}>
              <div className="form-row">
                <div className="form-group half">
                  <label htmlFor="chain-count">链数量</label>
                  <input
                    type="number"
                    id="chain-count"
                    value={chainCount}
                    onChange={(e) => setChainCount(parseInt(e.target.value) || 10)}
                    min="1"
                    placeholder="生成的链数量"
                    disabled={addingEntry}
                    title="决定生成多少条彩虹链。数量越多，覆盖面越广，但生成时间和存储空间也会增加。建议值：测试用10条，实用100-1000条，大型表1000条以上。"
                  />
                  <small>默认: 10</small>
                </div>

                <div className="form-group half">
                  <label htmlFor="chain-length">链长度</label>
                  <input
                    type="number"
                    id="chain-length"
                    value={chainLength}
                    onChange={(e) => setChainLength(parseInt(e.target.value) || 1000)}
                    min="100"
                    placeholder="链长度"
                    disabled={addingEntry}
                    title="每条链中哈希计算的次数，影响单条链的覆盖范围和破解成功率。链越长，单条链可能匹配的哈希值越多，但计算时间也会增加。建议值：测试用100-500，标准使用1000-5000，高效破解10000以上。"
                  />
                  <small>默认: 1000</small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="start-plaintext">起始明文</label>
                <input
                  type="text"
                  id="start-plaintext"
                  value={startPlaintext}
                  onChange={(e) => setStartPlaintext(e.target.value)}
                  placeholder="起始明文(可选)"
                  disabled={addingEntry}
                  title="每条链的起始密码。通常留空，系统会根据字符集随机生成，这样可以保证彩虹表的随机性和覆盖广度。如有特定需求（例如只想破解某种特定格式的密码），可以指定起始值。"
                />
                <small>留空将随机生成</small>
              </div>

              <div className="form-group">
                <label htmlFor="end-hash">结束哈希</label>
                <input
                  type="text"
                  id="end-hash"
                  value={endHash}
                  onChange={(e) => setEndHash(e.target.value)}
                  placeholder="结束哈希(可选)"
                  disabled={addingEntry}
                  title="链的最终哈希值。几乎总是留空，由系统自动计算并保存。"
                />
                <small>通常留空</small>
              </div>

              <div className="form-group">
                <label htmlFor="reduction-function">规约函数编号</label>
                <input
                  type="number"
                  id="reduction-function"
                  value={reductionFunction}
                  onChange={(e) => setReductionFunction(parseInt(e.target.value) || 0)}
                  placeholder="规约函数编号"
                  disabled={addingEntry}
                  title="将哈希值映射回明文的函数编号，不同编号使用不同的算法。0:直接加法(快速但分布集中)；1:异或操作(均匀分布)；2:乘法取余(更随机但计算慢)；3:混合操作(结合规约ID和索引)；4:旋转位(高度随机但复杂)。建议使用1或3获取性能与随机性的平衡。"
                />
              </div>

              <div className="form-group">
                <label htmlFor="charset-type">字符集类型</label>
                <select
                  id="charset-type"
                  value={charsetType}
                  onChange={(e) => setCharsetType(parseInt(e.target.value))}
                  disabled={addingEntry}
                  title="定义密码可能包含的字符范围。字符集越小，破解效率越高，但覆盖范围越窄。选择与目标密码特征相符的字符集可以大幅提高效率。"
                >
                  <option value="1">1 - 纯数字</option>
                  <option value="2">2 - 小写字母</option>
                  <option value="3">3 - 大写字母</option>
                  <option value="4">4 - 混合</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group half">
                  <label htmlFor="min-length">最小长度</label>
                  <input
                    type="number"
                    id="min-length"
                    value={minLength}
                    onChange={(e) => setMinLength(parseInt(e.target.value) || 3)}
                    min="1"
                    placeholder="最小长度"
                    disabled={addingEntry}
                    title="生成密码的最小长度。长度范围越小越精确，但覆盖面也越窄。推荐值：短密码3-6位，中等密码6-8位，长密码8位以上。"
                  />
                  <small>默认: 3</small>
                </div>

                <div className="form-group half">
                  <label htmlFor="max-length">最大长度</label>
                  <input
                    type="number"
                    id="max-length"
                    value={maxLength}
                    onChange={(e) => setMaxLength(parseInt(e.target.value) || 8)}
                    min="1"
                    placeholder="最大长度"
                    disabled={addingEntry}
                    title="生成密码的最大长度。注意：最大长度增加会使计算量呈指数级增长。推荐将最大长度限制在实际可能的范围内，以提高效率。"
                  />
                  <small>默认: 8</small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="charset-range">字符集范围</label>
                <input
                  type="text"
                  id="charset-range"
                  value={charsetRange}
                  onChange={(e) => setCharsetRange(e.target.value)}
                  placeholder="例如: 0-9 或 a-z"
                  disabled={addingEntry}
                  title="自定义字符集，可以精确指定包含哪些字符。通常可留空，使用预定义的字符集。需要特定字符时可以指定，如'0-9a-f'(十六进制字符)。自定义字符集可以针对特定类型的密码提高效率。"
                />
              </div>

              <button type="submit" disabled={addingEntry} title="点击开始生成彩虹表。根据参数设置，生成过程可能需要较长时间，请耐心等待。">
                {addingEntry ? '生成中...' : '生成彩虹表'}
              </button>
            </form>
          </div>
        )}

        {/* 彩虹表列表 */}
        <div className="entries-list">
          <h3>条目列表 <span className="total-count">共 {total} 条</span></h3>

          {error && <div className="form-error">{error}</div>}

          <table className="entries-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>字符集</th>
                <th>长度范围</th>
                <th>起始明文</th>
                <th>链长度</th>
                <th>规约函数</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr>
                    <td>{entry.id}</td>
                    <td>{getCharsetTypeName(entry.charset_type || 1)}</td>
                    <td>{entry.min_length} - {entry.max_length}</td>
                    <td>{entry.start_plaintext}</td>
                    <td>{entry.chain_length}</td>
                    <td>{entry.reduction_function}</td>
                    <td>{new Date(entry.created_at * 1000).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    })}</td>
                    <td>
                      <button
                        className="detail-btn"
                        onClick={() => toggleDetails(entry.id)}
                      >
                        {expandedRows.includes(entry.id) ? '隐藏' : '详情'}
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                  {expandedRows.includes(entry.id) && (
                    <tr className="details-row">
                      <td colSpan={8}>
                        <div className="entry-details">
                          <div className="detail-item">
                            <span className="detail-label">MD5哈希:</span>
                            <span className="detail-value">{entry.hash}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">哈希类型:</span>
                            <span className="detail-value">{entry.hash_type === 'MD5_32' ? '32位' : '16位'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">明文:</span>
                            <span className="detail-value">{entry.plaintext || '未知'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">结束哈希:</span>
                            <span className="detail-value">{entry.end_hash || '-'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">字符集范围:</span>
                            <span className="detail-value">{entry.charset_range || '默认'}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}

              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="no-data">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading && <div className="loading-more">加载中...</div>}

          {hasMore && !loading && (
            <button className="load-more-btn" onClick={handleLoadMore}>
              加载更多
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RainbowTable; 