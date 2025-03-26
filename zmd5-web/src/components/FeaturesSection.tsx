const FeaturesSection = () => {
  return (
    <div className="features-section">
      <h2>功能特点</h2>
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🔒</div>
          <h3>快速MD5加密</h3>
          <p>秒级完成文本到MD5的转换</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔓</div>
          <h3>多重解密尝试</h3>
          <p>通过彩虹表等多种方式尝试解密</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>高性能计算</h3>
          <p>Rust后端提供极速计算能力</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🖥️</div>
          <h3>强大后端破解</h3>
          <p>利用服务器级计算能力高效破解MD5</p>
        </div>
      </div>
    </div>
  )
}

export default FeaturesSection 