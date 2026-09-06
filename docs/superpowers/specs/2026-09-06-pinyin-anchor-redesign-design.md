# 拼音短教单元锚点重构设计

> 日期:2026-09-06 · 状态:设计待审 · 所属:feature 轨(0.2.0 未发,修订 foundation-learning 交付质量)
>
> 关联:`docs/PLAN.md` feature 轨「拼音短教单元锚点重构」行;spec `2026-09-05-foundation-learning-design.md` §4.1/§8 为原始设计依据;现代码 `src/features/foundation/{catalogs,decompose,demo-blocks,teach-questions}.ts` 与对应测试。

## 1. 背景与问题

浏览器人工验收「拼音短教」词 1(鸡蛋 jī dàn)发现两问题:

1. **合体 chip 读整词**:演示「拆合」后每音节 chip(jī / dàn)点读均读整词「鸡蛋」,两 chip 发音相同,应各自读「鸡」「蛋」。
2. **不同单元共享同锚**:声母 `j` 与韵母 `i` 的砖卡 emoji 同为 🥚、点读同为「鸡蛋」,不可区分。验收建议:每声母/韵母独立 emoji、独立音。

全量审计(`catalogs` 遍历)确认问题 2 非个例,共 9 对跨轨同锚:

`m/ao` 猫 · `p/uo` 苹果 · `g/ou` 狗 · `h/ua` 花 · `l/ong` 龙 · `w/uei` 乌龟 · `y/ia` 鸭子 · `t/ai` 太阳 · `j/i` 鸡蛋

另有 emoji 撞字异(`t` 大象/`iang` 象、`ch` 车/`e` 汽车、`t/r/ai` 太阳/日)、跨单元读整词含他音(i 听不出 i)。

## 2. 根因

原始设计 spec §4.1 已定**每单元单字锚点**(示例 `b → bà 爸`, `ing → jīng 精`),实现却贪省直接拿 100 词整词当锚:

- 整词含多音节 → 单元朗读把目标音裹在他音里(i 锚「鸡蛋」听不出 i);
- 一词拆出两单元都锚同词 → emoji/读音必然撞轨(m 与 ao 同「猫」);
- `decompose` 音节不携带汉字索引 → 合体 chip 退读整词,读不出本音节的字。

## 3. 决策(与需求方确认)

- **单元卡读音标准 = 单字整音节锚**:声母是辅音单发不可靠,借「以该声母开头的单字音节」示范(j → 鸡 jī);韵母卡优先「整音节=该韵母的零声母字」、无则「含该韵母的单字」(i → 衣 yī)。TTS 直读汉字 zh-CN 稳,每单元听感独立。否定「严格呼读音」(TTS 无拼音输入,呼读音无规范单字,不可靠)。
- **合体 chip 读音 = 当前词该音节对应汉字**(鸡蛋 jī chip → 鸡、dàn chip → 蛋)。已扫 100 词,汉字数 ↔ 音节数 100/100 对齐,索引映射无死角。
- **砖卡保持通用单元卡语义**(spec §8 既定:砖 = 该单元独立锚点卡,点读锚字),不改为词内语境砖。

## 4. 结构改动

### 4.1 `catalogs.ts` — 锚点值重写(契约不变)

字段 `symbol/anchorPinyin/anchorHanzi/anchorEmoji` 不变,只换值。**23 声母 + 34 韵母全量重排**(见 §5 表),共性:

- `anchorHanzi` 一律单字;`anchorPinyin` 一律单音节(该字带调拼音)。
- 拼音轨内(声母 ∪ 韵母)锚汉字两两不同、锚 emoji 两两不同。
- 韵母锚须自拆归口恰好本单元(单音节 → 天然仅一个韵母,现「夹带第二韵母」歧义归零)。
- 声母锚音节须以该声母开头;`y`/`w` 例外(教学惯例列声母、算法零声母整音节),锚字拼音以 `y`/`w` 起头即可(`y → 羊 yáng`、`w → 网 wǎng`)。
- 声调 5 项、英语 26 项**不动**(非本问题范围;英语锚已全唯一)。

### 4.2 `decompose.ts` — 音节带汉字

`PinyinSyllable` 增 `hanzi: string`。`decomposeWord` 内拼音音节按序号与 `word.hanzi` 字符一一对应(`parts.pinyin[i].hanzi = [...word.hanzi][i]`,越界兜底空串)。零声母整音节(y/w)同取该位汉字。`unitsFor` 输出不变(不加新 unitKey)。英语分支不动。

### 4.3 `demo-blocks.ts` — 合体 chip 读音

拼音 `group.speak` 由整词 `word.hanzi` → 该音节 `s.hanzi`(空则退整词兜底)。砖 speak/emoji 照旧取 catalogs 锚(现独立单字)。标题整词朗读、英语轨、`TeachOverlay` 布局与点读路径全不动。

### 4.4 消费方验证

- `teach-questions.ts` 逻辑不动:锚现单字,题干/选项朗读自动 = 该字单音。
- 既有测试中 `ch/r/s → 车/日/伞` 断言保留(§5 表恰好沿用这三锚,不需改)。
- `decompose`/`unit-key-charset` 等完整性与全量拆解测试:锚换值不影响符号集,保持绿。

## 5. 锚点内容表(新)

> 图稿可再调,音/字/唯一性为硬约束。emoji 为 pinyin 轨内唯一;与英语轨重复(e.g. 🐰/🌙)不影响:两轨不同时上桌。

### 5.1 声母 23

| 单元 | 锚字 | 锚音 | emoji |
| :-- | :-- | :-- | :-- |
| b | 爸 | bà | 👨 |
| p | 盘 | pán | 🍽️ |
| m | 妈 | mā | 👩 |
| f | 饭 | fàn | 🍚 |
| d | 蛋 | dàn | 🥚 |
| t | 兔 | tù | 🐰 |
| n | 牛 | niú | 🐮 |
| l | 梨 | lí | 🍐 |
| g | 瓜 | guā | 🍈 |
| k | 口 | kǒu | 👄 |
| h | 花 | huā | 🌸 |
| j | 鸡 | jī | 🐔 |
| q | 球 | qiú | 🏀 |
| x | 鞋 | xié | 👟 |
| zh | 猪 | zhū | 🐷 |
| ch | 车 | chē | 🚗 |
| sh | 书 | shū | 📖 |
| r | 日 | rì | 🌞 |
| z | 足 | zú | 🦶 |
| c | 草 | cǎo | 🌿 |
| s | 伞 | sǎn | ☂️ |
| y | 羊 | yáng | 🐑 |
| w | 网 | wǎng | 🕸️ |

### 5.2 韵母 34

| 单元 | 锚字 | 锚音 | emoji | 拆解径 |
| :-- | :-- | :-- | :-- | :-- |
| a | 马 | mǎ | 🐴 | m+a |
| o | 哦 | ó | 😮 | 零声母 o |
| e | 鹅 | é | 🪿 | 零声母 e |
| i | 衣 | yī | 🧥 | y→i |
| u | 屋 | wū | 🏠 | w→u |
| ü | 鱼 | yú | 🐠 | y→ü |
| ai | 爱 | ài | ❤️ | 零声母 ai |
| ei | 黑 | hēi | ⚫ | h+ei |
| ao | 猫 | māo | 🐱 | m+ao |
| ou | 狗 | gǒu | 🐶 | g+ou |
| an | 山 | shān | ⛰️ | sh+an |
| en | 门 | mén | 🚪 | m+en |
| ang | 房 | fáng | 🏡 | f+ang |
| eng | 风 | fēng | 🌬️ | f+eng |
| ong | 龙 | lóng | 🐉 | l+ong |
| ia | 鸭 | yā | 🦆 | y→ia |
| ie | 蟹 | xiè | 🦀 | x+ie |
| iao | 鸟 | niǎo | 🐦 | n+iao |
| iou | 游 | yóu | 🏊 | y→iou |
| ian | 面 | miàn | 🍜 | m+ian |
| in | 心 | xīn | 💗 | x+in |
| iang | 象 | xiàng | 🐘 | x+iang |
| ing | 星 | xīng | ⭐ | x+ing |
| iong | 熊 | xióng | 🐻 | x+iong |
| ua | 蛙 | wā | 🐸 | w→ua |
| uo | 果 | guǒ | 🍎 | g+uo |
| uei | 龟 | guī | 🐢 | gui→uei |
| uan | 船 | chuán | ⛵ | ch+uan |
| uen | 蚊 | wén | 🦟 | w→uen |
| uang | 窗 | chuāng | 🪟 | ch+uang |
| üe | 雪 | xuě | ❄️ | x+üe(jqx u→ü) |
| üan | 圆 | yuán | ⭕ | y→üan |
| ün | 云 | yún | ☁️ | y→ün |
| ueng | 翁 | wēng | 👴 | w→ueng |

> 注:韵母锚带声母属「含该韵母的单字」回退(单音节即恰好一韵母,诚实无歧义);零声母/y-w 径为优先(读感更纯)。`üe` 锚「雪」走 jqx u→ü 规则,归口 `üe` 符号。

## 6. 测试策略

### 6.1 新增不变量(catalogs 单测)

- 声母∪韵母:锚汉字两两不同、锚 emoji 两两不同、锚汉字均单字、锚音均单音节。
- 韵母锚自拆(伪词 decompose)归口恰本单元:final 集合 == {symbol},无夹带。
- 声母锚(除 y/w)自拆 initial == symbol;y/w 锚字拼音以 y/w 起头。
- 音节汉字对齐:任一 100 词,`decomposeWord` 拼音逐音节 `hanzi` 与 `word.hanzi` 逐位相等。

### 6.2 demo-blocks 新增

- `鸡蛋`:两 chip 文本 `jī`/`dàn` 且 speak 分别「鸡」「蛋」;砖 j/i 锚 emoji/speak 各异。
- 单字词 chip speak == 整词;英语 chip speak == 字母名(回归)。

### 6.3 回归

`npm test` 全绿:既有 catalogs 完整性、100 词全量拆解、teach-questions(含 ch/r/s)、architecture 边界。锚换值不影响符号集与 3 层注册纪律。

## 7. 兼容与回滚

- 纯前端静态数据 + 拆解派生变更,**无 db/API/存储改动**;rollback = 旧代码回切即原样(锚退整词旧观感,不崩)。
- 短教期间产物(熟度/演示)不依赖锚内容;目录符号集不变,`basics_progress` 已存 unitKey 不受影响。
- emoji 与部分锚字(哦/蟹/翁 等)超出 100 词库属允许:spec §4.1 本就以常见儿童词/音节作锚,英文轨已先例(xylophone 等)。

## 8. 风险与开放项

- **TTS 单音节听感**:零声母/整读锚已规避孤立音素;个别锚(哦 ó、翁 wēng)非常用字,听感是否适合儿童待真机验收。
- **emoji 渲染**:🪿(鹅)在部分系统字库可能缺字,必要时换 🦢/手绘;验收时逐一过屏。
- **y/w 教学口径**:目录 y/w 属教学惯例(写作用声母),算法零声母;锚字以拼写为准,短教内 y/w 单元本就不由词拆解产出,冷启动若涉及另行确认。
