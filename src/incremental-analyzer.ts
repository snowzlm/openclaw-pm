import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
export class IncrementalAnalyzer {
  private checkpointDir: string;

  constructor(cacheDir: string) {
    this.checkpointDir = path.join(cacheDir, 'checkpoints');
    this.ensureCheckpointDir();
  }

  /**
   * 确保检查点目录存在
   */
  private ensureCheckpointDir(): void {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * 获取检查点文件路径
   */
  private getCheckpointPath(logFile: string): string {
    const hash = crypto.createHash('md5').update(logFile).digest('hex');
    return path.join(this.checkpointDir, `checkpoint-${hash}.json`);
  }

  /**
   * 加载检查点
   */
  loadCheckpoint(logFile: string): AnalysisCheckpoint | null {
    const checkpointPath = this.getCheckpointPath(logFile);

    if (!fs.existsSync(checkpointPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(checkpointPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 保存检查点
   */
  saveCheckpoint(checkpoint: AnalysisCheckpoint): void {
    const checkpointPath = this.getCheckpointPath(checkpoint.logFile);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * 创建初始检查点
   */
  private createInitialCheckpoint(logFile: string): AnalysisCheckpoint {
    return {
      logFile,
      lastOffset: 0,
      lastLineNumber: 0,
      lastTimestamp: '',
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0,
        gatewayStarts: 0,
        gatewayStops: 0,
      },
      updatedAt: Date.now(),
    };
  }

  /**
   * 检查日志文件是否被截断或重置
   */
  private isLogFileReset(logFile: string, checkpoint: AnalysisCheckpoint): boolean {
    const stat = fs.statSync(logFile);
    return stat.size < checkpoint.lastOffset;
  }

  /**
   * 分析新增内容
   */
  analyzeIncremental(logFile: string): IncrementalAnalysisResult {
    // 1. 加载或创建检查点
    let checkpoint = this.loadCheckpoint(logFile);
    if (!checkpoint) {
      checkpoint = this.createInitialCheckpoint(logFile);
    }

    // 2. 检查日志文件是否被重置
    if (this.isLogFileReset(logFile, checkpoint)) {
      checkpoint = this.createInitialCheckpoint(logFile);
    }

    // 3. 读取新增内容
    const fd = fs.openSync(logFile, 'r');
    const stat = fs.statSync(logFile);
    const newContentSize = stat.size - checkpoint.lastOffset;

    if (newContentSize <= 0) {
      fs.closeSync(fd);
      return {
        newMessages: 0,
        newErrors: 0,
        newGatewayEvents: 0,
        totalProcessed: 0,
        checkpoint,
      };
    }

    const buffer = Buffer.alloc(newContentSize);
    fs.readSync(fd, buffer, 0, newContentSize, checkpoint.lastOffset);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf-8');
    const newLines = newContent.split('\n');

    // 4. 分析新增内容
    let newMessages = 0;
    let newErrors = 0;
    let newGatewayEvents = 0;
    let lastTimestamp = checkpoint.lastTimestamp;

    for (const line of newLines) {
      if (!line.trim()) continue;

      // 提取时间戳
      const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      if (timeMatch) {
        lastTimestamp = timeMatch[1];
      }

      // 统计消息
      if (line.includes('received message') || line.includes('inbound message')) {
        newMessages++;
        checkpoint.stats.messagesReceived++;
      }

      if (line.includes('sent message') || line.includes('outbound message')) {
        checkpoint.stats.messagesSent++;
      }

      // 统计错误
      if (/ERROR|FailoverError|All models failed/.test(line)) {
        newErrors++;
        checkpoint.stats.errors++;
      }

      // 统计 Gateway 事件
      if (line.includes('Gateway starting') || line.includes('Gateway started')) {
        newGatewayEvents++;
        checkpoint.stats.gatewayStarts++;
      }

      if (line.includes('Gateway stopping') || line.includes('Gateway stopped')) {
        newGatewayEvents++;
        checkpoint.stats.gatewayStops++;
      }
    }

    // 5. 更新检查点
    checkpoint.lastOffset = stat.size;
    checkpoint.lastLineNumber += newLines.length;
    checkpoint.lastTimestamp = lastTimestamp;
    checkpoint.updatedAt = Date.now();

    this.saveCheckpoint(checkpoint);

    return {
      newMessages,
      newErrors,
      newGatewayEvents,
      totalProcessed: newLines.length,
      checkpoint,
    };
  }

  /**
   * 重置检查点
   */
  resetCheckpoint(logFile: string): void {
    const checkpointPath = this.getCheckpointPath(logFile);
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
    }
  }

  /**
   * 获取所有检查点
   */
  getAllCheckpoints(): AnalysisCheckpoint[] {
    const files = fs.readdirSync(this.checkpointDir);
    const checkpoints: AnalysisCheckpoint[] = [];

    for (const file of files) {
      if (!file.startsWith('checkpoint-')) continue;

      const filePath = path.join(this.checkpointDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        checkpoints.push(JSON.parse(content));
      } catch {
        // 忽略损坏的检查点文件
      }
    }

    return checkpoints;
  }

  /**
   * 清理过期检查点
   */
  cleanupOldCheckpoints(daysToKeep: number = 7): number {
    const files = fs.readdirSync(this.checkpointDir);
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      if (!file.startsWith('checkpoint-')) continue;

      const filePath = path.join(this.checkpointDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const checkpoint: AnalysisCheckpoint = JSON.parse(content);

        if (checkpoint.updatedAt < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch {
        // 删除损坏的检查点文件
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 获取检查点统计
   */
  getCheckpointStats(): {
    totalCheckpoints: number;
    totalSize: number;
    oldestCheckpoint: string | null;
    newestCheckpoint: string | null;
  } {
    const files = fs.readdirSync(this.checkpointDir);
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestCheckpoint: string | null = null;
    let newestCheckpoint: string | null = null;

    for (const file of files) {
      if (!file.startsWith('checkpoint-')) continue;

      const filePath = path.join(this.checkpointDir, file);
      const stat = fs.statSync(filePath);
      totalSize += stat.size;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const checkpoint: AnalysisCheckpoint = JSON.parse(content);

        if (checkpoint.updatedAt < oldestTime) {
          oldestTime = checkpoint.updatedAt;
          oldestCheckpoint = checkpoint.logFile;
        }

        if (checkpoint.updatedAt > newestTime) {
          newestTime = checkpoint.updatedAt;
          newestCheckpoint = checkpoint.logFile;
        }
      } catch {
        // 忽略损坏的文件
      }
    }

    return {
      totalCheckpoints: files.filter((f) => f.startsWith('checkpoint-')).length,
      totalSize,
      oldestCheckpoint,
      newestCheckpoint,
    };
  }
}
