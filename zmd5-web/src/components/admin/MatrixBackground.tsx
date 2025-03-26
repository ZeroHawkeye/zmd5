import { useEffect, useRef } from 'react';
import '../../styles/admin/MatrixBackground.css';

interface MatrixBackgroundProps {
  opacity?: number;
}

const MatrixBackground: React.FC<MatrixBackgroundProps> = ({ opacity = 0.05 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置画布尺寸为全屏
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // 矩阵字符
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$@#&%".split("");
    
    // 矩阵雨滴
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = [];
    
    // 初始化雨滴
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * canvas.height);
    }
    
    // 绘制矩阵雨滴
    const draw = () => {
      // 半透明黑色背景，形成拖尾效果
      ctx.fillStyle = `rgba(0, 0, 0, 0.04)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 设置字体样式
      ctx.fillStyle = "#00ff9d";
      ctx.font = `${fontSize}px monospace`;
      
      // 循环绘制每一列
      for (let i = 0; i < drops.length; i++) {
        // 随机字符
        const charIndex = Math.floor(Math.random() * chars.length);
        const char = chars[charIndex];
        
        // 绘制字符
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        
        // 较低概率将雨滴重置到顶部
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        
        // 移动雨滴
        drops[i]++;
      }
    };
    
    // 动画循环
    const interval = setInterval(draw, 40);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [opacity]);
  
  return (
    <div className="matrix-background" style={{ opacity }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

export default MatrixBackground; 