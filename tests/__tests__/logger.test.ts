import { Logger, LogLevel } from '../../src/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Logger', () => {
  let tempLogFile: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-logs-${Date.now()}`);
    tempLogFile = path.join(tempDir, 'test.log');
  });

  afterEach(() => {
    // 清理临时文件
    if (fs.existsSync(tempLogFile)) {
      fs.unlinkSync(tempLogFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  describe('构造函数', () => {
    test('应该创建日志目录（如果不存在）', () => {
      expect(fs.existsSync(tempDir)).toBe(false);
      new Logger({ logFile: tempLogFile, level: LogLevel.INFO, enableFile: true });
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    test('应该使用默认配置', () => {
      const logger = new Logger({});
      expect(logger).toBeDefined();
    });

    test('应该接受自定义日志级别', () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      expect(logger).toBeDefined();
    });
  });

  describe('日志级别过滤', () => {
    test('DEBUG 级别应该记录所有消息', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.DEBUG,
        enableConsole: false,
        enableFile: true,
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).toContain('DEBUG');
      expect(content).toContain('INFO');
      expect(content).toContain('WARN');
      expect(content).toContain('ERROR');
    });

    test('INFO 级别应该过滤 DEBUG 消息', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).not.toContain('DEBUG');
      expect(content).toContain('INFO');
      expect(content).toContain('WARN');
    });

    test('WARN 级别应该只记录 WARN 和 ERROR', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.WARN,
        enableConsole: false,
        enableFile: true,
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).not.toContain('DEBUG');
      expect(content).not.toContain('INFO');
      expect(content).toContain('WARN');
      expect(content).toContain('ERROR');
    });

    test('ERROR 级别应该只记录 ERROR', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.ERROR,
        enableConsole: false,
        enableFile: true,
      });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).not.toContain('DEBUG');
      expect(content).not.toContain('INFO');
      expect(content).not.toContain('WARN');
      expect(content).toContain('ERROR');
    });
  });

  describe('日志格式', () => {
    test('应该包含时间戳', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      logger.info('test message');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      // 检查 ISO 8601 时间戳格式
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    test('应该包含日志级别', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.DEBUG,
        enableConsole: false,
        enableFile: true,
      });

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).toContain('[DEBUG]');
      expect(content).toContain('[INFO]');
      expect(content).toContain('[WARN]');
      expect(content).toContain('[ERROR]');
    });

    test('应该包含消息内容', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      const message = 'This is a test message';
      logger.info(message);

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).toContain(message);
    });
  });

  describe('文件写入', () => {
    test('应该追加到现有日志文件', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      logger.info('first message');
      logger.info('second message');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('first message');
      expect(lines[1]).toContain('second message');
    });

    test('禁用文件写入时不应创建文件', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: false,
      });

      logger.info('test message');

      expect(fs.existsSync(tempLogFile)).toBe(false);
    });
  });

  describe('控制台输出', () => {
    test('禁用控制台输出时不应调用 console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      logger.info('test message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('启用控制台输出时应调用 console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: true,
      });

      logger.info('test message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('边界情况', () => {
    test('应该处理空消息', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      logger.info('');

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).toContain('[INFO]');
    });

    test('应该处理多行消息', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      logger.info(multilineMessage);

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).toContain(multilineMessage);
    });

    test('应该处理特殊字符', () => {
      const logger = new Logger({
        logFile: tempLogFile,
        level: LogLevel.INFO,
        enableConsole: false,
        enableFile: true,
      });

      const specialMessage = '特殊字符: 中文 émojis 🎉 symbols @#$%';
      logger.info(specialMessage);

      const content = fs.readFileSync(tempLogFile, 'utf-8');
      expect(content).toContain(specialMessage);
    });
  });
});
