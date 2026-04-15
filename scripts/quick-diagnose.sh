#!/bin/bash
# quick-diagnose.sh - 快速诊断 OpenClaw 问题
# 优化版本 - 使用统一工具库，跨平台兼容

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 配置
JSON_MODE=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --json) JSON_MODE=true; shift ;;
        *) shift ;;
    esac
done

# 辅助函数
print_status_diag() {
    local status=$1
    local message=$2
    if $JSON_MODE; then
        return
    fi
    print_status "$status" "$message"
}

# ============================================
# 1. 检查 Gateway 进程
# ============================================

check_gateway() {
    local count=$(get_gateway_count)
    
    if [[ $count -eq 0 ]]; then
        print_status_diag error "Gateway 未运行"
        return 1
    elif [[ $count -gt 1 ]]; then
        local pids=$(get_gateway_pids | tr '\n' ' ')
        print_status_diag warn "发现 $count 个 Gateway 进程 (PIDs: $pids)"
        return 1
    else
        local pid=$(get_gateway_pids)
        print_status_diag ok "Gateway 运行中 (PID: $pid)"
        return 0
    fi
}

# ============================================
# 2. 检查 Session Lock 文件
# ============================================

check_session_locks() {
    local lock_count=0
    local stale_count=0
    local now=$(date +%s)
    local stale_list=""
    
    for lock_file in "$OPENCLAW_DIR"/agents/*/sessions/*.lock; do
        [[ -f "$lock_file" ]] || continue
        lock_count=$((lock_count + 1))
        
        local mtime=$(get_file_mtime "$lock_file")
        if [ -z "$mtime" ]; then
            continue
        fi
        
        local age_minutes=$(( (now - mtime) / 60 ))
        if [[ $age_minutes -gt 5 ]]; then
            stale_count=$((stale_count + 1))
            stale_list="$stale_list\n  - $(basename "$lock_file") (${age_minutes}min)"
        fi
    done
    
    if [[ $lock_count -eq 0 ]]; then
        print_status_diag ok "无 session lock 文件"
        return 0
    elif [[ $stale_count -gt 0 ]]; then
        print_status_diag warn "发现 $stale_count 个可能过期的 lock 文件:"
        if ! $JSON_MODE; then
            echo -e "$stale_list"
        fi
        return 1
    else
        print_status_diag ok "$lock_count 个活跃的 session lock"
        return 0
    fi
}

# ============================================
# 3. 检查消息接收
# ============================================

check_message_receiving() {
    local today_log=$(get_today_log)
    
    if [[ ! -f "$today_log" ]]; then
        print_status_diag warn "今日日志文件不存在"
        return 1
    fi
    
    local msg_count=$(safe_count "received message" "$today_log")
    local last_msg=$(grep "received message" "$today_log" 2>/dev/null | tail -1 | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1 || echo "unknown")
    
    if [[ $msg_count -eq 0 ]]; then
        print_status_diag warn "今日未收到任何消息"
    else
        print_status_diag ok "今日收到 $msg_count 条消息 (最后: $last_msg)"
    fi
    return 0
}

# ============================================
# 4. 检查队列状态
# ============================================

check_queue_status() {
    local today_log=$(get_today_log)
    
    if [[ ! -f "$today_log" ]]; then
        return 1
    fi
    
    local enqueue_count=$(safe_count "enqueue" "$today_log")
    local done_count=$(safe_count "task done" "$today_log")
    local error_count=$(safe_count "task error" "$today_log")
    
    local pending=$((enqueue_count - done_count - error_count))
    [[ $pending -lt 0 ]] && pending=0
    
    if [[ $error_count -gt 0 ]]; then
        print_status_diag warn "队列: $enqueue_count 入队, $done_count 完成, $error_count 错误"
    else
        print_status_diag ok "队列: $enqueue_count 入队, $done_count 完成, $pending 待处理"
    fi
    
    return 0
}

# ============================================
# 5. 检查 LLM 错误
# ============================================

check_llm_errors() {
    local today_log=$(get_today_log)
    
    if [[ ! -f "$today_log" ]]; then
        return 1
    fi
    
    local failover_errors=$(safe_count "FailoverError\|All models failed" "$today_log")
    local timeout_errors=$(safe_count "timed out" "$today_log")
    
    if [[ $failover_errors -gt 0 || $timeout_errors -gt 0 ]]; then
        print_status_diag warn "LLM 错误: $failover_errors 次 failover, $timeout_errors 次超时"
        
        local last_error=$(grep -E "FailoverError|All models failed|timed out" "$today_log" 2>/dev/null | tail -1)
        if [[ -n "$last_error" ]]; then
            local error_time=$(echo "$last_error" | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1 || echo "unknown")
            if ! $JSON_MODE; then
                echo "  最后错误: $error_time"
            fi
        fi
        return 1
    else
        print_status_diag ok "无 LLM 错误"
        return 0
    fi
}

# ============================================
# 6. 检查磁盘空间
# ============================================

check_disk_space() {
    local usage=$(df -h "$OPENCLAW_DIR" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ -z "$usage" ]]; then
        print_status_diag warn "无法检查磁盘空间"
        return 1
    fi
    
    if [[ $usage -gt 90 ]]; then
        print_status_diag error "磁盘使用率: $usage%"
        return 1
    elif [[ $usage -gt 80 ]]; then
        print_status_diag warn "磁盘使用率: $usage%"
        return 1
    else
        print_status_diag ok "磁盘使用率: $usage%"
        return 0
    fi
}

# ============================================
# 7. 检查健康检查脚本状态
# ============================================

check_health_script() {
    local health_log="$HOME/.openclaw/logs/health-check.log"
    if [[ ! -f "$health_log" ]]; then
        print_status_diag warn "健康检查日志不存在"
        return 1
    fi
    
    local last_check=$(tail -1 "$health_log" | grep -oE '\[.*\]' | head -1)
    local last_result=$(tail -3 "$health_log" | grep -E "All checks passed|Found and fixed")
    
    if [[ -n "$last_result" ]]; then
        if echo "$last_result" | grep -q "All checks passed"; then
            print_status_diag ok "健康检查正常 $last_check"
        else
            print_status_diag warn "健康检查发现问题 $last_check"
        fi
    else
        print_status_diag info "健康检查: $last_check"
    fi
    return 0
}

# ============================================
# 8. 检查备份状态
# ============================================

check_backup_status() {
    if ! is_backup_enabled; then
        print_status_diag info "备份功能已禁用"
        return 0
    fi
    
    local backup_dir=$(get_backup_path)
    if [[ ! -d "$backup_dir" ]]; then
        print_status_diag warn "备份目录不存在: $backup_dir"
        return 1
    fi
    
    local backup_count=$(find "$backup_dir" -name "*.bak" 2>/dev/null | wc -l | tr -d ' ')
    local backup_size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
    
    print_status_diag ok "备份: $backup_count 个文件, $backup_size"
    return 0
}

# ============================================
# 主函数
# ============================================

main() {
    local issues=0
    
    if ! $JSON_MODE; then
        print_header "🔍 OpenClaw 快速诊断"
        echo "   $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
    fi
    
    check_gateway || ((issues++))
    check_session_locks || ((issues++))
    check_message_receiving
    check_queue_status
    check_llm_errors || ((issues++))
    check_disk_space || ((issues++))
    check_health_script
    check_backup_status
    
    if ! $JSON_MODE; then
        echo ""
        if [[ $issues -eq 0 ]]; then
            echo -e "${GREEN}✓ 所有检查通过${NC}"
        else
            echo -e "${YELLOW}⚠ 发现 $issues 个潜在问题${NC}"
        fi
    fi
    
    return $issues
}

main
