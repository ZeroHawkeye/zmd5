import EncryptSection from './EncryptSection'
import DecryptSection from './DecryptSection'
import FeaturesSection from './FeaturesSection'
import { DecryptRecord } from '../types/index'

interface MainSectionProps {
  isLoggedIn: boolean
  onDecryptSuccess?: (record: DecryptRecord) => void
}

const MainSection = ({ isLoggedIn, onDecryptSuccess }: MainSectionProps) => {
  return (
    <>
      <div className="main-section">
        <EncryptSection />
        <DecryptSection isLoggedIn={isLoggedIn} onDecryptSuccess={onDecryptSuccess} />
      </div>
      <FeaturesSection />
    </>
  )
}

export default MainSection 