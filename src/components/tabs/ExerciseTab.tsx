import { Dumbbell } from 'lucide-react'
import { exercises, type ExerciseGuide } from '../../data/exercises'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

function ExerciseCard({ guide }: { guide: ExerciseGuide }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{guide.name}</CardTitle>
          <Badge variant="secondary">{guide.sets}</Badge>
        </div>
        <CardDescription>目标: {guide.target}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">动作步骤</h4>
          <ol className="space-y-1.5 text-sm text-slate-600">
            {guide.steps.map((step, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-medium text-slate-400">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">注意事项</h4>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {guide.tips.map((tip, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-emerald-500">•</span>
                <span>{tip}</span>
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
      <Card>
        <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>运动指导</CardTitle>
            <CardDescription>动作要领与建议,帮助你科学运动。运动数据不做记录。</CardDescription>
          </div>
          <Badge variant="secondary" className="inline-flex items-center gap-2">
            <Dumbbell className="h-3.5 w-3.5" />
            {exercises.length} 项
          </Badge>
        </CardHeader>
      </Card>
      <section className="grid gap-6 md:grid-cols-2">
        {exercises.map((guide) => (
          <ExerciseCard key={guide.id} guide={guide} />
        ))}
      </section>
    </div>
  )
}
