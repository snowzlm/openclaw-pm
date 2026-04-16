import { Logger } from './logger';
import { OpenClawConfig } from './config';
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
    private buildConfig;
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
    repairConfig(config: Record<string, unknown>): OpenClawConfig;
    /**
     * 自动检测配置
     */
    autoDetectConfig(): OpenClawConfig;
}
//# sourceMappingURL=config-initializer.d.ts.map