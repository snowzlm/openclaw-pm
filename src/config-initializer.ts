import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { Logger } from './logger';
import {
  detectOpenClawDir,
  getDefaultSessionsDir,
  getDefaultBackupDir,
  getDefaultWorkspaceDir,
  OpenClawConfig,
} from './config';

export interface ConfigInitOptions {
  interactive?: boolean;
  force?: boolean;
}

export class ConfigInitializer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 初始化配置文件
   */
  async initConfig(configPath: string, options: ConfigInitOptions = {}): Promise<void> {
    // 检查配置文件是否已存在
    if (fs.existsSync(configPath) && !options.force) {
      console.log(chalk.yellow('⚠ 配置文件已存在'));
      console.log(chalk.gray(`  路径: ${configPath}`));
      console.log(chalk.gray('  使用 --force 参数强制覆盖'));
      return;
    }

    let config: OpenClawConfig;

    if (options.interactive) {
      config = await this.interactiveConfig();
    } else {
      config = this.getDefaultConfig();
    }

    // 写入配置文件
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green('✓ 配置文件已创建'));
    console.log(chalk.gray(`  路径: ${configPath}`));
    this.logger.success(`配置文件已创建: ${configPath}`);
  }

  /**
   * 交互式配置
   */
  private async interactiveConfig(): Promise<OpenClawConfig> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    console.log(chalk.bold.cyan('\n📝 OpenClaw PM 配置向导\n'));

    const detectedOpenClawDir = detectOpenClawDir();
    const detectedSessionsDir = getDefaultSessionsDir(detectedOpenClawDir);
    const detectedBackupDir = getDefaultBackupDir(detectedOpenClawDir);

    // OpenClaw 目录
    const openclawDir = await question(chalk.cyan(`OpenClaw 数据目录 [${detectedOpenClawDir}]: `));

    // Sessions 目录
    const sessionsDir = await question(chalk.cyan(`Sessions 目录 [${detectedSessionsDir}]: `));

    // Gateway 端口
    const gatewayPort = await question(chalk.cyan('Gateway 端口 [3000]: '));

    // 备份目录
    const backupDir = await question(chalk.cyan(`备份目录 [${detectedBackupDir}]: `));

    // 最大备份数
    const maxBackups = await question(chalk.cyan('最大备份数 [10]: '));

    rl.close();

    return this.buildConfig(
      openclawDir || detectedOpenClawDir,
      sessionsDir || detectedSessionsDir,
      backupDir || detectedBackupDir,
      parseInt(gatewayPort) || 3000,
      parseInt(maxBackups) || 10
    );
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): OpenClawConfig {
    const openclawDir = detectOpenClawDir();
    return this.buildConfig(
      openclawDir,
      getDefaultSessionsDir(openclawDir),
      getDefaultBackupDir(openclawDir),
      3000,
      10
    );
  }

  private buildConfig(
    openclawDir: string,
    sessionsDir: string,
    backupDir: string,
    gatewayPort: number,
    maxBackups: number
  ): OpenClawConfig {
    return {
      openclaw: {
        dir: openclawDir,
        sessions_dir: sessionsDir,
        queue_dir: path.join(openclawDir, 'queue'),
        logs_dir: path.join(openclawDir, 'logs'),
        workspace_dir: getDefaultWorkspaceDir(openclawDir),
        gateway_port: gatewayPort,
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
        max_backups: maxBackups,
        backup_dir: backupDir,
        dir: backupDir,
      },
      notification: {
        enabled: false,
        channels: [],
      },
      cron_tasks: [
        { name: 'gateway-health-check', schedule: '*/5 * * * *', enabled: true },
        { name: 'check-unanswered', schedule: '*/15 * * * *', enabled: true },
        { name: 'morning-briefing', schedule: '0 9 * * *', enabled: true },
        { name: 'daily-stats', schedule: '0 23 * * *', enabled: true },
      ],
    };
  }

  /**
   * 验证配置
   */
  validateConfig(config: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 验证 openclaw 配置
    if (!config.openclaw || typeof config.openclaw !== 'object') {
      errors.push('缺少 openclaw 配置');
    } else {
      const openclaw = config.openclaw as Record<string, unknown>;

      if (!openclaw.dir || typeof openclaw.dir !== 'string') {
        errors.push('openclaw.dir 必须是字符串');
      }

      if (!openclaw.sessions_dir || typeof openclaw.sessions_dir !== 'string') {
        errors.push('openclaw.sessions_dir 必须是字符串');
      }

      if (!openclaw.queue_dir || typeof openclaw.queue_dir !== 'string') {
        errors.push('openclaw.queue_dir 必须是字符串');
      }

      if (!openclaw.logs_dir || typeof openclaw.logs_dir !== 'string') {
        errors.push('openclaw.logs_dir 必须是字符串');
      }

      if (!openclaw.workspace_dir || typeof openclaw.workspace_dir !== 'string') {
        errors.push('openclaw.workspace_dir 必须是字符串');
      }

      if (!openclaw.gateway_port || typeof openclaw.gateway_port !== 'number') {
        errors.push('openclaw.gateway_port 必须是数字');
      }

      if (typeof openclaw.gateway_timeout !== 'number') {
        errors.push('openclaw.gateway_timeout 必须是数字');
      }
    }

    if (!config.health_check || typeof config.health_check !== 'object') {
      errors.push('缺少 health_check 配置');
    } else {
      const healthCheck = config.health_check as Record<string, unknown>;

      if (typeof healthCheck.interval_minutes !== 'number') {
        errors.push('health_check.interval_minutes 必须是数字');
      }

      if (typeof healthCheck.max_lock_age_hours !== 'number') {
        errors.push('health_check.max_lock_age_hours 必须是数字');
      }

      if (typeof healthCheck.max_queue_age_hours !== 'number') {
        errors.push('health_check.max_queue_age_hours 必须是数字');
      }

      if (typeof healthCheck.provider_error_threshold !== 'number') {
        errors.push('health_check.provider_error_threshold 必须是数字');
      }
    }

    // 验证 backup 配置
    if (!config.backup || typeof config.backup !== 'object') {
      errors.push('缺少 backup 配置');
    } else {
      const backup = config.backup as Record<string, unknown>;

      if (typeof backup.enabled !== 'boolean') {
        errors.push('backup.enabled 必须是布尔值');
      }

      const backupDir = backup.backup_dir ?? backup.dir;
      if (!backupDir || typeof backupDir !== 'string') {
        errors.push('backup.backup_dir 必须是字符串');
      }

      if (!backup.max_backups || typeof backup.max_backups !== 'number') {
        errors.push('backup.max_backups 必须是数字');
      }
    }

    if (!config.notification || typeof config.notification !== 'object') {
      errors.push('缺少 notification 配置');
    }

    if (!Array.isArray(config.cron_tasks)) {
      errors.push('cron_tasks 必须是数组');
    } else {
      config.cron_tasks.forEach((task, index) => {
        const cronTask = task as Record<string, unknown>;
        if (typeof cronTask.name !== 'string') {
          errors.push(`cron_tasks[${index}].name 必须是字符串`);
        }
        if (typeof cronTask.schedule !== 'string') {
          errors.push(`cron_tasks[${index}].schedule 必须是字符串`);
        }
        if (typeof cronTask.enabled !== 'boolean') {
          errors.push(`cron_tasks[${index}].enabled 必须是布尔值`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 修复配置
   */
  repairConfig(config: Record<string, unknown>): OpenClawConfig {
    const defaultConfig = this.getDefaultConfig();

    // 深度合并配置
    const mergeDeep = (target: any, source: any): any => {
      const result = { ...target };

      for (const key in source) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = mergeDeep(
            (result[key] as Record<string, unknown>) || {},
            source[key] as Record<string, unknown>
          );
        } else if (result[key] === undefined) {
          result[key] = source[key];
        }
      }

      return result;
    };

    return mergeDeep(config, defaultConfig) as OpenClawConfig;
  }

  /**
   * 自动检测配置
   */
  autoDetectConfig(): OpenClawConfig {
    const openclawDir = detectOpenClawDir();

    // 检测 sessions 目录
    let sessionsDir = getDefaultSessionsDir(openclawDir);
    if (!fs.existsSync(sessionsDir)) {
      // 尝试其他可能的路径
      const alternatives = [
        path.join(openclawDir, 'sessions'),
        path.join(openclawDir, 'data', 'sessions'),
      ];

      for (const alt of alternatives) {
        if (fs.existsSync(alt)) {
          sessionsDir = alt;
          break;
        }
      }
    }

    return this.buildConfig(openclawDir, sessionsDir, getDefaultBackupDir(openclawDir), 3000, 10);
  }
}
