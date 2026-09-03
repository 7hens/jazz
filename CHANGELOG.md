# Changelog

本仓库变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),版本遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> 发布节奏见 CLAUDE.md「发布流水线」。每次发版前手写本文件(新增 / 修复 / 变更各 ≤ 一行),先提交,再部署,冒烟通过后才 `npm version` 打 tag。

## [0.1.0] - 2026-09-04

### 新增

- 词库学习岛一期首发:100 词 × 拼音/汉字/英语技能步 + 家长模块开关 + 称号体系,进度行级持久化。

### 变更

- 迁移规范化:`schema.sql` 下线,改 `wrangler d1 migrations apply` + 数字前缀迁移(`migrations/0001_init.sql` 基线快照),旧 date 迁移移入 `migrations/archive/`。
- 新增 preview 环境(`--env preview`,独立 D1);生产 = 默认 env;发布流程对齐「部署 → 冒烟 → 打 tag」。
