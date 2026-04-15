#!/bin/bash
# health-history.sh - 健康检查历史追踪
# 记录和查询健康检查历史

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 配置
HISTORY_DIR="$OPENCLAW_DIR/health-history"
HISTORY_FILE="$HISTORY_DIR/health-checks.jsonl"
MAX_HISTORY_DAYS=30

# 参数解析
ACTION="list"
DAYS=7
JSON_OUTPUT=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        record)
            ACTION="record"
            shift
            ;;
        list|show)
            ACTION="list"
            shift
            ;;
        stats)
            ACTION="stats"
            shift
            ;;
        clean)
            ACTION="clean"
            shift
            ;;
        --days)
            DAYS="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [action] [options]"
            echo ""
            echo "健康检查历史追踪"
            echo ""
            echo "Actions:"
            echo "  record              记录健康检查结果（由 gateway-health-check.sh 调用）"
            echo "  list, show          显示历史记录（默认）"
            echo "  stats               显示统计信息"
            echo "  clean               清理旧记录"
            echo ""
            echo "Options:"
            echo "  --days <n>          显示最近 n 天的记录（默认 7）"
            echo "  --json              JSON 格式输出"
            echo "  --verbose, -v       显示详细信息"
            echo "  --help, -h          显示帮助"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# 检查依赖
check_required_dependencies

# 创建历史目录
mkdir -p "$HISTORY_DIR"

# ============================================
# 记录健康检查结果
# ============================================

record_check() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local date=$(date +"%Y-%m-%d")
    local time=$(date +"%H:%M:%S")
    
    # 收集健康检查结果
    local gateway_running=false
    local gateway_count=0
    local lock_count=0
    local queue_stuck=false
    local provider_errors=0
    
    # 检查 Gateway
    if is_gateway_running; then
        gateway_running=true
        gateway_count=$(get_gateway_count)
    fi
    
    # 检查 Lock 文件
    lock_count=$(find "$OPENCLAW_DIR/agents" -name "*.lock" 2>/dev/null | wc -l | tr -d ' ')
    
    # 检查 Provider 错误
    local today_log=$(get_today_log)
    if [ -f "$today_log" ]; then
        provider_errors=$(grep -c "provider.*error\|LLM.*failed" "$today_log" 2>/dev/null || echo 0)
    fi
    
    # 构造 JSON 记录
    local record=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "date": "$date",
  "time": "$time",
  "gateway": {
    "running": $gateway_running,
    "count": $gateway_count
  },
  "locks": {
    "count": $lock_count
  },
  "queue": {
    "stuck": $queue_stuck
  },
  "provider": {
    "errors": $provider_errors
  }
}
EOF
)
    
    # 追加到历史文件
    echo "$record" >> "$HISTORY_FILE"
    
    if ! $JSON_OUTPUT; then
        echo -e "${GREEN}✓ 已记录健康检查结果${NC}"
    fi
}

# ============================================
# 显示历史记录
# ============================================

list_history() {
    if [ ! -f "$HISTORY_FILE" ]; then
        if $JSON_OUTPUT; then
            echo '{"history": [], "count": 0}'
        else
            echo -e "${YELLOW}没有历史记录${NC}"
        fi
        return
    fi
    
    # 计算日期范围
    local cutoff_date=$(get_date_ago "$DAYS")
    
    if $JSON_OUTPUT; then
        # JSON 格式输出
        echo -n '{"history": ['
        local first=true
        while IFS= read -r line; do
            local record_date=$(echo "$line" | jq -r '.date')
            if [[ "$record_date" > "$cutoff_date" ]] || [[ "$record_date" == "$cutoff_date" ]]; then
                if $first; then
                    first=false
                else
                    echo -n ','
                fi
                echo -n "$line"
            fi
        done < "$HISTORY_FILE"
        echo '], "days": '$DAYS'}'
    else
        # 人类可读格式
        print_header "健康检查历史（最近 $DAYS 天）"
        
        local count=0
        while IFS= read -r line; do
            local record_date=$(echo "$line" | jq -r '.date')
            if [[ "$record_date" > "$cutoff_date" ]] || [[ "$record_date" == "$cutoff_date" ]]; then
                local timestamp=$(echo "$line" | jq -r '.timestamp')
                local gateway_running=$(echo "$line" | jq -r '.gateway.running')
                local gateway_count=$(echo "$line" | jq -r '.gateway.count')
                local lock_count=$(echo "$line" | jq -r '.locks.count')
                local provider_errors=$(echo "$line" | jq -r '.provider.errors')
                
                echo -e "${CYAN}$timestamp${NC}"
                echo -e "  Gateway: $([ "$gateway_running" = "true" ] && echo "${GREEN}运行中${NC} ($gateway_count)" || echo "${RED}未运行${NC}")"
                echo -e "  Locks: $lock_count"
                echo -e "  Provider 错误: $provider_errors"
                echo ""
                
                ((count++))
            fi
        done < "$HISTORY_FILE"
        
        echo -e "${BLUE}总计: $count 条记录${NC}"
    fi
}

# ============================================
# 显示统计信息
# ============================================

show_stats() {
    if [ ! -f "$HISTORY_FILE" ]; then
        if $JSON_OUTPUT; then
            echo '{"error": "no history"}'
        else
            echo -e "${YELLOW}没有历史记录${NC}"
        fi
        return
    fi
    
    # 计算日期范围
    local cutoff_date=$(get_date_ago "$DAYS")
    
    # 统计数据
    local total_checks=0
    local gateway_down=0
    local multiple_gateway=0
    local total_locks=0
    local total_errors=0
    
    while IFS= read -r line; do
        local record_date=$(echo "$line" | jq -r '.date')
        if [[ "$record_date" > "$cutoff_date" ]] || [[ "$record_date" == "$cutoff_date" ]]; then
            ((total_checks++))
            
            local gateway_running=$(echo "$line" | jq -r '.gateway.running')
            local gateway_count=$(echo "$line" | jq -r '.gateway.count')
            local lock_count=$(echo "$line" | jq -r '.locks.count')
            local provider_errors=$(echo "$line" | jq -r '.provider.errors')
            
            [ "$gateway_running" = "false" ] && ((gateway_down++))
            [ "$gateway_count" -gt 1 ] && ((multiple_gateway++))
            total_locks=$((total_locks + lock_count))
            total_errors=$((total_errors + provider_errors))
        fi
    done < "$HISTORY_FILE"
    
    if $JSON_OUTPUT; then
        cat <<EOF
{
  "days": $DAYS,
  "total_checks": $total_checks,
  "gateway_down": $gateway_down,
  "multiple_gateway": $multiple_gateway,
  "total_locks": $total_locks,
  "total_errors": $total_errors,
  "avg_locks_per_check": $(echo "scale=2; $total_locks / $total_checks" | bc 2>/dev/null || echo 0),
  "avg_errors_per_check": $(echo "scale=2; $total_errors / $total_checks" | bc 2>/dev/null || echo 0)
}
EOF
    else
        print_header "健康检查统计（最近 $DAYS 天）"
        
        echo -e "${CYAN}总检查次数:${NC} $total_checks"
        echo -e "${CYAN}Gateway 停止:${NC} $gateway_down 次"
        echo -e "${CYAN}多个 Gateway:${NC} $multiple_gateway 次"
        echo -e "${CYAN}总 Lock 数:${NC} $total_locks"
        echo -e "${CYAN}总错误数:${NC} $total_errors"
        
        if [ $total_checks -gt 0 ]; then
            local avg_locks=$(echo "scale=2; $total_locks / $total_checks" | bc 2>/dev/null || echo 0)
            local avg_errors=$(echo "scale=2; $total_errors / $total_checks" | bc 2>/dev/null || echo 0)
            echo -e "${CYAN}平均 Lock/次:${NC} $avg_locks"
            echo -e "${CYAN}平均错误/次:${NC} $avg_errors"
        fi
        
        # 健康评分
        local health_score=100
        [ $gateway_down -gt 0 ] && health_score=$((health_score - gateway_down * 10))
        [ $multiple_gateway -gt 0 ] && health_score=$((health_score - multiple_gateway * 5))
        [ $total_locks -gt 10 ] && health_score=$((health_score - 10))
        [ $total_errors -gt 50 ] && health_score=$((health_score - 20))
        [ $health_score -lt 0 ] && health_score=0
        
        echo ""
        if [ $health_score -ge 80 ]; then
            echo -e "${GREEN}健康评分: $health_score/100 (优秀)${NC}"
        elif [ $health_score -ge 60 ]; then
            echo -e "${YELLOW}健康评分: $health_score/100 (良好)${NC}"
        else
            echo -e "${RED}健康评分: $health_score/100 (需要关注)${NC}"
        fi
    fi
}

# ============================================
# 清理旧记录
# ============================================

clean_old_records() {
    if [ ! -f "$HISTORY_FILE" ]; then
        if ! $JSON_OUTPUT; then
            echo -e "${YELLOW}没有历史记录${NC}"
        fi
        return
    fi
    
    # 计算截止日期
    local cutoff_date=$(get_date_ago "$MAX_HISTORY_DAYS")
    
    # 备份原文件
    create_backup "$HISTORY_FILE" "cleanup"
    
    # 过滤记录
    local temp_file="$HISTORY_FILE.tmp"
    local kept=0
    local removed=0
    
    while IFS= read -r line; do
        local record_date=$(echo "$line" | jq -r '.date')
        if [[ "$record_date" > "$cutoff_date" ]] || [[ "$record_date" == "$cutoff_date" ]]; then
            echo "$line" >> "$temp_file"
            ((kept++))
        else
            ((removed++))
        fi
    done < "$HISTORY_FILE"
    
    # 替换原文件
    mv "$temp_file" "$HISTORY_FILE"
    
    if $JSON_OUTPUT; then
        echo "{\"kept\": $kept, \"removed\": $removed}"
    else
        echo -e "${GREEN}✓ 已清理 $removed 条旧记录，保留 $kept 条${NC}"
    fi
}

# ============================================
# 主逻辑
# ============================================

case $ACTION in
    record)
        record_check
        ;;
    list)
        list_history
        ;;
    stats)
        show_stats
        ;;
    clean)
        clean_old_records
        ;;
    *)
        echo "Unknown action: $ACTION"
        exit 1
        ;;
esac
