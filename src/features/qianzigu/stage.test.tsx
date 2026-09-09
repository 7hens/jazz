import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScenePanel, StageCast, StageFrame, StageSky } from './stage'

describe('ScenePanel', () => {
  it('渲染内容于可滚动浮层(自身无按钮)', () => {
    const { container } = render(
      <StageFrame>
        <ScenePanel><span>答题卡内容</span></ScenePanel>
      </StageFrame>,
    )
    expect(screen.getByText('答题卡内容')).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('StageSky 实景布景', () => {
  it('烧焦蛋档渲染 .stage-sun--burnt;词点灯条不再存在', () => {
    const { container } = render(<StageSky atmosphere="dawn" fraction={0} />)
    // 氛围底仍在(atmosphereToClass)
    expect(container.querySelector('.stage-sky--dawn')).not.toBeNull()
    // 太阳位 = 烧焦蛋档(进度 0)
    expect(container.querySelector('.stage-sun--burnt')).not.toBeNull()
    // 词 emoji 点灯条退役:不再渲染任何 .stage-word
    expect(container.querySelector('.stage-word')).toBeNull()
  })

  it('太阳档随 fraction 进阶:burnt → crack → glow → full', () => {
    const at = (fraction: number) => render(<StageSky atmosphere="dawn" fraction={fraction} />).container
    expect(at(0).querySelector('.stage-sun--burnt')).not.toBeNull()
    expect(at(0.2).querySelector('.stage-sun--crack')).not.toBeNull()
    expect(at(0.5).querySelector('.stage-sun--glow')).not.toBeNull()
    expect(at(0.8).querySelector('.stage-sun--full')).not.toBeNull()
    expect(at(1).querySelector('.stage-sun--full')).not.toBeNull()
  })

  it('月星在 showMoonStars true 时出现、false 时消失', () => {
    const yes = render(<StageSky atmosphere="dawn" fraction={0} />)
    expect(yes.container.querySelector('[data-sky-bodies]')).not.toBeNull()
    const no = render(<StageSky atmosphere="day" fraction={1} />)
    expect(no.container.querySelector('[data-sky-bodies]')).toBeNull()
  })

  it('真夜(night/dark)太阳隐、月星显(靠 moonStars 表现)', () => {
    const night = render(<StageSky atmosphere="night" fraction={1} />)
    expect(night.container.querySelector('[data-sun]')).toBeNull()
    expect(night.container.querySelector('[data-sky-bodies]')).not.toBeNull()
    const dark = render(<StageSky atmosphere="dark" fraction={0} />)
    expect(dark.container.querySelector('[data-sun]')).toBeNull()
    expect(dark.container.querySelector('[data-sky-bodies]')).not.toBeNull()
  })

  it('可显式注入 sun 档与 moonStars(sky 分流接线用)', () => {
    const { container } = render(<StageSky atmosphere="day" fraction={0} sun="full" moonStars={false} />)
    // day + fraction=0 默认应是 burnt;显式 sun="full" 覆盖
    expect(container.querySelector('.stage-sun--full')).not.toBeNull()
    expect(container.querySelector('.stage-sun--burnt')).toBeNull()
    expect(container.querySelector('[data-sky-bodies]')).toBeNull()
  })
})

describe('StageCast', () => {
  it('按 cast 站队出名字牌;说者高亮 accent,听者灰', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun']} speaker="sun" />,
    )
    const names = Array.from(container.querySelectorAll('span')).map((n) => n.textContent)
    expect(names).toContain('灵灵')
    expect(names).toContain('太阳')
    // sun 说者高亮 class(accent),灵灵听者灰
    const badges = container.querySelectorAll('span')
    const speakerTag = Array.from(badges).find((b) => b.textContent === '太阳')!
    const listenerTag = Array.from(badges).find((b) => b.textContent === '灵灵')!
    expect(speakerTag.className).toContain('bg-accent')
    expect(listenerTag.className).toContain('bg-ink/60')
  })

  it('bubble 仅渲染在当前说话者上方', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun']} speaker="sun" bubble={<span>救救我</span>} />,
    )
    expect(screen.getByText('救救我')).toBeInTheDocument()
    // 气泡数量 = 1(只在说话者列)
    expect(container.querySelectorAll('[data-stage-bubble]').length).toBe(1)
  })

  it('sky 分流:天空体绝不占地面行;说者(天空体)泡/名牌锚天幕,静默天空体零多余 DOM', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun', 'moon']} sky={['sun', 'moon']} speaker="sun" bubble={<span>救救我</span>} />,
    )
    // 地面行只留 ground(灵灵);天空体(太阳/月亮)不落地
    const ground = container.querySelector('[data-stage-ground]')!
    expect(ground).not.toBeNull()
    const groundNames = Array.from(ground.querySelectorAll('span')).map((n) => n.textContent)
    expect(groundNames).toContain('灵灵')
    expect(groundNames).not.toContain('太阳')
    expect(groundNames).not.toContain('月亮')
    // 顶栏槽退役:不再渲染 [data-stage-sky] 重复小头像槽(§15.4 无双太阳)
    expect(container.querySelector('[data-stage-sky]')).toBeNull()
    // 说者是天空体(太阳)时:泡 + 名牌锚天幕位;泡只一个,静默月亮零重复头像
    expect(screen.getByText('救救我')).toBeInTheDocument()
    const skySpeaker = container.querySelector('[data-stage-sky-speaker]')!
    expect(skySpeaker).not.toBeNull()
    expect(skySpeaker.textContent).toContain('太阳')
    expect(container.querySelectorAll('[data-stage-bubble]').length).toBe(1)
    expect(container.textContent).not.toContain('月亮')
  })
})
