#!/bin/bash
# morning-briefing.sh - 晨间简报
# 优化版本 - 使用统一工具库，跨平台兼容

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 配置
YESTERDAY=$(get_yesterday)
TODAY=$(date +%Y-%m-%d)
YESTERDAY_LOG=$(get_date_log "$YESTERDAY")
TODAY_LOG=$(get_today_log)

# ============================================
# 1. 系统健康状态
# ============================================

print_system_health() {
    echo -e "${BOLD}${CYAN}📊 系统健康状态${NC}"
    echo ""
    
    # Gateway 状态
    if is_gateway_running; then
        local pid=$(get_gateway_pids)
        echo -e "  ${GREEN}✓${NC} Gateway 运行中 (PID: $pid)"
    else
        echo -e "  ${RED}✗${NC} Gateway 未运行"
    fi
    
    # Lock 文件
    local lock_count=$(find "$OPENCLAW_DIR"/agents/*/sessions/*.lock 2>/dev/null | wc -l | tr -d ' ')
    if [[ $lock_count -eq 0 ]]; then
        echo -e "  ${GREEN}✓${NC} 无 session lock 文件"
    else
        echo -e "  ${YELLOW}⚠${NC} $lock_count 个 session lock 文件"
    fi
    
    # 磁盘空间
    local usage=$(df -h "$OPENCLAW_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    if [[ -n "$usage" ]]; then
        if [[ $usage -gt 80 ]]; then
            echo -e "  ${YELLOW}⚠${NC} 磁盘使用率: $usage%"
        else
            echo -e "  ${GREEN}✓${NC} 磁盘使用率: $usage%"
        fi
    fi
    
    echo ""
}

# ============================================
# 2. 昨夜活动摘要
# ============================================

print_yesterday_summary() {
    echo -e "${BOLD}${CYAN}🌙 昨夜活动摘要 ($YESTERDAY)${NC}"
    echo ""
    
    if [[ ! -f "$YESTERDAY_LOG" ]]; then
        echo -e "  ${YELLOW}⚠${NC} 昨日日志文件不存在"
        echo ""
        return
    fi
    
    # 消息统计
    local msg_received=$(safe_count "received message" "$YESTERDAY_LOG")
    local msg_sent=$(safe_count "sent message\|dispatch complete" "$YESTERDAY_LOG")
    echo -e "  📨 消息: 收到 $msg_received 条, 发送 $msg_sent 条"
    
    # Gateway 重启
    local restart_count=$(safe_count "Gateway starting\|openclaw-gateway.*started" "$YESTERDAY_LOG")
    if [[ $restart_count -gt 0 ]]; then
        echo -e "  ${YELLOW}⚠${NC} Gateway 重启: $restart_count 次"
    fi
    
    # 错误统计
    local error_count=$(safe_count "ERROR\|FailoverError\|All models failed" "$YESTERDAY_LOG")
    if [[ $error_count -gt 0 ]]; then
        echo -e "  ${RED}✗${NC} 错误: $error_count 次"
        
        # 显示最后一个错误
        local last_error=$(grep -E "ERROR|FailoverError|All models failed" "$YESTERDAY_LOG" 2>/dev/null | tail -1)
        if [[ -n "$last_error" ]]; then
            local error_time=$(echo "$last_error" | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1 || echo "unknown")
            local error_msg=$(echo "$last_error" | sed 's/.*ERROR/ERROR/' | cut -c1-60)
            echo -e "     最后错误 ($error_time): $error_msg..."
        fi
    else
        echo -e "  ${GREEN}✓${NC} 无错误"
    fi
    
    echo ""
}

# ============================================
# 3. Cron 任务状态
# ============================================

print_cron_status() {
    echo -e "${BOLD}${CYAN}⏰ Cron 任务状态${NC}"
    echo ""
    
    local cron_check_script="$SCRIPT_DIR/check-missed-crons.sh"
    if [[ ! -f "$cron_check_script" ]]; then
        echo -e "  ${YELLOW}⚠${NC} check-missed-crons.sh 不存在"
        echo ""
        return
    fi
    
    # 运行 cron 检查
    local cron_result
    if cron_result=$("$cron_check_script" --json 2>&1); then
        if ! check_optional_dependency "jq"; then
            echo -e "  ${YELLOW}⚠${NC} 无法解析 Cron 检查结果（缺少 jq）"
            echo ""
            return
        fi
        
        local ok_count=$(echo "$cron_result" | jq -r '.ok // 0')
        local missed_count=$(echo "$cron_result" | jq -r '.missed // 0')
        
        if [[ $missed_count -eq 0 ]]; then
            echo -e "  ${GREEN}✓${NC} 所有关键任务已执行 ($ok_count 个)"
        else
            echo -e "  ${YELLOW}⚠${NC} $missed_count 个任务未执行:"
            echo "$cron_result" | jq -r '.jobs[] | select(.status=="missed") | "     - \(.name)"'
        fi
    else
        echo -e "  ${RED}✗${NC} 无法检查 Cron 任务"
    fi
    
    echo ""
}

# ============================================
# 4. 待办事项检查
# ============================================

print_todo_check() {
    echo -e "${BOLD}${CYAN}📝 待办事项${NC}"
    echo ""
    
    local memory_file="$OPENCLAW_DIR/workspace/memory/$TODAY.md"
    if [[ ! -f "$memory_file" ]]; then
        echo -e "  ${GREEN}✓${NC} 今日 memory 文件不存在，无待办事项"
        echo ""
        return
    fi
    
    # 查找 "## In Progress" 部分
    local in_progress=$(sed -n '/^## In Progress/,/^##/p' "$memory_file" | grep -v "^##")
    
    if [[ -z "$in_progress" ]] || echo "$in_progress" | grep -q "（无）"; then
        echo -e "  ${GREEN}✓${NC} 无进行中任务"
    else
        echo -e "  ${YELLOW}⚠${NC} 发现进行中任务:"
        echo "$in_progress" | grep "^###" | sed 's/^###/     -/'
    fi
    
    echo ""
}

# ============================================
# 5. 今日建议
# ============================================

print_suggestions() {
    echo -e "${BOLD}${CYAN}💡 今日建议${NC}"
    echo ""
    
    local suggestions=()
    
    # 检查 Gateway 状态
    if ! is_gateway_running; then
        suggestions+=("启动 Gateway: openclaw gateway start")
    fi
    
    # 检查 Lock 文件
    local lock_count=$(find "$OPENCLAW_DIR"/agents/*/sessions/*.lock 2>/dev/null | wc -l | tr -d ' ')
    if [[ $lock_count -gt 0 ]]; then
        suggestions+=("清理 Lock 文件: $SCRIPT_DIR/gateway-health-check.sh")
    fi
    
    # 检查未回复消息
    local unanswered_script="$SCRIPT_DIR/check-unanswered.sh"
    if [[ -f "$unanswered_script" ]]; then
        local unanswered_count=$("$unanswered_script" --json 2>/dev/null | jq -r '.count // 0' || echo "0")
        if [[ $unanswered_count -gt 0 ]]; then
            suggestions+=("检查未回复消息: $unanswered_script --verbose")
        fi
    fi
    
    # 检查错误日志
    if [[ -f "$YESTERDAY_LOG" ]]; then
        local error_count=$(safe_count "ERROR\|FailoverError" "$YESTERDAY_LOG")
        if [[ $error_count -gt 5 ]]; then
            suggestions+=("检查昨日错误日志: tail -100 $YESTERDAY_LOG | grep ERROR")
        fi
    fi
    
    # 输出建议
    if [[ ${#suggestions[@]} -eq 0 ]]; then
        echo -e "  ${GREEN}✓${NC} 一切正常，无需特别关注"
    else
        for suggestion in "${suggestions[@]}"; do
            echo -e "  ${YELLOW}→${NC} $suggestion"
        done
    fi
    
    echo ""
}

# ============================================
# 6. 快速操作命令
# ============================================

print_quick_commands() {
    echo -e "${BOLD}${CYAN}⚡ 快速操作${NC}"
    echo ""
    echo "  快速诊断:    $SCRIPT_DIR/quick-diagnose.sh"
    echo "  健康检查:    $SCRIPT_DIR/gateway-health-check.sh"
    echo "  未回复消息:  $SCRIPT_DIR/check-unanswered.sh"
    echo "  Cron 任务:   $SCRIPT_DIR/check-missed-crons.sh"
    echo "  每日统计:    $SCRIPT_DIR/daily-stats.sh"
    echo ""
}

# ============================================
# 主函数
# ============================================

main() {
    print_separator "="
    echo -e "${BOLD}${CYAN}☀️  OpenClaw 晨间简报${NC}"
    echo -e "   $(date '+%Y-%m-%d %H:%M:%S')"
    print_separator "="
    echo ""
    
    print_system_health
    print_yesterday_summary
    print_cron_status
    print_todo_check
    print_suggestions
    print_quick_commands
    
    print_separator "="
    echo -e "${GREEN}祝你今天工作顺利！${NC}"
    print_separator "="
}

main
