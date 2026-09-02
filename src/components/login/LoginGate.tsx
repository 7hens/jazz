import { type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type Props = {
  error: string
  onTokenChange: (v: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function LoginGate({ error, onTokenChange, onSubmit }: Props) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas-2 p-4 text-ink">
      <div className="text-center">
        <div className="text-6xl">🏰✨🌤️</div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">魔法语言岛</h1>
        <p className="mt-1 text-ink-2">语言小魔法师,来收集魔法星尘吧!</p>
        <Card className="mx-auto mt-8 w-full max-w-sm rounded-[2rem] shadow-pop">
          <form className="space-y-4 p-6" onSubmit={onSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="token">家长通行令牌</Label>
              <Input
                id="token"
                type="password"
                autoComplete="off"
                onChange={(e) => onTokenChange(e.target.value)}
                placeholder="请输入访问令牌"
              />
            </div>
            {error ? <div className="rounded-xl bg-red-tint px-3.5 py-2.5 text-sm text-red">{error}</div> : null}
            <Button type="submit" size="lg" className="w-full">
              进入魔法岛 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
