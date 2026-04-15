/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 配置管理
 */
export declare function detectOpenClawDir(): string;
export declare function getDefaultConfigPath(): string;
export declare function getDefaultSessionsDir(openclawDir?: string): string;
export declare function getDefaultWorkspaceDir(openclawDir?: string): string;
export declare function getDefaultBackupDir(openclawDir?: string): string;
export declare function getDefaultCacheDir(openclawDir?: string): string;
export interface OpenClawConfig {
    openclaw: {
        dir: string;
        sessions_dir?: string;
        queue_dir?: string;
        logs_dir?: string;
        workspace_dir?: string;
        gateway_port: number;
        gateway_timeout: number;
        gateway_token?: string;
    };
    health_check: {
        interval_minutes: number;
        max_lock_age_hours: number;
        max_queue_age_hours: number;
        provider_error_threshold: number;
    };
    backup: {
        enabled: boolean;
        max_backups: number;
        backup_dir?: string;
        dir?: string;
    };
    notification: {
        enabled: boolean;
        channels: string[];
        telegram?: {
            bot_token: string;
            chat_id: string;
        };
    };
    cron_tasks: Array<{
        name: string;
        schedule: string;
        enabled: boolean;
    }>;
}
export declare class ConfigManager {
    private configPath;
    private config;
    constructor(configPath?: string);
    /**
     * 加载配置文件
     */
    load(): OpenClawConfig;
    /**
     * 保存配置文件
     */
    save(config: OpenClawConfig): void;
    /**
     * 获取配置值
     */
    get<T>(key: string, defaultValue?: T): T;
    /**
     * 设置配置值
     */
    set(key: string, value: any): void;
    /**
     * 获取完整配置
     */
    getAll(): OpenClawConfig;
    /**
     * 创建默认配置
     */
    static createDefault(configPath: string): OpenClawConfig;
}
//# sourceMappingURL=config.d.ts.map