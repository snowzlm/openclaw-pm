/**
 * OpenClaw PM v4.2.0 - TypeScript Core
 * 未回复消息检查器
 */
import { ConfigManager } from './config';
import { Logger } from './logger';
export interface UnansweredSession {
    sessionKey: string;
    agentId: string;
    sessionName: string;
    timestamp: string;
    preview: string;
    lastModified: Date;
}
export interface UnansweredCheckResult {
    unanswered: UnansweredSession[];
    count: number;
    recovered?: number;
    failed?: number;
}
export interface CheckOptions {
    includeOld?: boolean;
    maxAgeHours?: number;
    agentFilter?: string;
    autoRecover?: boolean;
}
export declare class UnansweredChecker {
    private config;
    private logger;
    constructor(config: ConfigManager, logger: Logger);
    /**
     * 检查未回复的消息
     */
    check(options?: CheckOptions): Promise<UnansweredCheckResult>;
    /**
     * 检查单个 session
     */
    private checkSession;
    /**
     * 恢复未回复的 sessions
     */
    private recoverSessions;
    /**
     * 发送 wake 通知
     */
    private sendWakeNotification;
}
//# sourceMappingURL=unanswered-checker.d.ts.map