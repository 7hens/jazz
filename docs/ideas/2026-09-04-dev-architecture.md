# 📐 开发规范文档（最终版 v4.0）

> **版本**：v4.0（合并 v3.0 评审意见与 v2.0 修订）
> **适用项目**：魔法语言岛 / 魔法成长乐园
> **核心架构**：三层（shared → features → app），服务注册表解耦，Entry 组件模式
> **状态**：⚠️ 目标态提案，非当前代码事实源。所描述的 shared/features/app 三层 + 服务注册表 + IndexedDB/mock API 与现行结构（`worker/` + D1 + 单页 App.tsx 状态机）**不同**。事实源 = `CLAUDE.md`「架构」节 + 源码。

## 1. 架构总览

### 1.1 层级定义

```
┌─────────────────────────────────────────────┐
│              app/（调度层）                  │
│    状态机路由 + 服务注册 + 跨 feature 组装    │
│    零 Page、零业务流程                       │
├─────────────────────────────────────────────┤
│              features/（业务层）              │
│   每个 feature 自包含：组件+逻辑+数据+测试    │
│   编译期零依赖，运行期通过服务注册表解耦      │
│   页面型 feature 有 Entry（唯一 useService）  │
├─────────────────────────────────────────────┤
│              shared/（基础层）               │
│   服务接口 + 注册表 + 纯工具，零业务语义      │
└─────────────────────────────────────────────┘
```

### 1.2 依赖规则

| 层 | 可以依赖 | 禁止依赖 |
| ----- | --------- | --------- |
| `shared/` | 无 | 任何人 |
| `features/` | `shared/` | 其他 `features/`（编译期）、`app/` |
| `app/` | `shared/`、`features/` | 无 |

### 1.3 核心原则

```
1. features 之间零编译期 import
2. 跨 feature 通信 = 接口在 shared + 实现在 feature + 注册在 app
3. 纯逻辑被跨 feature 消费时，必须升级为服务
4. Page 属于 feature，app 不存放任何 Page
5. Entry 是 feature 内唯一调用 useService 的文件
6. shared 零业务语义
7. 服务依赖通过构造函数注入，注册顺序在 bootstrap 显式管理
```

## 2. 目录结构

```
src/
├── app/                          # 调度层（零 Page，零业务）
│   ├── App.tsx                   # 状态机路由 + 跨 feature 组装
│   ├── ErrorBoundary.tsx         # 错误边界
│   ├── bootstrap.ts              # 服务注册（唯一注册点）
│   ├── useAppState.ts            # 全局路由状态（phase、currentWordId）
│   └── useCompletedWords.ts      # 组装 hook（给 App 层用）
│
├── features/                     # 业务层（含各自 Entry/Page）
│   │
│   ├── vocabulary/               # 词库服务（服务型 feature）
│   │   ├── vocabulary.ts         # 实现 VocabularyService
│   │   ├── words.ts              # 100 词数据
│   │   ├── words.test.ts
│   │   └── index.ts
│   │
│   ├── question-engine/          # 出题引擎服务（服务型 feature）
│   │   ├── engine.ts             # 实现 QuestionEngineService
│   │   ├── engine.test.ts
│   │   └── index.ts
│   │
│   ├── lesson/                   # 学习单元（页面型 feature）
│   │   ├── LessonEntry.tsx       # Entry：组装子组件，useService
│   │   ├── WordLesson.tsx        # 纯 UI：答题器
│   │   ├── WordDone.tsx          # 纯 UI：结算卡
│   │   ├── lesson.ts             # 纯逻辑：步序/解锁（仅供本 feature 内部使用）
│   │   ├── lesson.test.ts
│   │   └── index.ts
│   │
│   ├── archipelago/              # 群岛主页（页面型 feature）
│   │   ├── HomeEntry.tsx         # Entry：主页组装
│   │   ├── ArchipelagoView.tsx   # 纯 UI：群岛地图
│   │   ├── CornerCard.tsx        # 子组件
│   │   ├── corners.ts            # 学习角定义（本 feature 数据）
│   │   └── index.ts
│   │
│   ├── settings/                 # 设置（页面型 feature）
│   │   ├── SettingsEntry.tsx     # Entry
│   │   ├── SettingsPanel.tsx     # 纯 UI
│   │   ├── settings.ts           # 校验逻辑（本 feature 内部）
│   │   └── index.ts
│   │
│   ├── speech/                   # 语音服务（服务型 feature）
│   │   ├── speech.ts             # 实现 SpeechService
│   │   └── index.ts
│   │
│   ├── combo/                    # 连击服务（服务型 feature）
│   │   ├── combo.ts              # 实现 ComboService
│   │   ├── ComboDisplay.tsx      # 特效文字 UI
│   │   └── index.ts
│   │
│   ├── api/                      # API 服务（服务型 feature）
│   │   ├── api.ts                # 实现 ApiService
│   │   └── index.ts
│   │
│   ├── celebrate/                # 撒花服务（服务型 feature）
│   │   ├── celebrate.ts          # 实现 CelebrateService
│   │   └── index.ts
│   │
│   ├── toast/                    # Toast 服务（服务型 feature）
│   │   ├── toast.ts              # 实现 ToastService
│   │   ├── ToastContainer.tsx    # 渲染容器
│   │   └── index.ts
│   │
│   ├── progress/                 # 进度服务（服务型 feature）
│   │   ├── progress.ts           # 实现 ProgressService
│   │   ├── progress.test.ts
│   │   └── index.ts
│   │
│   ├── lingling/                 # 灵灵吉祥物（纯 UI feature）
│   │   ├── LingLing.tsx
│   │   ├── lingling.css
│   │   └── index.ts
│   │
│   ├── story/                    # 故事节拍（数据+UI feature）
│   │   ├── story.ts              # 故事节点数据（本 feature 数据）
│   │   ├── StoryBeatModal.tsx    # 纯 UI
│   │   └── index.ts
│   │
│   └── achievements/             # 成就（数据+逻辑 feature）
│       ├── achievements.ts       # 成就定义（本 feature 数据）
│       ├── achievements.test.ts
│       ├── AchievementPopup.tsx  # 纯 UI
│       └── index.ts
│
├── shared/
│   ├── services/                 # 服务接口（一文件一接口）
│   │   ├── vocabulary.ts
│   │   ├── question-engine.ts
│   │   ├── speech.ts
│   │   ├── combo.ts
│   │   ├── api.ts
│   │   ├── celebrate.ts
│   │   ├── toast.ts
│   │   ├── progress.ts
│   │   ├── keys.ts
│   │   ├── map.ts
│   │   └── index.ts
│   │
│   ├── registry.ts               # 含 subscribe
│   ├── useService.ts             # useSyncExternalStore
│   ├── types.ts                  # WordUnit / Question / WordProgress
│   ├── db.ts                     # IndexedDB
│   └── utils.ts                  # shuffle / pick / todayKey
│
├── global.css
├── test-setup.ts
├── main.tsx
├── vite-env.d.ts
│
└── worker/                       # 后端（独立）
    ├── index.ts
    └── routes/
        ├── auth.ts
        ├── progress.ts
        └── settings.ts
```

## 3. Feature 分类

| 类型 | 特点 | 服务接口 | Entry | 示例 |
| ------ | ------ | --------- | ------- | ------ |
| **纯 UI** | 只展示，props 接收 | ❌ | ❌ | `lingling` |
| **纯数据** | 只提供数据查询 | ❌（不跨 feature） | ❌ | — |
| **服务型** | 运行时行为，跨 feature 消费 | ✅ | ❌ | `vocabulary`、`question-engine`、`speech`、`combo`、`api`、`celebrate`、`toast`、`progress` |
| **页面型** | 含 Entry，可 useService | 可选 | ✅ | `lesson`、`archipelago`、`settings` |
| **数据+UI** | 含自身数据 + UI，不跨 feature | ❌ | 可选 | `story`、`achievements` |

**关键规则**：**任何被跨 feature 消费的纯逻辑或数据，必须升级为服务。**

## 4. Entry 组件模式

### 4.1 Entry 定位

```
Entry 在 feature 内部
Entry 是 feature 内唯一调用 useService 的文件
Entry 负责组装本 feature 的子组件
Entry 接收导航回调（onExit、onNextWord 等）来自 App
```

### 4.2 LessonEntry 示例

```tsx
// features/lesson/LessonEntry.tsx
import { useService } from '@/shared/useService';
import { WordLesson } from './WordLesson';
import { WordDone } from './WordDone';

interface LessonEntryProps {
  wordId: number;
  onExit: () => void;          // 由 App 注入
  onNextWord: () => void;      // 由 App 注入
}

export function LessonEntry({ wordId, onExit, onNextWord }: LessonEntryProps) {
  // Entry 中获取所有需要的服务
  const vocabulary = useService('vocabulary');
  const engine = useService('question-engine');
  const combo = useService('combo');
  const speech = useService('speech');
  const progress = useService('progress');
  const celebrate = useService('celebrate');
  const toast = useService('toast');

  // 获取数据
  const word = vocabulary.wordById(wordId)!;
  const wordProgress = progress.getProgress(wordId);
  const distractors = engine.getDistractors(word, 3);

  // 预生成题目
  const questions = ['pinyin', 'hanzi', 'english'].flatMap(skill => [
    engine.generateQuestion(word, skill, distractors),
    engine.generateQuestion(word, skill, distractors),
  ]);

  // 组装纯 UI 子组件
  return (
    <WordLesson
      word={word}
      questions={questions}
      onCorrect={() => combo.increment()}
      onWrong={() => combo.reset()}
      onStepComplete={(skill, stars) => {
        progress.saveStep(wordId, skill, stars);
        celebrate.step();
      }}
      onWordComplete={() => celebrate.word()}
      onExit={onExit}
      onNextWord={onNextWord}
      speak={speech.speak}
      showToast={toast.success}
    />
  );
}
```

### 4.3 HomeEntry 示例

```tsx
// features/archipelago/HomeEntry.tsx
import { useService } from '@/shared/useService';
import { ArchipelagoView } from './ArchipelagoView';
import { CORNERS } from './corners';

interface HomeEntryProps {
  lingling?: React.ReactNode;    // 由 App 注入（跨 feature 组装）
  onEnterLesson: (wordId: number) => void;
  onOpenSettings: () => void;
}

export function HomeEntry({ lingling, onEnterLesson, onOpenSettings }: HomeEntryProps) {
  const progress = useService('progress');

  return (
    <ArchipelagoView
      corners={CORNERS}
      completedWords={progress.getCompletedWords()}
      lingling={lingling}
      onEnterLesson={onEnterLesson}
      onOpenSettings={onOpenSettings}
    />
  );
}
```

### 4.4 SettingsEntry 示例

```tsx
// features/settings/SettingsEntry.tsx
import { useService } from '@/shared/useService';
import { SettingsPanel } from './SettingsPanel';

interface SettingsEntryProps {
  onClose: () => void;
}

export function SettingsEntry({ onClose }: SettingsEntryProps) {
  const progress = useService('progress');
  const toast = useService('toast');

  const handleReset = () => {
    progress.resetAll();
    toast.success('进度已重置');
  };

  return <SettingsPanel onClose={onClose} onReset={handleReset} />;
}
```

## 5. 服务系统

### 5.1 服务接口清单

| 服务 | 接口文件 | 依赖注入 | 核心方法 |
| ------ | --------- | --------- | --------- |
| `vocabulary` | `vocabulary.ts` | 无 | `getAllWords()` `wordById(id)` |
| `question-engine` | `question-engine.ts` | `vocabulary` | `generateQuestion()` `getDistractors()` |
| `speech` | `speech.ts` | 无 | `speak()` `stop()` |
| `combo` | `combo.ts` | 无 | `increment()` `reset()` `getBonus()` |
| `api` | `api.ts` | 无 | `getProgress()` `saveProgress()` `getSettings()` `saveSettings()` |
| `celebrate` | `celebrate.ts` | 无 | `step()` `word()` `achievement()` `combo10()` |
| `toast` | `toast.ts` | 无 | `success()` `error()` `info()` |
| `progress` | `progress.ts` | `api` | `getProgress()` `saveStep()` `getCompletedWords()` `resetAll()` |

### 5.2 服务 Key

```typescript
// shared/services/keys.ts
export const SERVICE_KEYS = {
  VOCABULARY: 'vocabulary',
  QUESTION_ENGINE: 'question-engine',
  SPEECH: 'speech',
  COMBO: 'combo',
  API: 'api',
  CELEBRATE: 'celebrate',
  TOAST: 'toast',
  PROGRESS: 'progress',
} as const;

export type ServiceKey = (typeof SERVICE_KEYS)[keyof typeof SERVICE_KEYS];
```

### 5.3 ServiceMap

```typescript
// shared/services/map.ts
import type { VocabularyService } from './vocabulary';
import type { QuestionEngineService } from './question-engine';
import type { SpeechService } from './speech';
import type { ComboService } from './combo';
import type { ApiService } from './api';
import type { CelebrateService } from './celebrate';
import type { ToastService } from './toast';
import type { ProgressService } from './progress';

export interface ServiceMap {
  'vocabulary': VocabularyService;
  'question-engine': QuestionEngineService;
  'speech': SpeechService;
  'combo': ComboService;
  'api': ApiService;
  'celebrate': CelebrateService;
  'toast': ToastService;
  'progress': ProgressService;
}
```

### 5.4 注册表

```typescript
// shared/registry.ts
const services = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

export const registry = {
  register<T>(key: string, instance: T): void {
    services.set(key, instance);
    listeners.get(key)?.forEach(fn => fn());
  },

  get<T>(key: string): T {
    const s = services.get(key);
    if (!s) throw new Error(`[registry] 服务未注册: ${key}`);
    return s as T;
  },

  has(key: string): boolean {
    return services.has(key);
  },

  subscribe(key: string, callback: () => void): () => void {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(callback);
    return () => listeners.get(key)?.delete(callback);
  },

  clear(): void {
    services.clear();
    listeners.forEach(set => set.clear());
  },
};
```

### 5.5 Hook

```typescript
// shared/useService.ts
import { useSyncExternalStore, useCallback } from 'react';
import { registry } from './registry';
import type { ServiceMap } from './services/map';
import type { ServiceKey } from './services/keys';

export function useService<K extends ServiceKey>(key: K): ServiceMap[K] {
  const subscribe = useCallback(
    (callback: () => void) => registry.subscribe(key, callback),
    [key]
  );
  const getSnapshot = useCallback(
    () => registry.get<ServiceMap[K]>(key),
    [key]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getService<K extends ServiceKey>(key: K): ServiceMap[K] {
  return registry.get<ServiceMap[K]>(key);
}
```

### 5.6 注册顺序（bootstrap.ts）

```typescript
// app/bootstrap.ts
import { registry } from '@/shared/registry';
import { SERVICE_KEYS } from '@/shared/services/keys';
import { createVocabularyService } from '@/features/vocabulary';
import { createQuestionEngineService } from '@/features/question-engine';
import { createWebSpeechService, createSilentSpeechService } from '@/features/speech';
import { createHttpApiService, createMockApiService } from '@/features/api';
import { createComboService } from '@/features/combo';
import { createCelebrateService } from '@/features/celebrate';
import { createToastService } from '@/features/toast';
import { createProgressService } from '@/features/progress';

export function bootstrap() {
  // Layer 1：无依赖服务
  const vocabulary = createVocabularyService();
  registry.register(SERVICE_KEYS.VOCABULARY, vocabulary);

  registry.register(
    SERVICE_KEYS.SPEECH,
    'speechSynthesis' in window
      ? createWebSpeechService()
      : createSilentSpeechService()
  );

  registry.register(
    SERVICE_KEYS.API,
    import.meta.env.VITE_USE_MOCK_API === 'true'
      ? createMockApiService()
      : createHttpApiService(import.meta.env.VITE_API_BASE_URL || '')
  );

  registry.register(SERVICE_KEYS.COMBO, createComboService());
  registry.register(SERVICE_KEYS.CELEBRATE, createCelebrateService());
  registry.register(SERVICE_KEYS.TOAST, createToastService());

  // Layer 2：有依赖的服务
  registry.register(
    SERVICE_KEYS.QUESTION_ENGINE,
    createQuestionEngineService(vocabulary)
  );

  const api = registry.get(SERVICE_KEYS.API);
  registry.register(
    SERVICE_KEYS.PROGRESS,
    createProgressService(api)
  );
}
```

## 6. App 层规范

### 6.1 App.tsx（调度 + 跨 feature 组装）

```tsx
// app/App.tsx
import { ErrorBoundary } from './ErrorBoundary';
import { useAppState } from './useAppState';
import { useCompletedWords } from './useCompletedWords';
import { HomeEntry } from '@/features/archipelago';
import { LessonEntry } from '@/features/lesson';
import { SettingsEntry } from '@/features/settings';
import { ToastContainer } from '@/features/toast';
import { LingLing } from '@/features/lingling';

export default function App() {
  const { phase, currentWordId, actions } = useAppState();
  const completedWords = useCompletedWords();  // 组装 hook

  return (
    <ErrorBoundary>
      {phase === 'home' && (
        <HomeEntry
          lingling={<LingLing completedWords={completedWords} totalWords={100} />}
          onEnterLesson={actions.enterLesson}
          onOpenSettings={actions.openSettings}
        />
      )}
      {phase === 'lesson' && currentWordId !== null && (
        <LessonEntry
          wordId={currentWordId}
          onExit={actions.exitToHome}
          onNextWord={actions.nextWord}
        />
      )}
      {phase === 'settings' && (
        <SettingsEntry onClose={actions.closeSettings} />
      )}
      <ToastContainer />
    </ErrorBoundary>
  );
}
```

**App 层职责**：

- ✅ 状态机路由
- ✅ 跨 feature 组装（LingLing 注入 HomeEntry）
- ✅ 组装 hook（useCompletedWords）
- ❌ 不含业务流程逻辑（出题、结算、规则）
- ❌ 不含 Page 组件（Page 在 feature 内）

### 6.2 组装 Hook

```typescript
// app/useCompletedWords.ts
import { useService } from '@/shared/useService';

export function useCompletedWords(): number {
  const progress = useService('progress');
  return progress.getCompletedWords();
}
```

**规则**：App 中的组装逻辑提取为 hook 而不是内联，保持 App.tsx 干净。

### 6.3 useAppState

```typescript
// app/useAppState.ts
type AppPhase = 'home' | 'lesson' | 'settings';

interface AppState {
  phase: AppPhase;
  currentWordId: number | null;
  actions: {
    enterLesson: (wordId: number) => void;
    exitToHome: () => void;
    nextWord: () => void;
    openSettings: () => void;
    closeSettings: () => void;
  };
}

export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('home');
  const [currentWordId, setCurrentWordId] = useState<number | null>(null);

  const actions = {
    enterLesson: (wordId: number) => { setCurrentWordId(wordId); setPhase('lesson'); },
    exitToHome: () => setPhase('home'),
    nextWord: () => setCurrentWordId(id => (id !== null ? id + 1 : null)),
    openSettings: () => setPhase('settings'),
    closeSettings: () => setPhase('home'),
  };

  return { phase, currentWordId, actions };
}
```

## 7. 纯 UI 组件示例

### 7.1 WordLesson（纯 UI）

```tsx
// features/lesson/WordLesson.tsx
import type { WordUnit, Question, Skill } from '@/shared/types';

interface WordLessonProps {
  word: WordUnit;
  questions: Question[];
  onCorrect: () => void;
  onWrong: () => void;
  onStepComplete: (skill: Skill, stars: number) => void;
  onWordComplete: () => void;
  onExit: () => void;
  onNextWord: () => void;
  speak: (text: string, lang: 'zh-CN' | 'en-US') => void;
  showToast: (message: string) => void;
}

export function WordLesson(props: WordLessonProps) {
  // 一切通过 props
  // 不调用 useService
  // 不 import 其他 feature
}
```

### 7.2 LingLing（纯 UI）

```tsx
// features/lingling/LingLing.tsx
import './lingling.css';

interface LingLingProps {
  completedWords: number;
  totalWords: number;
}

export function LingLing({ completedWords, totalWords }: LingLingProps) {
  const state = getLingLingState(completedWords, totalWords);
  return (
    <div className={`lingling-${state.animation}`}>
      {state.emoji}
      <p>{state.text}</p>
    </div>
  );
}

function getLingLingState(completedWords: number, totalWords: number) {
  const pct = completedWords / totalWords;
  if (pct < 0.1) return { emoji: '😴', animation: 'sleeping', text: '灵灵在睡觉...' };
  if (pct < 0.3) return { emoji: '🦊', animation: 'bounce', text: '好耶！继续加油！' };
  if (pct < 0.5) return { emoji: '🦊✨', animation: 'wiggle', text: '你太厉害了！' };
  if (pct < 0.8) return { emoji: '🌟', animation: 'glow', text: '魔法快恢复了！' };
  return { emoji: '🦊👑', animation: 'fly', text: '你是我的英雄！' };
}
```

## 8. 服务实现示例

### 8.1 VocabularyService

```typescript
// shared/services/vocabulary.ts
import type { WordUnit } from '../types';

export interface VocabularyService {
  getAllWords(): WordUnit[];
  wordById(id: number): WordUnit | undefined;
}
```

```typescript
// features/vocabulary/vocabulary.ts
import type { VocabularyService } from '@/shared/services/vocabulary';
import { WORDS } from './words';

export function createVocabularyService(): VocabularyService {
  return {
    getAllWords() { return WORDS; },
    wordById(id) { return WORDS.find(w => w.id === id); },
  };
}
```

### 8.2 QuestionEngineService

```typescript
// shared/services/question-engine.ts
import type { WordUnit, Question, Skill } from '../types';
import type { VocabularyService } from './vocabulary';

export interface QuestionEngineService {
  generateQuestion(
    word: WordUnit,
    skill: Skill,
    distractors: WordUnit[],
  ): Question;

  getDistractors(word: WordUnit, count: number): WordUnit[];
}
```

```typescript
// features/question-engine/engine.ts
import type { QuestionEngineService } from '@/shared/services/question-engine';
import type { VocabularyService } from '@/shared/services/vocabulary';
import { shuffle } from '@/shared/utils';

export function createQuestionEngineService(vocabulary: VocabularyService): QuestionEngineService {
  return {
    generateQuestion(word, skill, distractors) {
      // 出题逻辑
    },

    getDistractors(word, count) {
      const allWords = vocabulary.getAllWords();
      const sameCategory = allWords.filter(
        w => w.category === word.category && w.id !== word.id
      );
      return shuffle(sameCategory).slice(0, count);
    },
  };
}
```

## 9. 命名规范

| 项 | 规范 | 示例 |
| ----- | ------ | ------ |
| 文件夹 | kebab-case | `question-engine/` |
| 组件文件 | PascalCase.tsx | `WordLesson.tsx` |
| Entry 组件 | `<Name>Entry.tsx` | `LessonEntry.tsx` |
| 逻辑文件 | camelCase.ts | `engine.ts` |
| 服务实现 | `<name>.ts` + `create<Name>Service` | `speech.ts` → `createWebSpeechService` |
| 服务接口 | `<Name>Service` | `SpeechService` |
| 服务 Key | `SERVICE_KEYS.<UPPER_SNAKE>` | `SERVICE_KEYS.SPEECH` |
| 测试文件 | `<name>.test.ts` | `engine.test.ts` |
| 类型/接口 | PascalCase | `WordUnit` |
| 常量 | UPPER_SNAKE_CASE | `WORDS` |

## 10. Import 规范

### 允许

```typescript
// features 中 import shared
import type { WordUnit } from '@/shared/types';
import { shuffle } from '@/shared/utils';
import type { SpeechService } from '@/shared/services/speech';

// Entry 中 useService
import { useService } from '@/shared/useService';

// app 中 import features + shared
import { LessonEntry } from '@/features/lesson';
import { useService } from '@/shared/useService';

// 同 feature 内部
import { StepFlow } from './StepFlow';
```

### 禁止

```typescript
// features 之间 import
import { getCombo } from '@/features/combo';

// 深层相对路径
import { xxx } from '../../features/xxx';

// 直接 import 其他 feature 内部文件
import { StepFlow } from '@/features/lesson/StepFlow';

// 非 Entry 组件调用 useService
// features/lesson/WordLesson.tsx 中 ❌ useService(...)

// feature 中 import app
import { useAppState } from '@/app/useAppState';
```

## 11. 样式规范

| 项 | 方案 |
| ----- | ------ |
| 主要样式 | Tailwind 4（`@tailwindcss/vite`） |
| 特殊动画 | CSS 文件，与组件同目录 |
| 全局样式 | `src/global.css`（CSS变量 + 通用动画） |
| 不跨 feature 引用样式 | 每 feature 独立 |

```css
/* features/lingling/lingling.css */
@keyframes lingling-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.lingling-bounce { animation: lingling-bounce 2s infinite; }
```

## 12. 环境变量

```typescript
// vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK_API: string;
}
```

**规则**：

- 所有环境变量以 `VITE_` 前缀
- **只在 `app/bootstrap.ts` 中读取**
- 通过服务注册表将配置传递给各 feature

## 13. 测试规范

### 13.1 测试位置

```
features/<name>/<name>.test.ts    # 与源文件同目录
```

### 13.2 测试 Setup

```typescript
// src/test-setup.ts
import { registry } from '@/shared/registry';
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => registry.clear());
afterEach(() => registry.clear());
```

### 13.3 测试分类

| 类型 | 方式 | 覆盖 |
| ------ | ------ | ------ |
| 纯逻辑 | 直接调用 | 引擎、步序、结算 |
| 数据完整性 | 直接断言 | 数量、ID连续、唯一性 |
| 服务实现 | 直接调用工厂函数 | 行为正确 |
| 纯 UI 组件 | React Testing Library + Mock props | 渲染正确、回调触发 |
| Entry 组件 | Mock registry + 渲染 | 服务获取、子组件组装 |

### 13.4 UI 组件测试示例

```tsx
// features/lesson/WordLesson.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { WordLesson } from './WordLesson';

it('答对时触发 onCorrect', () => {
  const onCorrect = vi.fn();
  render(<WordLesson {...baseProps} onCorrect={onCorrect} />);

  fireEvent.click(screen.getByText('sun'));
  expect(onCorrect).toHaveBeenCalledTimes(1);
});
```

### 13.5 Entry 组件测试示例

```tsx
// features/lesson/LessonEntry.test.tsx
import { registry } from '@/shared/registry';
import { SERVICE_KEYS } from '@/shared/services/keys';

beforeEach(() => {
  registry.register(SERVICE_KEYS.VOCABULARY, createMockVocabulary());
  registry.register(SERVICE_KEYS.QUESTION_ENGINE, createMockEngine());
  // ...
});

it('组装子组件', () => {
  render(<LessonEntry wordId={1} onExit={vi.fn()} onNextWord={vi.fn()} />);
  expect(screen.getByText('太阳')).toBeInTheDocument();
});
```

## 14. 新增 Feature 流程

### 14.1 纯 UI Feature

```bash
mkdir -p src/features/<name>
touch src/features/<name>/<Name>.tsx
touch src/features/<name>/index.ts
# 如果被 App 直接使用，在 App.tsx 中 import
```

### 14.2 服务型 Feature

```bash
# 1. 接口
touch src/shared/services/<name>.ts

# 2. Key
# 在 shared/services/keys.ts 中添加

# 3. Map
# 在 shared/services/map.ts 中添加

# 4. 导出
# 在 shared/services/index.ts 中添加

# 5. 实现
mkdir -p src/features/<name>
touch src/features/<name>/<name>.ts
# create<Name>Service()

# 6. 注册
# 在 app/bootstrap.ts 中注册
```

### 14.3 页面型 Feature

```bash
# 1. 创建文件夹
mkdir -p src/features/<name>

# 2. Entry
touch src/features/<name>/<Name>Entry.tsx

# 3. 子组件
touch src/features/<name>/<Component>.tsx

# 4. index.ts

# 5. App.tsx 中添加路由
# {phase === '<name>' && <NameEntry ... />}
```

## 15. 删除 Feature 流程

```bash
# 1. 搜索引用
grep -r "features/<name>" src/ --include="*.ts" --include="*.tsx"

# 2. 移除 App 中的路由/组装
# 3. 服务型：移除 shared/services 中的接口/Key/Map/导出，bootstrap 注册
# 4. 删除文件夹
rm -rf src/features/<name>

# 5. 验证
npm test && npx tsc -b && npm run lint
```

## 16. 检查清单

### 依赖

```bash
# features 之间零 import
grep -r "from '@/features/" src/features/ --include="*.ts" --include="*.tsx"
# 必须为空

# features 不 import app
grep -r "from '@/app" src/features/ --include="*.ts" --include="*.tsx"
# 必须为空
```

### 代码审查

```
□ 命名符合规范
□ 有 index.ts 且只导出公共 API
□ 使用 @/ 别名
□ 纯 UI 不调用 useService
□ Entry 是唯一 useService 的文件
□ 服务接口在 shared/services/ 中
□ 服务注册在 app/bootstrap.ts
□ 纯逻辑有单元测试
□ tsc -b 通过
□ lint 通过
```

### Entry

```
□ 位于 feature 文件夹内
□ 不 import 其他 features
□ 接收导航回调来自 App
□ 组装本 feature 子组件
```

### App.tsx

```
□ 不含 Page 组件
□ 不含业务流程逻辑
□ 可含跨 feature 组装（如 LingLing）
□ < 50 行
```

## 17. 反模式清单

| 反模式 | 正确做法 |
| -------- | --------- |
| `features/a/` import `features/b/` | 服务注册表解耦 |
| 非 Entry 组件调用 `useService` | 通过 props 接收 |
| app 中包含 Page | Page 在 feature 内 |
| Entry import 其他 feature | useService |
| 纯逻辑被消费但不做服务 | 升级为服务型 feature |
| 环境变量散落各 feature | 集中 bootstrap |
| 服务接口一文件多接口 | 一文件一接口 |
| `App.tsx` 写业务逻辑 | 放 feature 内 |
| 多处 `registry.register` | 仅 bootstrap |

## 18. 总结

```
最终架构：

app/ = 调度器
  ├── bootstrap.ts     → 服务注册（分 Layer，显式依赖顺序）
  ├── App.tsx          → 状态机路由 + 跨 feature 组装
  ├── useAppState.ts   → 路由状态
  └── useXxx.ts        → 组装 hook

features/ = 业务模块
  ├── 纯 UI         → props 接收一切，零 useService
  ├── 服务型        → create<Name>Service() 工厂
  ├── 页面型        → Entry 组件（唯一 useService）
  └── 数据+UI       → 含自身数据，不跨 feature

shared/ = 基础层
  ├── services/       → 接口定义（一文件一接口）
  ├── registry.ts     → 含 subscribe
  ├── useService.ts   → useSyncExternalStore
  └── utils           → 纯工具

核心规则：
1. Page 跟 feature 走
2. Entry 是 useService 的唯一位置
3. 纯逻辑被跨 feature 消费 → 升级为服务
4. 服务依赖 → 构造函数注入，bootstrap 控制顺序
5. 编译期零依赖，运行期靠注册表
6. App 只做：路由 + 注册 + 跨 feature 组装
```
