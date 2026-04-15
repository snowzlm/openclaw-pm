/**
 * 缓存管理器
 */
export declare class CacheManager {
    private memoryCache;
    private diskCachePath;
    private maxMemorySize;
    constructor(cacheDir: string, maxMemorySizeMB?: number);
    /**
     * 确保缓存目录存在
     */
    private ensureCacheDir;
    /**
     * 获取缓存文件路径
     */
    private getCacheFilePath;
    /**
     * 哈希键名
     */
    private hashKey;
    /**
     * 检查缓存是否过期
     */
    private isExpired;
    /**
     * 获取内存缓存大小（估算）
     */
    private getMemoryCacheSize;
    /**
     * 清理过期的内存缓存
     */
    private cleanupMemoryCache;
    /**
     * 驱逐最旧的缓存条目
     */
    private evictOldest;
    /**
     * 获取缓存（内存优先）
     */
    get<T>(key: string): T | null;
    /**
     * 设置缓存（内存 + 磁盘）
     */
    set<T>(key: string, value: T, ttlSeconds: number): void;
    /**
     * 删除缓存
     */
    delete(key: string): void;
    /**
     * 清空所有缓存
     */
    clear(): void;
    /**
     * 按模式删除缓存
     */
    invalidate(pattern: string): number;
    /**
     * 清理过期缓存
     */
    cleanup(): number;
    /**
     * 获取缓存统计
     */
    getStats(): {
        memoryEntries: number;
        memorySizeBytes: number;
        diskEntries: number;
        diskSizeBytes: number;
    };
}
//# sourceMappingURL=cache-manager.d.ts.map