#!/bin/bash
# daily-stats.sh - 每日活动统计
# 优化版本 - 使用统一工具库，跨平台兼容

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 配置
TARGET_DATE="${1:-$(date +%Y-%m-%d)}"
TARGET_LOG=$(get_date_log "$TARGET_DATE")

# 检查日志文件
if [[ ! -f "$TARGET_LOG" ]]; then
    echo -e "${RED}✗${NC} 日志文件不存在: $TARGET_LOG"
    exit 1
fi

# ============================================
# 1. 基本统计
# ============================================

print_basic_stats() {
    echo -e "${BOLD}${CYAN}📊 基本统计${NC}"
    echo ""
    
    local msg_received=$(safe_count "received message" "$TARGET_LOG")
    local msg_sent=$(safe_count "sent message\|dispatch complete" "$TARGET_LOG")
    local sessions=$(grep "received message" "$TARGET_LOG" 2>/dev/null | grep -oE 'session:[a-zA-Z0-9-]+' | sort -u | wc -l | tr -d ' ')
    
    echo "  📨 消息接收: $msg_received 条"
    echo "  📤 消息发送: $msg_sent 条"
    echo "  💬 活跃会话: $sessions 个"
    echo ""
}

# ============================================
# 2. 按小时分布
# ============================================

print_hourly_distribution() {
    echo -e "${BOLD}${CYAN}⏰ 按小时分布${NC}"
    echo ""
    
    if ! check_optional_dependency "awk"; then
        echo -e "  ${YELLOW}⚠${NC} 缺少 awk，跳过小时分布统计"
        echo ""
        return
    fi
    
    # 提取时间戳并统计每小时的消息数
    local hourly_data=$(grep "received message" "$TARGET_LOG" 2>/dev/null | \
        grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | \
        cut -d: -f1 | \
        sort | uniq -c | \
        awk '{printf "  %02d:00 - %02d:59  ", $2, $2; for(i=0;i<$1;i+=5) printf "█"; printf " (%d)\n", $1}')
    
    if [[ -z "$hourly_data" ]]; then
        echo "  无消息记录"
    else
        echo "$hourly_data"
    fi
    
    echo ""
}

# ============================================
# 3. 错误分析
# ============================================

print_error_analysis() {
    echo -e "${BOLD}${CYAN}❌ 错误分析${NC}"
    echo ""
    
    local total_errors=$(safe_count "ERROR\|FailoverError\|All models failed" "$TARGET_LOG")
    
    if [[ $total_errors -eq 0 ]]; then
        echo -e "  ${GREEN}✓${NC} 无错误记录"
        echo ""
        return
    fi
    
    echo "  总错误数: $total_errors"
    echo ""
    
    # 错误类型统计
    local failover_errors=$(safe_count "FailoverError\|All models failed" "$TARGET_LOG")
    local timeout_errors=$(safe_count "timed out" "$TARGET_LOG")
    local connection_errors=$(safe_count "ECONNREFUSED\|ECONNRESET\|ETIMEDOUT" "$TARGET_LOG")
    local other_errors=$((total_errors - failover_errors - timeout_errors - connection_errors))
    
    echo "  错误类型:"
    if [[ $failover_errors -gt 0 ]]; then
        echo "    - Failover 错误: $failover_errors"
    fi
    if [[ $timeout_errors -gt 0 ]]; then
        echo "    - 超时错误: $timeout_errors"
    fi
    if [[ $connection_errors -gt 0 ]]; then
        echo "    - 连接错误: $connection_errors"
    fi
    if [[ $other_errors -gt 0 ]]; then
        echo "    - 其他错误: $other_errors"
    fi
    
    echo ""
    
    # 最近 3 个错误
    echo "  最近错误:"
    grep -E "ERROR|FailoverError|All models failed" "$TARGET_LOG" 2>/dev/null | tail -3 | while read -r line; do
        local error_time=$(echo "$line" | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1 || echo "unknown")
        local error_msg=$(echo "$line" | sed 's/.*ERROR/ERROR/' | cut -c1-70)
        echo "    [$error_time] $error_msg..."
    done
    
    echo ""
}

# ============================================
# 4. Gateway 状态
# ============================================

print_gateway_status() {
    echo -e "${BOLD}${CYAN}🔧 Gateway 状态${NC}"
    echo ""
    
    local start_count=$(safe_count "Gateway starting\|openclaw-gateway.*started" "$TARGET_LOG")
    local stop_count=$(safe_count "Gateway stopping\|openclaw-gateway.*stopped" "$TARGET_LOG")
    
    if [[ $start_count -eq 0 ]]; then
        echo "  无 Gateway 启动记录"
    else
        echo "  启动次数: $start_count"
        
        # 显示启动时间
        grep -E "Gateway starting|openclaw-gateway.*started" "$TARGET_LOG" 2>/dev/null | \
            grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | \
            head -5 | \
            while read -r time; do
                echo "    - $time"
            done
    fi
    
    if [[ $stop_count -gt 0 ]]; then
        echo "  停止次数: $stop_count"
    fi
    
    echo ""
}

# ============================================
# 5. 性能指标
# ============================================

print_performance_metrics() {
    echo -e "${BOLD}${CYAN}⚡ 性能指标${NC}"
    echo ""
    
    # 平均响应时间（简化版，基于日志中的时间戳）
    local dispatch_times=$(grep "dispatch complete" "$TARGET_LOG" 2>/dev/null | wc -l | tr -d ' ')
    
    if [[ $dispatch_times -eq 0 ]]; then
        echo "  无性能数据"
    else
        echo "  完成任务数: $dispatch_times"
        
        # 检查是否有慢查询
        local slow_queries=$(grep -E "took [0-9]{4,}ms|took [0-9]+s" "$TARGET_LOG" 2>/dev/null | wc -l | tr -d ' ')
        if [[ $slow_queries -gt 0 ]]; then
            echo -e "  ${YELLOW}⚠${NC} 慢查询: $slow_queries 次"
        fi
    fi
    
    echo ""
}

# ============================================
# 6. 渠道统计
# ============================================

print_channel_stats() {
    echo -e "${BOLD}${CYAN}📡 渠道统计${NC}"
    echo ""
    
    if ! check_optional_dependency "grep"; then
        echo "  无法统计渠道信息"
        echo ""
        return
    fi
    
    # 统计各渠道的消息数
    local telegram_count=$(grep "received message" "$TARGET_LOG" 2>/dev/null | grep -c "telegram" || echo "0")
    local discord_count=$(grep "received message" "$TARGET_LOG" 2>/dev/null | grep -c "discord" || echo "0")
    local slack_count=$(grep "received message" "$TARGET_LOG" 2>/dev/null | grep -c "slack" || echo "0")
    local other_count=$(grep "received message" "$TARGET_LOG" 2>/dev/null | grep -cvE "telegram|discord|slack" || echo "0")
    
    local has_data=false
    
    if [[ $telegram_count -gt 0 ]]; then
        echo "  Telegram: $telegram_count 条"
        has_data=true
    fi
    if [[ $discord_count -gt 0 ]]; then
        echo "  Discord: $discord_count 条"
        has_data=true
    fi
    if [[ $slack_count -gt 0 ]]; then
        echo "  Slack: $slack_count 条"
        has_data=true
    fi
    if [[ $other_count -gt 0 ]]; then
        echo "  其他: $other_count 条"
        has_data=true
    fi
    
    if ! $has_data; then
        echo "  无渠道数据"
    fi
    
    echo ""
}

# ============================================
# 7. 总结
# ============================================

print_summary() {
    echo -e "${BOLD}${CYAN}📝 总结${NC}"
    echo ""
    
    local msg_received=$(safe_count "received message" "$TARGET_LOG")
    local error_count=$(safe_count "ERROR\|FailoverError" "$TARGET_LOG")
    local restart_count=$(safe_count "Gateway starting" "$TARGET_LOG")
    
    # 计算健康分数（简化版）
    local health_score=100
    
    if [[ $error_count -gt 0 ]]; then
        health_score=$((health_score - error_count * 2))
        [[ $health_score -lt 0 ]] && health_score=0
    fi
    
    if [[ $restart_count -gt 1 ]]; then
        health_score=$((health_score - (restart_count - 1) * 10))
        [[ $health_score -lt 0 ]] && health_score=0
    fi
    
    # 输出健康分数
    if [[ $health_score -ge 90 ]]; then
        echo -e "  健康分数: ${GREEN}$health_score/100${NC} (优秀)"
    elif [[ $health_score -ge 70 ]]; then
        echo -e "  健康分数: ${YELLOW}$health_score/100${NC} (良好)"
    else
        echo -e "  健康分数: ${RED}$health_score/100${NC} (需要关注)"
    fi
    
    # 活跃度评估
    if [[ $msg_received -gt 100 ]]; then
        echo "  活跃度: 高"
    elif [[ $msg_received -gt 20 ]]; then
        echo "  活跃度: 中"
    else
        echo "  活跃度: 低"
    fi
    
    # 稳定性评估
    if [[ $restart_count -eq 0 ]]; then
        echo "  稳定性: 优秀"
    elif [[ $restart_count -eq 1 ]]; then
        echo "  稳定性: 良好"
    else
        echo "  稳定性: 需要关注"
    fi
    
    echo ""
}

# ============================================
# 主函数
# ============================================

main() {
    print_separator "="
    echo -e "${BOLD}${CYAN}📈 OpenClaw 每日统计${NC}"
    echo -e "   日期: $TARGET_DATE"
    echo -e "   日志: $(basename "$TARGET_LOG")"
    print_separator "="
    echo ""
    
    print_basic_stats
    print_hourly_distribution
    print_error_analysis
    print_gateway_status
    print_performance_metrics
    print_channel_stats
    print_summary
    
    print_separator "="
}

main
