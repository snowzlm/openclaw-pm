/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * Gateway 健康检查器
 */
import { ConfigManager } from './config';
import { Logger } from './logger';
import { HealthCheckResult } from './types';
export declare class GatewayHealthChecker {
    private config;
    private logger;
    constructor(config: ConfigManager, logger: Logger);
    /**
     * 执行完整健康检查（并发优化）
     */
    check(): Promise<HealthCheckResult>;
    /**
     * 检查 Gateway 状态
     */
    private checkGateway;
    /**
     * 检查 Sessions
     */
    private checkSessions;
    /**
     * 检查队列
     */
    private checkQueue;
    /**
     * 检查 Providers
     */
    private checkProviders;
    /**
     * 检查 Cron 任务
     */
    private checkCron;
    /**
     * 获取 Gateway 状态
     */
    private getGatewayStatus;
    /**
     * 获取 Gateway 进程列表
     */
    private getGatewayProcesses;
    /**
     * 获取 Sessions 列表
     */
    private getSessions;
    /**
     * 计算健康评分
     */
    private calculateHealthScore;
}
//# sourceMappingURL=health-checker.d.ts.map