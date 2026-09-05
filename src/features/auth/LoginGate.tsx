import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '../../shared/ui/button'
import { Card } from '../../shared/ui/card'
import { Input } from '../../shared/ui/input'
import { Label } from '../../shared/ui/label'

type Props = {
  error: string
  onTokenChange: (v: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function LoginGate({ error, onTokenChange, onSubmit }: Props) {
  const [show, setShow] = useState(false)
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
              <div className="relative">
                <Input
                  id="token"
                  type={show ? 'text' : 'password'}
                  autoComplete="off"
                  className="pr-11"
                  onChange={(e) => onTokenChange(e.target.value)}
                  placeholder="请输入访问令牌"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? '隐藏令牌' : '显示令牌'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-ink-3 transition-colors hover:text-ink"
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
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
