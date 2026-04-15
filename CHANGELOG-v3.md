# OpenClaw PM 变更日志

## [3.1.0] - 2026-04-15

### 新增
- **健康检查历史追踪** (`health-history.sh`)
  - 记录每次健康检查结果（Gateway状态、Lock数量、错误数等）
  - 支持查询历史记录（`list`）
  - 支持统计分析（`stats`）：健康评分、平均错误数等
  - 支持自动清理旧记录（`clean`）
  - 支持 JSON 格式输出
  - 自动集成到 `gateway-health-check.sh`

### 修复
- **thinking-only session 清理逻辑改进**
  - 改为标记而非删除消息
  - 添加 `_incomplete` 和 `_marked_at` 字段
  - 保留原始消息数据，避免数据丢失
  - 如果 jq 不可用，回退到删除方式

- **自动恢复功能改进** (`check-unanswered.sh --recover`)
  - 优先尝试使用 `openclaw sessions send` 命令
  - 如果不可用，回退到 wake 通知
  - 显示详细的恢复状态（成功/失败）
  - 改进错误处理和用户反馈

### 文档
- 更新 README.md 添加 `health-history.sh` 使用说明
- 更新 CHANGELOG-v3.md

---

## [3.0.0] - 2026-04-15

# OpenClaw PM v3.0.0 优化版本

## 重大更新

### 阶段一：基础优化（2026-04-15）

#### 新增功能

**1. 配置文件系统**
- 新增 `scripts/config.json` 统一配置管理
- 支持自定义端口、路径、超时时间等
- 支持从配置文件读取 Cron 任务列表

**2. 统一工具库**
- 新增 `scripts/lib/common.sh` 提供跨平台兼容性函数
- 自动检测操作系统（macOS/Linux）
- 统一的 API 调用、日志管理、备份管理

**3. 配置向导**
- 新增 `scripts/setup.sh` 交互式配置向导
- 自动检测 OpenClaw 安装
- 引导配置 Cron 任务和通知渠道

**4. 备份机制**
- 删除文件前自动备份
- 支持备份清理（保留最近 N 个）
- 备份路径可配置

**5. 通知系统**
- 统一的通知接口
- 支持多渠道通知（Telegram/飞书/邮件）
- 可配置通知级别（info/warn/error）

#### 优化改进

**1. gateway-health-check.sh**
- ✅ 移除外部脚本依赖（fix-sessions.py、detect-stuck-dispatch.py）
- ✅ 添加跨平台兼容性（macOS/Linux）
- ✅ 从配置文件读取参数
- ✅ 添加备份机制（删除文件前备份）
- ✅ 添加通知机制
- ✅ 简化逻辑，移除复杂的 stuck dispatch 检测

**2. check-unanswered.sh**
- ✅ 添加跨平台兼容性
- ✅ 添加 jq 依赖检查
- ✅ 新增 `--recover` 参数自动发送恢复通知
- ✅ 新增 `--agent` 参数过滤特定 agent
- ✅ 改进 JSON 解析逻辑

**3. check-missed-crons.sh**
- ✅ 从配置文件读取任务列表（不再硬编码）
- ✅ 添加确认机制（补执行前询问）
- ✅ 新增 `--yes` 参数跳过确认
- ✅ 改进错误处理

---

### 阶段二：剩余脚本优化（2026-04-15）

#### 优化改进

**4. heartbeat-check.sh**
- ✅ 添加跨平台支持
- ✅ 支持 JSON 输出模式（--json）
- ✅ 统一使用 lib/common.sh 工具库
- ✅ 3 项检查：Context Health、进行中任务、Cron 任务
- ✅ 改进错误处理和依赖检查

**5. quick-diagnose.sh**
- ✅ 8 项快速诊断
  - Gateway 进程状态
  - Session Lock 文件
  - 消息接收情况
  - 队列状态
  - LLM 错误
  - 磁盘空间
  - 健康检查脚本状态
  - 备份状态
- ✅ 跨平台兼容（macOS/Linux）
- ✅ 统一使用工具库

**6. morning-briefing.sh**
- ✅ 完整晨间简报
  - 系统健康状态
  - 昨夜活动摘要
  - Cron 任务状态
  - 待办事项检查
  - 今日建议
  - 快速操作命令
- ✅ 跨平台支持
- ✅ 统一使用工具库

**7. daily-stats.sh**
- ✅ 详细每日统计
  - 基本统计（消息收发、活跃会话）
  - 按小时分布（可视化图表）
  - 错误分析（分类统计）
  - Gateway 状态
  - 性能指标
  - 渠道统计
  - 健康分数评估
- ✅ 跨平台支持
- ✅ 统一使用工具库

---

## 破坏性变更

### 配置文件位置
- 旧版本：无配置文件，所有参数硬编码
- 新版本：需要 `scripts/config.json`

**迁移方法**：
```bash
# 运行配置向导
./scripts/setup.sh

# 或手动创建配置文件
cp scripts/config.json.example scripts/config.json
# 编辑 config.json
```

### Cron 任务列表
- 旧版本：在 `check-missed-crons.sh` 中硬编码
- 新版本：在 `config.json` 中配置

**迁移方法**：
编辑 `scripts/config.json`，添加你的任务：
```json
{
  "cron": {
    "criticalJobs": [
      {
        "name": "your-job-name",
        "jobId": "your-job-id"
      }
    ]
  }
}
```

---

## 已知问题

1. **thinking-only session 清理**：当前实现会删除最后一条消息，可能导致数据丢失
   - 建议：改为标记而非删除
   
2. **自动恢复功能**：`check-unanswered.sh --recover` 只发送 wake 通知，不直接发送消息
   - 原因：OpenClaw CLI 不支持直接发送消息到 session
   - 建议：使用 `sessions_send` API

3. **跨平台测试**：当前只在 Linux 上测试
   - 需要在 macOS 上测试

---

## 历史后续规划（归档）

### v3.1.0
- [ ] 添加健康检查历史追踪
- [ ] 添加 Web Dashboard
- [ ] 添加邮件通知支持

### v4.0.0
- [ ] 重构为 TypeScript
- [ ] 集成到 OpenClaw 核心

---

## 安装和使用

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm

# 2. 运行配置向导
./scripts/setup.sh

# 3. 测试健康检查
./scripts/quick-diagnose.sh

# 4. 查看晨间简报
./scripts/morning-briefing.sh
```

### 手动配置

```bash
# 1. 复制配置文件
cp scripts/config.json.example scripts/config.json

# 2. 编辑配置文件
vim scripts/config.json

# 3. 运行健康检查
./scripts/gateway-health-check.sh
```

### 定时任务

#### Linux (cron)

```bash
# 编辑 crontab
crontab -e

# 添加以下行
*/5 * * * * /path/to/openclaw-pm/scripts/gateway-health-check.sh
0 8 * * * /path/to/openclaw-pm/scripts/morning-briefing.sh
```

#### macOS (launchd)

```bash
# 运行配置向导会自动安装
./scripts/setup.sh

# 或手动安装
cp scripts/ai.openclaw.health-check.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ai.openclaw.health-check.plist
```

---

## 贡献

欢迎提交 Issue 和 PR！

### 开发指南

1. 所有脚本必须使用 `lib/common.sh` 工具库
2. 所有配置必须从 `config.json` 读取
3. 所有跨平台差异必须在 `lib/common.sh` 中处理
4. 删除文件前必须备份
5. 重要操作必须发送通知

---

## 许可证

MIT License

---

## 致谢

- 原作者：VA7
- 优化版本：snowzlm
- 社区贡献者
