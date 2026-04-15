/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 类型定义
 */
export interface HealthCheckResult {
    timestamp: string;
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: HealthIssue[];
    checks: {
        gateway: CheckResult;
        sessions: CheckResult;
        queue: CheckResult;
        providers: CheckResult;
        cron: CheckResult;
    };
}
export interface HealthIssue {
    severity: 'info' | 'warning' | 'error' | 'critical';
    category: string;
    message: string;
    details?: any;
}
export interface CheckResult {
    status: 'ok' | 'warning' | 'error';
    message: string;
    details?: any;
}
export interface SessionInfo {
    id: string;
    agent: string;
    status: 'active' | 'idle' | 'locked' | 'thinking_only';
    lastActivity: Date;
    messageCount: number;
    hasUnanswered: boolean;
}
export interface QueueItem {
    id: string;
    type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Date;
    updatedAt: Date;
    age: number;
}
export interface ProviderError {
    provider: string;
    model: string;
    error: string;
    timestamp: Date;
    count: number;
}
export interface CronTask {
    name: string;
    schedule: string;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    status: 'ok' | 'missed' | 'disabled';
}
export interface GatewayStatus {
    running: boolean;
    pid?: number;
    port: number;
    uptime?: number;
    version?: string;
}
export interface BackupInfo {
    path: string;
    timestamp: Date;
    size: number;
    type: 'auto' | 'manual';
}
export interface NotificationPayload {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    timestamp: Date;
    details?: any;
}
export interface HistoryRecord {
    timestamp: Date;
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issueCount: number;
    issues: string[];
}
export interface StatsSummary {
    period: string;
    sessions: {
        total: number;
        active: number;
        idle: number;
        locked: number;
    };
    messages: {
        total: number;
        user: number;
        assistant: number;
        unanswered: number;
    };
    providers: {
        total: number;
        errors: number;
        errorRate: number;
    };
    cron: {
        total: number;
        enabled: number;
        missed: number;
    };
}
//# sourceMappingURL=types.d.ts.map