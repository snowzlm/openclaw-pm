import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { Logger } from './logger';

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
  async initConfig(
    configPath: string,
    options: ConfigInitOptions = {}
  ): Promise<void> {
    // 检查配置文件是否已存在
    if (fs.existsSync(configPath) && !options.force) {
      console.log(chalk.yellow('⚠ 配置文件已存在'));
      console.log(chalk.gray(`  路径: ${configPath}`));
      console.log(
        chalk.gray('  使用 --force 参数强制覆盖')
      );
      return;
    }

    let config: Record<string, unknown>;

    if (options.interactive) {
      config = await this.interactiveConfig();
    } else {
      config = this.getDefaultConfig();
    }

    // 写入配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green('✓ 配置文件已创建'));
    console.log(chalk.gray(`  路径: ${configPath}`));
    this.logger.success(`配置文件已创建: ${configPath}`);
  }

  /**
   * 交互式配置
   */
  private async interactiveConfig(): Promise<Record<string, unknown>> {
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

    // OpenClaw 目录
    const openclawDir = await question(
      chalk.cyan('OpenClaw 数据目录 [/root/.openclaw]: ')
    );

    // Sessions 目录
    const sessionsDir = await question(
      chalk.cyan(
        'Sessions 目录 [/root/.openclaw/agents/main/sessions]: '
      )
    );

    // Gateway 端口
    const gatewayPort = await question(
      chalk.cyan('Gateway 端口 [3000]: ')
    );

    // 备份目录
    const backupDir = await question(
      chalk.cyan('备份目录 [/root/.openclaw/backups]: ')
    );

    // 最大备份数
    const maxBackups = await question(
      chalk.cyan('最大备份数 [10]: ')
    );

    rl.close();

    return {
      openclaw: {
        dir: openclawDir || '/root/.openclaw',
        sessions_dir:
          sessionsDir || '/root/.openclaw/agents/main/sessions',
        gateway_port: parseInt(gatewayPort) || 3000,
      },
      backup: {
        enabled: true,
        dir: backupDir || '/root/.openclaw/backups',
        max_backups: parseInt(maxBackups) || 10,
      },
      health: {
        check_interval: 300,
        max_retries: 3,
      },
      cron_tasks: [
        { name: 'backup', enabled: true },
        { name: 'cleanup', enabled: true },
        { name: 'health-check', enabled: true },
        { name: 'monitor', enabled: true },
      ],
    };
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): Record<string, unknown> {
    return {
      openclaw: {
        dir: '/root/.openclaw',
        sessions_dir: '/root/.openclaw/agents/main/sessions',
        gateway_port: 3000,
      },
      backup: {
        enabled: true,
        dir: '/root/.openclaw/backups',
        max_backups: 10,
      },
      health: {
        check_interval: 300,
        max_retries: 3,
      },
      cron_tasks: [
        { name: 'backup', enabled: true },
        { name: 'cleanup', enabled: true },
        { name: 'health-check', enabled: true },
        { name: 'monitor', enabled: true },
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

      if (
        !openclaw.sessions_dir ||
        typeof openclaw.sessions_dir !== 'string'
      ) {
        errors.push('openclaw.sessions_dir 必须是字符串');
      }

      if (
        !openclaw.gateway_port ||
        typeof openclaw.gateway_port !== 'number'
      ) {
        errors.push('openclaw.gateway_port 必须是数字');
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

      if (!backup.dir || typeof backup.dir !== 'string') {
        errors.push('backup.dir 必须是字符串');
      }

      if (
        !backup.max_backups ||
        typeof backup.max_backups !== 'number'
      ) {
        errors.push('backup.max_backups 必须是数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 修复配置
   */
  repairConfig(
    config: Record<string, unknown>
  ): Record<string, unknown> {
    const defaultConfig = this.getDefaultConfig();

    // 深度合并配置
    const mergeDeep = (
      target: Record<string, unknown>,
      source: Record<string, unknown>
    ): Record<string, unknown> => {
      const result = { ...target };

      for (const key in source) {
        if (
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
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

    return mergeDeep(config, defaultConfig);
  }

  /**
   * 自动检测配置
   */
  autoDetectConfig(): Record<string, unknown> {
    const homeDir = process.env.HOME || '/root';
    const openclawDir = path.join(homeDir, '.openclaw');

    // 检测 sessions 目录
    let sessionsDir = path.join(
      openclawDir,
      'agents',
      'main',
      'sessions'
    );
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

    return {
      openclaw: {
        dir: openclawDir,
        sessions_dir: sessionsDir,
        gateway_port: 3000,
      },
      backup: {
        enabled: true,
        dir: path.join(openclawDir, 'backups'),
        max_backups: 10,
      },
      health: {
        check_interval: 300,
        max_retries: 3,
      },
      cron_tasks: [
        { name: 'backup', enabled: true },
        { name: 'cleanup', enabled: true },
        { name: 'health-check', enabled: true },
        { name: 'monitor', enabled: true },
      ],
    };
  }
}
