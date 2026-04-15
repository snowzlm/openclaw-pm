import { ConfigManager } from './config';
import { Logger } from './logger';
export interface DailyStats {
    date: string;
    messages: {
        received: number;
        sent: number;
        activeSessions: number;
    };
    hourlyDistribution: {
        hour: number;
        count: number;
    }[];
    errors: {
        total: number;
        failover: number;
        timeout: number;
        connection: number;
        recent: string[];
    };
    gateway: {
        starts: number;
        stops: number;
        startTimes: string[];
    };
    performance: {
        completedTasks: number;
        slowQueries: number;
    };
    channels: {
        telegram: number;
        discord: number;
        slack: number;
        other: number;
    };
    health: {
        score: number;
        activity: string;
        stability: string;
    };
}
export interface MorningBriefing {
    timestamp: string;
    system: {
        gatewayRunning: boolean;
        gatewayPid?: number;
        lockFiles: number;
        diskUsage?: number;
    };
    yesterday: {
        date: string;
        messagesReceived: number;
        messagesSent: number;
        restarts: number;
        errors: number;
        lastError?: string;
    };
    cron: {
        okCount: number;
        missedCount: number;
        missedTasks: string[];
    };
    todos: {
        inProgress: string[];
    };
    suggestions: string[];
}
export interface HeartbeatResult {
    timestamp: string;
    checks: {
        contextHealth: {
            status: string;
            message: string;
        };
        inProgressTasks: {
            status: string;
            message: string;
        };
        cronTasks: {
            status: string;
            message: string;
        };
    };
    allPassed: boolean;
}
export declare class StatsGenerator {
    private config;
    private logger;
    constructor(config: ConfigManager, logger: Logger);
    /**
     * 生成每日统计
     */
    generateDailyStats(date?: string): Promise<DailyStats>;
    /**
     * 生成晨间简报
     */
    generateMorningBriefing(): Promise<MorningBriefing>;
    /**
     * 执行心跳检查
     */
    performHeartbeatCheck(): Promise<HeartbeatResult>;
    private analyzeMessages;
    private analyzeHourlyDistribution;
    private analyzeErrors;
    private analyzeGateway;
    private analyzePerformance;
    private analyzeChannels;
    private calculateHealth;
    private checkSystemHealth;
    private analyzeYesterday;
    private checkCronStatus;
    private checkTodos;
    private generateSuggestions;
    private checkContextHealth;
    private checkInProgressTasks;
    private checkCronTasks;
    private getLogFile;
}
//# sourceMappingURL=stats-generator.d.ts.map