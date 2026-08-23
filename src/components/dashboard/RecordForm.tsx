import { Sparkles } from 'lucide-react'

import type { RecordFormData, RecordType } from '../../types'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type RecordFormProps = {
  recordType: RecordType
  form: RecordFormData
  error: string
  onTypeChange: (type: RecordType) => void
  onFieldChange: (field: keyof RecordFormData, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function RecordForm({ recordType, form, error, onTypeChange, onFieldChange, onSubmit }: RecordFormProps) {
  const renderMiniForm = () => {
    if (recordType === 'expense') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">日期</Label>
            <Input id="date" type="date" value={form.date} onChange={(event) => onFieldChange('date', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">金额</Label>
            <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(event) => onFieldChange('amount', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">分类</Label>
            <select
              id="category"
              className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={form.category}
              onChange={(event) => onFieldChange('category', event.target.value)}
            >
              <option>餐饮</option>
              <option>购物</option>
              <option>交通</option>
              <option>娱乐</option>
              <option>生活</option>
              <option>医疗</option>
              <option>其他</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expense-note">备注</Label>
            <Input id="expense-note" value={form.note} placeholder="例如：早餐、电影票、副食品" onChange={(event) => onFieldChange('note', event.target.value)} />
          </div>
        </div>
      )
    }

    if (recordType === 'weight') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weight-date">日期</Label>
            <Input id="weight-date" type="date" value={form.date} onChange={(event) => onFieldChange('date', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight-value">体重（kg）</Label>
            <Input id="weight-value" type="number" step="0.1" min="20" max="300" placeholder="68.5" value={form.weight} onChange={(event) => onFieldChange('weight', event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="weight-note">备注</Label>
            <Input id="weight-note" value={form.note} placeholder="例如：晨间空腹、运动后" onChange={(event) => onFieldChange('note', event.target.value)} />
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exercise-date">日期</Label>
          <Input id="exercise-date" type="date" value={form.date} onChange={(event) => onFieldChange('date', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-type">运动类型</Label>
          <select
            id="exercise-type"
            className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={form.exerciseType}
            onChange={(event) => onFieldChange('exerciseType', event.target.value)}
          >
            <option>跑步</option>
            <option>健身</option>
            <option>骑行</option>
            <option>游泳</option>
            <option>散步</option>
            <option>瑜伽</option>
            <option>其他</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-duration">时长（分钟）</Label>
          <Input id="exercise-duration" type="number" min="1" value={form.duration} onChange={(event) => onFieldChange('duration', event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-calories">热量（kcal）</Label>
          <Input id="exercise-calories" type="number" min="0" value={form.calories} onChange={(event) => onFieldChange('calories', event.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="exercise-note">备注</Label>
          <Input id="exercise-note" value={form.note} placeholder="例如：胸肌训练、轻松晨跑" onChange={(event) => onFieldChange('note', event.target.value)} />
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新增记录</CardTitle>
        <CardDescription>所有数据都保存在带用户隔离的 D1 数据库中。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex flex-wrap gap-2">
          {(['expense', 'weight', 'exercise'] as RecordType[]).map((type) => (
            <Button
              key={type}
              type="button"
              variant={recordType === type ? 'default' : 'secondary'}
              onClick={() => onTypeChange(type)}
              className="rounded-full"
            >
              {type === 'expense' ? '记账' : type === 'weight' ? '体重' : '运动'}
            </Button>
          ))}
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          {renderMiniForm()}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit">
              <Sparkles className="mr-2 h-4 w-4" />
              保存记录
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
