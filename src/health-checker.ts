/**
 * OpenClaw PM - TypeScript Core
 * Gateway 健康检查器
 */

import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { ConfigManager } from './config';
import { Logger } from './logger';
import { HealthCheckResult, HealthIssue, CheckResult, SessionInfo, GatewayStatus } from './types';

export class GatewayHealthChecker {
  private config: ConfigManager;
  private logger: Logger;

  constructor(config: ConfigManager, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 执行完整健康检查（并发优化）
   */
  async check(): Promise<HealthCheckResult> {
    this.logger.info('开始 Gateway 健康检查...');

    const startTime = Date.now();

    // 并发执行所有检查项
    const [gateway, sessions, queue, providers, cron] = await Promise.all([
      this.checkGateway(),
      this.checkSessions(),
      this.checkQueue(),
      this.checkProviders(),
      this.checkCron(),
    ]);

    const checks = { gateway, sessions, queue, providers, cron };
    const checkTime = Date.now() - startTime;
    this.logger.debug(`检查耗时: ${checkTime}ms`);

    const issues: HealthIssue[] = [];

    // 收集所有问题
    for (const [category, result] of Object.entries(checks)) {
      if (result.status === 'error') {
        issues.push({
          severity: 'error',
          category,
          message: result.message,
          details: result.details,
        });
      } else if (result.status === 'warning') {
        issues.push({
          severity: 'warning',
          category,
          message: result.message,
          details: result.details,
        });
      }
    }

    // 计算健康评分
    const score = this.calculateHealthScore(checks, issues);

    // 确定整体状态
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 50) {
      status = 'critical';
    } else if (score < 80) {
      status = 'warning';
    }

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      status,
      score,
      issues,
      checks,
    };

    this.logger.info(`健康检查完成: ${status} (评分: ${score}/100)`);
    return result;
  }

  /**
   * 检查 Gateway 状态
   */
  private async checkGateway(): Promise<CheckResult> {
    try {
      const status = await this.getGatewayStatus();

      if (!status.running) {
        return {
          status: 'error',
          message: 'Gateway 未运行',
          details: status,
        };
      }

      // 检查是否有多个 Gateway 进程
      const processes = this.getGatewayProcesses();
      if (processes.length > 1) {
        return {
          status: 'warning',
          message: `检测到 ${processes.length} 个 Gateway 进程`,
          details: { pids: processes },
        };
      }

      return {
        status: 'ok',
        message: 'Gateway 运行正常',
        details: status,
      };
    } catch (err) {
      return {
        status: 'error',
        message: `Gateway 检查失败: ${(err as Error).message}`,
      };
    }
  }

  /**
   * 检查 Sessions
   */
  private async checkSessions(): Promise<CheckResult> {
    try {
      const sessionsDir =
        this.config.get<string>('openclaw.sessions_dir') ||
        path.join(this.config.get<string>('openclaw.dir'), 'sessions');

      if (!fs.existsSync(sessionsDir)) {
        return {
          status: 'warning',
          message: 'Sessions 目录不存在',
        };
      }

      const sessions = this.getSessions(sessionsDir);
      const issues: string[] = [];

      // 检查 thinking-only sessions
      const thinkingOnly = sessions.filter((s) => s.status === 'thinking_only');
      if (thinkingOnly.length > 0) {
        issues.push(`${thinkingOnly.length} 个 thinking-only session`);
      }

      // 检查 locked sessions
      const locked = sessions.filter((s) => s.status === 'locked');
      if (locked.length > 0) {
        issues.push(`${locked.length} 个 locked session`);
      }

      // 检查未回复消息
      const unanswered = sessions.filter((s) => s.hasUnanswered);
      if (unanswered.length > 0) {
        issues.push(`${unanswered.length} 个未回复消息`);
      }

      if (issues.length > 0) {
        return {
          status: 'warning',
          message: `Sessions 存在问题: ${issues.join(', ')}`,
          details: { total: sessions.length, issues },
        };
      }

      return {
        status: 'ok',
        message: `Sessions 正常 (${sessions.length} 个)`,
        details: { total: sessions.length },
      };
    } catch (err) {
      return {
        status: 'error',
        message: `Sessions 检查失败: ${(err as Error).message}`,
      };
    }
  }

  /**
   * 检查队列
   */
  private async checkQueue(): Promise<CheckResult> {
    try {
      const openclawDir = this.config.get<string>('openclaw.dir');
      const queueDir = path.join(openclawDir, 'queue');

      if (!fs.existsSync(queueDir)) {
        return {
          status: 'ok',
          message: '队列目录不存在（正常）',
        };
      }

      const queueFiles = fs.readdirSync(queueDir).filter((f) => f.endsWith('.json'));

      if (queueFiles.length === 0) {
        return {
          status: 'ok',
          message: '队列为空',
        };
      }

      const maxQueueAge = this.config.get<number>('health_check.max_queue_age_hours', 2);
      const staleThreshold = Date.now() - maxQueueAge * 60 * 60 * 1000;
      let staleCount = 0;

      for (const file of queueFiles) {
        const filePath = path.join(queueDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < staleThreshold) {
          staleCount++;
        }
      }

      if (staleCount > 0) {
        return {
          status: 'warning',
          message: `队列中有 ${staleCount} 个任务超过 ${maxQueueAge} 小时未处理`,
          details: { total: queueFiles.length, stale: staleCount },
        };
      }

      return {
        status: 'ok',
        message: `队列正常 (${queueFiles.length} 个任务)`,
        details: { total: queueFiles.length },
      };
    } catch (err) {
      return {
        status: 'error',
        message: `队列检查失败: ${(err as Error).message}`,
      };
    }
  }

  /**
   * 检查 Providers
   */
  private async checkProviders(): Promise<CheckResult> {
    try {
      const openclawDir = this.config.get<string>('openclaw.dir');
      const logsDir = path.join(openclawDir, 'logs');
      const gatewayLog = path.join(logsDir, 'gateway.log');

      if (!fs.existsSync(gatewayLog)) {
        return {
          status: 'ok',
          message: 'Gateway 日志不存在',
        };
      }

      // 读取最近的日志（最后 1000 行）
      const logContent = child_process
        .execSync(`tail -n 1000 "${gatewayLog}"`, { encoding: 'utf-8' })
        .trim();

      // 统计 Provider 错误
      const errorPatterns = [
        /provider.*error/i,
        /model.*failed/i,
        /rate.*limit/i,
        /timeout/i,
        /connection.*refused/i,
      ];

      const errors: { [key: string]: number } = {};
      const lines = logContent.split('\n');

      for (const line of lines) {
        for (const pattern of errorPatterns) {
          if (pattern.test(line)) {
            // 尝试提取 provider 名称
            const providerMatch = line.match(/provider[:\s]+([\w-]+)/i);
            const provider = providerMatch ? providerMatch[1] : 'unknown';
            errors[provider] = (errors[provider] || 0) + 1;
          }
        }
      }

      const totalErrors = Object.values(errors).reduce((a, b) => a + b, 0);
      const threshold = this.config.get<number>('health_check.provider_error_threshold', 10);

      if (totalErrors > threshold) {
        return {
          status: 'warning',
          message: `检测到 ${totalErrors} 个 Provider 错误（阈值: ${threshold}）`,
          details: { errors, total: totalErrors },
        };
      }

      if (totalErrors > 0) {
        return {
          status: 'ok',
          message: `检测到 ${totalErrors} 个 Provider 错误（在阈值内）`,
          details: { errors, total: totalErrors },
        };
      }

      return {
        status: 'ok',
        message: 'Providers 运行正常',
      };
    } catch (err) {
      return {
        status: 'error',
        message: `Providers 检查失败: ${(err as Error).message}`,
      };
    }
  }

  /**
   * 检查 Cron 任务
   */
  private async checkCron(): Promise<CheckResult> {
    try {
      // 从配置文件读取 Cron 任务（避免调用 CLI 超时）
      const cronTasks = this.config.get<any[]>('cron_tasks', []);

      if (cronTasks.length === 0) {
        return {
          status: 'ok',
          message: '没有配置 Cron 任务',
        };
      }

      const disabledTasks = cronTasks.filter((task) => !task.enabled);
      const enabledTasks = cronTasks.filter((task) => task.enabled);

      if (disabledTasks.length > 0) {
        return {
          status: 'warning',
          message: `有 ${disabledTasks.length}/${cronTasks.length} 个 Cron 任务被禁用`,
          details: {
            enabled: enabledTasks.map((t) => t.name),
            disabled: disabledTasks.map((t) => t.name),
          },
        };
      }

      return {
        status: 'ok',
        message: `${cronTasks.length} 个 Cron 任务已启用`,
        details: { tasks: cronTasks.map((t) => t.name) },
      };
    } catch (err) {
      return {
        status: 'error',
        message: `Cron 检查失败: ${(err as Error).message}`,
      };
    }
  }

  /**
   * 获取 Gateway 状态
   */
  private async getGatewayStatus(): Promise<GatewayStatus> {
    const processes = this.getGatewayProcesses();
    const port = this.config.get<number>('openclaw.gateway_port', 3000);

    return {
      running: processes.length > 0,
      pid: processes[0],
      port,
    };
  }

  /**
   * 获取 Gateway 进程列表
   */
  private getGatewayProcesses(): number[] {
    try {
      const result = child_process.execSync('pgrep -f "^openclaw-gateway"', {
        encoding: 'utf-8',
      });
      return result
        .trim()
        .split('\n')
        .filter((line) => line)
        .map((pid) => parseInt(pid, 10));
    } catch (err) {
      return [];
    }
  }

  /**
   * 获取 Sessions 列表
   */
  private getSessions(sessionsDir: string): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    if (!fs.existsSync(sessionsDir)) {
      return sessions;
    }

    const files = fs.readdirSync(sessionsDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(sessionsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content
          .trim()
          .split('\n')
          .filter((l) => l);

        if (lines.length === 0) continue;

        const lastLine = lines[lines.length - 1];
        const lastMsg = JSON.parse(lastLine);

        const session: SessionInfo = {
          id: file.replace('.jsonl', ''),
          agent: lastMsg.agent || 'unknown',
          status: 'active',
          lastActivity: new Date(lastMsg.timestamp || Date.now()),
          messageCount: lines.length,
          hasUnanswered: lastMsg.role === 'user',
        };

        // 检查 thinking-only
        if (lastMsg.role === 'assistant' && lastMsg.thinking && !lastMsg.text) {
          session.status = 'thinking_only';
        }

        sessions.push(session);
      } catch (err) {
        this.logger.warn(`解析 session 文件失败: ${file}`);
      }
    }

    return sessions;
  }

  /**
   * 计算健康评分
   */
  private calculateHealthScore(checks: Record<string, CheckResult>, issues: HealthIssue[]): number {
    let score = 100;

    // Gateway 问题扣分
    if (checks.gateway.status === 'error') {
      score -= 30;
    } else if (checks.gateway.status === 'warning') {
      score -= 10;
    }

    // Sessions 问题扣分
    if (checks.sessions.status === 'error') {
      score -= 20;
    } else if (checks.sessions.status === 'warning') {
      score -= 10;
    }

    // 其他问题扣分
    for (const issue of issues) {
      if (issue.severity === 'critical') {
        score -= 20;
      } else if (issue.severity === 'error') {
        score -= 10;
      } else if (issue.severity === 'warning') {
        score -= 5;
      }
    }

    return Math.max(0, score);
  }
}
