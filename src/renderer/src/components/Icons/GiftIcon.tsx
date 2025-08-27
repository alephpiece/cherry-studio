import { giftShakeVariants } from '@renderer/utils/motionVariants'
import { motion } from 'framer-motion'
import { Gift } from 'lucide-react'

interface GiftIconProps extends React.ComponentProps<typeof Gift> {
  active?: boolean
}

const GiftIcon = ({ active = false, size = '1rem', ...props }: GiftIconProps) => (
  <motion.span
    variants={active ? giftShakeVariants : undefined}
    whileHover={active ? 'hover' : undefined}
    initial="idle"
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
    <Gift size={size} {...props} />
  </motion.span>
)

export default GiftIcon
