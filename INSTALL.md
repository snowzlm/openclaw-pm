# OpenClaw PM v3.0.0 安装指南

## 安装方式

### 方式一：Git Clone（推荐）

适用于需要完整功能的用户。

```bash
# 1. 克隆仓库
git clone https://github.com/snowzlm/openclaw-pm.git
cd openclaw-pm

# 2. 运行配置向导
./scripts/setup.sh

# 3. 测试
./scripts/quick-diagnose.sh
```

**优点**：
- 获取完整的脚本和文档
- 可以自定义修改
- 可以通过 git pull 更新

---

### 方式二：NPM 安装（即将支持）

适用于只需要配置升级的用户。

```bash
# 全局安装
npm install -g @snowzlm/openclaw-pm

# 运行
openclaw-pm
```

**注意**：当前版本 (v3.0.0) 暂未发布到 NPM，请使用方式一。

---

### 方式三：直接下载

适用于不使用 Git 的用户。

```bash
# 下载最新版本
wget https://github.com/snowzlm/openclaw-pm/archive/refs/heads/main.zip
unzip main.zip
cd openclaw-pm-main

# 运行配置向导
./scripts/setup.sh
```

---

## 系统要求

### 必需
- **操作系统**: Linux 或 macOS
- **Shell**: Bash 4.0+
- **工具**: curl, jq

### 可选
- **Node.js**: 14.0+ (仅用于 NPM 安装方式)
- **Git**: 用于克隆和更新

---

## 依赖安装

### macOS

```bash
# 安装 Homebrew（如果没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装依赖
brew install jq curl
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y jq curl
```

### CentOS/RHEL

```bash
sudo yum install -y jq curl
```

---

## 配置步骤

### 1. 运行配置向导

```bash
cd openclaw-pm
./scripts/setup.sh
```

配置向导会：
- 检测 OpenClaw 安装
- 检查依赖工具
- 引导配置 Gateway 端口
- 引导配置 Cron 任务列表
- 引导配置通知渠道
- 自动安装定时任务

### 2. 手动配置（可选）

如果不使用配置向导，可以手动配置：

```bash
# 复制配置文件
cp scripts/config.json.example scripts/config.json

# 编辑配置
vim scripts/config.json
```

配置文件说明：
```json
{
  "gateway": {
    "port": 18789,              // Gateway 端口
    "logPath": "/tmp/openclaw"  // 日志路径
  },
  "cron": {
    "criticalJobs": [           // 关键任务列表
      {
        "name": "任务名称",
        "jobId": "任务ID"
      }
    ]
  }
}
```

### 3. 验证安装

```bash
# 快速诊断
./scripts/quick-diagnose.sh

# 查看晨间简报
./scripts/morning-briefing.sh
```

---

## 定时任务配置

### Linux (cron)

```bash
# 编辑 crontab
crontab -e

# 添加以下行
*/5 * * * * /path/to/openclaw-pm/scripts/gateway-health-check.sh
0 8 * * * /path/to/openclaw-pm/scripts/morning-briefing.sh
```

### macOS (launchd)

配置向导会自动创建 launchd 服务，或手动创建：

```bash
# 创建 plist 文件
cat > ~/Library/LaunchAgents/ai.openclaw.health-check.plist << 'EOF'
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
EOF

# 加载服务
launchctl load ~/Library/LaunchAgents/ai.openclaw.health-check.plist
```

---

## 更新

### Git Clone 方式

```bash
cd openclaw-pm
git pull origin main
./scripts/setup.sh  # 重新运行配置向导
```

### NPM 方式（即将支持）

```bash
npm update -g @snowzlm/openclaw-pm
```

---

## 卸载

### 移除定时任务

**Linux (cron)**:
```bash
crontab -e
# 删除相关行
```

**macOS (launchd)**:
```bash
launchctl unload ~/Library/LaunchAgents/ai.openclaw.health-check.plist
rm ~/Library/LaunchAgents/ai.openclaw.health-check.plist
```

### 删除文件

```bash
rm -rf /path/to/openclaw-pm
```

---

## 故障排查

### 问题：脚本无法执行

**解决方法**：
```bash
chmod +x scripts/*.sh
```

### 问题：找不到 jq

**解决方法**：
```bash
# macOS
brew install jq

# Linux
sudo apt-get install jq  # Debian/Ubuntu
sudo yum install jq      # CentOS/RHEL
```

### 问题：Gateway Token 错误

**解决方法**：
确保 `~/.openclaw/openclaw.json` 包含有效的 token：
```json
{
  "token": "your-gateway-token-here"
}
```

### 问题：配置文件不存在

**解决方法**：
```bash
cp scripts/config.json.example scripts/config.json
vim scripts/config.json
```

---

## 获取帮助

- **GitHub Issues**: https://github.com/snowzlm/openclaw-pm/issues
- **原项目**: https://github.com/1va7/openclaw-pm
- **文档**: 查看 `docs/` 目录

---

## 许可证

MIT License

---

## 致谢

- 原作者：VA7 (@1va7/openclaw-pm)
- 优化版本：snowzlm
