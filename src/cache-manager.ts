import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private diskCachePath: string;
  private maxMemorySize: number;

  constructor(cacheDir: string, maxMemorySizeMB: number = 50) {
    this.memoryCache = new Map();
    this.diskCachePath = path.join(cacheDir, 'disk-cache');
    this.maxMemorySize = maxMemorySizeMB * 1024 * 1024;
    this.ensureCacheDir();
  }

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.diskCachePath)) {
      fs.mkdirSync(this.diskCachePath, { recursive: true });
    }
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFilePath(key: string): string {
    const hash = this.hashKey(key);
    return path.join(this.diskCachePath, `${hash}.json`);
  }

  /**
   * 哈希键名
   */
  private hashKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * 获取内存缓存大小（估算）
   */
  private getMemoryCacheSize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry.value).length;
    }
    return size;
  }

  /**
   * 清理过期的内存缓存
   */
  private cleanupMemoryCache(): void {
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
  private evictOldest(): void {
    let oldestKey: string | null = null;
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
  get<T>(key: string): T | null {
    // 1. 尝试从内存缓存获取
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.value as T;
    }

    // 2. 尝试从磁盘缓存获取
    const filePath = this.getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const entry: CacheEntry<T> = JSON.parse(content);

        if (!this.isExpired(entry)) {
          // 加载到内存缓存
          this.memoryCache.set(key, entry);
          return entry.value;
        } else {
          // 删除过期的磁盘缓存
          fs.unlinkSync(filePath);
        }
      } catch {
        // 读取失败，删除损坏的缓存文件
        fs.unlinkSync(filePath);
      }
    }

    return null;
  }

  /**
   * 设置缓存（内存 + 磁盘）
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const entry: CacheEntry<T> = {
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
    } catch {
      // 磁盘写入失败，忽略（内存缓存仍然有效）
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
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
  clear(): void {
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
  invalidate(pattern: string): number {
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
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.diskCachePath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const entry: CacheEntry<any> = JSON.parse(content);

        if (regex.test(entry.key)) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch {
        // 读取失败，删除损坏的文件
        fs.unlinkSync(filePath);
      }
    }

    return deletedCount;
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
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
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.diskCachePath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const entry: CacheEntry<any> = JSON.parse(content);

        if (now > entry.expiresAt) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch {
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
  getStats(): {
    memoryEntries: number;
    memorySizeBytes: number;
    diskEntries: number;
    diskSizeBytes: number;
  } {
    const memoryEntries = this.memoryCache.size;
    const memorySizeBytes = this.getMemoryCacheSize();

    const files = fs.readdirSync(this.diskCachePath);
    let diskEntries = 0;
    let diskSizeBytes = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

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
