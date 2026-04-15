#!/bin/bash
# check-missed-crons.sh - 检查关键 cron 任务是否执行
# 优化版本 - 从配置文件读取任务列表
#
# 用法:
#   ./check-missed-crons.sh           # 检查并报告
#   ./check-missed-crons.sh --run     # 检查并补执行错过的任务
#   ./check-missed-crons.sh --json    # JSON 格式输出
#
# 退出码:
#   0 = 所有关键任务都已执行
#   1 = 有任务未执行

set -e

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 参数
RUN_MISSED=false
JSON_OUTPUT=false
CONFIRM=true

for arg in "$@"; do
    case $arg in
        --run) RUN_MISSED=true ;;
        --json) JSON_OUTPUT=true ;;
        --yes|-y) CONFIRM=false ;;
    esac
done

# 从配置文件读取关键任务列表
load_critical_jobs() {
    local config=$(load_config)
    
    if [ -z "$config" ]; then
        echo "[]"
        return
    fi
    
    jq -r '.cron.criticalJobs // []' "$config" 2>/dev/null || echo "[]"
}

# 检查任务是否今天执行过
check_job_ran_today() {
    local job_id="$1"
    local today_start=$(date +%s)000  # 今天 00:00:00 的毫秒时间戳（简化版）
    
    # 获取任务运行历史
    local runs=$(call_openclaw_api "/api/cron" "POST" "{\"action\":\"runs\",\"jobId\":\"$job_id\"}")
    
    if [ -z "$runs" ] || echo "$runs" | grep -q '"error"'; then
        echo "error"
        return
    fi
    
    # 检查是否有今天的运行记录
    local last_run=$(echo "$runs" | jq -r '.runs[0].startedAtMs // 0' 2>/dev/null)
    
    if [ "$last_run" -ge "$today_start" ]; then
        echo "ok"
    else
        echo "missed"
    fi
}

# 触发任务执行
trigger_job() {
    local job_id="$1"
    call_openclaw_api "/api/cron" "POST" "{\"action\":\"run\",\"jobId\":\"$job_id\",\"runMode\":\"force\"}" > /dev/null 2>&1
}

# 主检查逻辑
main() {
    local missed_count=0
    local ok_count=0
    local error_count=0
    local missed_jobs=""
    local results=""
    
    # 检查 gateway 是否运行
    if ! is_gateway_running; then
        if ! $JSON_OUTPUT; then
            echo -e "${RED}✗${NC} Gateway 未运行，无法检查 cron 任务"
        fi
        exit 1
    fi
    
    # 加载关键任务列表
    local jobs=$(load_critical_jobs)
    local job_count=$(echo "$jobs" | jq 'length' 2>/dev/null || echo "0")
    
    if [ "$job_count" -eq 0 ]; then
        if ! $JSON_OUTPUT; then
            echo -e "${YELLOW}⚠${NC} 未配置关键任务"
            echo "请编辑 $SCRIPT_DIR/config.json 添加任务"
        fi
        exit 0
    fi
    
    if ! $JSON_OUTPUT; then
        echo "🕐 Cron 任务检查 ($(date '+%Y-%m-%d %H:%M'))"
        echo ""
    fi
    
    # 遍历所有任务
    for i in $(seq 0 $((job_count - 1))); do
        local job=$(echo "$jobs" | jq -r ".[$i]" 2>/dev/null)
        local name=$(echo "$job" | jq -r '.name' 2>/dev/null)
        local job_id=$(echo "$job" | jq -r '.jobId' 2>/dev/null)
        
        if [ -z "$name" ] || [ -z "$job_id" ]; then
            continue
        fi
        
        local status=$(check_job_ran_today "$job_id")
        
        case $status in
            ok)
                ((ok_count++))
                if ! $JSON_OUTPUT; then
                    echo -e "${GREEN}✓${NC} $name"
                fi
                results="${results}{\"name\":\"$name\",\"jobId\":\"$job_id\",\"status\":\"ok\"},"
                ;;
            missed)
                ((missed_count++))
                missed_jobs="$missed_jobs $job_id"
                if ! $JSON_OUTPUT; then
                    echo -e "${YELLOW}⚠${NC} $name - 今日未执行"
                fi
                results="${results}{\"name\":\"$name\",\"jobId\":\"$job_id\",\"status\":\"missed\"},"
                ;;
            error)
                ((error_count++))
                if ! $JSON_OUTPUT; then
                    echo -e "${RED}?${NC} $name - 无法检查"
                fi
                results="${results}{\"name\":\"$name\",\"jobId\":\"$job_id\",\"status\":\"error\"},"
                ;;
        esac
    done
    
    # 补执行错过的任务
    if $RUN_MISSED && [ $missed_count -gt 0 ]; then
        if ! $JSON_OUTPUT; then
            echo ""
            
            if $CONFIRM; then
                echo -e "${YELLOW}将补执行 $missed_count 个任务，是否继续？ [y/N]${NC}"
                read -r confirm
                if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                    echo "已取消"
                    exit 0
                fi
            fi
            
            echo "🔄 补执行错过的任务..."
        fi
        
        for job_id in $missed_jobs; do
            trigger_job "$job_id"
            if ! $JSON_OUTPUT; then
                echo "  - 已触发: $job_id"
            fi
        done
        
        # 发送通知
        notify "info" "已补执行 $missed_count 个错过的 Cron 任务"
    fi
    
    # 输出结果
    if $JSON_OUTPUT; then
        results="${results%,}"
        echo "{\"ok\":$ok_count,\"missed\":$missed_count,\"error\":$error_count,\"jobs\":[$results]}"
    else
        echo ""
        if [ $missed_count -eq 0 ]; then
            echo -e "${GREEN}✓ 所有关键任务今日已执行${NC}"
        else
            echo -e "${YELLOW}⚠ $missed_count 个任务今日未执行${NC}"
            if ! $RUN_MISSED; then
                echo "  使用 --run 参数可以补执行"
            fi
        fi
    fi
    
    # 退出码
    if [ $missed_count -gt 0 ]; then
        exit 1
    fi
    exit 0
}

main
