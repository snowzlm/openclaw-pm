/**
 * OpenClaw PM v4.2.0 - TypeScript Core
 * 未回复消息检查器
 */

import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { ConfigManager } from './config';
import { Logger } from './logger';

export interface UnansweredSession {
  sessionKey: string;
  agentId: string;
  sessionName: string;
  timestamp: string;
  preview: string;
  lastModified: Date;
}

export interface UnansweredCheckResult {
  unanswered: UnansweredSession[];
  count: number;
  recovered?: number;
  failed?: number;
}

export interface CheckOptions {
  includeOld?: boolean;
  maxAgeHours?: number;
  agentFilter?: string;
  autoRecover?: boolean;
}

export class UnansweredChecker {
  private config: ConfigManager;
  private logger: Logger;

  constructor(config: ConfigManager, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * 检查未回复的消息
   */
  async check(options: CheckOptions = {}): Promise<UnansweredCheckResult> {
    const { includeOld = false, maxAgeHours = 24, agentFilter, autoRecover = false } = options;

    this.logger.info('开始检查未回复消息...');

    const openclawDir = this.config.get<string>('openclaw.dir');
    const agentsDir = path.join(openclawDir, 'agents');

    if (!fs.existsSync(agentsDir)) {
      throw new Error(`Agents 目录不存在: ${agentsDir}`);
    }

    const unanswered: UnansweredSession[] = [];

    // 遍历所有 agent
    const agents = fs.readdirSync(agentsDir).filter((name) => {
      const agentPath = path.join(agentsDir, name);
      return fs.statSync(agentPath).isDirectory();
    });

    for (const agentId of agents) {
      // 过滤 agent
      if (agentFilter && agentId !== agentFilter) {
        continue;
      }

      const sessionsDir = path.join(agentsDir, agentId, 'sessions');
      if (!fs.existsSync(sessionsDir)) {
        continue;
      }

      // 遍历所有 session 文件
      const sessionFiles = fs.readdirSync(sessionsDir).filter((name) => {
        return name.endsWith('.jsonl') && !name.endsWith('.deleted') && !name.endsWith('.lock');
      });

      for (const sessionFile of sessionFiles) {
        const sessionPath = path.join(sessionsDir, sessionFile);
        const session = await this.checkSession(sessionPath, agentId, {
          includeOld,
          maxAgeHours,
        });

        if (session) {
          unanswered.push(session);
        }
      }
    }

    this.logger.info(`发现 ${unanswered.length} 个未回复的 session`);

    // 自动恢复
    let recovered = 0;
    let failed = 0;

    if (autoRecover && unanswered.length > 0) {
      this.logger.info('开始自动恢复...');
      const result = await this.recoverSessions(unanswered);
      recovered = result.recovered;
      failed = result.failed;
    }

    return {
      unanswered,
      count: unanswered.length,
      recovered,
      failed,
    };
  }

  /**
   * 检查单个 session
   */
  private async checkSession(
    sessionPath: string,
    agentId: string,
    options: { includeOld: boolean; maxAgeHours: number }
  ): Promise<UnansweredSession | null> {
    try {
      // 检查文件修改时间
      if (!options.includeOld) {
        const stats = fs.statSync(sessionPath);
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

        if (ageHours > options.maxAgeHours) {
          return null;
        }
      }

      // 读取最后一行
      const content = fs.readFileSync(sessionPath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((l) => l);

      if (lines.length === 0) {
        return null;
      }

      const lastLine = lines[lines.length - 1];
      let lastMessage: any;

      try {
        lastMessage = JSON.parse(lastLine);
      } catch {
        return null;
      }

      // 检查最后一条消息的 role
      const role = lastMessage.message?.role || lastMessage.role;

      if (role !== 'user') {
        return null;
      }

      // 提取信息
      const sessionName = path.basename(sessionPath, '.jsonl');
      const sessionKey = `agent:${agentId}:${sessionName}`;

      let preview = lastMessage.message?.content || lastMessage.content || '';
      if (Array.isArray(preview)) {
        preview = preview[0]?.text || '';
      }
      preview = preview.substring(0, 100);

      const timestamp =
        lastMessage.timestamp || new Date(fs.statSync(sessionPath).mtime).toISOString();

      return {
        sessionKey,
        agentId,
        sessionName,
        timestamp,
        preview,
        lastModified: new Date(fs.statSync(sessionPath).mtime),
      };
    } catch {
      this.logger.debug(`检查 session 失败: ${sessionPath}`);
      return null;
    }
  }

  /**
   * 恢复未回复的 sessions
   */
  private async recoverSessions(
    sessions: UnansweredSession[]
  ): Promise<{ recovered: number; failed: number }> {
    let recovered = 0;
    let failed = 0;

    for (const session of sessions) {
      try {
        this.logger.info(`恢复 session: ${session.sessionKey}`);

        // 尝试使用 OpenClaw CLI 发送消息
        const recoveryMsg = '[自动恢复] 检测到有未回复的消息，正在处理...';

        try {
          // 尝试 sessions send
          child_process.execSync(
            `openclaw sessions send --session "${session.sessionKey}" --message "${recoveryMsg}"`,
            { encoding: 'utf-8', timeout: 5000 }
          );
          recovered++;
          this.logger.info(`✓ 已发送恢复消息: ${session.sessionKey}`);
        } catch {
          // 回退到 wake 通知
          this.sendWakeNotification(
            `[未回复消息恢复] session ${session.sessionKey} 有未回复的消息`,
            'now'
          );
          recovered++;
          this.logger.warn(`⚠ 已发送 wake 通知: ${session.sessionKey}`);
        }
      } catch {
        failed++;
        this.logger.error(`✗ 恢复失败: ${session.sessionKey}`);
      }
    }

    return { recovered, failed };
  }

  /**
   * 发送 wake 通知
   */
  private sendWakeNotification(text: string, mode: string = 'now'): void {
    try {
      child_process.execSync(`openclaw cron wake --text "${text}" --mode ${mode}`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
    } catch {
      this.logger.error('发送 wake 通知失败');
    }
  }
}
