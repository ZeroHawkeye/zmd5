import { useEffect } from 'react'

const MatrixBackground = () => {
  // 矩阵雨效果
  useEffect(() => {
    const canvas = document.getElementById('matrix-background') as HTMLCanvasElement
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const fontSize = 14
    const columns = canvas.width / fontSize
    
    const drops: number[] = []
    
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * canvas.height / fontSize)
    }
    
    const matrix = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = '#0f0'
      ctx.font = fontSize + 'px monospace'
      
      for (let i = 0; i < drops.length; i++) {
        const text = String.fromCharCode(Math.floor(Math.random() * 128))
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        
        drops[i]++
      }
    }
    
    const interval = setInterval(matrix, 33)
    
    return () => clearInterval(interval)
  }, [])

  return <canvas id="matrix-background" className="matrix-background"></canvas>
}

export default MatrixBackground 