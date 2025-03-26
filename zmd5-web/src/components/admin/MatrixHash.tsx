import { useEffect, useState } from 'react';
import '../../styles/admin/MatrixHash.css';

interface MatrixHashProps {
  hash: string;
  type: 'MD5_32' | 'MD5_16';
}

const MatrixHash: React.FC<MatrixHashProps> = ({ hash, type }) => {
  const [hovering, setHovering] = useState(false);
  const [glitchChars, setGlitchChars] = useState<string[]>([]);
  
  // 为每个字符生成随机的闪烁效果
  useEffect(() => {
    const chars = hash.split('');
    const glitchIndices: number[] = [];
    
    // 随机选择2-4个位置进行闪烁
    const numGlitches = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < numGlitches; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      if (!glitchIndices.includes(randomIndex)) {
        glitchIndices.push(randomIndex);
      }
    }
    
    // 为选中的字符应用闪烁类
    const newGlitchChars = chars.map((char, index) => {
      if (glitchIndices.includes(index)) {
        return char + ' glitch';
      }
      return char;
    });
    
    setGlitchChars(newGlitchChars);
    
    // 每3秒更新一次闪烁效果
    const interval = setInterval(() => {
      const newGlitchIndices: number[] = [];
      const newNumGlitches = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < newNumGlitches; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        if (!newGlitchIndices.includes(randomIndex)) {
          newGlitchIndices.push(randomIndex);
        }
      }
      
      const updatedGlitchChars = chars.map((char, index) => {
        if (newGlitchIndices.includes(index)) {
          return char + ' glitch';
        }
        return char;
      });
      
      setGlitchChars(updatedGlitchChars);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [hash]);
  
  return (
    <div 
      className={`matrix-hash ${hovering ? 'hover' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {glitchChars.map((char, index) => {
        const [character, className] = char.includes(' ') 
          ? char.split(' ') 
          : [char, ''];
        
        return (
          <span 
            key={index} 
            className={`hash-char ${className}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {character}
          </span>
        );
      })}
    </div>
  );
};

export default MatrixHash; 