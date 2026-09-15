import { motion } from 'motion/react'

/** 4 个粒子的固定轨迹(px)。数量 ≤5、存活 ≤550ms —— 见 spec §5「克制约束」。 */
const SPARKS = [
  { emoji: '✨', x: -30, y: -34 },
  { emoji: '⭐', x: 30, y: -30 },
  { emoji: '✨', x: -14, y: 26 },
  { emoji: '🌟', x: 18, y: 28 },
] as const

/** 答对迸星。纯装饰:整块 aria-hidden,绝不进入宿主按钮的 accessible name(spec §9.1)。
 *  动效走 motion → 自动继承 App 的 MotionConfig reducedMotion="user"。 */
export function SparkBurst() {
  return (
    <span aria-hidden data-spark-burst className="quiz-burst">
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          data-spark
          className="quiz-spark"
          initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.85], x: s.x, y: s.y }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          {s.emoji}
        </motion.span>
      ))}
    </span>
  )
}
