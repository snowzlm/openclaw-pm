/**
 * OpenClaw PM - TypeScript Core
 * 日志管理
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LoggerOptions {
    level?: LogLevel;
    logFile?: string;
    enableConsole?: boolean;
    enableFile?: boolean;
}
export declare class Logger {
    private level;
    private logFile?;
    private enableConsole;
    private enableFile;
    constructor(options?: LoggerOptions);
    private formatMessage;
    private writeToFile;
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: Error): void;
    success(message: string): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map