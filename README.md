# @snowzlm/openclaw-pm

OpenClaw 项目经理配置升级工具 - 让你的 AI Agent 成为优秀的项目经理。

> 基于 @1va7/openclaw-pm v2.1.0，优化版本 v3.0.0

## 版本说明

### V3 (当前版本 - 优化版)

V3 在 V2 基础上进行了全面优化，解决了跨平台兼容性、硬编码、依赖管理等问题。

**V3 新增功能：**
- 🔧 配置文件系统（统一配置管理）
- 📦 统一工具库（跨平台兼容）
- 🎯 配置向导（交互式配置）
- 💾 备份机制（删除前自动备份）
- 📢 通知系统（多渠道通知）
- 🔄 自动恢复（未回复消息自动恢复）

**V3 优化改进：**
- ✅ 跨平台兼容（macOS + Linux）
- ✅ 移除硬编码（端口、路径、任务列表）
- ✅ 移除外部依赖（fix-sessions.py 等）
- ✅ 添加依赖检查（jq、curl 等）
- ✅ 改进错误处理
- ✅ 添加确认机制（危险操作前询问）

### V2

V2 在 V1 基础上增加了任务管理、Session 隔离、自动恢复等核心能力。

**V2 新增功能：**
- 🔴 复杂任务管理（计划文件 + Checkpoint）
- 🔒 Session 隔离规则（防止跨 session 混淆）
- 🔄 GatewayRestart 强制恢复行为
- 🎤 主动 Interview（需求澄清）
- ⚡ 并行执行优化
- 🔖 Checkpoint 机制

### V1

V1 提供了 3 个核心能力增强：
- 主动性增强（Heartbeat 机制）
- 可重入性增强（Memory Flush Protocol）
- Agential Thinking（任务执行优先级）

---

## 快速开始

### 方式一：使用配置向导（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm

# 2. 运行配置向导
./scripts/setup.sh

# 3. 测试健康检查
./scripts/quick-diagnose.sh
```

### 方式二：手动配置

```bash
# 1. 克隆仓库
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm

# 2. 复制配置文件
cp scripts/config.json scripts/config.json.backup
vim scripts/config.json

# 3. 运行健康检查
./scripts/gateway-health-check.sh
```

---

## 配置文件说明

### scripts/config.json

```json
{
  "gateway": {
    "port": 18789,                    // Gateway 端口
    "logPath": "/tmp/openclaw",       // 日志路径
    "healthCheckInterval": 300        // 健康检查间隔（秒）
  },
  "locks": {
    "timeoutMinutes": 5,              // Lock 超时时间（分钟）
    "forceRemoveMinutes": 15          // 强制删除 Lock 时间（分钟）
  },
  "queue": {
    "stuckThresholdMinutes": 3        // 队列卡住阈值（分钟）
  },
  "retry": {
    "maxRetries": 5,                  // 最大重试次数
    "intervalSeconds": 120            // 重试间隔（秒）
  },
  "cron": {
    "criticalJobs": [                 // 关键 Cron 任务列表
      {
        "name": "example-job",
        "jobId": "00000000-0000-0000-0000-000000000000",
        "description": "示例任务"
      }
    ]
  },
  "notifications": {
    "enabled": true,                  // 是否启用通知
    "channels": ["telegram"]          // 通知渠道
  },
  "backup": {
    "enabled": true,                  // 是否启用备份
    "path": "$HOME/.openclaw/backups" // 备份路径
  }
}
```

---

## 健康检查脚本

### 核心脚本

#### 1. gateway-health-check.sh
**自动检查和恢复 Gateway**

功能：
- 检测 Gateway 是否运行
- 检测多个 Gateway 进程
- 清理过期的 session lock
- 清理 thinking-only session
- 检测队列卡住
- Provider 错误自动重试

用法：
```bash
# 手动运行
./scripts/gateway-health-check.sh

# 定时运行（cron）
*/5 * * * * /path/to/openclaw-pm/scripts/gateway-health-check.sh
```

#### 2. check-unanswered.sh
**检测未回复的用户消息**

功能：
- 扫描所有 agent 的 session
- 检查最后一条消息是否未回复
- 支持自动恢复（发送通知）
- 支持过滤特定 agent

用法：
```bash
# 检查未回复消息
./scripts/check-unanswered.sh

# 显示详细信息
./scripts/check-unanswered.sh --verbose

# 自动发送恢复通知
./scripts/check-unanswered.sh --recover

# 只检查特定 agent
./scripts/check-unanswered.sh --agent main

# JSON 格式输出
./scripts/check-unanswered.sh --json
```

#### 3. check-missed-crons.sh
**检查 Cron 任务执行状态**

功能：
- 从配置文件读取任务列表
- 检查任务是否今日执行
- 支持自动补执行
- 支持确认机制

用法：
```bash
# 检查并报告
./scripts/check-missed-crons.sh

# 检查并补执行（需确认）
./scripts/check-missed-crons.sh --run

# 跳过确认直接补执行
./scripts/check-missed-crons.sh --run --yes

# JSON 格式输出
./scripts/check-missed-crons.sh --json
```

#### 4. quick-diagnose.sh
**一键诊断常见问题**

功能：
- Gateway 进程状态
- Session lock 文件
- 消息接收情况
- 队列状态
- LLM 错误
- 磁盘空间

用法：
```bash
./scripts/quick-diagnose.sh
```

#### 5. morning-briefing.sh
**晨间简报**

功能：
- 系统健康状态
- 昨夜活动摘要
- Cron 任务执行状态
- 待办事项检查
- 今日建议

用法：
```bash
./scripts/morning-briefing.sh
```

#### 6. daily-stats.sh
**每日活动统计**

功能：
- 消息收发统计
- 按小时分布
- 错误分析
- Gateway 状态

用法：
```bash
# 查看今天的统计
./scripts/daily-stats.sh

# 查看指定日期
./scripts/daily-stats.sh 2026-04-15
```

#### 7. heartbeat-check.sh
**统一 Heartbeat 检查**

功能：
- Context Health 检查
- 进行中任务检查
- Cron 任务检查

用法：
```bash
# 运行所有检查
./scripts/heartbeat-check.sh

# JSON 格式输出
./scripts/heartbeat-check.sh --json
```

---

## 定时任务配置

### Linux (cron)

```bash
# 编辑 crontab
crontab -e

# 添加以下行
# 健康检查（每 5 分钟）
*/5 * * * * /path/to/openclaw-pm/scripts/gateway-health-check.sh

# 晨间简报（每天 8:00）
0 8 * * * /path/to/openclaw-pm/scripts/morning-briefing.sh
```

### macOS (launchd)

运行配置向导会自动安装：
```bash
./scripts/setup.sh
```

或手动创建 `~/Library/LaunchAgents/ai.openclaw.health-check.plist`：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.health-check</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/path/to/openclaw-pm/scripts/gateway-health-check.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

加载服务：
```bash
launchctl load ~/Library/LaunchAgents/ai.openclaw.health-check.plist
```

---

## V3 vs V2 核心差异

| 维度 | V2 | V3 |
|------|-----|-----|
| 配置管理 | 硬编码 | 配置文件 |
| 跨平台 | 仅 macOS | macOS + Linux |
| 外部依赖 | 需要 Python 脚本 | 无外部依赖 |
| 备份机制 | 无 | 自动备份 |
| 通知系统 | 无 | 统一通知接口 |
| 依赖检查 | 无 | 自动检查 |
| 配置向导 | 无 | 交互式配置 |

---

## 从 V2 迁移到 V3

### 1. 更新代码

```bash
cd openclaw-pm
git pull origin main
```

### 2. 运行配置向导

```bash
./scripts/setup.sh
```

### 3. 迁移 Cron 任务列表

如果你在 V2 中修改了 `check-missed-crons.sh` 的任务列表，需要迁移到 `config.json`：

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

## 故障排查

### 脚本无法运行

```bash
# 检查权限
chmod +x scripts/*.sh

# 检查依赖
./scripts/setup.sh
```

### 找不到 jq

```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq  # Debian/Ubuntu
sudo yum install jq      # CentOS/RHEL
```

### Gateway Token 错误

确保 `~/.openclaw/openclaw.json` 包含有效的 token：
```json
{
  "token": "your-gateway-token-here"
}
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

- 原作者：VA7 (@1va7/openclaw-pm)
- 优化版本：snowzlm
- 社区贡献者

---

## 更多内容

- 原项目：https://github.com/1va7/openclaw-pm
- 优化版本：https://github.com/snowzlm/openclaw-pm
- 详细变更：`CHANGELOG-v3.md`
- 配置指南：`config/V2-升级指南.md`
