#!/bin/bash
# setup.sh - OpenClaw PM 配置向导
# 交互式配置脚本

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

print_header "OpenClaw PM 配置向导"
echo ""

# ============================================
# 1. 检测 OpenClaw 安装
# ============================================

echo -e "${BLUE}[1/5] 检测 OpenClaw 安装${NC}"

OPENCLAW_DIR="$HOME/.openclaw"
if [ ! -d "$OPENCLAW_DIR" ]; then
    echo -e "${RED}✗ OpenClaw 未安装或路径不正确${NC}"
    read -p "请输入 OpenClaw 安装路径 [默认: $HOME/.openclaw]: " custom_path
    OPENCLAW_DIR="${custom_path:-$HOME/.openclaw}"
    
    if [ ! -d "$OPENCLAW_DIR" ]; then
        echo -e "${RED}错误: 路径不存在${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ OpenClaw 路径: $OPENCLAW_DIR${NC}"
echo ""

# ============================================
# 2. 检测 Gateway 配置
# ============================================

echo -e "${BLUE}[2/5] 检测 Gateway 配置${NC}"

CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ openclaw.json 不存在${NC}"
    exit 1
fi

# 检测端口
GATEWAY_PORT=$(grep -oE '"port":\s*[0-9]+' "$CONFIG_FILE" | grep -oE '[0-9]+' | head -1)
if [ -z "$GATEWAY_PORT" ]; then
    GATEWAY_PORT=18789
fi

echo -e "${GREEN}✓ Gateway 端口: $GATEWAY_PORT${NC}"

# 检测 Token
TOKEN=$(get_gateway_token)
if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Gateway Token 未找到${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Gateway Token: ${TOKEN:0:10}...${NC}"
echo ""

# ============================================
# 3. 配置 Cron 任务
# ============================================

echo -e "${BLUE}[3/5] 配置关键 Cron 任务${NC}"
echo ""
echo "请输入需要监控的关键 Cron 任务（留空结束）："
echo "格式: 任务名称|任务ID"
echo "示例: daily-report|12345678-1234-1234-1234-123456789abc"
echo ""

CRON_JOBS=()
while true; do
    read -p "任务 $((${#CRON_JOBS[@]} + 1)): " job_input
    
    if [ -z "$job_input" ]; then
        break
    fi
    
    if [[ ! "$job_input" =~ \| ]]; then
        echo -e "${YELLOW}格式错误，请使用: 任务名称|任务ID${NC}"
        continue
    fi
    
    CRON_JOBS+=("$job_input")
done

if [ ${#CRON_JOBS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠ 未配置 Cron 任务，将使用示例配置${NC}"
fi

echo ""

# ============================================
# 4. 配置通知渠道
# ============================================

echo -e "${BLUE}[4/5] 配置通知渠道${NC}"
echo ""
echo "选择通知渠道（多选用空格分隔）："
echo "1) Telegram"
echo "2) 飞书"
echo "3) 邮件"
echo "4) 禁用通知"
echo ""

read -p "选择 [1]: " notify_choice
notify_choice="${notify_choice:-1}"

NOTIFY_CHANNELS=()
if [[ "$notify_choice" == *"1"* ]]; then
    NOTIFY_CHANNELS+=("telegram")
fi
if [[ "$notify_choice" == *"2"* ]]; then
    NOTIFY_CHANNELS+=("feishu")
fi
if [[ "$notify_choice" == *"3"* ]]; then
    NOTIFY_CHANNELS+=("email")
fi

NOTIFY_ENABLED="true"
if [[ "$notify_choice" == "4" ]]; then
    NOTIFY_ENABLED="false"
    NOTIFY_CHANNELS=()
fi

echo -e "${GREEN}✓ 通知配置完成${NC}"
echo ""

# ============================================
# 5. 生成配置文件
# ============================================

echo -e "${BLUE}[5/5] 生成配置文件${NC}"

TARGET_CONFIG="$SCRIPT_DIR/config.json"

# 构建 Cron 任务 JSON
CRON_JSON="["
for i in "${!CRON_JOBS[@]}"; do
    IFS='|' read -r name job_id <<< "${CRON_JOBS[$i]}"
    if [ $i -gt 0 ]; then
        CRON_JSON+=","
    fi
    CRON_JSON+="{\"name\":\"$name\",\"jobId\":\"$job_id\"}"
done
CRON_JSON+="]"

# 构建通知渠道 JSON
CHANNELS_JSON="["
for i in "${!NOTIFY_CHANNELS[@]}"; do
    if [ $i -gt 0 ]; then
        CHANNELS_JSON+=","
    fi
    CHANNELS_JSON+="\"${NOTIFY_CHANNELS[$i]}\""
done
CHANNELS_JSON+="]"

# 生成配置文件
cat > "$TARGET_CONFIG" <<EOF
{
  "gateway": {
    "port": $GATEWAY_PORT,
    "logPath": "/tmp/openclaw",
    "healthCheckInterval": 300
  },
  "locks": {
    "timeoutMinutes": 5,
    "forceRemoveMinutes": 15
  },
  "queue": {
    "stuckThresholdMinutes": 3
  },
  "retry": {
    "maxRetries": 5,
    "intervalSeconds": 120
  },
  "cron": {
    "criticalJobs": $CRON_JSON
  },
  "notifications": {
    "enabled": $NOTIFY_ENABLED,
    "channels": $CHANNELS_JSON
  },
  "backup": {
    "enabled": true,
    "path": "$HOME/.openclaw/backups"
  }
}
EOF

echo -e "${GREEN}✓ 配置文件已生成: $TARGET_CONFIG${NC}"
echo ""

# ============================================
# 6. 安装健康检查脚本
# ============================================

echo -e "${BLUE}[可选] 安装健康检查定时任务${NC}"
echo ""
echo "是否安装健康检查定时任务？"
echo "1) 是 - 使用 cron（Linux）"
echo "2) 是 - 使用 launchd（macOS）"
echo "3) 否 - 手动运行"
echo ""

read -p "选择 [3]: " install_choice
install_choice="${install_choice:-3}"

if [ "$install_choice" = "1" ]; then
    # Linux cron
    echo ""
    echo "添加以下行到 crontab（crontab -e）："
    echo ""
    echo "# OpenClaw PM 健康检查（每 5 分钟）"
    echo "*/5 * * * * $SCRIPT_DIR/gateway-health-check.sh"
    echo ""
    echo "# OpenClaw PM 晨间简报（每天 8:00）"
    echo "0 8 * * * $SCRIPT_DIR/morning-briefing.sh"
    echo ""
elif [ "$install_choice" = "2" ]; then
    # macOS launchd
    PLIST_FILE="$HOME/Library/LaunchAgents/ai.openclaw.health-check.plist"
    
    cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.health-check</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT_DIR/gateway-health-check.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw-health-check.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw-health-check-error.log</string>
</dict>
</plist>
EOF
    
    launchctl load "$PLIST_FILE" 2>/dev/null || true
    
    echo -e "${GREEN}✓ launchd 任务已安装${NC}"
fi

# ============================================
# 完成
# ============================================

echo ""
print_separator "="
echo -e "${GREEN}${BOLD}配置完成！${NC}"
print_separator "="
echo ""
echo "下一步："
echo "  1. 运行快速诊断: $SCRIPT_DIR/quick-diagnose.sh"
echo "  2. 查看晨间简报: $SCRIPT_DIR/morning-briefing.sh"
echo "  3. 查看每日统计: $SCRIPT_DIR/daily-stats.sh"
echo ""
echo "文档: $SCRIPT_DIR/README.md"
echo ""
