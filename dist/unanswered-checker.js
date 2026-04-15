"use strict";
/**
 * OpenClaw PM v4.2.0 - TypeScript Core
 * 未回复消息检查器
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
exports.UnansweredChecker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process = __importStar(require("child_process"));
class UnansweredChecker {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * 检查未回复的消息
     */
    async check(options = {}) {
        const { includeOld = false, maxAgeHours = 24, agentFilter, autoRecover = false, } = options;
        this.logger.info('开始检查未回复消息...');
        const openclawDir = this.config.get('openclaw.dir');
        const agentsDir = path.join(openclawDir, 'agents');
        if (!fs.existsSync(agentsDir)) {
            throw new Error(`Agents 目录不存在: ${agentsDir}`);
        }
        const unanswered = [];
        // 遍历所有 agent
        const agents = fs.readdirSync(agentsDir).filter((name) => {
            const agentPath = path.join(agentsDir, name);
            return fs.statSync(agentPath).isDirectory();
        });
        for (const agentId of agents) {
            // 过滤 agent
            if (agentFilter && agentId !== agentFilter) {
                continue;
            }
            const sessionsDir = path.join(agentsDir, agentId, 'sessions');
            if (!fs.existsSync(sessionsDir)) {
                continue;
            }
            // 遍历所有 session 文件
            const sessionFiles = fs.readdirSync(sessionsDir).filter((name) => {
                return name.endsWith('.jsonl') && !name.endsWith('.deleted') && !name.endsWith('.lock');
            });
            for (const sessionFile of sessionFiles) {
                const sessionPath = path.join(sessionsDir, sessionFile);
                const session = await this.checkSession(sessionPath, agentId, {
                    includeOld,
                    maxAgeHours,
                });
                if (session) {
                    unanswered.push(session);
                }
            }
        }
        this.logger.info(`发现 ${unanswered.length} 个未回复的 session`);
        // 自动恢复
        let recovered = 0;
        let failed = 0;
        if (autoRecover && unanswered.length > 0) {
            this.logger.info('开始自动恢复...');
            const result = await this.recoverSessions(unanswered);
            recovered = result.recovered;
            failed = result.failed;
        }
        return {
            unanswered,
            count: unanswered.length,
            recovered,
            failed,
        };
    }
    /**
     * 检查单个 session
     */
    async checkSession(sessionPath, agentId, options) {
        try {
            // 检查文件修改时间
            if (!options.includeOld) {
                const stats = fs.statSync(sessionPath);
                const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
                if (ageHours > options.maxAgeHours) {
                    return null;
                }
            }
            // 读取最后一行
            const content = fs.readFileSync(sessionPath, 'utf-8');
            const lines = content.trim().split('\n').filter((l) => l);
            if (lines.length === 0) {
                return null;
            }
            const lastLine = lines[lines.length - 1];
            let lastMessage;
            try {
                lastMessage = JSON.parse(lastLine);
            }
            catch {
                return null;
            }
            // 检查最后一条消息的 role
            const role = lastMessage.message?.role || lastMessage.role;
            if (role !== 'user') {
                return null;
            }
            // 提取信息
            const sessionName = path.basename(sessionPath, '.jsonl');
            const sessionKey = `agent:${agentId}:${sessionName}`;
            let preview = lastMessage.message?.content || lastMessage.content || '';
            if (Array.isArray(preview)) {
                preview = preview[0]?.text || '';
            }
            preview = preview.substring(0, 100);
            const timestamp = lastMessage.timestamp || new Date(fs.statSync(sessionPath).mtime).toISOString();
            return {
                sessionKey,
                agentId,
                sessionName,
                timestamp,
                preview,
                lastModified: new Date(fs.statSync(sessionPath).mtime),
            };
        }
        catch (error) {
            this.logger.debug(`检查 session 失败: ${sessionPath}`);
            return null;
        }
    }
    /**
     * 恢复未回复的 sessions
     */
    async recoverSessions(sessions) {
        let recovered = 0;
        let failed = 0;
        for (const session of sessions) {
            try {
                this.logger.info(`恢复 session: ${session.sessionKey}`);
                // 尝试使用 OpenClaw CLI 发送消息
                const recoveryMsg = '[自动恢复] 检测到有未回复的消息，正在处理...';
                try {
                    // 尝试 sessions send
                    child_process.execSync(`openclaw sessions send --session "${session.sessionKey}" --message "${recoveryMsg}"`, { encoding: 'utf-8', timeout: 5000 });
                    recovered++;
                    this.logger.info(`✓ 已发送恢复消息: ${session.sessionKey}`);
                }
                catch {
                    // 回退到 wake 通知
                    this.sendWakeNotification(`[未回复消息恢复] session ${session.sessionKey} 有未回复的消息`, 'now');
                    recovered++;
                    this.logger.warn(`⚠ 已发送 wake 通知: ${session.sessionKey}`);
                }
            }
            catch (error) {
                failed++;
                this.logger.error(`✗ 恢复失败: ${session.sessionKey}`);
            }
        }
        return { recovered, failed };
    }
    /**
     * 发送 wake 通知
     */
    sendWakeNotification(text, mode = 'now') {
        try {
            child_process.execSync(`openclaw cron wake --text "${text}" --mode ${mode}`, {
                encoding: 'utf-8',
                timeout: 5000,
            });
        }
        catch (error) {
            this.logger.error('发送 wake 通知失败');
        }
    }
}
exports.UnansweredChecker = UnansweredChecker;
//# sourceMappingURL=unanswered-checker.js.map