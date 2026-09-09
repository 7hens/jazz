import type { Chapter } from './chapter'

/**
 * 千字谷 · 第 1 章《太阳的求救》内容数据。
 * 台本逐条照录自 docs/ideas/260908-01-001.md §4.1-§4.10,role 映射:
 * 🦊→lingling / ☀️→sun / 🌙→moon / 🖤→jingmo / 🐰→villager。
 * 台本句长规则:单句台词去标点推荐 ≤18 汉字、硬线 ≤20;超 20 必按意群拆(ch1-script.test.ts 守卫)。
 * 场景结构遵循 P3 引擎/控制器约束:
 *  - 每词两个连续 task scene(先 sound 后 shape),minCorrect 均 2(R2);
 *  - 断点恰 3 个(词1 后 / 词2 后 / 社交事件后,对齐 idea §2 流程);
 *  - 创作锚定/画/拍照等延迟子步骤不在此纵切片,仅以 idea 相邻台词作接缝(R4a)。
 */
export const CHAPTER_1: Chapter = {
  id: 1,
  title: '太阳的求救',
  subtitle: '天空区·第一束光',
  emoji: '🌅',
  wordIds: [1, 101, 102, 103, 3],
  restoreOrder: [1, 1, 101, 101, 102, 102, 103, 103, 3, 3],
  scenes: [
    // §4.1 开场:灰白天空区,太阳暗淡。开场台词依产品反馈改写(欢迎 + 幽默介绍千字谷 + 借太阳哭诉立起静默/墨迹两个反派),非逐字照录;
    // 原 R4b「❓ 的重新解释」已内化进哭诉对话本身,故删去尾部重解释行,无需分支。
    {
      id: 'open',
      kind: 'dialogue',
      stage: { sky: ['sun'] },
      lines: [
        { role: 'lingling', text: '欢迎来到千字谷——锵锵锵！' },
        { role: 'lingling', text: '这可是世界上最热闹的山谷！' },
        { role: 'lingling', text: '山壁上刻着亮晶晶的汉字，空气里飘着拼音！' },
        { role: 'lingling', text: '天天叮叮咚咚的，像在开演唱会！' },
        { role: 'lingling', text: '诶？今天怎么这么安静？连个“叮”都没有……' },
        { role: 'lingling', text: '咦，太阳怎么灰扑扑的？太阳——你还好吗？！' },
        { role: 'sun', text: '救……救我……我的声音……被吃掉了……脸……也被画花了……' },
        { role: 'lingling', text: '什么？！谁干的？！' },
        { role: 'sun', text: '一个黑乎乎的家伙……它说它叫……静默……' },
        { role: 'sun', text: '然后……啊呜一口……把我的声音……全吞掉了……' },
        { role: 'lingling', text: '静默！我知道——专偷声音的贪吃鬼！' },
        { role: 'lingling', text: '声音一到它嘴里，咕咚一声就没影啦！' },
        { role: 'lingling', text: '那你的脸呢？又是谁画的？' },
        { role: 'sun', text: '是墨迹……它说要给我画个超——帅的新造型……' },
        { role: 'lingling', text: '扑哧——这叫超帅造型？' },
        { role: 'lingling', text: '明明就是一颗煎糊了的荷包蛋嘛！' },
        { role: 'sun', text: '呜哇——你、你还笑！' },
        { role: 'sun', text: '没声音、顶着鸡蛋脸，我还怎么照亮大家嘛！' },
        { role: 'lingling', text: '别怕！咱俩专治偷声音、乱涂鸦！' },
        { role: 'lingling', text: '你——就是千字谷的成长守护者！' },
        { role: 'lingling', text: '走，咱们把太阳的声音和帅脸抢回来！' },
      ],
    },

    // §4.2 任务1 太阳(1):听音引子 + 拼音恢复(sound)→ 汉字恢复(shape)→ 情境收尾。
    {
      id: 't1-sound',
      kind: 'task',
      title: '拯救太阳 · 声音',
      intro: [
        { role: 'lingling', text: '听！这是太阳的声音...' },
        { role: 'lingling', text: 'tài yáng！记住了吗？' },
        { role: 'lingling', text: '太阳的声音是 tài yáng！' },
        { role: 'lingling', text: '太阳的名字是什么？' },
        { role: 'lingling', text: '找到正确的读音！' },
      ],
      task: { wordId: 1, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't1-shape',
      kind: 'task',
      title: '拯救太阳 · 字形',
      intro: [
        { role: 'lingling', text: '声音回来了！但字还看不清...' },
        { role: 'lingling', text: '把‘太阳’两个字拼出来！' },
      ],
      task: { wordId: 1, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'lingling', text: '太棒了！太阳复活了！' },
        { role: 'villager', text: '有光了...！谢谢你！' },
        // §4.2 末尾【自然断点】处 灵灵 的语音提示(BreakScene 无台词槽,并入上一幕收尾)
        { role: 'lingling', text: '想继续吗？还是休息一下？' },
      ],
    },
    // 断点 1:词1 后(idea §4.2 明确标记)
    { id: 'br1', kind: 'break' },

    // §4.3 任务2 升起(101)。TPR 演示拍(看！这就是…/你也来做…)属延迟互动,不录。
    {
      id: 't2-sound',
      kind: 'task',
      title: '教会太阳升起 · 声音',
      intro: [
        { role: 'lingling', text: '太阳虽然活了，但它还不会升起...' },
        { role: 'lingling', text: '我们教它‘升起’！' },
        { role: 'lingling', text: 'shēng qǐ！升起！' },
        { role: 'lingling', text: '哪个小动物在‘升起’？' },
      ],
      task: { wordId: 101, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't2-shape',
      kind: 'task',
      title: '教会太阳升起 · 字形',
      intro: [],
      task: { wordId: 101, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'lingling', text: '太阳升起来了！天空变亮了！' },
      ],
    },
    // 断点 2:词2 后(idea §4.3 末尾标记)
    { id: 'br2', kind: 'break' },

    // §4.4 社交事件:安慰哭泣的月亮(后果式 3 选项,好/坏/中性)。
    {
      id: 'social-moon',
      kind: 'social',
      stage: { atmosphere: 'night', cast: ['lingling', 'moon'] },
      lines: [
        { role: 'lingling', text: '咦...月亮在哭...' },
        { role: 'moon', text: '大家都喜欢太阳...没有人喜欢我...' },
        { role: 'moon', text: '白天有太阳...晚上只有我...好孤单...' },
      ],
      options: [
        { id: 'a', text: '你哭起来真难看。', emoji: '😠', consequence: 'bad', response: '月亮哭得更伤心了...' },
        { id: 'b', text: '我也喜欢你！你照亮了夜晚！', emoji: '💕', consequence: 'good', response: '月亮笑了！' },
        { id: 'c', text: '（不说话，走开）', emoji: '🚶', consequence: 'neutral', response: '月亮继续哭...' },
      ],
      goodOptionId: 'b',
      // 非 good 选择后 灵灵 的引导词(单 loop 槽承载 A/C 两句引导,UI 依情景取舍)
      loop: [
        { role: 'lingling', text: '月亮更难过了...我们想想怎么安慰它？' },
        { role: 'lingling', text: '月亮还在哭...我们回去看看它？' },
      ],
      onGood: [
        { role: 'moon', text: '真的吗？...谢谢你！' },
        { role: 'moon', text: '我每天晚上都会为你照亮的！' },
        { role: 'lingling', text: '你学会了安慰别人！' },
        { role: 'lingling', text: '月亮开心了！' },
      ],
    },
    // 断点 3:社交事件后(idea §2 流程:任务1/任务2/社交事件 各一处自然断点)
    { id: 'br3', kind: 'break' },

    // §4.5 任务3 亮(102):听音 + 情感匹配(sound)→ 修饰组合(shape)→ 山谷变亮(无对白收尾)。
    {
      id: 't3-sound',
      kind: 'task',
      title: '让山谷亮起来 · 声音',
      intro: [
        { role: 'lingling', text: '太阳升起来了，但山谷还是不够亮...' },
        { role: 'lingling', text: '我们需要‘亮’！' },
        { role: 'lingling', text: 'liàng！亮！' },
        { role: 'lingling', text: '‘亮’是哪种感觉？' },
      ],
      task: { wordId: 102, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't3-shape',
      kind: 'task',
      title: '让山谷亮起来 · 字形',
      intro: [
        { role: 'lingling', text: '把‘亮’送给谁？' },
      ],
      task: { wordId: 102, layer: 'shape', minCorrect: 2 },
      onDone: [],
    },

    // §4.6 任务4 早上好(103):情境选择(sound)→ 对话演练(shape)→ 居民齐问候。
    {
      id: 't4-sound',
      kind: 'task',
      title: '说早上好 · 声音',
      intro: [
        { role: 'lingling', text: '太阳升起来了！现在是早上！' },
        { role: 'lingling', text: '我们要对太阳说什么？' },
        { role: 'lingling', text: 'zǎo shang hǎo！早上好！' },
      ],
      task: { wordId: 103, layer: 'sound', minCorrect: 2 },
      onDone: [
        { role: 'sun', text: '早上好！' },
      ],
    },
    {
      id: 't4-shape',
      kind: 'task',
      title: '说早上好 · 字形',
      intro: [
        { role: 'lingling', text: '你也来说早上好！' },
      ],
      task: { wordId: 103, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'sun', text: '听到你的声音了！早上好！' },
        { role: 'villager', text: '早上好！' },
      ],
    },

    // §4.7 任务5 找回星星(3):综合回顾,星光回到夜空。
    {
      id: 't5-sound',
      kind: 'task',
      title: '找回星星 · 声音',
      intro: [
        { role: 'lingling', text: '白天有太阳，晚上还需要...？' },
      ],
      task: { wordId: 3, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't5-shape',
      kind: 'task',
      title: '找回星星 · 字形',
      intro: [],
      task: { wordId: 3, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'lingling', text: '星星也回来了！' },
      ],
    },
    // §4.8 BOSS 战:静默的挑战(交错 5 题;失败 3 次阈值。勇气徽章等奖励不在本数据)。
    {
      id: 'boss',
      kind: 'boss',
      intro: [
        { role: 'jingmo', text: '你们...居然唤醒了太阳...' },
        { role: 'jingmo', text: '我是静默！我吃掉了千字谷的声音！' },
        { role: 'jingmo', text: '如果你们能全部答对，我就把星星还给你们！' },
      ],
      maxWrong: 3,
      questionCount: 5,
      win: [
        { role: 'jingmo', text: '不可能...！我还会回来的！' },
        { role: 'lingling', text: '静默逃跑时掉下了这个...' },
        { role: 'lingling', text: '这是什么意思呢？' },
      ],
      lose: [
        { role: 'lingling', text: '已经很棒了！太阳、月亮都被你救了！' },
        { role: 'lingling', text: '我们先回去休息，下次再来挑战静默！' },
      ],
    },

    // §4.9 结局:天空恢复彩色。
    {
      id: 'ending',
      kind: 'ending',
      lines: [
        { role: 'villager', text: '千字谷的天空恢复了！' },
        { role: 'villager', text: '谢谢你，成长守护者！' },
        { role: 'lingling', text: '我们做到了！太阳、月亮、星星都回来了！' },
      ],
    },

    // §4.10 结算 + 悬念:灵灵持纸片的悬念台词(星尘/连击/成就数值不落数据,由 UI 实时结算)。
    {
      id: 'settle',
      kind: 'settle',
      summary: [
        { role: 'lingling', text: '静默逃跑时掉下了这个...' },
        { role: 'lingling', text: '上面画着山和树...' },
        { role: 'lingling', text: '大山那边有什么呢？' },
        { role: 'lingling', text: '下一章：大地的秘密！' },
      ],
    },
  ],
}
