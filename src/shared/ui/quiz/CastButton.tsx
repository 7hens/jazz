import { Button } from '@/shared/ui/button'

/** 提交钮文案。感叹号写死为 ASCII `!`(U+0021)—— 测试按精确字符串匹配,换全角会静默失配。 */
export const CAST_LABEL = '就它了!'

/** 施法钮:替代「确定」,去掉交卷感。措辞与造型都集中在此,消费点只传状态。 */
export function CastButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button size="lg" className="w-full sm:w-auto sm:min-w-52" disabled={disabled} onClick={onClick}>
      {CAST_LABEL}
      <span aria-hidden className="ml-1">
        ✨
      </span>
    </Button>
  )
}
