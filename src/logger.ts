/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 日志管理
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  logFile?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
}

export class Logger {
  private level: LogLevel;
  private logFile?: string;
  private enableConsole: boolean;
  private enableFile: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.logFile = options.logFile;
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? false;

    if (this.enableFile && this.logFile) {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private writeToFile(message: string): void {
    if (this.enableFile && this.logFile) {
      fs.appendFileSync(this.logFile, message + '\n', 'utf-8');
    }
  }

  debug(message: string): void {
    if (this.level <= LogLevel.DEBUG) {
      const formatted = this.formatMessage('DEBUG', message);
      if (this.enableConsole) {
        console.log(chalk.gray(formatted));
      }
      this.writeToFile(formatted);
    }
  }

  info(message: string): void {
    if (this.level <= LogLevel.INFO) {
      const formatted = this.formatMessage('INFO', message);
      if (this.enableConsole) {
        console.log(chalk.blue(formatted));
      }
      this.writeToFile(formatted);
    }
  }

  warn(message: string): void {
    if (this.level <= LogLevel.WARN) {
      const formatted = this.formatMessage('WARN', message);
      if (this.enableConsole) {
        console.log(chalk.yellow(formatted));
      }
      this.writeToFile(formatted);
    }
  }

  error(message: string, error?: Error): void {
    if (this.level <= LogLevel.ERROR) {
      const formatted = this.formatMessage('ERROR', message);
      if (this.enableConsole) {
        console.log(chalk.red(formatted));
        if (error) {
          console.log(chalk.red(error.stack || error.message));
        }
      }
      this.writeToFile(formatted);
      if (error) {
        this.writeToFile(error.stack || error.message);
      }
    }
  }

  success(message: string): void {
    const formatted = this.formatMessage('SUCCESS', message);
    if (this.enableConsole) {
      console.log(chalk.green(formatted));
    }
    this.writeToFile(formatted);
  }
}

// 全局 Logger 实例
export const logger = new Logger();
