import * as fs from 'fs';
import chalk from 'chalk';
import { Logger } from './logger';

export interface ErrorContext {
  operation: string;
  file?: string;
  details?: Record<string, unknown>;
}

export class ErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 处理文件不存在错误
   */
  handleFileNotFound(filePath: string, suggestions: string[]): never {
    this.logger.error(`文件不存在: ${filePath}`);

    console.error(chalk.red('\n✗ 文件不存在'));
    console.error(chalk.gray(`  路径: ${filePath}`));

    if (suggestions.length > 0) {
      console.error(chalk.yellow('\n建议:'));
      suggestions.forEach((suggestion, i) => {
        console.error(chalk.gray(`  ${i + 1}. ${suggestion}`));
      });
    }

    process.exit(1);
  }

  /**
   * 处理配置错误
   */
  handleConfigError(message: string, configPath: string): never {
    this.logger.error(`配置错误: ${message}`);

    console.error(chalk.red('\n✗ 配置错误'));
    console.error(chalk.gray(`  ${message}`));
    console.error(chalk.gray(`  配置文件: ${configPath}`));

    console.error(chalk.yellow('\n建议:'));
    console.error(chalk.gray('  1. 运行 openclaw-pm config init 重新生成配置'));
    console.error(chalk.gray('  2. 检查配置文件格式是否正确'));
    console.error(chalk.gray('  3. 参考文档: docs/configuration.md'));

    process.exit(1);
  }

  /**
   * 处理权限错误
   */
  handlePermissionError(filePath: string): never {
    this.logger.error(`权限不足: ${filePath}`);

    console.error(chalk.red('\n✗ 权限不足'));
    console.error(chalk.gray(`  无法访问: ${filePath}`));

    console.error(chalk.yellow('\n建议:'));
    console.error(chalk.gray(`  1. 检查文件权限: ls -la ${filePath}`));
    console.error(chalk.gray(`  2. 使用 sudo 运行（如果需要）`));
    console.error(
      chalk.gray(`  3. 修改权限: chmod 644 ${filePath}`)
    );

    process.exit(1);
  }

  /**
   * 处理 OpenClaw 未运行错误
   */
  handleOpenClawNotRunning(): never {
    this.logger.error('OpenClaw Gateway 未运行');

    console.error(chalk.red('\n✗ OpenClaw Gateway 未运行'));

    console.error(chalk.yellow('\n建议:'));
    console.error(chalk.gray('  1. 启动 Gateway: openclaw gateway start'));
    console.error(chalk.gray('  2. 检查状态: openclaw gateway status'));
    console.error(chalk.gray('  3. 查看日志: openclaw gateway logs'));

    process.exit(1);
  }

  /**
   * 处理日志文件错误
   */
  handleLogFileError(logFile: string): never {
    const suggestions = [
      '检查 OpenClaw 是否正在运行',
      '确认日志目录存在且有写入权限',
      `检查配置中的日志路径: ${logFile}`,
      '运行 openclaw gateway logs 查看日志',
    ];

    this.handleFileNotFound(logFile, suggestions);
  }

  /**
   * 处理数据库错误
   */
  handleDatabaseError(error: Error, dbPath: string): never {
    this.logger.error(`数据库错误: ${error.message}`);

    console.error(chalk.red('\n✗ 数据库错误'));
    console.error(chalk.gray(`  ${error.message}`));
    console.error(chalk.gray(`  数据库: ${dbPath}`));

    console.error(chalk.yellow('\n建议:'));
    console.error(chalk.gray('  1. 检查数据库文件是否损坏'));
    console.error(chalk.gray('  2. 尝试删除并重建索引'));
    console.error(chalk.gray('  3. 检查磁盘空间是否充足'));

    process.exit(1);
  }

  /**
   * 处理通用错误
   */
  handleGenericError(error: Error, context: ErrorContext): never {
    this.logger.error(`${context.operation} 失败: ${error.message}`);

    console.error(chalk.red(`\n✗ ${context.operation} 失败`));
    console.error(chalk.gray(`  ${error.message}`));

    if (context.file) {
      console.error(chalk.gray(`  文件: ${context.file}`));
    }

    if (context.details) {
      console.error(chalk.gray('\n详细信息:'));
      Object.entries(context.details).forEach(([key, value]) => {
        console.error(chalk.gray(`  ${key}: ${value}`));
      });
    }

    if (error.stack) {
      console.error(chalk.gray('\n堆栈跟踪:'));
      console.error(chalk.gray(error.stack));
    }

    process.exit(1);
  }

  /**
   * 验证文件存在
   */
  validateFileExists(filePath: string, suggestions: string[]): void {
    if (!fs.existsSync(filePath)) {
      this.handleFileNotFound(filePath, suggestions);
    }
  }

  /**
   * 验证目录存在
   */
  validateDirectoryExists(dirPath: string, autoCreate = false): void {
    if (!fs.existsSync(dirPath)) {
      if (autoCreate) {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          this.logger.info(`创建目录: ${dirPath}`);
        } catch (error) {
          this.handleGenericError(error as Error, {
            operation: '创建目录',
            file: dirPath,
          });
        }
      } else {
        this.handleFileNotFound(dirPath, [
          `创建目录: mkdir -p ${dirPath}`,
          '检查配置中的路径设置',
        ]);
      }
    }
  }

  /**
   * 验证文件可读
   */
  validateFileReadable(filePath: string): void {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      this.handlePermissionError(filePath);
    }
  }

  /**
   * 验证文件可写
   */
  validateFileWritable(filePath: string): void {
    try {
      fs.accessSync(filePath, fs.constants.W_OK);
    } catch {
      this.handlePermissionError(filePath);
    }
  }

  /**
   * 安全执行操作
   */
  async safeExecute<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleGenericError(error as Error, context);
    }
  }
}
