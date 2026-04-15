# OpenClaw PM v5.4.0 安装指南

> 当前主线：TypeScript CLI。  
> 历史 Bash 脚本方案仍保留在 `scripts/` 中，作为 legacy 兼容层，不再是当前主线入口。

## 推荐安装方式

### 方式一：Git Clone（推荐）

适用于本地使用、开发和完整查看仓库内容。

```bash
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm
npm install
npm run build
npm test
```

运行方式：

```bash
# 健康检查
node dist/cli.js health

# 查看配置
node dist/cli.js config show

# 每日统计
node dist/cli.js daily-stats

# 晨间简报
node dist/cli.js morning-briefing
```

### 方式二：NPM 包结构（发布就绪）

仓库当前已经具备标准 npm 包结构：
- `bin` 已配置
- `npm pack --dry-run` 已通过
- 发布包仅包含 `dist/ / README.md / CHANGELOG.md / LICENSE`

如果未来发布到 npm，可直接按标准 CLI 方式安装和使用。

---

## 系统要求

- Node.js **>= 18.0.0**
- Linux / macOS
- Bash（仅 legacy 脚本需要）
- jq（仅 legacy Bash 脚本需要）

---

## 配置

默认配置文件为自动探测模式：
- 通常路径：`~/.openclaw/pm-config.json`
- 也可通过环境变量：`OPENCLAW_DIR`

典型配置结构：

```json
{
  "openclaw": {
    "dir": "~/.openclaw",
    "sessions_dir": "~/.openclaw/agents/main/sessions",
    "queue_dir": "~/.openclaw/queue",
    "logs_dir": "~/.openclaw/logs",
    "gateway_port": 3000
  },
  "health_check": {
    "max_queue_age_hours": 2,
    "provider_error_threshold": 10
  },
  "backup": {
    "dir": "~/.openclaw/backups",
    "max_backups": 10
  },
  "cron_tasks": []
}
```

---

## Legacy Bash 脚本说明

`scripts/` 目录中的 Bash 工具仍可使用，但它们属于：
- 历史实现
- 运维兼容层
- 非当前主线发布内容

如果你要使用它们，请先复制示例配置：

```bash
cp scripts/config.json.example scripts/config.json
```

然后参考：
- `scripts/README.md`

---

## 验证安装

```bash
npm run build
npm test
npm run release:check
```

---

## 获取帮助

- `README.md` — 当前仓库主说明
- `CHANGELOG.md` — 当前版本主入口
- `docs/v5.4.0-complete-report.md` — 当前版本完整报告
- `CONTRIBUTING.md` — 贡献指南

---

## 许可证

MIT License
