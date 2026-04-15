/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 配置管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean).map((p) => path.resolve(p))));
}

function scoreOpenClawDir(dir: string): number {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let score = 1;
  const markers = ['openclaw.json', 'pm-config.json', 'agents', 'logs', 'workspace'];

  for (const marker of markers) {
    if (fs.existsSync(path.join(dir, marker))) {
      score += 2;
    }
  }

  return score;
}

export function detectOpenClawDir(): string {
  if (process.env.OPENCLAW_DIR) {
    return path.resolve(process.env.OPENCLAW_DIR);
  }

  const homeDir = os.homedir();
  const candidates = uniquePaths([
    path.join(homeDir, '.openclaw'),
    process.env.HOME ? path.join(process.env.HOME, '.openclaw') : '',
    path.join(process.cwd(), '.openclaw'),
    '/root/.openclaw',
  ]);

  let bestCandidate = candidates[0] || path.join(homeDir, '.openclaw');
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = scoreOpenClawDir(candidate);
    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
}

export function getDefaultConfigPath(): string {
  return path.join(detectOpenClawDir(), 'pm-config.json');
}

export function getDefaultSessionsDir(openclawDir: string = detectOpenClawDir()): string {
  return path.join(openclawDir, 'agents', 'main', 'sessions');
}

export function getDefaultWorkspaceDir(openclawDir: string = detectOpenClawDir()): string {
  return path.join(openclawDir, 'workspace');
}

export function getDefaultBackupDir(openclawDir: string = detectOpenClawDir()): string {
  return path.join(openclawDir, 'backups');
}

export function getDefaultCacheDir(openclawDir: string = detectOpenClawDir()): string {
  return path.join(openclawDir, 'pm-cache');
}

export interface OpenClawConfig {
  openclaw: {
    dir: string;
    sessions_dir?: string;
    queue_dir?: string;
    logs_dir?: string;
    workspace_dir?: string;
    gateway_port: number;
    gateway_timeout: number;
    gateway_token?: string;
  };
  health_check: {
    interval_minutes: number;
    max_lock_age_hours: number;
    max_queue_age_hours: number;
    provider_error_threshold: number;
  };
  backup: {
    enabled: boolean;
    max_backups: number;
    backup_dir?: string;
    dir?: string;
  };
  notification: {
    enabled: boolean;
    channels: string[];
    telegram?: {
      bot_token: string;
      chat_id: string;
    };
  };
  cron_tasks: Array<{
    name: string;
    schedule: string;
    enabled: boolean;
  }>;
}

export class ConfigManager {
  private configPath: string;
  private config: OpenClawConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || getDefaultConfigPath();
  }

  /**
   * 加载配置文件
   */
  load(): OpenClawConfig {
    if (this.config) {
      return this.config;
    }

    if (!fs.existsSync(this.configPath)) {
      throw new Error(`配置文件不存在: ${this.configPath}`);
    }

    const content = fs.readFileSync(this.configPath, 'utf-8');
    this.config = JSON.parse(content);
    return this.config!;
  }

  /**
   * 保存配置文件
   */
  save(config: OpenClawConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.config = config;
  }

  /**
   * 获取配置值
   */
  get<T>(key: string, defaultValue?: T): T {
    const config = this.load();
    const keys = key.split('.');
    let value: any = config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue as T;
      }
    }

    return value as T;
  }

  /**
   * 设置配置值
   */
  set(key: string, value: any): void {
    const config = this.load();
    const keys = key.split('.');
    let target: any = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target)) {
        target[k] = {};
      }
      target = target[k];
    }

    target[keys[keys.length - 1]] = value;
    this.save(config);
  }

  /**
   * 获取完整配置
   */
  getAll(): OpenClawConfig {
    return this.load();
  }

  /**
   * 创建默认配置
   */
  static createDefault(configPath: string): OpenClawConfig {
    const openclawDir = detectOpenClawDir();

    const defaultConfig: OpenClawConfig = {
      openclaw: {
        dir: openclawDir,
        sessions_dir: getDefaultSessionsDir(openclawDir),
        queue_dir: path.join(openclawDir, 'queue'),
        logs_dir: path.join(openclawDir, 'logs'),
        workspace_dir: getDefaultWorkspaceDir(openclawDir),
        gateway_port: 3000,
        gateway_timeout: 30,
      },
      health_check: {
        interval_minutes: 5,
        max_lock_age_hours: 1,
        max_queue_age_hours: 2,
        provider_error_threshold: 10,
      },
      backup: {
        enabled: true,
        max_backups: 10,
        backup_dir: getDefaultBackupDir(openclawDir),
        dir: getDefaultBackupDir(openclawDir),
      },
      notification: {
        enabled: false,
        channels: [],
      },
      cron_tasks: [
        {
          name: 'gateway-health-check',
          schedule: '*/5 * * * *',
          enabled: true,
        },
        {
          name: 'check-unanswered',
          schedule: '*/15 * * * *',
          enabled: true,
        },
        {
          name: 'morning-briefing',
          schedule: '0 9 * * *',
          enabled: true,
        },
        {
          name: 'daily-stats',
          schedule: '0 23 * * *',
          enabled: true,
        },
      ],
    };

    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }
}
