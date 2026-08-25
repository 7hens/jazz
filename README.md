# 隐私生活记录仪

一个基于 React + TypeScript + Tailwind 的生活记录应用，目标是用 Cloudflare Pages + D1 部署，支持：

- 记账：收入 + 支出记录、分类统计、月度收支图表
- 体重：每周五记录、趋势图表
- 运动：运动动作指导（纯静态,不记录数据）
- 安全访问：登录后才可查看和编辑数据
- 私密存储：所有记录绑定当前用户,保存在 D1 中

## 技术栈

- Frontend: React + TypeScript + Vite
- UI: Shadcn 风格组件 + Tailwind
- Backend: Cloudflare Pages Functions
- Database: Cloudflare D1
- Auth: HttpOnly session cookie + 服务端校验

## 本地开发

```bash
npm install
npm run dev
npm run db:migrate   # 执行 migrations/ 下迁移（表重建加入 income，需先 db:apply）
```

默认登录账户：

- 邮箱：admin@life.local
- 密码：ChangeMe123!

本地 Vite 开发模式下，前端会通过 Cloudflare Pages Functions 约定的 `/api/*` 路径访问后端；要在真实 Cloudflare 环境中使用，需要关联 D1 和 Pages 项目。

## Cloudflare Pages 部署

1. 在 Cloudflare Dashboard 创建 Pages 项目并绑定当前仓库。
2. 配置环境变量：
   - `ADMIN_EMAIL=admin@life.local`
   - `ADMIN_PASSWORD=ChangeMe123!`
3. 创建 D1 数据库并在 `wrangler.toml` 里填写 `database_id`。
4. 执行：

```bash
npx wrangler d1 create jazz-life-tracker
npx wrangler d1 execute jazz-life-tracker --file=./schema.sql
npx wrangler pages deploy dist
```

5. 访问项目 URL，登录后即可使用。

## 安全说明

- 认证使用 HttpOnly + SameSite=Lax 的安全 cookie。
- 后端每个 `/api/*` 访问都要求有效 session。
- 数据通过 `user_id` 绑定到当前用户，不共享到其他账户。
- 生产环境建议进一步使用 Cloudflare Zero Trust / Access 保护页面访问入口。
