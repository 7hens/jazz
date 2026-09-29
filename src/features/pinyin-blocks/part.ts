// 一个单元的三个部分。**这个数组就是「部分的先后」的唯一事实源** —— 解锁链、地图上的排序、
// 部分间该去哪一部分,全部从它派生。别在别处再写一遍。
// LEAF:不引任何东西(引它的人包括 blocks.ts,反向引会造成环)。

export const PARTS = ['easy', 'hard', 'review'] as const
export type Part = (typeof PARTS)[number]
