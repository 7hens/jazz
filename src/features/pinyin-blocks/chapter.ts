// 一个单元的三章。**这个数组就是「章的先后」的唯一事实源** —— 解锁链、地图上的排序、
// 章末该去哪一章,全部从它派生。别在别处再写一遍 ['easy','hard','review']。
// LEAF:不引任何东西(引它的人包括 blocks.ts,反向引会造成环)。

export const CHAPTERS = ['easy', 'hard', 'review'] as const
export type Chapter = (typeof CHAPTERS)[number]
