/**
 * 日志索引接口
 */
export interface LogIndex {
    date: string;
    filePath: string;
    fileHash: string;
    lineCount: number;
    messageCount: number;
    errorCount: number;
    hourlyDistribution: {
        hour: number;
        offset: number;
        count: number;
    }[];
    lastModified: number;
    createdAt: number;
}
/**
 * 日志索引管理器
 */
export declare class LogIndexManager {
    private indexDir;
    constructor(cacheDir: string);
    /**
     * 确保索引目录存在
     */
    private ensureIndexDir;
    /**
     * 获取索引文件路径
     */
    private getIndexPath;
    /**
     * 计算文件哈希
     */
    private calculateFileHash;
    /**
     * 检查索引是否有效
     */
    isIndexValid(date: string, logFilePath: string): boolean;
    /**
     * 加载索引
     */
    loadIndex(date: string): LogIndex | null;
    /**
     * 保存索引
     */
    saveIndex(index: LogIndex): void;
    /**
     * 构建日志索引
     */
    buildIndex(date: string, logFilePath: string): LogIndex;
    /**
     * 获取或构建索引
     */
    getOrBuildIndex(date: string, logFilePath: string): LogIndex;
    /**
     * 清理过期索引
     */
    cleanupOldIndexes(daysToKeep?: number): number;
    /**
     * 获取索引统计
     */
    getIndexStats(): {
        totalIndexes: number;
        totalSize: number;
        oldestIndex: string | null;
        newestIndex: string | null;
    };
}
//# sourceMappingURL=log-index.d.ts.map