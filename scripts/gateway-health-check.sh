#!/bin/bash
# Gateway Health Check Script
# 检查并修复常见的 Gateway 问题
# 优化版本 - 使用统一工具库，跨平台兼容

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 日志文件
LOG_FILE="$HOME/.openclaw/logs/health-check.log"
mkdir -p "$(dirname "$LOG_FILE")"

# 配置
LOCK_TIMEOUT_MINUTES=$(get_config_value "locks.timeoutMinutes" "5")
LOCK_FORCE_REMOVE_MINUTES=$(get_config_value "locks.forceRemoveMinutes" "15")
QUEUE_STUCK_MINUTES=$(get_config_value "queue.stuckThresholdMinutes" "3")
MAX_RETRIES=$(get_config_value "retry.maxRetries" "5")
RETRY_INTERVAL_SECONDS=$(get_config_value "retry.intervalSeconds" "120")

# 状态文件
RETRY_STATE_FILE="$HOME/.openclaw/retry-state.json"
STUCK_DISPATCH_STATE_FILE="$HOME/.openclaw/stuck-dispatch-state.json"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ============================================
# 1. 检查 Gateway 是否运行
# ============================================

check_gateway_running() {
    if ! is_gateway_running; then
        log "WARNING: Gateway not running, attempting to start"
        
        # 尝试启动 gateway
        openclaw gateway start >> "$LOG_FILE" 2>&1 || true
        sleep 5
        
        if is_gateway_running; then
            log "Gateway started successfully"
            sleep 10
            
            # 发送 wake 通知
            send_wake_notification "Gateway 已重启，请检查任务状态" "now"
            notify "info" "Gateway 已自动重启"
            return 0
        else
            log "ERROR: Failed to start gateway"
            notify "error" "Gateway 启动失败"
            return 1
        fi
    fi
    return 0
}

# ============================================
# 2. 检查多个 Gateway 进程
# ============================================

check_multiple_gateways() {
    local pids=$(get_gateway_pids)
    local count=$(echo "$pids" | wc -l | tr -d ' ')
    
    if [ "$count" -gt 1 ]; then
        log "WARNING: Found $count gateway processes, killing old ones"
        
        # 保留最新的进程（最大的 PID）
        local newest=$(echo "$pids" | tail -1)
        for pid in $pids; do
            if [ "$pid" != "$newest" ]; then
                log "Killing old gateway process: $pid"
                kill "$pid" 2>/dev/null || true
            fi
        done
        
        notify "warn" "发现多个 Gateway 进程，已清理旧进程"
        return 1
    fi
    return 0
}

# ============================================
# 3. 检查 Stale Lock 文件
# ============================================

check_stale_locks() {
    local fixed=0
    
    # 检查所有 agent 目录下的 lock 文件
    for lock_file in "$OPENCLAW_DIR"/agents/*/sessions/*.lock; do
        [ -f "$lock_file" ] || continue
        
        # 获取 lock 文件的年龄（分钟）
        local mtime=$(get_file_mtime "$lock_file")
        if [ -z "$mtime" ]; then
            continue
        fi
        
        local age_minutes=$(( ($(date +%s) - $mtime) / 60 ))
        
        if [ "$age_minutes" -gt "$LOCK_TIMEOUT_MINUTES" ]; then
            # 检查 lock 文件中的 PID 是否还在运行
            local lock_pid=$(cat "$lock_file" 2>/dev/null | grep -oE '"pid":\s*[0-9]+' | grep -oE '[0-9]+')
            
            if [ -n "$lock_pid" ]; then
                if ! ps -p "$lock_pid" > /dev/null 2>&1; then
                    # PID 不存在，删除 lock
                    log "Removing stale lock file (pid $lock_pid not running): $lock_file"
                    
                    # 备份后删除
                    create_backup "$lock_file" "stale-lock" > /dev/null
                    rm -f "$lock_file"
                    fixed=1
                    
                elif [ "$age_minutes" -gt "$LOCK_FORCE_REMOVE_MINUTES" ]; then
                    # 超过强制删除时间，即使进程还在也删除
                    log "Removing very old lock file (${age_minutes}min, pid $lock_pid still running): $lock_file"
                    
                    # 备份后删除
                    create_backup "$lock_file" "force-remove" > /dev/null
                    rm -f "$lock_file"
                    fixed=1
                fi
            fi
        fi
    done
    
    if [ $fixed -eq 1 ]; then
        notify "info" "已清理 stale lock 文件"
    fi
    
    return $fixed
}

# ============================================
# 4. 检查 Thinking-only Session
# ============================================

check_thinking_only_sessions() {
    local fixed=0
    
    # 检查所有 session 文件
    for session_file in "$OPENCLAW_DIR"/agents/*/sessions/*.jsonl; do
        [ -f "$session_file" ] || continue
        
        # 获取最后一条消息
        local last_msg=$(tail -1 "$session_file" 2>/dev/null)
        
        if echo "$last_msg" | grep -q '"role":"assistant"'; then
            # 检查是否只有 thinking，没有 text
            if echo "$last_msg" | grep -q '"thinking":' && ! echo "$last_msg" | grep -q '"text":'; then
                # 检查文件年龄
                local mtime=$(get_file_mtime "$session_file")
                if [ -z "$mtime" ]; then
                    continue
                fi
                
                local age_minutes=$(( ($(date +%s) - $mtime) / 60 ))
                
                if [ "$age_minutes" -gt 5 ]; then
                    log "Found thinking-only session (${age_minutes}min old): $session_file"
                    
                    # 备份原文件
                    create_backup "$session_file" "thinking-only" > /dev/null
                    
                    # 标记为 incomplete 而非删除
                    # 在消息中添加 _incomplete 标记
                    local marked_msg=$(echo "$last_msg" | jq '. + {"_incomplete": true, "_marked_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' 2>/dev/null)
                    
                    if [ -n "$marked_msg" ]; then
                        # 替换最后一行
                        head -n -1 "$session_file" > "$session_file.tmp"
                        echo "$marked_msg" >> "$session_file.tmp"
                        mv "$session_file.tmp" "$session_file"
                        log "Marked thinking-only message as incomplete (not deleted)"
                    else
                        # jq 失败，回退到删除方式
                        log "Warning: jq not available, removing message instead"
                        head -n -1 "$session_file" > "$session_file.tmp"
                        mv "$session_file.tmp" "$session_file"
                    fi
                    
                    fixed=1
                fi
            fi
        fi
    done
    
    if [ $fixed -eq 1 ]; then
        notify "info" "已标记 thinking-only session"
    fi
    
    return $fixed
}

# ============================================
# 5. 检查队列卡住
# ============================================

check_stuck_queue() {
    local today_log=$(get_today_log)
    
    if [ ! -f "$today_log" ]; then
        return 0
    fi
    
    # 查找最近的 dequeue 事件
    local last_dequeue=$(grep "dequeue" "$today_log" | tail -1)
    
    if [ -z "$last_dequeue" ]; then
        return 0
    fi
    
    # 提取时间戳
    local dequeue_time=$(echo "$last_dequeue" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}')
    
    if [ -z "$dequeue_time" ]; then
        return 0
    fi
    
    # 计算时间差（分钟）
    local dequeue_epoch=$(date -d "$dequeue_time" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$dequeue_time" +%s 2>/dev/null)
    
    if [ -z "$dequeue_epoch" ]; then
        return 0
    fi
    
    local age_minutes=$(( ($(date +%s) - $dequeue_epoch) / 60 ))
    
    # 检查是否有对应的 done 或 error
    if [ "$age_minutes" -gt "$QUEUE_STUCK_MINUTES" ]; then
        # 检查是否有后续的 done/error
        local has_completion=$(tail -100 "$today_log" | grep -E "(done|error)" | tail -1)
        
        if [ -z "$has_completion" ]; then
            log "WARNING: Queue stuck for ${age_minutes} minutes, restarting gateway"
            
            # 重启 Gateway
            openclaw gateway restart >> "$LOG_FILE" 2>&1 || true
            sleep 10
            
            # 发送 wake 通知
            send_wake_notification "Gateway 因队列卡住已重启" "now"
            notify "warn" "队列卡住，Gateway 已重启"
            
            return 1
        fi
    fi
    
    return 0
}

# ============================================
# 6. 检查 Provider 错误重试
# ============================================

check_provider_errors() {
    local today_log=$(get_today_log)
    
    if [ ! -f "$today_log" ]; then
        return 0
    fi
    
    # 检查最近 5 分钟内是否有 "All models failed" 错误
    local recent_errors=$(tail -500 "$today_log" | grep "All models failed" | wc -l | tr -d ' ')
    
    if [ "$recent_errors" -gt 0 ]; then
        # 读取重试状态
        local retry_count=0
        if [ -f "$RETRY_STATE_FILE" ]; then
            retry_count=$(jq -r '.retryCount // 0' "$RETRY_STATE_FILE" 2>/dev/null || echo "0")
        fi
        
        if [ "$retry_count" -lt "$MAX_RETRIES" ]; then
            log "Provider errors detected ($recent_errors), retry $((retry_count + 1))/$MAX_RETRIES"
            
            # 更新重试状态
            echo "{\"retryCount\": $((retry_count + 1)), \"lastRetry\": $(date +%s)}" > "$RETRY_STATE_FILE"
            
            # 发送 wake 事件触发重试
            send_wake_notification "检测到 Provider 错误，触发重试 ($((retry_count + 1))/$MAX_RETRIES)" "now"
            
            return 1
        else
            log "Max retries reached ($MAX_RETRIES), giving up"
            notify "error" "Provider 错误重试次数已达上限"
            
            # 重置重试计数
            rm -f "$RETRY_STATE_FILE"
        fi
    else
        # 没有错误，重置重试计数
        if [ -f "$RETRY_STATE_FILE" ]; then
            rm -f "$RETRY_STATE_FILE"
        fi
    fi
    
    return 0
}

# ============================================
# 主函数
# ============================================

main() {
    log "=== Health Check Started ==="
    
    local issues_found=0
    
    # 1. 检查 Gateway 是否运行
    if ! check_gateway_running; then
        ((issues_found++))
    fi
    
    # 2. 检查多个 Gateway 进程
    if ! check_multiple_gateways; then
        ((issues_found++))
    fi
    
    # 3. 检查 Stale Lock 文件
    if ! check_stale_locks; then
        ((issues_found++))
    fi
    
    # 4. 检查 Thinking-only Session
    if ! check_thinking_only_sessions; then
        ((issues_found++))
    fi
    
    # 5. 检查队列卡住
    if ! check_stuck_queue; then
        ((issues_found++))
    fi
    
    # 6. 检查 Provider 错误
    if ! check_provider_errors; then
        ((issues_found++))
    fi
    
    if [ $issues_found -eq 0 ]; then
        log "All checks passed"
    else
        log "Found and fixed $issues_found issues"
    fi
    
    log "=== Health Check Completed ==="
    
    # 记录健康检查历史
    if [ -f "$SCRIPT_DIR/health-history.sh" ]; then
        "$SCRIPT_DIR/health-history.sh" record 2>/dev/null || true
    fi
    
    # 清理旧备份（保留最近 10 个）
    cleanup_old_backups "*.lock" 10
    cleanup_old_backups "*.jsonl" 10
}

# 运行主函数
main "$@"
