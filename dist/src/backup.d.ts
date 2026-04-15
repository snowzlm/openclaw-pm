/**
 * OpenClaw PM - TypeScript Core
 * 备份管理器
 */
import { ConfigManager } from './config';
import { Logger } from './logger';
import { BackupInfo } from './types';
export declare class BackupManager {
    private config;
    private logger;
    constructor(config: ConfigManager, logger: Logger);
    /**
     * 创建备份
     */
    createBackup(type?: 'auto' | 'manual'): Promise<BackupInfo>;
    /**
     * 恢复备份
     */
    restoreBackup(backupPath: string): Promise<void>;
    /**
     * 列出所有备份
     */
    listBackups(): BackupInfo[];
    /**
     * 清理旧备份
     */
    private cleanOldBackups;
    /**
     * 递归复制文件/目录
     */
    private copyRecursive;
    /**
     * 递归删除目录
     */
    private removeRecursive;
    /**
     * 格式化文件大小
     */
    private formatSize;
}
//# sourceMappingURL=backup.d.ts.map