import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTaskManagement, cancelTask } from '../../api/admin';
import { Task, TaskManagementResponse } from '../../types/index';
import { formatDate } from '../../utils/date';
import styles from './TaskManagement.module.css';

const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSize] = useState(10);
  
  // 从 URL 获取当前页码，默认为 1
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await getTaskManagement(currentPage, pageSize, 0);
      if (response.success && response.data) {
        setTasks(response.data.tasks);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentPage]);

  // 更新页码并同步到 URL
  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('page', newPage.toString());
      return newParams;
    });
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 1:
        return '成功';
      case 2:
        return '失败';
      default:
        return '未知';
    }
  };

  const getDecryptStatusText = (status: number) => {
    switch (status) {
      case 0:
        return '未开始';
      case 1:
        return '进行中';  
      case 2:
        return '解密成功';
      case 3:
        return '解密失败';
      default:
        return '未知';
    }
  };

  const getStatusClass = (status: number) => {
    switch (status) {
      case 0:
        return styles.statusWaiting;
      case 1:
        return styles.statusProcessing;
      case 2:
        return styles.statusCompleted;
      case 3:
        return styles.statusFailed;
      default:
        return styles.statusWaiting;
    }
  };

  const handleCancelTask = async (taskId: number) => {
    try {
      const response = await cancelTask(taskId);
      if (response.success) {
        fetchTasks(); // 刷新任务列表
      }
    } catch (error) {
      console.error('取消任务失败:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>任务管理</h2>
        <div className={styles.filterContainer}>
          <button 
            onClick={fetchTasks}
            className={styles.refreshButton}
            disabled={loading}
          >
            刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead className={styles.tableHeader}>
              <tr>
                <th>ID</th>
                <th>哈希值</th>
                <th>明文</th>
                <th>状态</th>
                <th>解密状态</th>
                <th>进度</th>
                <th>创建时间</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className={styles.tableRow}>
                  <td className={styles.tableCell}>{task.id}</td>
                  <td className={`${styles.tableCell} ${styles.hashCell}`}>{task.hash}</td>
                  <td className={styles.tableCell}>{task.plain_text || '-'}</td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.statusBadge} ${getStatusClass(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.statusBadge} ${getStatusClass(task.decrypt_status)}`}>
                      {getDecryptStatusText(task.decrypt_status)}
                    </span>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <span className={styles.progressText}>{task.progress}%</span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>{formatDate(task.created_at)}</td>
                  <td className={styles.tableCell}>{formatDate(task.updated_at)}</td>
                  <td className={styles.tableCell}>
                    <button
                      className={styles.actionButton}
                      onClick={() => handleCancelTask(task.id)}
                      disabled={task.progress === 100 || task.progress === 0}
                    >
                      取消
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.pagination}>
        <div className={styles.totalCount}>
          共 {total} 条记录
        </div>
        <div className={styles.paginationButtons}>
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            上一页
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage * pageSize >= total}
            className={styles.paginationButton}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskManagement; 