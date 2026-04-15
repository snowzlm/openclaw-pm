# @snowzlm/openclaw-pm

OpenClaw 项目管理工具 - 健康检查、统计分析、备份恢复的 TypeScript 工具集。

> 当前版本: **v5.4.0** (TypeScript 重构版)

[![测试覆盖率](https://img.shields.io/badge/coverage-95.08%25-brightgreen.svg)](https://github.com/snowzlm/openclaw-pm)
[![测试通过](https://img.shields.io/badge/tests-88%20passed-brightgreen.svg)](https://github.com/snowzlm/openclaw-pm)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

---

## 📦 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm

# 安装依赖
npm install

# 编译
npm run build

# 运行测试
npm test
```

### 使用

```bash
# 健康检查
npm run cli health

# 查看配置
npm run cli config

# 备份管理
npm run cli backup
npm run cli restore <backup-id>
npm run cli backups

# 统计分析
npm run cli daily-stats
npm run cli morning-briefing
npm run cli heartbeat
npm run cli check-unanswered
```

---

## ✨ 功能特性

### 核心功能

- **健康检查**: Gateway/Sessions/Queue/Providers/Cron 全方位检查
- **统计分析**: 每日统计、晨间简报、心跳检查
- **备份恢复**: 自动备份、版本管理、一键恢复
- **未回复检测**: 自动检测未回复消息并恢复
- **配置管理**: 统一配置文件、环境变量支持

### 技术特性

- ✅ **TypeScript**: 类型安全、代码提示
- ✅ **高测试覆盖**: 95.08% 整体覆盖率、88 个测试用例
- ✅ **并发优化**: Promise.all 并发执行检查
- ✅ **增量分析**: 日志增量读取、缓存管理
- ✅ **跨平台**: Linux、macOS 支持

---

## 📌 当前版本亮点

### v5.4.0（当前）
- 整体覆盖率：**95.08%**
- 测试：**88 passed**
- 所有核心模块覆盖率达到 **80%+**
- 默认 OpenClaw 目录改为**自动探测**
- 发布口径已收紧，`coverage/` 不再进入仓库产物，`dist/tests` 不再进入构建输出

历史版本、阶段性报告与归档说明，请看：
- [CHANGELOG 主入口](CHANGELOG.md)
- [v5.4.0 完成报告](docs/v5.4.0-complete-report.md)

---

## 🏗️ 架构设计

### 核心模块

```
src/
├── config.ts              # 配置管理器
├── logger.ts              # 日志系统
├── health-checker.ts      # 健康检查器
├── backup.ts              # 备份管理器
├── cache-manager.ts       # 缓存管理器
├── incremental-analyzer.ts # 增量分析器
├── stats-generator.ts     # 统计生成器
├── unanswered-checker.ts  # 未回复检查器
├── chart-renderer.ts      # 图表渲染器
├── error-handler.ts       # 错误处理器
├── config-initializer.ts  # 配置初始化器
├── cli.ts                 # CLI 接口
└── types.ts               # 类型定义
```

### 测试覆盖

```
tests/__tests__/
├── cache-manager.test.ts
├── config.test.ts
├── health-checker.test.ts
├── health-checker-detailed.test.ts
├── incremental-analyzer.test.ts
└── logger.test.ts
```

---

## 📖 使用指南

### 配置文件

默认配置文件：**自动探测**（通常为 `~/.openclaw/pm-config.json`，也可通过 `OPENCLAW_DIR` 环境变量指定）

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

### CLI 命令

#### 健康检查
```bash
npm run cli health
```

输出示例：
```
健康检查结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
状态: healthy
评分: 85/100

检查项:
  ✓ Gateway: 运行正常
  ✓ Sessions: 正常 (5 个)
  ✓ Queue: 队列为空
  ✓ Providers: 运行正常
  ✓ Cron: 2 个任务已启用
```

#### 每日统计
```bash
npm run cli daily-stats [日期]
```

#### 晨间简报
```bash
npm run cli morning-briefing
```

#### 未回复检查
```bash
npm run cli check-unanswered [--agent <agent>] [--recover]
```

#### 备份管理
```bash
# 创建备份
npm run cli backup

# 查看备份列表
npm run cli backups

# 恢复备份
npm run cli restore <backup-id>
```

---

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并查看覆盖率
npm run test:coverage

# 运行特定测试
npm test tests/__tests__/health-checker.test.ts
```

### 测试覆盖率

```
All files:
  Statements: 95.08%
  Branches:   78.42%
  Functions:  98.7%
  Lines:      96.28%

核心模块:
  health-checker.ts:       94.61%
  logger.ts:               80%
  config.ts:               100%
  cache-manager.ts:        96.49%
  incremental-analyzer.ts: 97.5%
```

---

## 🔧 开发

### 代码规范

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run type-check
```

### Git Hooks

项目使用 Husky + lint-staged 自动检查：
- 提交前自动运行 lint 和格式化
- 确保代码质量

---

## 📝 文档

快速入口：
- [CHANGELOG 主入口](CHANGELOG.md)
- [v5.4.0 完成报告](docs/v5.4.0-complete-report.md)
- [安装说明](INSTALL.md)
- [贡献指南](CONTRIBUTING.md)
- [当前仓库说明](README.md)

历史版本与归档文档保留在 `docs/` 与 `CHANGELOG-v*.md` 中。

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

### 开发指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 保持测试覆盖率 >80%
- 添加单元测试

---

## 📄 许可证

MIT License

---

## 👤 作者

**snowzlm**
- GitHub: [@snowzlm](https://github.com/snowzlm)

---

## 🙏 致谢

- 原项目: [@1va7/openclaw-pm](https://github.com/1va7/openclaw-pm)
- OpenClaw 社区

---

## 📊 项目状态

- ✅ 生产就绪
- ✅ 活跃维护
- ✅ 测试覆盖 >95%
- ✅ TypeScript 类型安全

---

**最后更新**: 2026-04-16  
**当前版本**: v5.4.0  
**下载链接**: https://github.com/snowzlm/openclaw-pm
