/**
 * 分析检查点接口
 */
export interface AnalysisCheckpoint {
    logFile: string;
    lastOffset: number;
    lastLineNumber: number;
    lastTimestamp: string;
    stats: {
        messagesReceived: number;
        messagesSent: number;
        errors: number;
        gatewayStarts: number;
        gatewayStops: number;
    };
    updatedAt: number;
}
/**
 * 增量分析结果
 */
export interface IncrementalAnalysisResult {
    newMessages: number;
    newErrors: number;
    newGatewayEvents: number;
    totalProcessed: number;
    checkpoint: AnalysisCheckpoint;
}
/**
 * 增量分析管理器
 */
export declare class IncrementalAnalyzer {
    private checkpointDir;
    constructor(cacheDir: string);
    /**
     * 确保检查点目录存在
     */
    private ensureCheckpointDir;
    /**
     * 获取检查点文件路径
     */
    private getCheckpointPath;
    /**
     * 加载检查点
     */
    loadCheckpoint(logFile: string): AnalysisCheckpoint | null;
    /**
     * 保存检查点
     */
    saveCheckpoint(checkpoint: AnalysisCheckpoint): void;
    /**
     * 创建初始检查点
     */
    private createInitialCheckpoint;
    /**
     * 检查日志文件是否被截断或重置
     */
    private isLogFileReset;
    /**
     * 分析新增内容
     */
    analyzeIncremental(logFile: string): IncrementalAnalysisResult;
    /**
     * 重置检查点
     */
    resetCheckpoint(logFile: string): void;
    /**
     * 获取所有检查点
     */
    getAllCheckpoints(): AnalysisCheckpoint[];
    /**
     * 清理过期检查点
     */
    cleanupOldCheckpoints(daysToKeep?: number): number;
    /**
     * 获取检查点统计
     */
    getCheckpointStats(): {
        totalCheckpoints: number;
        totalSize: number;
        oldestCheckpoint: string | null;
        newestCheckpoint: string | null;
    };
}
//# sourceMappingURL=incremental-analyzer.d.ts.map