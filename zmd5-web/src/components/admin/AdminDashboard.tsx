import { useEffect, useState } from 'react';
import { AdminDashboardStats } from '../../types/index';
import { getAdminStats } from '../../api/admin';

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const result = await getAdminStats();
        if (result.success && result.data) {
          setStats(result.data);
        } else {
          setError(result.message || '获取统计数据失败');
        }
      } catch (err) {
        setError('获取统计数据时发生错误');
        console.error('获取管理员统计数据出错:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  if (loading) {
    return <div className="admin-loading">加载统计数据中...</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  return (
    <div className="admin-dashboard">
      <h2>仪表盘</h2>
      
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>MD5记录总数</h3>
            <div className="stat-value">{stats.md5_records}</div>
          </div>
          
          <div className="stat-card">
            <h3>用户总数</h3>
            <div className="stat-value">{stats.total_users}</div>
          </div>
          
          <div className="stat-card">
            <h3>活跃用户数</h3>
            <div className="stat-value">{stats.active_users}</div>
          </div>
          
          <div className="stat-card">
            <h3>今日新增记录</h3>
            <div className="stat-value">{stats.today_records}</div>
          </div>
        </div>
      )}
      
      {/* 彩虹表统计信息 */}
      {stats?.rainbow_stats && (
        <div className="dashboard-section mt-6">
          <h3>彩虹表统计</h3>
          <div className="stats-grid mt-3">
            <div className="stat-card">
              <h3>彩虹表链数</h3>
              <div className="stat-value">{stats.rainbow_stats.total_chains.toLocaleString()}</div>
            </div>
            
            <div className="stat-card">
              <h3>字符集类型数</h3>
              <div className="stat-value">{stats.rainbow_stats.total_charsets}</div>
            </div>
            
            <div className="stat-card">
              <h3>覆盖率估计</h3>
              <div className="stat-value">{stats.rainbow_stats.coverage_estimate.toFixed(4)}%</div>
            </div>
            
            <div className="stat-card">
              <h3>平均链长度</h3>
              <div className="stat-value">{stats.rainbow_stats.average_chain_length.toFixed(0)}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="dashboard-section">
        <h3>系统状态</h3>
        <p>{stats?.system_status}</p>
        <p className="text-sm text-gray-400">数据库: {stats?.database_info}</p>
        <p className="text-sm text-gray-400">最后更新: {stats?.last_refreshed}</p>
      </div>
      
      <div className="dashboard-section">
        <h3>最近活动</h3>
        <p>这里将显示最近活动记录...</p>
      </div>
    </div>
  );
};

export default AdminDashboard; 