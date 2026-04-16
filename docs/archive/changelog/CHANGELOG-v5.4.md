# Changelog - v5.4.0

## [5.4.0] - 2026-04-16

### 🎉 重大更新

#### 整体覆盖率提升到 95.08%
- **Statements**: 83.13% → 95.08% (+11.95%)
- **Branches**: 72.05% → 78.42% (+6.37%)
- **Functions**: 89.85% → 98.7% (+8.85%)
- **Lines**: 83.99% → 96.28% (+12.29%)

#### 所有核心模块覆盖率达标
- `config.ts`: 100%
- `cache-manager.ts`: 96.49%
- `incremental-analyzer.ts`: 97.5%
- `health-checker.ts`: 94.61%
- `logger.ts`: 80%

### ✨ 新增与改进

#### 自动探测 OpenClaw 目录
- 默认配置路径改为自动探测
- 优先使用 `OPENCLAW_DIR`
- 自动探测本机可用的 `.openclaw` 目录
- `/root/.openclaw` 仅保留为兼容兜底候选，不再作为默认写死路径

#### 补强测试覆盖
新增 16 个测试用例，重点覆盖：
- `cache-manager.ts`
  - 磁盘缓存回填内存
  - 损坏缓存文件自动删除
  - 内存超限驱逐最旧项
  - `invalidate()` / `cleanup()` 处理损坏文件
- `incremental-analyzer.ts`
  - 损坏 checkpoint 文件处理
  - sent/outbound message 统计
  - Gateway stopping/stopped 统计
  - `cleanupOldCheckpoints()` 删除损坏文件
  - `getCheckpointStats()` oldest/newest 统计
- `config.ts`
  - 默认配置路径生成
  - 自动探测辅助路径函数
  - `save()` 自动创建目录
  - `createDefault()` 默认配置生成与落盘

#### 文档口径统一
- README 更新到 v5.4.0
- README 覆盖率/测试数/文档链接全部更新
- 历史文档中的 `/root/.openclaw` 示例统一改为 `~/.openclaw`
- 新增 `docs/v5.4.0-complete-report.md`

### 📊 测试结果

```text
Test Suites: 6 passed, 6 total
Tests:       88 passed, 88 total
Snapshots:   0 total

Coverage:
  Statements: 95.08%
  Branches:   78.42%
  Functions:  98.7%
  Lines:      96.28%
```

### 🔄 兼容性
- Node.js >= 18.0.0
- TypeScript 6.0.2
- Linux / macOS
- OpenClaw 目录支持自动探测与环境变量覆盖

### 📌 说明
- 本版本重点是**质量提升 + 本机路径兼容性优化**
- 没有引入破坏性变更
- 现有配置仍可继续使用
