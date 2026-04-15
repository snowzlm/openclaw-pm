"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * 缓存管理器
 */
class CacheManager {
    constructor(cacheDir, maxMemorySizeMB = 50) {
        this.memoryCache = new Map();
        this.diskCachePath = path.join(cacheDir, 'disk-cache');
        this.maxMemorySize = maxMemorySizeMB * 1024 * 1024;
        this.ensureCacheDir();
    }
    /**
     * 确保缓存目录存在
     */
    ensureCacheDir() {
        if (!fs.existsSync(this.diskCachePath)) {
            fs.mkdirSync(this.diskCachePath, { recursive: true });
        }
    }
    /**
     * 获取缓存文件路径
     */
    getCacheFilePath(key) {
        const hash = this.hashKey(key);
        return path.join(this.diskCachePath, `${hash}.json`);
    }
    /**
     * 哈希键名
     */
    hashKey(key) {
        return crypto.createHash('md5').update(key).digest('hex');
    }
    /**
     * 检查缓存是否过期
     */
    isExpired(entry) {
        return Date.now() > entry.expiresAt;
    }
    /**
     * 获取内存缓存大小（估算）
     */
    getMemoryCacheSize() {
        let size = 0;
        for (const entry of this.memoryCache.values()) {
            size += JSON.stringify(entry.value).length;
        }
        return size;
    }
    /**
     * 清理过期的内存缓存
     */
    cleanupMemoryCache() {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
            }
        }
    }
    /**
     * 驱逐最旧的缓存条目
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
        }
    }
    /**
     * 获取缓存（内存优先）
     */
    get(key) {
        // 1. 尝试从内存缓存获取
        const memoryEntry = this.memoryCache.get(key);
        if (memoryEntry && !this.isExpired(memoryEntry)) {
            return memoryEntry.value;
        }
        // 2. 尝试从磁盘缓存获取
        const filePath = this.getCacheFilePath(key);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const entry = JSON.parse(content);
                if (!this.isExpired(entry)) {
                    // 加载到内存缓存
                    this.memoryCache.set(key, entry);
                    return entry.value;
                }
                else {
                    // 删除过期的磁盘缓存
                    fs.unlinkSync(filePath);
                }
            }
            catch {
                // 读取失败，删除损坏的缓存文件
                fs.unlinkSync(filePath);
            }
        }
        return null;
    }
    /**
     * 设置缓存（内存 + 磁盘）
     */
    set(key, value, ttlSeconds) {
        const entry = {
            key,
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
            createdAt: Date.now(),
        };
        // 1. 写入内存缓存
        this.memoryCache.set(key, entry);
        // 2. 检查内存缓存大小
        if (this.getMemoryCacheSize() > this.maxMemorySize) {
            this.cleanupMemoryCache();
            if (this.getMemoryCacheSize() > this.maxMemorySize) {
                this.evictOldest();
            }
        }
        // 3. 写入磁盘缓存
        const filePath = this.getCacheFilePath(key);
        try {
            fs.writeFileSync(filePath, JSON.stringify(entry));
        }
        catch {
            // 磁盘写入失败，忽略（内存缓存仍然有效）
        }
    }
    /**
     * 删除缓存
     */
    delete(key) {
        // 1. 删除内存缓存
        this.memoryCache.delete(key);
        // 2. 删除磁盘缓存
        const filePath = this.getCacheFilePath(key);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    /**
     * 清空所有缓存
     */
    clear() {
        // 1. 清空内存缓存
        this.memoryCache.clear();
        // 2. 清空磁盘缓存
        const files = fs.readdirSync(this.diskCachePath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                fs.unlinkSync(path.join(this.diskCachePath, file));
            }
        }
    }
    /**
     * 按模式删除缓存
     */
    invalidate(pattern) {
        let deletedCount = 0;
        const regex = new RegExp(pattern);
        // 1. 删除内存缓存
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
                deletedCount++;
            }
        }
        // 2. 删除磁盘缓存
        const files = fs.readdirSync(this.diskCachePath);
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filePath = path.join(this.diskCachePath, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const entry = JSON.parse(content);
                if (regex.test(entry.key)) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            catch {
                // 读取失败，删除损坏的文件
                fs.unlinkSync(filePath);
            }
        }
        return deletedCount;
    }
    /**
     * 清理过期缓存
     */
    cleanup() {
        let deletedCount = 0;
        const now = Date.now();
        // 1. 清理内存缓存
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
                deletedCount++;
            }
        }
        // 2. 清理磁盘缓存
        const files = fs.readdirSync(this.diskCachePath);
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filePath = path.join(this.diskCachePath, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const entry = JSON.parse(content);
                if (now > entry.expiresAt) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            catch {
                // 读取失败，删除损坏的文件
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * 获取缓存统计
     */
    getStats() {
        const memoryEntries = this.memoryCache.size;
        const memorySizeBytes = this.getMemoryCacheSize();
        const files = fs.readdirSync(this.diskCachePath);
        let diskEntries = 0;
        let diskSizeBytes = 0;
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            diskEntries++;
            const filePath = path.join(this.diskCachePath, file);
            const stat = fs.statSync(filePath);
            diskSizeBytes += stat.size;
        }
        return {
            memoryEntries,
            memorySizeBytes,
            diskEntries,
            diskSizeBytes,
        };
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=cache-manager.js.map