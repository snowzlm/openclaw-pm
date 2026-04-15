#!/bin/bash
# common.sh - 统一工具库
# 提供跨平台兼容性函数和通用工具

# 颜色定义
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export PURPLE='\033[0;35m'
export BOLD='\033[1m'
export NC='\033[0m'

# 配置文件路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"

# ============================================
# 配置管理
# ============================================

# 加载配置文件
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        echo "$CONFIG_FILE"
    else
        echo "" >&2
    fi
}

# 从配置读取值
get_config_value() {
    local key="$1"
    local default="$2"
    local config=$(load_config)
    
    if [ -z "$config" ]; then
        echo "$default"
        return
    fi
    
    if ! command -v jq &> /dev/null; then
        echo "$default"
        return
    fi
    
    local value=$(jq -r ".$key // \"$default\"" "$config" 2>/dev/null)
    echo "$value"
}

# ============================================
# 跨平台兼容性
# ============================================

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

# 跨平台获取文件修改时间（Unix 时间戳）
get_file_mtime() {
    local file="$1"
    if [[ "$(detect_os)" == "macos" ]]; then
        stat -f %m "$file" 2>/dev/null
    else
        stat -c %Y "$file" 2>/dev/null
    fi
}

# 跨平台获取文件修改时间（人类可读）
get_file_mtime_human() {
    local file="$1"
    if [[ "$(detect_os)" == "macos" ]]; then
        stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file" 2>/dev/null
    else
        stat -c "%y" "$file" 2>/dev/null | cut -d. -f1
    fi
}

# 跨平台获取昨天日期
get_yesterday() {
    if [[ "$(detect_os)" == "macos" ]]; then
        date -v-1d +%Y-%m-%d
    else
        date -d "yesterday" +%Y-%m-%d 2>/dev/null
    fi
}

# 跨平台获取 N 天前日期
get_date_ago() {
    local days="$1"
    if [[ "$(detect_os)" == "macos" ]]; then
        date -v-${days}d +%Y-%m-%d
    else
        date -d "$days days ago" +%Y-%m-%d 2>/dev/null
    fi
}

# ============================================
# 依赖检查
# ============================================

# 检查命令是否存在
check_command() {
    local cmd="$1"
    command -v "$cmd" &> /dev/null
}

# 检查依赖（必需）
check_dependency() {
    local cmd="$1"
    local install_hint="$2"
    
    if ! check_command "$cmd"; then
        echo -e "${RED}ERROR: $cmd not found${NC}" >&2
        if [ -n "$install_hint" ]; then
            echo -e "${YELLOW}Install: $install_hint${NC}" >&2
        fi
        return 1
    fi
    return 0
}

# 检查可选依赖
check_optional_dependency() {
    local cmd="$1"
    check_command "$cmd"
}

# 检查所有必需依赖
check_required_dependencies() {
    local missing=0
    
    if ! check_dependency "curl" "apt-get install curl / brew install curl"; then
        ((missing++))
    fi
    
    if ! check_dependency "jq" "apt-get install jq / brew install jq"; then
        ((missing++))
    fi
    
    return $missing
}

# ============================================
# OpenClaw API
# ============================================

# 获取 Gateway Token
get_gateway_token() {
    local config_file="$OPENCLAW_DIR/openclaw.json"
    if [ ! -f "$config_file" ]; then
        echo "" >&2
        return 1
    fi
    grep -oE '"token":\s*"[^"]+' "$config_file" | head -1 | sed 's/"token":\s*"//'
}

# 获取 Gateway 端口
get_gateway_port() {
    get_config_value "gateway.port" "18789"
}

# 调用 OpenClaw API
call_openclaw_api() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"
    local token=$(get_gateway_token)
    local port=$(get_gateway_port)
    
    if [ -z "$token" ]; then
        echo '{"error":"token not found"}' >&2
        return 1
    fi
    
    local url="http://127.0.0.1:${port}${endpoint}"
    
    if [ "$method" = "POST" ]; then
        curl -s -X POST "$url" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null
    else
        curl -s "$url" -H "Authorization: Bearer $token" 2>/dev/null
    fi
}

# 发送 Cron Wake 通知
send_wake_notification() {
    local message="$1"
    local mode="${2:-now}"
    
    local data="{\"text\":\"$message\",\"mode\":\"$mode\"}"
    call_openclaw_api "/api/cron/wake" "POST" "$data"
}

# ============================================
# Gateway 管理
# ============================================

# 获取 Gateway 进程 PID
get_gateway_pids() {
    ps aux | grep "[o]penclaw-gateway" | awk '{print $2}' | sort -n
}

# 检查 Gateway 是否运行
is_gateway_running() {
    [ -n "$(get_gateway_pids)" ]
}

# 获取 Gateway 进程数量
get_gateway_count() {
    get_gateway_pids | wc -l | tr -d ' '
}

# ============================================
# 日志管理
# ============================================

# 获取日志路径
get_log_path() {
    get_config_value "gateway.logPath" "/tmp/openclaw"
}

# 获取今日日志文件
get_today_log() {
    local log_path=$(get_log_path)
    echo "$log_path/openclaw-$(date +%Y-%m-%d).log"
}

# 获取指定日期日志文件
get_date_log() {
    local date="$1"
    local log_path=$(get_log_path)
    echo "$log_path/openclaw-${date}.log"
}

# ============================================
# 备份管理
# ============================================

# 检查是否启用备份
is_backup_enabled() {
    local enabled=$(get_config_value "backup.enabled" "true")
    [ "$enabled" = "true" ]
}

# 获取备份路径
get_backup_path() {
    local path=$(get_config_value "backup.path" "$HOME/.openclaw/backups")
    # 展开环境变量
    eval echo "$path"
}

# 创建备份
create_backup() {
    local file="$1"
    local reason="${2:-manual}"
    
    if ! is_backup_enabled; then
        return 0
    fi
    
    if [ ! -f "$file" ]; then
        return 1
    fi
    
    local backup_dir=$(get_backup_path)
    mkdir -p "$backup_dir"
    
    local filename=$(basename "$file")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/${filename}.${timestamp}.${reason}.bak"
    
    cp "$file" "$backup_file" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "$backup_file"
        return 0
    else
        return 1
    fi
}

# 清理旧备份（保留最近 N 个）
cleanup_old_backups() {
    local pattern="$1"
    local keep="${2:-10}"
    
    local backup_dir=$(get_backup_path)
    if [ ! -d "$backup_dir" ]; then
        return 0
    fi
    
    # 列出匹配的备份文件，按时间排序，删除旧的
    ls -t "$backup_dir"/$pattern*.bak 2>/dev/null | tail -n +$((keep + 1)) | xargs rm -f 2>/dev/null
}

# ============================================
# 通知系统
# ============================================

# 检查是否启用通知
is_notification_enabled() {
    local enabled=$(get_config_value "notifications.enabled" "true")
    [ "$enabled" = "true" ]
}

# 发送通知
notify() {
    local level="$1"  # info/warn/error
    local message="$2"
    
    if ! is_notification_enabled; then
        return 0
    fi
    
    # 根据级别添加前缀
    local prefix=""
    case $level in
        info) prefix="[信息]" ;;
        warn) prefix="[警告]" ;;
        error) prefix="[错误]" ;;
    esac
    
    # 发送 wake 通知
    send_wake_notification "$prefix $message" "now"
}

# ============================================
# 工具函数
# ============================================

# 安全计数（避免 grep -c 返回非零退出码）
safe_count() {
    local pattern="$1"
    local file="$2"
    
    if [ -z "$file" ]; then
        # 从 stdin 读取
        grep -c "$pattern" 2>/dev/null || echo "0"
    else
        # 从文件读取
        grep -c "$pattern" "$file" 2>/dev/null || echo "0"
    fi
}

# 打印状态消息
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        ok) echo -e "${GREEN}✓${NC} $message" ;;
        warn) echo -e "${YELLOW}⚠${NC} $message" ;;
        error) echo -e "${RED}✗${NC} $message" ;;
        info) echo -e "${BLUE}ℹ${NC} $message" ;;
        *) echo "$message" ;;
    esac
}

# 打印分隔线
print_separator() {
    local char="${1:-━}"
    local length="${2:-50}"
    printf "${CYAN}%${length}s${NC}\n" | tr ' ' "$char"
}

# 打印标题
print_header() {
    local title="$1"
    print_separator
    echo -e "${BOLD}${CYAN}$title${NC}"
    print_separator
}

# ============================================
# 初始化检查
# ============================================

# 初始化（脚本开始时调用）
init_common() {
    # 检查配置文件
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}Warning: config.json not found, using defaults${NC}" >&2
    fi
    
    # 创建必要的目录
    mkdir -p "$(get_backup_path)" 2>/dev/null
    mkdir -p "$(get_log_path)" 2>/dev/null
}

# 导出函数（供其他脚本使用）
export -f detect_os
export -f get_file_mtime
export -f get_file_mtime_human
export -f get_yesterday
export -f get_date_ago
export -f check_command
export -f check_dependency
export -f get_gateway_token
export -f get_gateway_port
export -f call_openclaw_api
export -f send_wake_notification
export -f get_gateway_pids
export -f is_gateway_running
export -f get_gateway_count
export -f get_log_path
export -f get_today_log
export -f get_date_log
export -f is_backup_enabled
export -f get_backup_path
export -f create_backup
export -f cleanup_old_backups
export -f is_notification_enabled
export -f notify
export -f safe_count
export -f print_status
export -f print_separator
export -f print_header
export -f get_config_value
