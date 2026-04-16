import { Logger } from './logger';
export interface ErrorContext {
    operation: string;
    file?: string;
    details?: Record<string, unknown>;
}
export declare class ErrorHandler {
    private logger;
    constructor(logger: Logger);
    /**
     * 处理文件不存在错误
     */
    handleFileNotFound(filePath: string, suggestions: string[]): never;
    /**
     * 处理配置错误
     */
    handleConfigError(message: string, configPath: string): never;
    /**
     * 处理权限错误
     */
    handlePermissionError(filePath: string): never;
    /**
     * 处理 OpenClaw 未运行错误
     */
    handleOpenClawNotRunning(): never;
    /**
     * 处理日志文件错误
     */
    handleLogFileError(logFile: string): never;
    /**
     * 处理数据库错误
     */
    handleDatabaseError(error: Error, dbPath: string): never;
    /**
     * 处理通用错误
     */
    handleGenericError(error: Error, context: ErrorContext): never;
    /**
     * 验证文件存在
     */
    validateFileExists(filePath: string, suggestions: string[]): void;
    /**
     * 验证目录存在
     */
    validateDirectoryExists(dirPath: string, autoCreate?: boolean): void;
    /**
     * 验证文件可读
     */
    validateFileReadable(filePath: string): void;
    /**
     * 验证文件可写
     */
    validateFileWritable(filePath: string): void;
    /**
     * 安全执行操作
     */
    safeExecute<T>(operation: () => Promise<T>, context: ErrorContext): Promise<T>;
}
//# sourceMappingURL=error-handler.d.ts.map