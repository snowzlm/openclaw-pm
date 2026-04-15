#!/bin/bash
# heartbeat-check.sh - 统一的 Heartbeat 检查脚本
# 优化版本 - 使用统一工具库，跨平台兼容

set -euo pipefail

# 加载工具库
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 初始化
init_common

# 配置
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME/.openclaw/workspace}"
MEMORY_DIR="$WORKSPACE_DIR/memory"
TODAY=$(date +%Y-%m-%d)
MEMORY_FILE="$MEMORY_DIR/$TODAY.md"

# 输出格式
OUTPUT_FORMAT="text"  # text 或 json
VERBOSE=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            OUTPUT_FORMAT="json"
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# JSON 输出缓冲
JSON_OUTPUT='{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","checks":{}}'

# 添加 JSON 结果
add_json_result() {
    local check_name=$1
    local status=$2
    local message=$3
    
    if ! check_optional_dependency "jq"; then
        return
    fi
    
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq --arg name "$check_name" --arg status "$status" --arg msg "$message" \
        '.checks[$name] = {"status": $status, "message": $msg}')
}

# 打印标题
print_header_check() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        print_separator "━"
        echo -e "${BOLD}${CYAN}💓 Heartbeat Check - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
        print_separator "━"
        echo
    fi
}

# ============================================
# 检查 1: Context Health
# ============================================

check_context_health() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${BLUE}[1/3] Context Health${NC}"
    fi
    
    # 检查 Gateway 是否运行
    if ! is_gateway_running; then
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${RED}✗${NC}  Gateway 未运行"
            echo
        fi
        add_json_result "context_health" "error" "Gateway 未运行"
        return 1
    fi
    
    # 尝试获取 session status（需要 OpenClaw CLI）
    # 这里简化为检查 Gateway 运行状态
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "  ${GREEN}✓${NC}  Gateway 运行正常"
        echo
    fi
    
    add_json_result "context_health" "ok" "Gateway 运行正常"
    return 0
}

# ============================================
# 检查 2: 进行中任务
# ============================================

check_in_progress_tasks() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${BLUE}[2/3] 进行中任务${NC}"
    fi
    
    if [[ ! -f "$MEMORY_FILE" ]]; then
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${GREEN}✓${NC}  今日 memory 文件不存在，无进行中任务"
            echo
        fi
        add_json_result "in_progress_tasks" "ok" "无进行中任务"
        return 0
    fi
    
    # 查找 "## In Progress" 部分
    local in_progress_section=$(sed -n '/^## In Progress/,/^##/p' "$MEMORY_FILE" | grep -v "^##")
    
    if [[ -z "$in_progress_section" ]] || echo "$in_progress_section" | grep -q "（无）"; then
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${GREEN}✓${NC}  无进行中任务"
            echo
        fi
        add_json_result "in_progress_tasks" "ok" "无进行中任务"
        return 0
    fi
    
    # 检查任务的最后汇报时间
    local tasks_found=false
    local tasks_need_report=()
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^###[[:space:]](.+) ]]; then
            local task_name="${BASH_REMATCH[1]}"
            
            # 提取时间戳
            if [[ "$task_name" =~ \(([0-9]{2}:[0-9]{2})[[:space:]]开始\) ]]; then
                local start_time="${BASH_REMATCH[1]}"
                tasks_found=true
                
                # 检查是否有"上次汇报"时间
                local last_report=$(echo "$in_progress_section" | grep -A 5 "### $task_name" | grep "上次汇报" | sed 's/.*上次汇报：//' | sed 's/[[:space:]].*//')
                
                if [[ -n "$last_report" ]]; then
                    # 计算时间差（简化版，只比较小时和分钟）
                    local now_hour=$(date +%H)
                    local now_min=$(date +%M)
                    local report_hour=$(echo "$last_report" | cut -d: -f1)
                    local report_min=$(echo "$last_report" | cut -d: -f2)
                    
                    local now_total=$((now_hour * 60 + now_min))
                    local report_total=$((report_hour * 60 + report_min))
                    local diff=$((now_total - report_total))
                    
                    if [[ $diff -gt 30 ]]; then
                        tasks_need_report+=("$task_name (${diff}分钟未汇报)")
                    fi
                fi
            fi
        fi
    done <<< "$in_progress_section"
    
    if [[ ${#tasks_need_report[@]} -gt 0 ]]; then
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${YELLOW}⚠${NC}  发现需要汇报的任务："
            for task in "${tasks_need_report[@]}"; do
                echo -e "     - $task"
            done
            echo
        fi
        add_json_result "in_progress_tasks" "warning" "$(IFS=,; echo "${tasks_need_report[*]}")"
        return 1
    elif [[ "$tasks_found" == true ]]; then
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${GREEN}✓${NC}  进行中任务状态正常"
            echo
        fi
        add_json_result "in_progress_tasks" "ok" "任务状态正常"
        return 0
    else
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${GREEN}✓${NC}  无进行中任务"
            echo
        fi
        add_json_result "in_progress_tasks" "ok" "无进行中任务"
        return 0
    fi
}

# ============================================
# 检查 3: Cron 任务
# ============================================

check_cron_tasks() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${BLUE}[3/3] Cron 任务${NC}"
    fi
    
    # 检查 check-missed-crons.sh 是否存在
    local cron_check_script="$SCRIPT_DIR/check-missed-crons.sh"
    if [[ ! -f "$cron_check_script" ]]; then
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${RED}✗${NC}  check-missed-crons.sh 不存在"
            echo
        fi
        add_json_result "cron_tasks" "error" "check-missed-crons.sh 不存在"
        return 1
    fi
    
    # 运行 check-missed-crons.sh --json
    local cron_result
    if cron_result=$("$cron_check_script" --json 2>&1); then
        if ! check_optional_dependency "jq"; then
            if [[ "$OUTPUT_FORMAT" == "text" ]]; then
                echo -e "  ${YELLOW}⚠${NC}  无法解析 Cron 检查结果（缺少 jq）"
                echo
            fi
            add_json_result "cron_tasks" "warning" "无法解析结果"
            return 1
        fi
        
        local missed_count=$(echo "$cron_result" | jq -r '.missed // 0')
        
        if [[ "$missed_count" -eq 0 ]]; then
            if [[ "$OUTPUT_FORMAT" == "text" ]]; then
                echo -e "  ${GREEN}✓${NC}  所有关键任务已执行"
                echo
            fi
            add_json_result "cron_tasks" "ok" "所有关键任务已执行"
            return 0
        else
            local missed_tasks=$(echo "$cron_result" | jq -r '.jobs[] | select(.status=="missed") | .name' | tr '\n' ',' | sed 's/,$//')
            if [[ "$OUTPUT_FORMAT" == "text" ]]; then
                echo -e "  ${YELLOW}⚠${NC}  发现 $missed_count 个未执行的任务："
                echo "$cron_result" | jq -r '.jobs[] | select(.status=="missed") | "     - \(.name)"'
                echo
            fi
            add_json_result "cron_tasks" "warning" "未执行: $missed_tasks"
            return 1
        fi
    else
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            echo -e "  ${RED}✗${NC}  无法检查 Cron 任务"
            echo
        fi
        add_json_result "cron_tasks" "error" "无法检查 Cron 任务"
        return 1
    fi
}

# ============================================
# 主函数
# ============================================

main() {
    print_header_check
    
    local exit_code=0
    
    check_context_health || exit_code=1
    check_in_progress_tasks || exit_code=1
    check_cron_tasks || exit_code=1
    
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        if check_optional_dependency "jq"; then
            echo "$JSON_OUTPUT" | jq '.'
        else
            echo "$JSON_OUTPUT"
        fi
    else
        print_separator "━"
        if [[ $exit_code -eq 0 ]]; then
            echo -e "${GREEN}✓ 所有检查通过${NC}"
        else
            echo -e "${YELLOW}⚠ 发现需要关注的问题${NC}"
        fi
        print_separator "━"
    fi
    
    exit $exit_code
}

main
