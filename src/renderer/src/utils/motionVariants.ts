export const lightbulbVariants = {
  active: {
    opacity: [1, 0.2, 1],
    transition: {
      duration: 1.2,
      ease: 'easeInOut',
      times: [0, 0.5, 1],
      repeat: Infinity
    }
  },
  idle: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeInOut'
    }
  }
}

export const lightbulbSoftVariants = {
  active: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 2,
      ease: 'easeInOut',
      times: [0, 0.5, 1],
      repeat: Infinity
    }
  },
  idle: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeInOut'
    }
  }
}

export const giftShakeVariants = {
  hover: {
    rotate: [0, -15, 12, -10, 8, -6, 5, -3, 2, -1, 0.5, 0],
    transition: {
      duration: 0.8,
      ease: 'easeOut',
      times: [0, 0.08, 0.16, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1]
    }
  },
  idle: {
    rotate: 0,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  }
}
