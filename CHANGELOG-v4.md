# OpenClaw PM v4.0.0 变更日志

## [4.0.0] - 2026-04-15

### 🎉 重大更新：TypeScript 重构

OpenClaw PM v4.0.0 完全重构为 TypeScript，提供更好的类型安全、代码可维护性和开发体验。

---

## 核心架构

### 1. TypeScript 核心模块

#### ConfigManager (`src/config.ts`)
- 统一配置管理
- 支持嵌套配置读写
- 自动创建默认配置
- 类型安全的配置访问

#### Logger (`src/logger.ts`)
- 多级别日志（DEBUG/INFO/WARN/ERROR）
- 彩色控制台输出
- 文件日志支持
- 统一的日志格式

#### GatewayHealthChecker (`src/health-checker.ts`)
- Gateway 状态检查
- Sessions 健康检查
- 队列状态监控
- Provider 错误检测
- Cron 任务检查
- 健康评分算法

#### BackupManager (`src/backup.ts`)
- 自动/手动备份
- 备份压缩（tar.gz）
- 备份恢复
- 自动清理旧备份
- 备份列表管理

#### CLI (`src/cli.ts`)
- 命令行接口
- 多命令支持
- 彩色输出
- JSON 格式支持

---

## 新增功能

### 1. 命令行工具

```bash
# 安装
npm install -g @snowzlm/openclaw-pm

# 或本地链接
npm link

# 使用
openclaw-pm --help
```

### 2. 健康检查命令

```bash
# 执行健康检查
openclaw-pm health

# JSON 格式输出
openclaw-pm health --json

# 详细输出
openclaw-pm health --verbose

# 调试模式
openclaw-pm health --debug
```

**输出示例**:
```
=== OpenClaw Gateway 健康检查 ===

状态: HEALTHY
评分: 95/100
时间: 2026-04-15 13:59:00

检查项:
  ✓ gateway: Gateway 运行正常
  ✓ sessions: Sessions 正常 (12 个)
  ✓ queue: 队列检查未实现
  ✓ providers: Providers 检查未实现
  ✓ cron: Cron 检查未实现
```

### 3. 备份管理命令

```bash
# 创建备份
openclaw-pm backup

# 创建自动备份
openclaw-pm backup --type auto

# 列出所有备份
openclaw-pm backups

# 恢复备份
openclaw-pm restore /path/to/backup.tar.gz
```

### 4. 配置管理命令

```bash
# 显示当前配置
openclaw-pm config

# 使用自定义配置文件
openclaw-pm --config /path/to/config.json health
```

---

## 技术改进

### 1. 类型安全
- 完整的 TypeScript 类型定义
- 接口定义（`src/types.ts`）
- 编译时类型检查
- 更好的 IDE 支持

### 2. 模块化架构
- 清晰的模块划分
- 单一职责原则
- 易于扩展和维护
- 可复用的组件

### 3. 错误处理
- 统一的错误处理机制
- 详细的错误信息
- 优雅的错误恢复
- 日志记录

### 4. 跨平台支持
- Node.js 14+ 支持
- macOS/Linux 兼容
- 统一的路径处理
- 平台检测

---

## 向后兼容

### Legacy 脚本保留

v3.x 的 Bash 脚本仍然保留在 `scripts/` 目录，可通过 npm scripts 调用：

```bash
# v3.x 脚本
npm run legacy:setup
npm run legacy:diagnose
npm run legacy:health
npm run legacy:briefing
npm run legacy:stats
```

### 迁移路径

1. **立即使用**: v4.0.0 CLI 可与 v3.x 脚本并存
2. **逐步迁移**: 先使用 CLI 命令，逐步替换脚本调用
3. **完全迁移**: 未来版本将移除 Bash 脚本

---

## 配置文件

### 默认配置路径

- `~/.openclaw/pm-config.json`
- 或通过 `--config` 指定

### 配置示例

```json
{
  "openclaw": {
    "dir": "~/.openclaw",
    "gateway_port": 3000,
    "gateway_timeout": 30
  },
  "health_check": {
    "interval_minutes": 5,
    "max_lock_age_hours": 1,
    "max_queue_age_hours": 2,
    "provider_error_threshold": 10
  },
  "backup": {
    "enabled": true,
    "max_backups": 10,
    "backup_dir": "~/.openclaw/.backup"
  },
  "notification": {
    "enabled": false,
    "channels": []
  },
  "cron_tasks": [
    {
      "name": "gateway-health-check",
      "schedule": "*/5 * * * *",
      "enabled": true
    }
  ]
}
```

---

## 依赖项

### 运行时依赖
- `commander`: CLI 框架
- `chalk`: 彩色输出
- `better-sqlite3`: SQLite 数据库（未来使用）

### 开发依赖
- `typescript`: TypeScript 编译器
- `@types/node`: Node.js 类型定义
- `ts-node`: TypeScript 运行时

---

## 构建和发布

### 构建

```bash
# 编译 TypeScript
npm run build

# 开发模式（监听文件变化）
npm run dev
```

### 发布

```bash
# 发布到 npm
npm publish

# 发布前自动构建
npm run prepublishOnly
```

---

## 已知限制

### 1. 部分功能未实现
- 队列检查（TODO）
- Provider 错误检测（TODO）
- Cron 任务检查（TODO）

### 2. 测试覆盖
- 暂无单元测试
- 需要添加测试用例

### 3. 文档
- API 文档待完善
- 使用示例待补充

---

## 下一步计划

### v4.1.0（预计 1 周）
- [ ] 完成队列检查功能
- [ ] 完成 Provider 错误检测
- [ ] 完成 Cron 任务检查
- [ ] 添加通知系统集成
- [ ] 添加历史追踪功能

### v4.2.0（预计 2 周）
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 完善 API 文档
- [ ] 添加使用示例

### v5.0.0（预计 1-2 月）
- [ ] 集成到 OpenClaw 核心
- [ ] 添加插件系统
- [ ] Web Dashboard
- [ ] 实时监控

---

## 迁移指南

### 从 v3.x 迁移到 v4.0.0

#### 1. 安装 v4.0.0

```bash
cd /path/to/openclaw-pm
npm install
npm run build
npm link
```

#### 2. 创建配置文件

```bash
# 使用默认配置
openclaw-pm config > ~/.openclaw/pm-config.json
```

#### 3. 测试命令

```bash
# 测试健康检查
openclaw-pm health

# 测试备份
openclaw-pm backup
```

#### 4. 更新 Cron 任务

将 Cron 任务从 Bash 脚本改为 CLI 命令：

```bash
# 旧方式
*/5 * * * * /path/to/scripts/gateway-health-check.sh

# 新方式
*/5 * * * * openclaw-pm health
```

---

## 贡献指南

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test
```

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 添加类型注释
- 编写单元测试

---

## 致谢

- 基于 VA7 的 OpenClaw PM v3.x
- 感谢所有贡献者

---

## 许可证

MIT License

---

## 联系方式

- GitHub: https://github.com/snowzlm/openclaw-pm
- Issues: https://github.com/snowzlm/openclaw-pm/issues
