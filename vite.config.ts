import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 本地 dev 环境标识:仅 dev server(非 build)改写 index.html,
// title 加 DEV 后缀、favicon 换成 dev-favicon.svg,避免与正式环境混淆
function devEnvMark(): Plugin {
  return {
    name: 'dev-env-mark',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace('<title>jazz</title>', '<title>jazz - DEV</title>')
        .replace('href="/favicon.svg"', 'href="/dev-favicon.svg"')
    },
  }
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    devEnvMark(),
    // worker 入口、D1 binding、assets 全部从 wrangler.toml 读取
    cloudflare(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
