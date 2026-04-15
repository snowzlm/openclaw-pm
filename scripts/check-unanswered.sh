#!/bin/bash
# check-unanswered.sh - 检测未回复的用户消息
# 优化版本 - 使用统一工具库，添加自动恢复功能

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 配置
MAX_AGE_HOURS=24  # 只检查最近 24 小时内有活动的 session

# 参数解析
JSON_OUTPUT=false
VERBOSE=false
INCLUDE_OLD=false
AUTO_RECOVER=false
AGENT_FILTER=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --all)
            INCLUDE_OLD=true
            shift
            ;;
        --recover)
            AUTO_RECOVER=true
            shift
            ;;
        --agent)
            AGENT_FILTER="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "检测未回复的用户消息"
            echo ""
            echo "Options:"
            echo "  --json          JSON 格式输出"
            echo "  --verbose, -v   显示详细信息"
            echo "  --all           包括旧 session（默认只检查 24h 内活跃的）"
            echo "  --recover       自动发送恢复消息"
            echo "  --agent <id>    只检查指定 agent"
            echo "  --help, -h      显示帮助"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# 检查依赖
if ! check_optional_dependency "jq"; then
    if $JSON_OUTPUT; then
        echo '{"error": "jq not found", "unanswered": []}'
        exit 1
    else
        echo -e "${RED}Error: jq not found${NC}"
        echo "Install: apt-get install jq / brew install jq"
        exit 1
    fi
fi

# 检查 agents 目录
if [ ! -d "$OPENCLAW_DIR/agents" ]; then
    if $JSON_OUTPUT; then
        echo '{"error": "agents directory not found", "unanswered": []}'
    else
        echo -e "${RED}Error: agents directory not found${NC}"
    fi
    exit 1
fi

# 收集未回复的 session
declare -a UNANSWERED_SESSIONS
declare -a UNANSWERED_DETAILS

# 检查单个 session
check_session() {
    local session_file="$1"
    local agent_id="$2"
    
    # 跳过 .deleted 和 .lock 文件
    [[ "$session_file" == *.deleted ]] && return
    [[ "$session_file" == *.lock ]] && return
    
    # 过滤 agent
    if [ -n "$AGENT_FILTER" ] && [ "$agent_id" != "$AGENT_FILTER" ]; then
        return
    fi
    
    # 检查文件修改时间（除非 --all）
    if ! $INCLUDE_OLD; then
        local mod_time=$(get_file_mtime "$session_file")
        if [ -z "$mod_time" ]; then
            return
        fi
        
        local now=$(date +%s)
        local age_hours=$(( (now - mod_time) / 3600 ))
        
        if [ $age_hours -gt $MAX_AGE_HOURS ]; then
            return
        fi
    fi
    
    # 读取 session 文件，找最后一条消息
    local last_line=$(tail -1 "$session_file" 2>/dev/null)
    
    # 检查是否是有效的 JSON
    if ! echo "$last_line" | jq -e . >/dev/null 2>&1; then
        return
    fi
    
    # 获取最后一条消息的 role
    local last_role=$(echo "$last_line" | jq -r '.message.role // .role // empty' 2>/dev/null)
    
    # 如果最后一条是 user 消息，说明没有回复
    if [ "$last_role" = "user" ]; then
        local session_name=$(basename "$session_file" .jsonl)
        local session_key="agent:${agent_id}:${session_name}"
        
        # 获取消息内容预览
        local content=$(echo "$last_line" | jq -r '.message.content // .content // empty' 2>/dev/null)
        if [ -z "$content" ]; then
            content=$(echo "$last_line" | jq -r '.message.content[0].text // empty' 2>/dev/null)
        fi
        content=$(echo "$content" | head -c 100)
        
        # 获取时间戳
        local timestamp=$(echo "$last_line" | jq -r '.timestamp // empty' 2>/dev/null)
        if [ -z "$timestamp" ]; then
            timestamp=$(get_file_mtime_human "$session_file")
        fi
        
        UNANSWERED_SESSIONS+=("$session_key")
        UNANSWERED_DETAILS+=("$session_key|$timestamp|$content")
    fi
}

# 遍历所有 agent 的 session
for agent_dir in "$OPENCLAW_DIR"/agents/*/; do
    [ -d "$agent_dir" ] || continue
    
    agent_id=$(basename "$agent_dir")
    sessions_dir="$agent_dir/sessions"
    
    [ -d "$sessions_dir" ] || continue
    
    for session_file in "$sessions_dir"/*.jsonl; do
        [ -f "$session_file" ] || continue
        check_session "$session_file" "$agent_id"
    done
done

# 自动恢复
if $AUTO_RECOVER && [ ${#UNANSWERED_SESSIONS[@]} -gt 0 ]; then
    if ! $JSON_OUTPUT; then
        echo -e "${BLUE}正在发送恢复消息...${NC}"
    fi
    
    local recovered=0
    local failed=0
    
    for session_key in "${UNANSWERED_SESSIONS[@]}"; do
        # 提取 agent 和 session
        local agent=$(echo "$session_key" | cut -d: -f2)
        local session=$(echo "$session_key" | cut -d: -f3)
        
        if ! $JSON_OUTPUT; then
            echo -e "  ${CYAN}→${NC} $session_key"
        fi
        
        # 尝试使用 OpenClaw CLI 发送消息
        if check_command "openclaw"; then
            # 构造恢复消息
            local recovery_msg="[自动恢复] 检测到有未回复的消息，正在处理..."
            
            # 尝试通过 OpenClaw CLI 发送（如果支持）
            # 注意：这需要 OpenClaw 支持 sessions_send 命令
            if openclaw sessions send --session "$session_key" --message "$recovery_msg" 2>/dev/null; then
                ((recovered++))
                if ! $JSON_OUTPUT; then
                    echo -e "    ${GREEN}✓${NC} 已发送恢复消息"
                fi
            else
                # 回退到 wake 通知
                send_wake_notification "[未回复消息恢复] session $session_key 有未回复的消息" "now"
                ((recovered++))
                if ! $JSON_OUTPUT; then
                    echo -e "    ${YELLOW}⚠${NC} 已发送 wake 通知（sessions_send 不可用）"
                fi
            fi
        else
            # OpenClaw CLI 不可用，使用 wake 通知
            send_wake_notification "[未回复消息恢复] session $session_key 有未回复的消息" "now"
            ((recovered++))
            if ! $JSON_OUTPUT; then
                echo -e "    ${YELLOW}⚠${NC} 已发送 wake 通知（openclaw CLI 不可用）"
            fi
        fi
    done
    
    if ! $JSON_OUTPUT; then
        if [ $recovered -gt 0 ]; then
            echo -e "${GREEN}✓ 已处理 $recovered 个 session${NC}"
        fi
        if [ $failed -gt 0 ]; then
            echo -e "${RED}✗ $failed 个 session 处理失败${NC}"
        fi
    fi
fi

# 输出结果
if $JSON_OUTPUT; then
    # JSON 格式输出
    echo -n '{"unanswered": ['
    first=true
    for detail in "${UNANSWERED_DETAILS[@]}"; do
        IFS='|' read -r key timestamp content <<< "$detail"
        if $first; then
            first=false
        else
            echo -n ','
        fi
        # 转义 JSON 字符串
        content_escaped=$(echo "$content" | jq -Rs '.')
        echo -n "{\"session_key\": \"$key\", \"timestamp\": \"$timestamp\", \"preview\": $content_escaped}"
    done
    echo '], "count": '${#UNANSWERED_SESSIONS[@]}'}'
else
    # 人类可读格式
    if [ ${#UNANSWERED_SESSIONS[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ 没有未回复的消息${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}⚠ 发现 ${#UNANSWERED_SESSIONS[@]} 个未回复的 session${NC}"
    echo ""
    
    for detail in "${UNANSWERED_DETAILS[@]}"; do
        IFS='|' read -r key timestamp content <<< "$detail"
        echo -e "${CYAN}Session:${NC} $key"
        echo -e "${BLUE}Time:${NC} $timestamp"
        if $VERBOSE && [ -n "$content" ]; then
            echo -e "${BLUE}Preview:${NC} ${content:0:80}..."
        fi
        echo ""
    done
    
    if ! $AUTO_RECOVER; then
        echo -e "${YELLOW}提示: 使用 --recover 自动发送恢复通知${NC}"
    fi
    exit 1
fi
