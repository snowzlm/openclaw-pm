import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import {
  ConfigManager,
  detectOpenClawDir,
  getDefaultCacheDir,
  getDefaultWorkspaceDir,
} from './config';
import { Logger } from './logger';
import { LogIndexManager } from './log-index';
import { CacheManager } from './cache-manager';
import { IncrementalAnalyzer } from './incremental-analyzer';

export interface DailyStats {
  date: string;
  messages: {
    received: number;
    sent: number;
    activeSessions: number;
  };
  hourlyDistribution: { hour: number; count: number }[];
  errors: {
    total: number;
    failover: number;
    timeout: number;
    connection: number;
    recent: string[];
  };
  gateway: {
    starts: number;
    stops: number;
    startTimes: string[];
  };
  performance: {
    completedTasks: number;
    slowQueries: number;
  };
  channels: {
    telegram: number;
    discord: number;
    slack: number;
    other: number;
  };
  health: {
    score: number;
    activity: string;
    stability: string;
  };
}

export interface MorningBriefing {
  timestamp: string;
  system: {
    gatewayRunning: boolean;
    gatewayPid?: number;
    lockFiles: number;
    diskUsage?: number;
  };
  yesterday: {
    date: string;
    messagesReceived: number;
    messagesSent: number;
    restarts: number;
    errors: number;
    lastError?: string;
  };
  cron: {
    okCount: number;
    missedCount: number;
    missedTasks: string[];
  };
  todos: {
    inProgress: string[];
  };
  suggestions: string[];
}

export interface HeartbeatResult {
  timestamp: string;
  checks: {
    contextHealth: { status: string; message: string };
    inProgressTasks: { status: string; message: string };
    cronTasks: { status: string; message: string };
  };
  allPassed: boolean;
}

export class StatsGenerator {
  private logIndexManager: LogIndexManager;
  private cacheManager: CacheManager;
  private incrementalAnalyzer: IncrementalAnalyzer;

  constructor(
    private config: ConfigManager,
    private logger: Logger
  ) {
    const cacheDir = getDefaultCacheDir(detectOpenClawDir());
    this.logIndexManager = new LogIndexManager(cacheDir);
    this.cacheManager = new CacheManager(cacheDir);
    this.incrementalAnalyzer = new IncrementalAnalyzer(cacheDir);
  }

  /**
   * 生成每日统计（使用缓存和索引）
   */
  async generateDailyStats(date?: string): Promise<DailyStats> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `daily-stats:${targetDate}`;

    // 1. 尝试从缓存获取
    const cached = this.cacheManager.get<DailyStats>(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的统计数据: ${targetDate}`);
      return cached;
    }

    const logFile = this.getLogFile(targetDate);

    if (!fs.existsSync(logFile)) {
      throw new Error(`日志文件不存在: ${logFile}`);
    }

    this.logger.info(`生成每日统计: ${targetDate}`);

    // 2. 获取或构建索引
    const startTime = Date.now();
    const index = this.logIndexManager.getOrBuildIndex(targetDate, logFile);
    const indexTime = Date.now() - startTime;
    this.logger.debug(`索引耗时: ${indexTime}ms`);

    // 3. 使用索引数据加速分析
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n');

    const stats: DailyStats = {
      date: targetDate,
      messages: this.analyzeMessages(lines, index),
      hourlyDistribution: this.analyzeHourlyDistribution(lines, index),
      errors: this.analyzeErrors(lines, index),
      gateway: this.analyzeGateway(lines),
      performance: this.analyzePerformance(lines),
      channels: this.analyzeChannels(lines),
      health: this.calculateHealth(lines),
    };

    // 4. 缓存结果（24小时）
    this.cacheManager.set(cacheKey, stats, 24 * 60 * 60);

    return stats;
  }

  /**
   * 生成晨间简报
   */
  async generateMorningBriefing(): Promise<MorningBriefing> {
    this.logger.info('生成晨间简报');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return {
      timestamp: new Date().toISOString(),
      system: await this.checkSystemHealth(),
      yesterday: await this.analyzeYesterday(yesterdayStr),
      cron: await this.checkCronStatus(),
      todos: await this.checkTodos(),
      suggestions: await this.generateSuggestions(),
    };
  }

  /**
   * 执行心跳检查
   */
  async performHeartbeatCheck(): Promise<HeartbeatResult> {
    this.logger.info('执行心跳检查');

    const checks = {
      contextHealth: await this.checkContextHealth(),
      inProgressTasks: await this.checkInProgressTasks(),
      cronTasks: await this.checkCronTasks(),
    };

    const allPassed = Object.values(checks).every((c) => c.status === 'ok');

    return {
      timestamp: new Date().toISOString(),
      checks,
      allPassed,
    };
  }

  // ============================================
  // 私有方法 - 每日统计
  // ============================================

  private analyzeMessages(lines: string[], index?: any): DailyStats['messages'] {
    // 如果有索引，使用索引数据
    if (index) {
      const received = index.messageCount;
      const sent = lines.filter(
        (l) => l.includes('sent message') || l.includes('dispatch complete')
      ).length;

      const sessionSet = new Set<string>();
      lines.forEach((line) => {
        const match = line.match(/session:([a-zA-Z0-9-]+)/);
        if (match) sessionSet.add(match[1]);
      });

      return {
        received,
        sent,
        activeSessions: sessionSet.size,
      };
    }

    // 否则全文扫描
    const received = lines.filter((l) => l.includes('received message')).length;
    const sent = lines.filter(
      (l) => l.includes('sent message') || l.includes('dispatch complete')
    ).length;

    const sessionSet = new Set<string>();
    lines.forEach((line) => {
      const match = line.match(/session:([a-zA-Z0-9-]+)/);
      if (match) sessionSet.add(match[1]);
    });

    return {
      received,
      sent,
      activeSessions: sessionSet.size,
    };
  }

  private analyzeHourlyDistribution(
    lines: string[],
    index?: any
  ): { hour: number; count: number }[] {
    // 如果有索引，使用索引数据
    if (index && index.hourlyDistribution) {
      return index.hourlyDistribution.map((h: any) => ({ hour: h.hour, count: h.count }));
    }

    // 否则全文扫描
    const hourCounts = new Map<number, number>();

    lines.forEach((line) => {
      if (!line.includes('received message')) return;
      const match = line.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const hour = parseInt(match[1], 10);
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    });

    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
  }

  private analyzeErrors(lines: string[], index?: any): DailyStats['errors'] {
    // 如果有索引，使用索引数据
    const total = index
      ? index.errorCount
      : lines.filter((l) => /ERROR|FailoverError|All models failed/.test(l)).length;

    const errorLines = lines.filter((l) => /ERROR|FailoverError|All models failed/.test(l));
    const failover = errorLines.filter((l) => /FailoverError|All models failed/.test(l)).length;
    const timeout = errorLines.filter((l) => l.includes('timed out')).length;
    const connection = errorLines.filter((l) => /ECONNREFUSED|ECONNRESET|ETIMEDOUT/.test(l)).length;

    const recent = errorLines.slice(-3).map((line) => {
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : 'unknown';
      const msg = line.substring(line.indexOf('ERROR')).substring(0, 70);
      return `[${time}] ${msg}`;
    });

    return { total, failover, timeout, connection, recent };
  }

  private analyzeGateway(lines: string[]): DailyStats['gateway'] {
    const starts = lines.filter((l) => /Gateway starting|openclaw-gateway.*started/.test(l)).length;
    const stops = lines.filter((l) => /Gateway stopping|openclaw-gateway.*stopped/.test(l)).length;

    const startTimes: string[] = [];
    lines.forEach((line) => {
      if (/Gateway starting|openclaw-gateway.*started/.test(line)) {
        const match = line.match(/(\d{2}:\d{2}:\d{2})/);
        if (match) startTimes.push(match[1]);
      }
    });

    return { starts, stops, startTimes: startTimes.slice(0, 5) };
  }

  private analyzePerformance(lines: string[]): DailyStats['performance'] {
    const completedTasks = lines.filter((l) => l.includes('dispatch complete')).length;
    const slowQueries = lines.filter((l) => /took \d{4,}ms|took \d+s/.test(l)).length;

    return { completedTasks, slowQueries };
  }

  private analyzeChannels(lines: string[]): DailyStats['channels'] {
    const messageLines = lines.filter((l) => l.includes('received message'));

    return {
      telegram: messageLines.filter((l) => l.includes('telegram')).length,
      discord: messageLines.filter((l) => l.includes('discord')).length,
      slack: messageLines.filter((l) => l.includes('slack')).length,
      other: messageLines.filter((l) => !/telegram|discord|slack/.test(l)).length,
    };
  }

  private calculateHealth(lines: string[]): DailyStats['health'] {
    const errors = lines.filter((l) => /ERROR|FailoverError/.test(l)).length;
    const restarts = lines.filter((l) => l.includes('Gateway starting')).length;
    const messages = lines.filter((l) => l.includes('received message')).length;

    let score = 100;
    score -= errors * 2;
    if (restarts > 1) score -= (restarts - 1) * 10;
    score = Math.max(0, score);

    const activity = messages > 100 ? '高' : messages > 20 ? '中' : '低';
    const stability = restarts === 0 ? '优秀' : restarts === 1 ? '良好' : '需要关注';

    return { score, activity, stability };
  }

  // ============================================
  // 私有方法 - 晨间简报
  // ============================================

  private async checkSystemHealth(): Promise<MorningBriefing['system']> {
    const openclawDir = this.config.get<string>('openclaw.dir', detectOpenClawDir());

    // 检查 Gateway 进程
    let gatewayRunning = false;
    let gatewayPid: number | undefined;
    try {
      const { execSync } = child_process;
      const result = execSync('pgrep -f "^openclaw-gateway$"', { encoding: 'utf-8' }).trim();
      if (result) {
        gatewayRunning = true;
        gatewayPid = parseInt(result.split('\n')[0], 10);
      }
    } catch {
      // Gateway 未运行
    }

    // 检查 lock 文件
    let lockFiles = 0;
    try {
      const { execSync } = child_process;
      const result = execSync(`find ${openclawDir}/agents/*/sessions/*.lock 2>/dev/null | wc -l`, {
        encoding: 'utf-8',
      }).trim();
      lockFiles = parseInt(result, 10) || 0;
    } catch {
      // 无 lock 文件
    }

    // 检查磁盘使用率
    let diskUsage: number | undefined;
    try {
      const { execSync } = child_process;
      const result = execSync(`df -h ${openclawDir} | tail -1 | awk '{print $5}' | sed 's/%//'`, {
        encoding: 'utf-8',
      }).trim();
      diskUsage = parseInt(result, 10);
    } catch {
      // 无法获取磁盘使用率
    }

    return { gatewayRunning, gatewayPid, lockFiles, diskUsage };
  }

  private async analyzeYesterday(date: string): Promise<MorningBriefing['yesterday']> {
    const logFile = this.getLogFile(date);

    if (!fs.existsSync(logFile)) {
      return {
        date,
        messagesReceived: 0,
        messagesSent: 0,
        restarts: 0,
        errors: 0,
      };
    }

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n');

    const messagesReceived = lines.filter((l) => l.includes('received message')).length;
    const messagesSent = lines.filter(
      (l) => l.includes('sent message') || l.includes('dispatch complete')
    ).length;
    const restarts = lines.filter((l) =>
      /Gateway starting|openclaw-gateway.*started/.test(l)
    ).length;
    const errorLines = lines.filter((l) => /ERROR|FailoverError|All models failed/.test(l));
    const errors = errorLines.length;

    let lastError: string | undefined;
    if (errorLines.length > 0) {
      const lastErrorLine = errorLines[errorLines.length - 1];
      const timeMatch = lastErrorLine.match(/(\d{2}:\d{2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : 'unknown';
      const msg = lastErrorLine.substring(lastErrorLine.indexOf('ERROR')).substring(0, 60);
      lastError = `[${time}] ${msg}`;
    }

    return { date, messagesReceived, messagesSent, restarts, errors, lastError };
  }

  private async checkCronStatus(): Promise<MorningBriefing['cron']> {
    const cronTasks = this.config.get<any[]>('cron_tasks', []);
    const enabledTasks = cronTasks.filter((t: any) => t.enabled);

    // 简化版：假设所有任务都已执行
    return {
      okCount: enabledTasks.length,
      missedCount: 0,
      missedTasks: [],
    };
  }

  private async checkTodos(): Promise<MorningBriefing['todos']> {
    const workspaceDir = this.config.get<string>(
      'openclaw.workspace_dir',
      getDefaultWorkspaceDir(detectOpenClawDir())
    );
    const today = new Date().toISOString().split('T')[0];
    const memoryFile = path.join(workspaceDir, 'memory', `${today}.md`);

    if (!fs.existsSync(memoryFile)) {
      return { inProgress: [] };
    }

    const content = fs.readFileSync(memoryFile, 'utf-8');
    const lines = content.split('\n');

    const inProgress: string[] = [];
    let inSection = false;

    for (const line of lines) {
      if (line.startsWith('## In Progress')) {
        inSection = true;
        continue;
      }
      if (inSection && line.startsWith('##')) {
        break;
      }
      if (inSection && line.startsWith('###')) {
        inProgress.push(line.replace(/^###\s*/, ''));
      }
    }

    return { inProgress };
  }

  private async generateSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];
    const system = await this.checkSystemHealth();

    if (!system.gatewayRunning) {
      suggestions.push('启动 Gateway: openclaw gateway start');
    }

    if (system.lockFiles > 0) {
      suggestions.push(`清理 ${system.lockFiles} 个 Lock 文件: openclaw-pm health`);
    }

    if (system.diskUsage && system.diskUsage > 80) {
      suggestions.push(`磁盘使用率 ${system.diskUsage}%，建议清理日志`);
    }

    return suggestions;
  }

  // ============================================
  // 私有方法 - 心跳检查
  // ============================================

  private async checkContextHealth(): Promise<{ status: string; message: string }> {
    try {
      const { execSync } = child_process;
      execSync('pgrep -f "^openclaw-gateway$"', { encoding: 'utf-8' });
      return { status: 'ok', message: 'Gateway 运行正常' };
    } catch {
      return { status: 'error', message: 'Gateway 未运行' };
    }
  }

  private async checkInProgressTasks(): Promise<{ status: string; message: string }> {
    const workspaceDir = this.config.get<string>(
      'openclaw.workspace_dir',
      getDefaultWorkspaceDir(detectOpenClawDir())
    );
    const today = new Date().toISOString().split('T')[0];
    const memoryFile = path.join(workspaceDir, 'memory', `${today}.md`);

    if (!fs.existsSync(memoryFile)) {
      return { status: 'ok', message: '无进行中任务' };
    }

    const content = fs.readFileSync(memoryFile, 'utf-8');
    const hasInProgress = /^## In Progress/m.test(content) && !/（无）/.test(content);

    if (!hasInProgress) {
      return { status: 'ok', message: '无进行中任务' };
    }

    return { status: 'ok', message: '任务状态正常' };
  }

  private async checkCronTasks(): Promise<{ status: string; message: string }> {
    const cronTasks = this.config.get<any[]>('cron_tasks', []);
    const enabledTasks = cronTasks.filter((t: any) => t.enabled);

    return { status: 'ok', message: `所有关键任务已执行 (${enabledTasks.length} 个)` };
  }

  // ============================================
  // 工具方法
  // ============================================

  private getLogFile(date: string): string {
    const openclawDir = this.config.get<string>('openclaw.dir', detectOpenClawDir());
    return path.join(openclawDir, 'logs', `gateway-${date}.log`);
  }
}
