import type { SentenceSet } from '@/shared/services/vocabulary'

export type { SentenceItem, SentenceSet } from '@/shared/services/vocabulary'

/**
 * 汉语句型步句库(ch1 五词切片)。
 * 每词 3 档、由易到难,每档 = 1 正确句 + 3 错句。
 * 难度轴:① 动词完全不搭 → ② 目标词位置换成别的库内名词 → ③ 成分错位 / 语序颠倒。
 * 硬线:正确句 ≤ 6 / 10 / 14 汉字(逐档),任一句 ≤ 20(sentences.test.ts 守卫)。
 * 干扰词约束:档 2 的替换名词必须是词库内已有的词(同上测试守卫)。
 * 类型(§SentenceSet)定义在 shared 契约里 —— 这样 VocabularyService 能跨 feature 供给句集。
 */

export const SENTENCES: readonly SentenceSet[] = [
  // 词 13 房子
  {
    wordId: 13,
    tiers: [
      {
        correct: '我住在房子里。',
        wrong: ['我吃掉了房子。', '我穿上了房子。', '我背起了房子。'],
      },
      {
        correct: '徐爷爷家就是那栋房子。',
        wrong: ['徐爷爷家就是那栋帽子。', '徐爷爷家就是那栋雨伞。', '徐爷爷家就是那栋台灯。'],
      },
      {
        correct: '房子在路的尽头，徐爷爷朝它走去。',
        wrong: [
          '徐爷爷在路的尽头，房子朝他走去。',
          '路在房子的尽头，徐爷爷朝它走去。',
          '尽头在房子的路，徐爷爷朝它走去。',
        ],
      },
    ],
  },
  // 词 7 门
  {
    wordId: 7,
    tiers: [
      {
        correct: '我推开门。',
        wrong: ['我吃掉了门。', '我穿上了门。', '我骑上了门。'],
      },
      {
        correct: '爷爷推开门，进屋了。',
        wrong: ['爷爷推开帽子，进屋了。', '爷爷推开杯子，进屋了。', '爷爷推开鞋子，进屋了。'],
      },
      {
        correct: '门在爷爷身后轻轻关上，天黑了。',
        wrong: [
          '爷爷在门身后轻轻关上，天黑了。',
          '天在门身后轻轻关上，爷爷黑了。',
          '黑在门身后轻轻关上，爷爷天了。',
        ],
      },
    ],
  },
  // 词 14 钥匙
  {
    wordId: 14,
    tiers: [
      {
        correct: '我用钥匙开门。',
        wrong: ['我用钥匙吃饭。', '我用钥匙穿鞋。', '我用钥匙扫地。'],
      },
      {
        correct: '爷爷掏出钥匙开门。',
        wrong: ['爷爷掏出帽子开门。', '爷爷掏出杯子开门。', '爷爷掏出鞋子开门。'],
      },
      {
        correct: '钥匙在爷爷口袋里，一摸就摸到了。',
        wrong: [
          '爷爷在钥匙的口袋里，一摸就摸到了。',
          '口袋在钥匙的爷爷里，一摸就摸到了。',
          '一摸在钥匙的口袋里，爷爷就摸到了。',
        ],
      },
    ],
  },
  // 词 8 窗户
  {
    wordId: 8,
    tiers: [
      {
        correct: '我打开窗户。',
        wrong: ['我吃掉了窗户。', '我穿上了窗户。', '我骑上了窗户。'],
      },
      {
        correct: '爷爷推开了那扇窗户。',
        wrong: ['爷爷推开了那扇帽子。', '爷爷推开了那扇台灯。', '爷爷推开了那本书。'],
      },
      {
        correct: '风从窗户吹进来，屋里凉快了。',
        wrong: ['窗户从风吹进来，屋里凉快了。', '屋里从窗户吹进来，风凉快了。', '风把窗户吹进来，屋里凉快了。'],
      },
    ],
  },
  // 词 19 台灯
  {
    wordId: 19,
    tiers: [
      {
        correct: '我打开台灯。',
        wrong: ['我吃掉了台灯。', '我穿上了台灯。', '我骑上了台灯。'],
      },
      {
        correct: '天黑前，爷爷点亮了台灯。',
        wrong: ['天黑前，爷爷点亮了帽子。', '天黑前，爷爷点亮了鞋子。', '天黑前，爷爷点亮了杯子。'],
      },
      {
        correct: '台灯亮起来，屋里一下子暖了。',
        wrong: ['屋里亮起来，台灯一下子暖了。', '亮起来台灯，屋里一下子暖了。', '暖起来台灯，屋里一下子亮了。'],
      },
    ],
  },
]

export function sentenceSetFor(wordId: number): SentenceSet | undefined {
  return SENTENCES.find((s) => s.wordId === wordId)
}
