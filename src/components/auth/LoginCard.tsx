import { ArrowRight, ShieldCheck } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type LoginCardProps = {
  token: string
  error: string
  onTokenChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function LoginCard({ token, error, onTokenChange, onSubmit }: LoginCardProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas p-4 text-ink">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(900px_500px_at_50%_-100px,rgb(10_132_255/0.08),transparent)]" />
      <Card className="w-full max-w-md rounded-[2rem] shadow-pop">
        <CardHeader className="items-center pt-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="mt-2">
            <CardTitle className="text-2xl">隐私生活记录</CardTitle>
            <CardDescription className="mt-1">登录后才可查看和编辑你的数据，访问前会校验授权。</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="token">访问令牌</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(event) => onTokenChange(event.target.value)}
                placeholder="请输入访问令牌"
                autoComplete="off"
              />
            </div>

            {error ? (
              <div className="rounded-xl bg-red-tint px-3.5 py-2.5 text-sm text-red">{error}</div>
            ) : null}

            <Button type="submit" size="lg" className="w-full">
              进入受保护空间
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-5 rounded-xl bg-emerald-tint px-3.5 py-2.5 text-sm text-emerald">
            首次访问需输入访问令牌，验证通过后无需重复登录。
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
