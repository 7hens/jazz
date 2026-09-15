/** 词课景深层:天顶柔光 + 远处云 + 题区落影,把题卡从「浮在天空渐变上的白盒子」变成
 *  「落在地上的物件」。只服务词课 —— 千字谷由舞台自备,短教/冷启动是全屏浮层没有天空
 *  (spec §6 分档表 + 勘误)。纯装饰:aria-hidden + pointer-events-none。 */
export function LessonAmbience() {
  return (
    <div aria-hidden data-lesson-ambience className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* 天顶柔光 */}
      <div className="absolute -top-32 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full bg-surface/60 blur-3xl" />
      {/* 远处云 */}
      <div className="absolute left-[6%] top-[15%] text-4xl opacity-40">☁️</div>
      <div className="absolute right-[9%] top-[8%] text-3xl opacity-30">☁️</div>
      {/* 题区落影:词石组脚下的地面感 */}
      <div className="absolute left-1/2 top-[58%] h-24 w-[76%] -translate-x-1/2 rounded-[999px] bg-ink/10 blur-2xl" />
    </div>
  )
}
