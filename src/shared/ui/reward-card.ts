/**
 * 奖励弹层(成就 / 幸运)卡片的**共享几何** —— 两个弹层必须同一份。
 *
 * 为什么共享而不是各写一遍:去掉几行文字后卡片会缩,两处缩得不一样就会出现
 * 「撒花落点一致、卡片却跳变」,比改造前更晃眼(设计 §3.1 末条)。
 *
 * `min-h-[13.5rem]`(216px)≈ 改造前四行文字时的高度
 * (emoji 48 + 12+28 + 28 + 4+20 + 8+20 + p-6 的 48 + 描边 2 ≈ 218)。
 * 取的意图是「文字消失,卡片不变形」,不是精确复刻 —— 共用这一份保证的是两个弹层**几何约束相同**
 * (`min-h` / `max-w` / `p-6` / 描边),**不保证渲染高度相同**(哪天某一边的内容高过 `min-h`,两边就会不等);
 * 数值本身好不好看由走查 `W-S3` 兜人眼。
 *
 * 描边颜色与底色由调用方补(`cn(REWARD_CARD, 'border-hairline bg-surface')`):
 * `border`(宽度)与 `border-hairline`(颜色)在 tailwind-merge 里是两组,不会互相删掉。
 */
export const REWARD_CARD =
  'flex w-full max-w-xs min-h-[13.5rem] flex-col items-center justify-center rounded-[2rem] border p-6 text-center shadow-pop'
