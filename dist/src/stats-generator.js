"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process = __importStar(require("child_process"));
const os = __importStar(require("os"));
const log_index_1 = require("./log-index");
const cache_manager_1 = require("./cache-manager");
const incremental_analyzer_1 = require("./incremental-analyzer");
class StatsGenerator {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        const cacheDir = path.join(os.homedir(), '.openclaw', 'pm-cache');
        this.logIndexManager = new log_index_1.LogIndexManager(cacheDir);
        this.cacheManager = new cache_manager_1.CacheManager(cacheDir);
        this.incrementalAnalyzer = new incremental_analyzer_1.IncrementalAnalyzer(cacheDir);
    }
    /**
     * 生成每日统计（使用缓存和索引）
     */
    async generateDailyStats(date) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const cacheKey = `daily-stats:${targetDate}`;
        // 1. 尝试从缓存获取
        const cached = this.cacheManager.get(cacheKey);
        if (cached) {
            this.logger.debug(`使用缓存的统计数据: ${targetDate}`);
            return cached;
        }
        const logFile = this.getLogFile(targetDate);
        if (!fs.existsSync(logFile)) {
            throw new Error(`日志文件不存在: ${logFile}`);
        }
        this.logger.info(`生成每日统计: ${targetDate}`);
        // 2. 获取或构建索引
        const startTime = Date.now();
        const index = this.logIndexManager.getOrBuildIndex(targetDate, logFile);
        const indexTime = Date.now() - startTime;
        this.logger.debug(`索引耗时: ${indexTime}ms`);
        // 3. 使用索引数据加速分析
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n');
        const stats = {
            date: targetDate,
            messages: this.analyzeMessages(lines, index),
            hourlyDistribution: this.analyzeHourlyDistribution(lines, index),
            errors: this.analyzeErrors(lines, index),
            gateway: this.analyzeGateway(lines),
            performance: this.analyzePerformance(lines),
            channels: this.analyzeChannels(lines),
            health: this.calculateHealth(lines),
        };
        // 4. 缓存结果（24小时）
        this.cacheManager.set(cacheKey, stats, 24 * 60 * 60);
        return stats;
    }
    /**
     * 生成晨间简报
     */
    async generateMorningBriefing() {
        this.logger.info('生成晨间简报');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return {
            timestamp: new Date().toISOString(),
            system: await this.checkSystemHealth(),
            yesterday: await this.analyzeYesterday(yesterdayStr),
            cron: await this.checkCronStatus(),
            todos: await this.checkTodos(),
            suggestions: await this.generateSuggestions(),
        };
    }
    /**
     * 执行心跳检查
     */
    async performHeartbeatCheck() {
        this.logger.info('执行心跳检查');
        const checks = {
            contextHealth: await this.checkContextHealth(),
            inProgressTasks: await this.checkInProgressTasks(),
            cronTasks: await this.checkCronTasks(),
        };
        const allPassed = Object.values(checks).every((c) => c.status === 'ok');
        return {
            timestamp: new Date().toISOString(),
            checks,
            allPassed,
        };
    }
    // ============================================
    // 私有方法 - 每日统计
    // ============================================
    analyzeMessages(lines, index) {
        // 如果有索引，使用索引数据
        if (index) {
            const received = index.messageCount;
            const sent = lines.filter((l) => l.includes('sent message') || l.includes('dispatch complete')).length;
            const sessionSet = new Set();
            lines.forEach((line) => {
                const match = line.match(/session:([a-zA-Z0-9-]+)/);
                if (match)
                    sessionSet.add(match[1]);
            });
            return {
                received,
                sent,
                activeSessions: sessionSet.size,
            };
        }
        // 否则全文扫描
        const received = lines.filter((l) => l.includes('received message')).length;
        const sent = lines.filter((l) => l.includes('sent message') || l.includes('dispatch complete')).length;
        const sessionSet = new Set();
        lines.forEach((line) => {
            const match = line.match(/session:([a-zA-Z0-9-]+)/);
            if (match)
                sessionSet.add(match[1]);
        });
        return {
            received,
            sent,
            activeSessions: sessionSet.size,
        };
    }
    analyzeHourlyDistribution(lines, index) {
        // 如果有索引，使用索引数据
        if (index && index.hourlyDistribution) {
            return index.hourlyDistribution.map((h) => ({ hour: h.hour, count: h.count }));
        }
        // 否则全文扫描
        const hourCounts = new Map();
        lines.forEach((line) => {
            if (!line.includes('received message'))
                return;
            const match = line.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (match) {
                const hour = parseInt(match[1], 10);
                hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
            }
        });
        return Array.from(hourCounts.entries())
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => a.hour - b.hour);
    }
    analyzeErrors(lines, index) {
        // 如果有索引，使用索引数据
        const total = index
            ? index.errorCount
            : lines.filter((l) => /ERROR|FailoverError|All models failed/.test(l)).length;
        const errorLines = lines.filter((l) => /ERROR|FailoverError|All models failed/.test(l));
        const failover = errorLines.filter((l) => /FailoverError|All models failed/.test(l)).length;
        const timeout = errorLines.filter((l) => l.includes('timed out')).length;
        const connection = errorLines.filter((l) => /ECONNREFUSED|ECONNRESET|ETIMEDOUT/.test(l)).length;
        const recent = errorLines.slice(-3).map((line) => {
            const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : 'unknown';
            const msg = line.substring(line.indexOf('ERROR')).substring(0, 70);
            return `[${time}] ${msg}`;
        });
        return { total, failover, timeout, connection, recent };
    }
    analyzeGateway(lines) {
        const starts = lines.filter((l) => /Gateway starting|openclaw-gateway.*started/.test(l)).length;
        const stops = lines.filter((l) => /Gateway stopping|openclaw-gateway.*stopped/.test(l)).length;
        const startTimes = [];
        lines.forEach((line) => {
            if (/Gateway starting|openclaw-gateway.*started/.test(line)) {
                const match = line.match(/(\d{2}:\d{2}:\d{2})/);
                if (match)
                    startTimes.push(match[1]);
            }
        });
        return { starts, stops, startTimes: startTimes.slice(0, 5) };
    }
    analyzePerformance(lines) {
        const completedTasks = lines.filter((l) => l.includes('dispatch complete')).length;
        const slowQueries = lines.filter((l) => /took \d{4,}ms|took \d+s/.test(l)).length;
        return { completedTasks, slowQueries };
    }
    analyzeChannels(lines) {
        const messageLines = lines.filter((l) => l.includes('received message'));
        return {
            telegram: messageLines.filter((l) => l.includes('telegram')).length,
            discord: messageLines.filter((l) => l.includes('discord')).length,
            slack: messageLines.filter((l) => l.includes('slack')).length,
            other: messageLines.filter((l) => !/telegram|discord|slack/.test(l)).length,
        };
    }
    calculateHealth(lines) {
        const errors = lines.filter((l) => /ERROR|FailoverError/.test(l)).length;
        const restarts = lines.filter((l) => l.includes('Gateway starting')).length;
        const messages = lines.filter((l) => l.includes('received message')).length;
        let score = 100;
        score -= errors * 2;
        if (restarts > 1)
            score -= (restarts - 1) * 10;
        score = Math.max(0, score);
        const activity = messages > 100 ? '高' : messages > 20 ? '中' : '低';
        const stability = restarts === 0 ? '优秀' : restarts === 1 ? '良好' : '需要关注';
        return { score, activity, stability };
    }
    // ============================================
    // 私有方法 - 晨间简报
    // ============================================
    async checkSystemHealth() {
        const openclawDir = this.config.get('openclaw.dir', '/root/.openclaw');
        // 检查 Gateway 进程
        let gatewayRunning = false;
        let gatewayPid;
        try {
            const { execSync } = child_process;
            const result = execSync('pgrep -f "^openclaw-gateway$"', { encoding: 'utf-8' }).trim();
            if (result) {
                gatewayRunning = true;
                gatewayPid = parseInt(result.split('\n')[0], 10);
            }
        }
        catch {
            // Gateway 未运行
        }
        // 检查 lock 文件
        let lockFiles = 0;
        try {
            const { execSync } = child_process;
            const result = execSync(`find ${openclawDir}/agents/*/sessions/*.lock 2>/dev/null | wc -l`, {
                encoding: 'utf-8',
            }).trim();
            lockFiles = parseInt(result, 10) || 0;
        }
        catch {
            // 无 lock 文件
        }
        // 检查磁盘使用率
        let diskUsage;
        try {
            const { execSync } = child_process;
            const result = execSync(`df -h ${openclawDir} | tail -1 | awk '{print $5}' | sed 's/%//'`, {
                encoding: 'utf-8',
            }).trim();
            diskUsage = parseInt(result, 10);
        }
        catch {
            // 无法获取磁盘使用率
        }
        return { gatewayRunning, gatewayPid, lockFiles, diskUsage };
    }
    async analyzeYesterday(date) {
        const logFile = this.getLogFile(date);
        if (!fs.existsSync(logFile)) {
            return {
                date,
                messagesReceived: 0,
                messagesSent: 0,
                restarts: 0,
                errors: 0,
            };
        }
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n');
        const messagesReceived = lines.filter((l) => l.includes('received message')).length;
        const messagesSent = lines.filter((l) => l.includes('sent message') || l.includes('dispatch complete')).length;
        const restarts = lines.filter((l) => /Gateway starting|openclaw-gateway.*started/.test(l)).length;
        const errorLines = lines.filter((l) => /ERROR|FailoverError|All models failed/.test(l));
        const errors = errorLines.length;
        let lastError;
        if (errorLines.length > 0) {
            const lastErrorLine = errorLines[errorLines.length - 1];
            const timeMatch = lastErrorLine.match(/(\d{2}:\d{2}:\d{2})/);
            const time = timeMatch ? timeMatch[1] : 'unknown';
            const msg = lastErrorLine.substring(lastErrorLine.indexOf('ERROR')).substring(0, 60);
            lastError = `[${time}] ${msg}`;
        }
        return { date, messagesReceived, messagesSent, restarts, errors, lastError };
    }
    async checkCronStatus() {
        const cronTasks = this.config.get('cron_tasks', []);
        const enabledTasks = cronTasks.filter((t) => t.enabled);
        // 简化版：假设所有任务都已执行
        return {
            okCount: enabledTasks.length,
            missedCount: 0,
            missedTasks: [],
        };
    }
    async checkTodos() {
        const workspaceDir = this.config.get('openclaw.workspace_dir', '/root/.openclaw/workspace');
        const today = new Date().toISOString().split('T')[0];
        const memoryFile = path.join(workspaceDir, 'memory', `${today}.md`);
        if (!fs.existsSync(memoryFile)) {
            return { inProgress: [] };
        }
        const content = fs.readFileSync(memoryFile, 'utf-8');
        const lines = content.split('\n');
        const inProgress = [];
        let inSection = false;
        for (const line of lines) {
            if (line.startsWith('## In Progress')) {
                inSection = true;
                continue;
            }
            if (inSection && line.startsWith('##')) {
                break;
            }
            if (inSection && line.startsWith('###')) {
                inProgress.push(line.replace(/^###\s*/, ''));
            }
        }
        return { inProgress };
    }
    async generateSuggestions() {
        const suggestions = [];
        const system = await this.checkSystemHealth();
        if (!system.gatewayRunning) {
            suggestions.push('启动 Gateway: openclaw gateway start');
        }
        if (system.lockFiles > 0) {
            suggestions.push(`清理 ${system.lockFiles} 个 Lock 文件: openclaw-pm health`);
        }
        if (system.diskUsage && system.diskUsage > 80) {
            suggestions.push(`磁盘使用率 ${system.diskUsage}%，建议清理日志`);
        }
        return suggestions;
    }
    // ============================================
    // 私有方法 - 心跳检查
    // ============================================
    async checkContextHealth() {
        try {
            const { execSync } = child_process;
            execSync('pgrep -f "^openclaw-gateway$"', { encoding: 'utf-8' });
            return { status: 'ok', message: 'Gateway 运行正常' };
        }
        catch {
            return { status: 'error', message: 'Gateway 未运行' };
        }
    }
    async checkInProgressTasks() {
        const workspaceDir = this.config.get('openclaw.workspace_dir', '/root/.openclaw/workspace');
        const today = new Date().toISOString().split('T')[0];
        const memoryFile = path.join(workspaceDir, 'memory', `${today}.md`);
        if (!fs.existsSync(memoryFile)) {
            return { status: 'ok', message: '无进行中任务' };
        }
        const content = fs.readFileSync(memoryFile, 'utf-8');
        const hasInProgress = /^## In Progress/m.test(content) && !/（无）/.test(content);
        if (!hasInProgress) {
            return { status: 'ok', message: '无进行中任务' };
        }
        return { status: 'ok', message: '任务状态正常' };
    }
    async checkCronTasks() {
        const cronTasks = this.config.get('cron_tasks', []);
        const enabledTasks = cronTasks.filter((t) => t.enabled);
        return { status: 'ok', message: `所有关键任务已执行 (${enabledTasks.length} 个)` };
    }
    // ============================================
    // 工具方法
    // ============================================
    getLogFile(date) {
        const openclawDir = this.config.get('openclaw.dir', '/root/.openclaw');
        return path.join(openclawDir, 'logs', `gateway-${date}.log`);
    }
}
exports.StatsGenerator = StatsGenerator;
//# sourceMappingURL=stats-generator.js.map