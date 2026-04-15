# OpenClaw PM v4.x 更新日志

## [4.2.0] - 2026-04-15

### ✨ 新增功能
- **未回复消息检查**: 实现 `check-unanswered` 命令，检测未回复的用户消息
  - 支持按 agent 过滤
  - 支持按时间过滤（默认 24 小时内活跃的 session）
  - 支持自动恢复功能（`--recover`）
  - JSON 输出支持

### 📦 新增模块
- `src/unanswered-checker.ts`: 未回复消息检查器（248 行）
  - `check()`: 检查未回复消息
  - `checkSession()`: 检查单个 session
  - `recoverSessions()`: 自动恢复未回复的 sessions
  - `sendWakeNotification()`: 发送 wake 通知

### 🎯 CLI 命令
```bash
# 检查未回复消息
openclaw-pm check-unanswered

# 包括旧 session
openclaw-pm check-unanswered --all

# 只检查指定 agent
openclaw-pm check-unanswered --agent main

# 自动发送恢复消息
openclaw-pm check-unanswered --recover

# JSON 输出
openclaw-pm check-unanswered --json
```

### 🔧 技术实现
- 读取 `~/.openclaw/agents/*/sessions/*.jsonl` 文件
- 解析最后一条消息的 role
- 如果是 `user` 消息则标记为未回复
- 支持通过 `openclaw sessions send` 发送恢复消息
- 回退到 `openclaw cron wake` 通知

### 📊 测试结果
```
=== 未回复消息检查 ===

未回复会话数: 0

✓ 没有发现未回复的消息
```

---

## [4.1.0] - 2026-04-15

### ✨ 新增功能
- **队列检查**: 实现队列文件监控，检测超时任务（默认 2 小时）
- **Provider 错误检测**: 分析 Gateway 日志，统计 Provider 错误（默认阈值 10）
- **Cron 任务检查**: 从配置文件读取任务状态，避免 CLI 调用超时

### 🐛 Bug 修复
- 修复 `getGatewayProcesses()` 误报多进程问题（改用精确匹配 `^openclaw-gateway`）
- 修复 Sessions 目录路径读取错误（支持 `openclaw.sessions_dir` 配置）
- 修复 Cron 检查超时问题（改为读取配置文件而非调用 CLI）
- 清理代码重复块

### 📝 配置更新
- 新增 `openclaw.sessions_dir` 配置项
- 新增 `health_check.max_queue_age_hours` 配置项（默认 2）
- 新增 `health_check.provider_error_threshold` 配置项（默认 10）
- 新增 `cron_tasks` 配置数组

### 🎯 测试结果
- 健康检查评分: 100/100
- 所有检查项通过
- 无超时问题

---

## [4.0.0] - 2026-04-14

### 🚀 重大更新
- **TypeScript 重构**: 将 3033 行 Bash 脚本重构为 855 行 TypeScript 代码
- **模块化架构**: 6 个核心模块（ConfigManager、Logger、GatewayHealthChecker、BackupManager、CLI）
- **类型安全**: 完整的 TypeScript 类型定义
- **CLI 工具**: 基于 Commander.js 的命令行接口

### 📦 核心模块
1. **ConfigManager** (`src/config.ts`)
   - 统一配置管理
   - 支持嵌套键访问（`get('openclaw.port')`）
   - 默认值支持

2. **Logger** (`src/logger.ts`)
   - 多级别日志（debug/info/warn/error）
   - 彩色输出（chalk）
   - 文件日志支持

3. **GatewayHealthChecker** (`src/health-checker.ts`)
   - Gateway 状态检查
   - Sessions 监控
   - 健康评分算法

4. **BackupManager** (`src/backup.ts`)
   - tar.gz 压缩备份
   - 自动清理旧备份
   - 恢复功能

5. **CLI** (`src/cli.ts`)
   - `openclaw-pm health` - 健康检查
   - `openclaw-pm backup` - 创建备份
   - `openclaw-pm restore` - 恢复备份

### 🛠️ 技术栈
- TypeScript 6.0.2
- Commander 14.0.3
- Chalk 5.6.2
- Better-SQLite3 12.9.0

### 📊 代码统计
- 源代码: 855 行 TypeScript
- 编译输出: 24 个文件，136KB
- 测试覆盖率: 待添加

### 🔄 迁移指南
详见 `docs/v4.0.0-migration-guide.md`

---

## 版本规划

### v4.3.0（计划中）
- [ ] 迁移 `daily-stats.sh` 功能
- [ ] 迁移 `morning-briefing.sh` 功能
- [ ] 迁移 `heartbeat-check.sh` 功能

### v5.0.0（计划中）
- [ ] Web Dashboard
- [ ] 实时监控
- [ ] 告警系统
- [ ] 性能优化
- [ ] 插件系统
