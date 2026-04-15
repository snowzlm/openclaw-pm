"use strict";
/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * Gateway 健康检查器
 */
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
exports.GatewayHealthChecker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process = __importStar(require("child_process"));
class GatewayHealthChecker {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * 执行完整健康检查
     */
    async check() {
        this.logger.info('开始 Gateway 健康检查...');
        const issues = [];
        const checks = {
            gateway: await this.checkGateway(),
            sessions: await this.checkSessions(),
            queue: await this.checkQueue(),
            providers: await this.checkProviders(),
            cron: await this.checkCron(),
        };
        // 收集所有问题
        for (const [category, result] of Object.entries(checks)) {
            if (result.status === 'error') {
                issues.push({
                    severity: 'error',
                    category,
                    message: result.message,
                    details: result.details,
                });
            }
            else if (result.status === 'warning') {
                issues.push({
                    severity: 'warning',
                    category,
                    message: result.message,
                    details: result.details,
                });
            }
        }
        // 计算健康评分
        const score = this.calculateHealthScore(checks, issues);
        // 确定整体状态
        let status = 'healthy';
        if (score < 50) {
            status = 'critical';
        }
        else if (score < 80) {
            status = 'warning';
        }
        const result = {
            timestamp: new Date().toISOString(),
            status,
            score,
            issues,
            checks,
        };
        this.logger.info(`健康检查完成: ${status} (评分: ${score}/100)`);
        return result;
    }
    /**
     * 检查 Gateway 状态
     */
    async checkGateway() {
        try {
            const status = await this.getGatewayStatus();
            if (!status.running) {
                return {
                    status: 'error',
                    message: 'Gateway 未运行',
                    details: status,
                };
            }
            // 检查是否有多个 Gateway 进程
            const processes = this.getGatewayProcesses();
            if (processes.length > 1) {
                return {
                    status: 'warning',
                    message: `检测到 ${processes.length} 个 Gateway 进程`,
                    details: { pids: processes },
                };
            }
            return {
                status: 'ok',
                message: 'Gateway 运行正常',
                details: status,
            };
        }
        catch (error) {
            return {
                status: 'error',
                message: `Gateway 检查失败: ${error.message}`,
            };
        }
    }
    /**
     * 检查 Sessions
     */
    async checkSessions() {
        try {
            const openclawDir = this.config.get('openclaw.dir');
            const sessionsDir = path.join(openclawDir, 'sessions');
            if (!fs.existsSync(sessionsDir)) {
                return {
                    status: 'warning',
                    message: 'Sessions 目录不存在',
                };
            }
            const sessions = this.getSessions(sessionsDir);
            const issues = [];
            // 检查 thinking-only sessions
            const thinkingOnly = sessions.filter((s) => s.status === 'thinking_only');
            if (thinkingOnly.length > 0) {
                issues.push(`${thinkingOnly.length} 个 thinking-only session`);
            }
            // 检查 locked sessions
            const locked = sessions.filter((s) => s.status === 'locked');
            if (locked.length > 0) {
                issues.push(`${locked.length} 个 locked session`);
            }
            // 检查未回复消息
            const unanswered = sessions.filter((s) => s.hasUnanswered);
            if (unanswered.length > 0) {
                issues.push(`${unanswered.length} 个未回复消息`);
            }
            if (issues.length > 0) {
                return {
                    status: 'warning',
                    message: `Sessions 存在问题: ${issues.join(', ')}`,
                    details: { total: sessions.length, issues },
                };
            }
            return {
                status: 'ok',
                message: `Sessions 正常 (${sessions.length} 个)`,
                details: { total: sessions.length },
            };
        }
        catch (error) {
            return {
                status: 'error',
                message: `Sessions 检查失败: ${error.message}`,
            };
        }
    }
    /**
     * 检查队列
     */
    async checkQueue() {
        // TODO: 实现队列检查逻辑
        return {
            status: 'ok',
            message: '队列检查未实现',
        };
    }
    /**
     * 检查 Providers
     */
    async checkProviders() {
        // TODO: 实现 Provider 错误检查
        return {
            status: 'ok',
            message: 'Providers 检查未实现',
        };
    }
    /**
     * 检查 Cron 任务
     */
    async checkCron() {
        // TODO: 实现 Cron 任务检查
        return {
            status: 'ok',
            message: 'Cron 检查未实现',
        };
    }
    /**
     * 获取 Gateway 状态
     */
    async getGatewayStatus() {
        const processes = this.getGatewayProcesses();
        const port = this.config.get('openclaw.gateway_port', 3000);
        return {
            running: processes.length > 0,
            pid: processes[0],
            port,
        };
    }
    /**
     * 获取 Gateway 进程列表
     */
    getGatewayProcesses() {
        try {
            const result = child_process.execSync('pgrep -f "openclaw.*gateway"', {
                encoding: 'utf-8',
            });
            return result
                .trim()
                .split('\n')
                .filter((line) => line)
                .map((pid) => parseInt(pid, 10));
        }
        catch {
            return [];
        }
    }
    /**
     * 获取 Sessions 列表
     */
    getSessions(sessionsDir) {
        const sessions = [];
        if (!fs.existsSync(sessionsDir)) {
            return sessions;
        }
        const files = fs.readdirSync(sessionsDir);
        for (const file of files) {
            if (!file.endsWith('.jsonl'))
                continue;
            const filePath = path.join(sessionsDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.trim().split('\n').filter((l) => l);
                if (lines.length === 0)
                    continue;
                const lastLine = lines[lines.length - 1];
                const lastMsg = JSON.parse(lastLine);
                const session = {
                    id: file.replace('.jsonl', ''),
                    agent: lastMsg.agent || 'unknown',
                    status: 'active',
                    lastActivity: new Date(lastMsg.timestamp || Date.now()),
                    messageCount: lines.length,
                    hasUnanswered: lastMsg.role === 'user',
                };
                // 检查 thinking-only
                if (lastMsg.role === 'assistant' && lastMsg.thinking && !lastMsg.text) {
                    session.status = 'thinking_only';
                }
                sessions.push(session);
            }
            catch (error) {
                this.logger.warn(`解析 session 文件失败: ${file}`);
            }
        }
        return sessions;
    }
    /**
     * 计算健康评分
     */
    calculateHealthScore(checks, issues) {
        let score = 100;
        // Gateway 问题扣分
        if (checks.gateway.status === 'error') {
            score -= 30;
        }
        else if (checks.gateway.status === 'warning') {
            score -= 10;
        }
        // Sessions 问题扣分
        if (checks.sessions.status === 'error') {
            score -= 20;
        }
        else if (checks.sessions.status === 'warning') {
            score -= 10;
        }
        // 其他问题扣分
        for (const issue of issues) {
            if (issue.severity === 'critical') {
                score -= 20;
            }
            else if (issue.severity === 'error') {
                score -= 10;
            }
            else if (issue.severity === 'warning') {
                score -= 5;
            }
        }
        return Math.max(0, score);
    }
}
exports.GatewayHealthChecker = GatewayHealthChecker;
//# sourceMappingURL=health-checker.js.map