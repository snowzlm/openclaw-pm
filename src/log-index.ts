import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
  hourlyDistribution: { hour: number; offset: number; count: number }[];
  lastModified: number;
  createdAt: number;
}

/**
 * 日志索引管理器
 */
export class LogIndexManager {
  private indexDir: string;

  constructor(cacheDir: string) {
    this.indexDir = path.join(cacheDir, 'log-indexes');
    this.ensureIndexDir();
  }

  /**
   * 确保索引目录存在
   */
  private ensureIndexDir(): void {
    if (!fs.existsSync(this.indexDir)) {
      fs.mkdirSync(this.indexDir, { recursive: true });
    }
  }

  /**
   * 获取索引文件路径
   */
  private getIndexPath(date: string): string {
    return path.join(this.indexDir, `log-index-${date}.json`);
  }

  /**
   * 计算文件哈希
   */
  private calculateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 检查索引是否有效
   */
  isIndexValid(date: string, logFilePath: string): boolean {
    const indexPath = this.getIndexPath(date);

    if (!fs.existsSync(indexPath)) {
      return false;
    }

    try {
      const index = this.loadIndex(date);
      if (!index) return false;

      // 检查日志文件是否被修改
      const logStat = fs.statSync(logFilePath);
      if (logStat.mtimeMs > index.lastModified) {
        return false;
      }

      // 检查文件哈希（可选，更严格）
      // const currentHash = this.calculateFileHash(logFilePath);
      // if (currentHash !== index.fileHash) {
      //   return false;
      // }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 加载索引
   */
  loadIndex(date: string): LogIndex | null {
    const indexPath = this.getIndexPath(date);

    if (!fs.existsSync(indexPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 保存索引
   */
  saveIndex(index: LogIndex): void {
    const indexPath = this.getIndexPath(index.date);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * 构建日志索引
   */
  buildIndex(date: string, logFilePath: string): LogIndex {
    const content = fs.readFileSync(logFilePath, 'utf-8');
    const lines = content.split('\n');
    const logStat = fs.statSync(logFilePath);

    let messageCount = 0;
    let errorCount = 0;
    const hourlyMap = new Map<number, { offset: number; count: number }>();

    lines.forEach((line, index) => {
      if (!line.trim()) return;

      // 统计消息
      if (line.includes('received message')) {
        messageCount++;
      }

      // 统计错误
      if (/ERROR|FailoverError|All models failed/.test(line)) {
        errorCount++;
      }

      // 按小时分布
      const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, { offset: index, count: 0 });
        }
        hourlyMap.get(hour)!.count++;
      }
    });

    const hourlyDistribution = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, offset: data.offset, count: data.count }))
      .sort((a, b) => a.hour - b.hour);

    const index: LogIndex = {
      date,
      filePath: logFilePath,
      fileHash: this.calculateFileHash(logFilePath),
      lineCount: lines.length,
      messageCount,
      errorCount,
      hourlyDistribution,
      lastModified: logStat.mtimeMs,
      createdAt: Date.now(),
    };

    this.saveIndex(index);
    return index;
  }

  /**
   * 获取或构建索引
   */
  getOrBuildIndex(date: string, logFilePath: string): LogIndex {
    if (this.isIndexValid(date, logFilePath)) {
      const index = this.loadIndex(date);
      if (index) return index;
    }

    return this.buildIndex(date, logFilePath);
  }

  /**
   * 清理过期索引
   */
  cleanupOldIndexes(daysToKeep: number = 30): number {
    const files = fs.readdirSync(this.indexDir);
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      if (!file.startsWith('log-index-')) continue;

      const filePath = path.join(this.indexDir, file);
      const stat = fs.statSync(filePath);

      if (stat.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 获取索引统计
   */
  getIndexStats(): {
    totalIndexes: number;
    totalSize: number;
    oldestIndex: string | null;
    newestIndex: string | null;
  } {
    const files = fs.readdirSync(this.indexDir);
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestIndex: string | null = null;
    let newestIndex: string | null = null;

    for (const file of files) {
      if (!file.startsWith('log-index-')) continue;

      const filePath = path.join(this.indexDir, file);
      const stat = fs.statSync(filePath);
      totalSize += stat.size;

      if (stat.mtimeMs < oldestTime) {
        oldestTime = stat.mtimeMs;
        oldestIndex = file;
      }

      if (stat.mtimeMs > newestTime) {
        newestTime = stat.mtimeMs;
        newestIndex = file;
      }
    }

    return {
      totalIndexes: files.filter((f) => f.startsWith('log-index-')).length,
      totalSize,
      oldestIndex,
      newestIndex,
    };
  }
}
