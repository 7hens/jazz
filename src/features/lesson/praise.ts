const PRAISES = [
  '太棒了!🎉', '你真厉害!⭐', '完美!✨', '小天才!🌟',
  '好样的!💪', '真不错!🎊', '你做到了!🏆', '太聪明了!🧠',
]

export function getRandomPraise(rng: () => number = Math.random): string {
  return PRAISES[Math.floor(rng() * PRAISES.length)] ?? PRAISES[0]
}
