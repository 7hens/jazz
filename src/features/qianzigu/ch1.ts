import type { Chapter } from './chapter'

/**
 * 千字谷 · 第 1 章《徐爷爷忘掉的名字》内容数据。
 * 主角 = 苏灵灵(玩家 = 无名搭档,无背景设定)。
 * 驱动机制:徐万年爷爷爱忘事 —— 说不出名字的东西就找不着、办不成(人物喜剧,非世界观规则)。
 * 角色映射:🦊→lingling(苏灵灵) / 🦥→xuwannian(徐万年) / 🦝→pixiaonao(皮小闹) / 📖→narrator(旁白)。
 * 无通用群众位 —— 每个出声者都有姓名(spec §4.1)。
 * 台词句长规则:单句去标点推荐 ≤18 汉字、硬线 ≤20;超 20 必按意群拆(ch1-script.test.ts 守卫)。
 * 场景结构遵循既有契约:每词两个连续 task scene(先 sound 后 shape),minCorrect 均 2;
 *  断点恰 3 个(词1 后 / 词2 后 / social 后);social 1 场;boss 1 场;ending + settle 各 1。
 * 因果链:房子(13)→ 门(7)→ 钥匙(14)→ 窗户(8)→ 台灯(19)。
 * 轻线:章末徐爷爷一句「这个我天天都记得的呀」= 唯一痕迹,不解释(见 spec §8.2)。
 */
export const CHAPTER_1: Chapter = {
  id: 1,
  title: '徐爷爷忘掉的名字',
  subtitle: '千字谷镇·第一天',
  emoji: '🏠',
  wordIds: [13, 7, 14, 8, 19],
  restoreOrder: [13, 13, 7, 7, 14, 14, 8, 8, 19, 19],
  scenes: [
    // 开场:旁白冷开场(第三人称)→ 苏灵灵自我介绍 → 撞见徐爷爷卡壳,立起「爱忘事」的人设。
    {
      id: 'open',
      kind: 'dialogue',
      lines: [
        { role: 'narrator', text: '早上的千字谷镇，风里飘着好听的拼音。' },
        { role: 'lingling', text: '早上好呀！我是苏灵灵——锵锵锵！' },
        { role: 'lingling', text: '今天我要去办一件大事，你跟我一起吧！' },
        { role: 'lingling', text: '诶？那不是徐爷爷吗？' },
        { role: 'lingling', text: '徐爷爷！你怎么站在路中间呀？' },
        { role: 'xuwannian', text: '我……我要去……去那个……' },
        { role: 'xuwannian', text: '……那个叫啥来着？' },
        { role: 'lingling', text: '诶？你连自己要干什么都忘啦？' },
        { role: 'xuwannian', text: '我忘了……我要去哪儿，要干啥。' },
        { role: 'lingling', text: '徐爷爷记性不太好，可我头一回见他忘成这样。' },
        { role: 'lingling', text: '没关系！咱们一个一个想起来！' },
      ],
    },

    // 词 1 房子(13)
    {
      id: 't1-sound',
      kind: 'task',
      title: '叫出「房子」· 声音',
      intro: [
        { role: 'lingling', text: '徐爷爷，你家在哪儿呀？' },
        { role: 'xuwannian', text: '我家……就是那个，住人的那个……' },
        { role: 'lingling', text: '哦！你是说「房子」！' },
        { role: 'lingling', text: 'fáng zi！房子！' },
        { role: 'lingling', text: '来，一起叫出它的名字！' },
      ],
      task: { wordId: 13, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't1-shape',
      kind: 'task',
      title: '认出「房子」· 字形',
      intro: [
        { role: 'lingling', text: '名字叫对了，你还认得出它的样子吗？' },
        { role: 'xuwannian', text: '认得出！快给我看看！' },
      ],
      task: { wordId: 13, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '房子！对，房子！我家就是那一栋！' },
        { role: 'lingling', text: '想起来啦！走，我们回家！' },
        // 自然断点前的休息提示(BreakScene 无台词槽,并入上一幕收尾)
        { role: 'lingling', text: '想继续吗？还是休息一下？' },
      ],
    },
    { id: 'br1', kind: 'break' },

    // 词 2 门(7)
    {
      id: 't2-sound',
      kind: 'task',
      title: '叫出「门」· 声音',
      intro: [
        { role: 'lingling', text: '到啦！这就是你家！' },
        { role: 'xuwannian', text: '太好了……可这门怎么一动不动呀？' },
        { role: 'lingling', text: '徐爷爷，你又忘了它叫什么吧？' },
        { role: 'xuwannian', text: '它……它叫什么来着？' },
        { role: 'lingling', text: '这个叫「门」！mén！' },
      ],
      task: { wordId: 7, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't2-shape',
      kind: 'task',
      title: '认出「门」· 字形',
      intro: [{ role: 'lingling', text: '再看看它长什么样！' }],
      task: { wordId: 7, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '门！对，是门！该往里推才对！' },
        { role: 'lingling', text: '哈哈，你刚才一直在往外拉呢！' },
      ],
    },
    { id: 'br2', kind: 'break' },

    // 社交事件:皮小闹冒失撞人 —— 苏灵灵怎么回应(后果式 3 选项)。
    {
      id: 'social-pixiaonao',
      kind: 'social',
      stage: { cast: ['lingling', 'pixiaonao'] },
      lines: [
        { role: 'lingling', text: '咦？皮小闹？你跑这么快干嘛——' },
        { role: 'pixiaonao', text: '让让让让让让——！' },
        { role: 'narrator', text: '咚！皮小闹一头撞在徐爷爷身上。' },
        { role: 'pixiaonao', text: '对、对不起！我不是故意的！', mood: 'scary' },
        { role: 'lingling', text: '哎呀，这可怎么办？' },
      ],
      options: [
        {
          id: 'a', text: '你怎么这么冒失！', emoji: '😠', consequence: 'bad',
          responder: 'pixiaonao', response: '我……我这就走开！',
        },
        {
          id: 'b', text: '没事没事，你没摔着吧？', emoji: '💕', consequence: 'good',
          responder: 'pixiaonao', response: '我没事！我帮你扶徐爷爷！',
        },
        {
          id: 'c', text: '（先去看看徐爷爷）', emoji: '🚶', consequence: 'neutral',
          responder: 'pixiaonao', response: '……那我先走了。',
        },
      ],
      goodOptionId: 'b',
      loop: [
        { role: 'lingling', text: '皮小闹更难过了……我们换句话说说？' },
        { role: 'lingling', text: '他还低着头呢，再试一次好不好？' },
      ],
      onGood: [
        { role: 'pixiaonao', text: '谢谢你！我帮你一起扶徐爷爷！', mood: 'happy' },
        { role: 'lingling', text: '你学会照顾别人的心情啦！' },
      ],
    },
    { id: 'br3', kind: 'break' },

    // 词 3 钥匙(14)
    {
      id: 't3-sound',
      kind: 'task',
      title: '叫出「钥匙」· 声音',
      intro: [
        { role: 'lingling', text: '门是认出来了，可它锁着呢。' },
        { role: 'xuwannian', text: '钥匙……钥匙就在我口袋里！' },
        { role: 'lingling', text: '那你快拿出来呀？' },
        { role: 'xuwannian', text: '可我说不出它叫啥，就摸不着它！' },
        { role: 'lingling', text: '它叫「钥匙」！yào shi！' },
      ],
      task: { wordId: 14, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't3-shape',
      kind: 'task',
      title: '认出「钥匙」· 字形',
      intro: [{ role: 'lingling', text: '再认认它的样子！' }],
      task: { wordId: 14, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '摸着了！钥匙！我这就开门！' },
        { role: 'narrator', text: '门开了。' },
      ],
    },

    // 词 4 窗户(8)
    {
      id: 't4-sound',
      kind: 'task',
      title: '叫出「窗户」· 声音',
      intro: [
        { role: 'lingling', text: '进屋啦！屋里怎么闷闷的？' },
        { role: 'xuwannian', text: '得透透气……那个透气的口子叫啥？' },
        { role: 'lingling', text: '叫「窗户」！chuāng hu！' },
      ],
      task: { wordId: 8, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't4-shape',
      kind: 'task',
      title: '认出「窗户」· 字形',
      intro: [{ role: 'lingling', text: '认认它！' }],
      task: { wordId: 8, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '窗户！开了！风进来啦！' },
        { role: 'pixiaonao', text: '哇！屋里一下子亮堂了！' },
      ],
    },

    // 词 5 台灯(19)—— 天黑了,全场唯一真夜戏
    {
      id: 't5-sound',
      kind: 'task',
      stage: { atmosphere: 'night' },
      title: '叫出「台灯」· 声音',
      intro: [
        { role: 'narrator', text: '天黑了，屋子里慢慢暗下来。' },
        { role: 'xuwannian', text: '我得点个亮……那个发光的叫啥？' },
        { role: 'lingling', text: '叫「台灯」！tái dēng！' },
      ],
      task: { wordId: 19, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't5-shape',
      kind: 'task',
      stage: { atmosphere: 'night' },
      title: '认出「台灯」· 字形',
      intro: [{ role: 'lingling', text: '最后再认一次！' }],
      task: { wordId: 19, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '台灯！亮了！' },
        { role: 'narrator', text: '小小的屋子，一下子暖了起来。' },
      ],
    },

    // BOSS:闹剧 —— 徐爷爷的记忆搅成一团,把 5 个名字一个个叫回来。
    {
      id: 'boss',
      kind: 'boss',
      intro: [
        { role: 'xuwannian', text: '哎哟……我今天忘得也太多了。' },
        { role: 'xuwannian', text: '门、钥匙、窗户……我全搅成一团了！' },
        { role: 'lingling', text: '别慌！咱们一个一个叫回来！' },
      ],
      maxWrong: 3,
      questionCount: 5,
      win: [
        { role: 'xuwannian', text: '都想起来了！房子、门、钥匙、窗户、台灯！', mood: 'happy' },
        { role: 'lingling', text: '一个都没落下！' },
      ],
      lose: [
        { role: 'lingling', text: '已经很棒啦！徐爷爷的记性得慢慢来。' },
        { role: 'lingling', text: '我们先歇歇，明天再来帮他！' },
      ],
    },

    // 结局:灯亮着,皮小闹咋呼,苏灵灵总括。
    {
      id: 'ending',
      kind: 'ending',
      lines: [
        { role: 'narrator', text: '徐爷爷家的窗户，亮起一盏暖黄的灯。' },
        { role: 'pixiaonao', text: '徐爷爷家的灯亮啦！' },
        { role: 'pixiaonao', text: '我明天还来帮忙！' },
        { role: 'lingling', text: '今天可真够忙的！' },
      ],
    },

    // 结算 + 轻线痕迹:徐爷爷忘了他「从没忘过」的东西。不解释。
    {
      id: 'settle',
      kind: 'settle',
      summary: [
        { role: 'lingling', text: '今天帮徐爷爷找回了五个名字！' },
        { role: 'lingling', text: '他高兴得直转圈呢。' },
        { role: 'xuwannian', text: '不对……这个我天天都记得的呀。' },
        { role: 'lingling', text: '徐爷爷？你说什么？' },
        { role: 'narrator', text: '徐爷爷没有回答。' },
      ],
    },
  ],
}
