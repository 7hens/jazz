import { Bike, CheckCircle2, Dumbbell, Flower2, Footprints, Waves, type LucideIcon } from 'lucide-react'
import { exercises, type ExerciseGuide } from '../../data/exercises'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

const iconMap: Record<string, LucideIcon> = {
  running: Footprints,
  strength: Dumbbell,
  cycling: Bike,
  swimming: Waves,
  yoga: Flower2,
  walking: Footprints,
}

function ExerciseCard({ guide }: { guide: ExerciseGuide }) {
  const Icon = iconMap[guide.id] ?? Dumbbell
  return (
    <Card className="transition-shadow hover:shadow-pop">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-tint text-violet">
              <Icon className="h-5 w-5" />
            </span>
            <CardTitle>{guide.name}</CardTitle>
          </div>
          <Badge variant="purple">{guide.sets}</Badge>
        </div>
        <CardDescription>目标: {guide.target}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h4 className="mb-2.5 text-sm font-semibold text-ink">动作步骤</h4>
          <ol className="space-y-2 text-sm text-ink-2">
            {guide.steps.map((step, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold tabular-nums text-accent-ink">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="mb-2.5 text-sm font-semibold text-ink">注意事项</h4>
          <ul className="space-y-2 text-sm text-ink-2">
            {guide.tips.map((tip, index) => (
              <li key={index} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export function ExerciseTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">动作要领与建议，帮助你科学运动。运动数据不做记录。</p>
        <Badge variant="purple" className="inline-flex shrink-0 items-center gap-2">
          <Dumbbell className="h-3.5 w-3.5" />
          {exercises.length} 项
        </Badge>
      </div>
      <section className="grid gap-6 md:grid-cols-2">
        {exercises.map((guide) => (
          <ExerciseCard key={guide.id} guide={guide} />
        ))}
      </section>
    </div>
  )
}
