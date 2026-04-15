import { Logger } from './logger';
export interface ConfigInitOptions {
    interactive?: boolean;
    force?: boolean;
}
export declare class ConfigInitializer {
    private logger;
    constructor(logger: Logger);
    /**
     * 初始化配置文件
     */
    initConfig(configPath: string, options?: ConfigInitOptions): Promise<void>;
    /**
     * 交互式配置
     */
    private interactiveConfig;
    /**
     * 获取默认配置
     */
    private getDefaultConfig;
    /**
     * 验证配置
     */
    validateConfig(config: Record<string, unknown>): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 修复配置
     */
    repairConfig(config: Record<string, unknown>): Record<string, unknown>;
    /**
     * 自动检测配置
     */
    autoDetectConfig(): Record<string, unknown>;
}
//# sourceMappingURL=config-initializer.d.ts.map