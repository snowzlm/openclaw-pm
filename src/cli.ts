#!/usr/bin/env node
/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 命令行接口
 */

import { Command } from 'commander';
import { ConfigManager } from './config';
import { Logger, LogLevel } from './logger';
import { GatewayHealthChecker } from './health-checker';
import { BackupManager } from './backup';
import chalk from 'chalk';

const program = new Command();

program
  .name('openclaw-pm')
  .description('OpenClaw 项目管理工具 v4.0.0')
  .version('4.0.0');

// 全局选项
program
  .option('-c, --config <path>', '配置文件路径')
  .option('-v, --verbose', '详细输出')
  .option('--debug', '调试模式');

// 健康检查命令
program
  .command('health')
  .description('执行 Gateway 健康检查')
  .option('-j, --json', '输出 JSON 格式')
  .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const checker = new GatewayHealthChecker(config, logger);

    try {
      const result = await checker.check();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printHealthResult(result);
      }

      process.exit(result.status === 'healthy' ? 0 : 1);
    } catch (error) {
      logger.error('健康检查失败', error as Error);
      process.exit(1);
    }
  });

// 备份命令
program
  .command('backup')
  .description('创建备份')
  .option('-t, --type <type>', '备份类型 (auto|manual)', 'manual')
  .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const backupManager = new BackupManager(config, logger);

    try {
      const backup = await backupManager.createBackup(options.type);
      logger.success(`备份已创建: ${backup.path}`);
      process.exit(0);
    } catch (error) {
      logger.error('备份失败', error as Error);
      process.exit(1);
    }
  });

// 恢复命令
program
  .command('restore <backup>')
  .description('恢复备份')
  .action(async (backupPath) => {
    const { config, logger } = initializeApp(program.opts());
    const backupManager = new BackupManager(config, logger);

    try {
      await backupManager.restoreBackup(backupPath);
      logger.success('备份已恢复');
      process.exit(0);
    } catch (error) {
      logger.error('恢复失败', error as Error);
      process.exit(1);
    }
  });

// 列出备份
program
  .command('backups')
  .description('列出所有备份')
  .action(() => {
    const { config, logger } = initializeApp(program.opts());
    const backupManager = new BackupManager(config, logger);

    try {
      const backups = backupManager.listBackups();

      if (backups.length === 0) {
        console.log(chalk.yellow('没有找到备份'));
        process.exit(0);
      }

      console.log(chalk.bold('\n可用备份:\n'));
      for (const backup of backups) {
        const size = formatSize(backup.size);
        const date = backup.timestamp.toLocaleString();
        console.log(`  ${chalk.cyan(date)} - ${size} - ${backup.path}`);
      }
      console.log();

      process.exit(0);
    } catch (error) {
      logger.error('列出备份失败', error as Error);
      process.exit(1);
    }
  });

// 配置命令
program
  .command('config')
  .description('显示当前配置')
  .action(() => {
    const { config } = initializeApp(program.opts());

    try {
      const configData = config.getAll();
      console.log(JSON.stringify(configData, null, 2));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('读取配置失败:'), error);
      process.exit(1);
    }
  });

// 初始化应用
function initializeApp(options: any): { config: ConfigManager; logger: Logger } {
  const logLevel = options.debug
    ? LogLevel.DEBUG
    : options.verbose
    ? LogLevel.INFO
    : LogLevel.WARN;

  const logger = new Logger({
    level: logLevel,
    enableConsole: true,
    enableFile: false,
  });

  const config = new ConfigManager(options.config);

  return { config, logger };
}

// 打印健康检查结果
function printHealthResult(result: any): void {
  console.log();
  console.log(chalk.bold('=== OpenClaw Gateway 健康检查 ==='));
  console.log();

  // 状态
  const statusColor =
    result.status === 'healthy'
      ? chalk.green
      : result.status === 'warning'
      ? chalk.yellow
      : chalk.red;

  console.log(`状态: ${statusColor(result.status.toUpperCase())}`);
  console.log(`评分: ${result.score}/100`);
  console.log(`时间: ${new Date(result.timestamp).toLocaleString()}`);
  console.log();

  // 检查项
  console.log(chalk.bold('检查项:'));
  for (const [name, check] of Object.entries(result.checks)) {
    const statusIcon =
      (check as any).status === 'ok'
        ? chalk.green('✓')
        : (check as any).status === 'warning'
        ? chalk.yellow('⚠')
        : chalk.red('✗');

    console.log(`  ${statusIcon} ${name}: ${(check as any).message}`);
  }
  console.log();

  // 问题
  if (result.issues.length > 0) {
    console.log(chalk.bold('发现的问题:'));
    for (const issue of result.issues) {
      const severityColor =
        issue.severity === 'critical'
          ? chalk.red
          : issue.severity === 'error'
          ? chalk.red
          : issue.severity === 'warning'
          ? chalk.yellow
          : chalk.blue;

      console.log(`  ${severityColor('●')} [${issue.category}] ${issue.message}`);
    }
    console.log();
  }
}

// 格式化文件大小
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 解析命令行参数
program.parse();
