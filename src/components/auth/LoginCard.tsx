import { ArrowRight, ShieldCheck } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type LoginCardProps = {
  email: string
  password: string
  error: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function LoginCard({ email, password, error, onEmailChange, onPasswordChange, onSubmit }: LoginCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f4f7ff,_#eef2ff_38%,_#f8fafc)] p-4 text-slate-700">
      <Card className="w-full max-w-md border-slate-200 shadow-xl shadow-slate-200/70">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">隐私生活记录</CardTitle>
            <CardDescription>登录后才可查看和编辑你的数据，访问前会校验授权。</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="请输入密码" />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            ) : null}

            <Button type="submit" className="w-full">
              进入受保护空间
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            默认账户：admin@life.local / ChangeMe123!
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
