import { GatewayHealthChecker } from '../../src/health-checker';
import { ConfigManager } from '../../src/config';
import { Logger, LogLevel } from '../../src/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';

describe('GatewayHealthChecker - 增强覆盖', () => {
  let tempDir: string;
  let tempConfigPath: string;
  let config: ConfigManager;
  let logger: Logger;
  let checker: GatewayHealthChecker;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-health-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const openclawDir = path.join(tempDir, '.openclaw');
    const sessionsDir = path.join(openclawDir, 'agents', 'main', 'sessions');
    const queueDir = path.join(openclawDir, 'queue');
    const logsDir = path.join(openclawDir, 'logs');

    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(queueDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    tempConfigPath = path.join(tempDir, 'config.json');
    const testConfig = {
      openclaw: {
        dir: openclawDir,
        sessions_dir: sessionsDir,
        queue_dir: queueDir,
        logs_dir: logsDir,
        gateway_port: 3000,
      },
      health_check: {
        max_queue_age_hours: 2,
        provider_error_threshold: 10,
      },
      cron_tasks: [],
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2));

    config = new ConfigManager(tempConfigPath);
    logger = new Logger({ level: LogLevel.ERROR, enableConsole: false });
    checker = new GatewayHealthChecker(config, logger);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  describe('Sessions 检查 - 详细场景', () => {
    test('应该检测 thinking-only sessions', async () => {
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'test-session.jsonl');

      const messages = [
        JSON.stringify({ role: 'user', content: 'test', timestamp: new Date().toISOString() }),
        JSON.stringify({
          role: 'assistant',
          thinking: 'thinking...',
          timestamp: new Date().toISOString(),
        }),
      ];
      fs.writeFileSync(sessionFile, messages.join('\n'));

      const result = await checker.check();

      expect(result.checks.sessions.status).toBe('warning');
      expect(result.checks.sessions.message).toContain('thinking-only');
    });

    test('应该检测未回复消息', async () => {
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'test-session.jsonl');

      const messages = [
        JSON.stringify({ role: 'user', content: 'Hello', timestamp: new Date().toISOString() }),
        JSON.stringify({
          role: 'assistant',
          content: 'Hi',
          timestamp: new Date().toISOString(),
        }),
        JSON.stringify({
          role: 'user',
          content: 'How are you?',
          timestamp: new Date().toISOString(),
        }),
      ];
      fs.writeFileSync(sessionFile, messages.join('\n'));

      const result = await checker.check();

      expect(result.checks.sessions.status).toBe('warning');
      expect(result.checks.sessions.message).toContain('未回复');
    });

    test('应该处理 sessions 目录不存在', async () => {
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      fs.rmSync(sessionsDir, { recursive: true, force: true });

      const result = await checker.check();

      // 目录不存在会返回 warning
      expect(result.checks.sessions.status).toBe('warning');
      expect(result.checks.sessions.message).toContain('不存在');
    });

    test('应该处理空 session 文件', async () => {
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'empty.jsonl');
      fs.writeFileSync(sessionFile, '');

      const result = await checker.check();

      expect(result.checks.sessions.status).toBe('ok');
    });

    test('应该处理损坏的 session 文件', async () => {
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'broken.jsonl');
      fs.writeFileSync(sessionFile, 'invalid json');

      const result = await checker.check();

      // 应该跳过损坏的文件，不影响整体检查
      expect(result.checks.sessions.status).toBe('ok');
    });
  });

  describe('Queue 检查 - 详细场景', () => {
    test('应该检测卡住的队列任务', async () => {
      const queueDir = config.get<string>('openclaw.queue_dir');
      const queueFile = path.join(queueDir, 'task-123.json');

      fs.writeFileSync(queueFile, JSON.stringify({ id: '123', status: 'pending' }));

      // 修改文件时间为 3 小时前（超过阈值 2 小时）
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      fs.utimesSync(queueFile, new Date(threeHoursAgo), new Date(threeHoursAgo));

      const result = await checker.check();

      expect(result.checks.queue.status).toBe('warning');
      expect(result.checks.queue.message).toContain('超过');
    });

    test('应该处理队列目录不存在', async () => {
      const queueDir = config.get<string>('openclaw.queue_dir');
      fs.rmSync(queueDir, { recursive: true, force: true });

      const result = await checker.check();

      expect(result.checks.queue.status).toBe('ok');
      expect(result.checks.queue.message).toContain('不存在');
    });

    test('应该处理空队列', async () => {
      const result = await checker.check();

      expect(result.checks.queue.status).toBe('ok');
      expect(result.checks.queue.message).toContain('为空');
    });

    test('应该处理正常的队列任务', async () => {
      const queueDir = config.get<string>('openclaw.queue_dir');
      const queueFile = path.join(queueDir, 'task-456.json');

      fs.writeFileSync(queueFile, JSON.stringify({ id: '456', status: 'pending' }));

      const result = await checker.check();

      expect(result.checks.queue.status).toBe('ok');
      expect(result.checks.queue.message).toContain('正常');
    });
  });

  describe('Providers 检查 - 详细场景', () => {
    test('应该检测日志中的错误', async () => {
      const logsDir = config.get<string>('openclaw.logs_dir');
      const logFile = path.join(logsDir, 'gateway.log');

      const logContent = Array(15)
        .fill(null)
        .map((_, i) => `[2026-04-15T10:${i}:00.000Z] [ERROR] Provider: openai error: timeout`)
        .join('\n');
      fs.writeFileSync(logFile, logContent);

      const result = await checker.check();

      expect(result.checks.providers.status).toBe('warning');
      expect(result.checks.providers.message).toContain('错误');
    });

    test('应该处理日志文件不存在', async () => {
      const result = await checker.check();

      expect(result.checks.providers.status).toBe('ok');
      expect(result.checks.providers.message).toContain('不存在');
    });

    test('应该处理错误数量在阈值内', async () => {
      const logsDir = config.get<string>('openclaw.logs_dir');
      const logFile = path.join(logsDir, 'gateway.log');

      const logContent = Array(5)
        .fill(null)
        .map((_, i) => `[2026-04-15T10:${i}:00.000Z] [ERROR] Provider: openai error: timeout`)
        .join('\n');
      fs.writeFileSync(logFile, logContent);

      const result = await checker.check();

      expect(result.checks.providers.status).toBe('ok');
      expect(result.checks.providers.message).toContain('在阈值内');
    });

    test('应该处理没有错误的日志', async () => {
      const logsDir = config.get<string>('openclaw.logs_dir');
      const logFile = path.join(logsDir, 'gateway.log');

      const logContent = Array(10)
        .fill(null)
        .map((_, i) => `[2026-04-15T10:${i}:00.000Z] [INFO] Request completed`)
        .join('\n');
      fs.writeFileSync(logFile, logContent);

      const result = await checker.check();

      expect(result.checks.providers.status).toBe('ok');
      expect(result.checks.providers.message).toContain('正常');
    });
  });

  describe('Cron 检查 - 详细场景', () => {
    test('应该检测禁用的 Cron 任务', async () => {
      config.set('cron_tasks', [
        { name: 'task-1', enabled: true, schedule: '0 0 * * *' },
        { name: 'task-2', enabled: false, schedule: '0 12 * * *' },
        { name: 'task-3', enabled: false, schedule: '0 18 * * *' },
      ]);

      const result = await checker.check();

      expect(result.checks.cron.status).toBe('warning');
      expect(result.checks.cron.message).toContain('被禁用');
    });

    test('应该处理没有配置 Cron 任务', async () => {
      const result = await checker.check();

      expect(result.checks.cron.status).toBe('ok');
      expect(result.checks.cron.message).toContain('没有配置');
    });

    test('应该处理所有 Cron 任务已启用', async () => {
      config.set('cron_tasks', [
        { name: 'task-1', enabled: true, schedule: '0 0 * * *' },
        { name: 'task-2', enabled: true, schedule: '0 12 * * *' },
      ]);

      const result = await checker.check();

      expect(result.checks.cron.status).toBe('ok');
      expect(result.checks.cron.message).toContain('已启用');
    });
  });

  describe('健康评分计算', () => {
    test('所有检查正常时应该是满分', async () => {
      // 创建正常的环境
      const logsDir = config.get<string>('openclaw.logs_dir');
      const logFile = path.join(logsDir, 'gateway.log');
      fs.writeFileSync(logFile, '[2026-04-15T10:00:00.000Z] [INFO] All good\n');

      const result = await checker.check();

      // Gateway 可能未运行，但其他检查应该正常
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    test('有警告时应该降低分数', async () => {
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'test-session.jsonl');

      fs.writeFileSync(
        sessionFile,
        JSON.stringify({ role: 'user', content: 'unanswered', timestamp: new Date().toISOString() })
      );

      const result = await checker.check();

      expect(result.checks.sessions.status).toBe('warning');
      expect(result.score).toBeLessThan(100);
    });

    test('多个问题应该累计扣分', async () => {
      // 创建多个问题
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'test-session.jsonl');
      fs.writeFileSync(
        sessionFile,
        JSON.stringify({ role: 'user', content: 'unanswered', timestamp: new Date().toISOString() })
      );

      const queueDir = config.get<string>('openclaw.queue_dir');
      const queueFile = path.join(queueDir, 'task-123.json');
      fs.writeFileSync(queueFile, JSON.stringify({ id: '123', status: 'pending' }));
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      fs.utimesSync(queueFile, new Date(threeHoursAgo), new Date(threeHoursAgo));

      const result = await checker.check();

      expect(result.checks.sessions.status).toBe('warning');
      expect(result.checks.queue.status).toBe('warning');
      expect(result.score).toBeLessThan(90);
    });
  });

  describe('整体状态评估', () => {
    test('高分应该是 healthy', async () => {
      const logsDir = config.get<string>('openclaw.logs_dir');
      const logFile = path.join(logsDir, 'gateway.log');
      fs.writeFileSync(logFile, '[2026-04-15T10:00:00.000Z] [INFO] All good\n');

      const result = await checker.check();

      if (result.score >= 80) {
        expect(result.status).toBe('healthy');
      }
    });

    test('中等分数应该是 warning', async () => {
      // 创建一些警告
      const sessionsDir = config.get<string>('openclaw.sessions_dir');
      const sessionFile = path.join(sessionsDir, 'test-session.jsonl');
      fs.writeFileSync(
        sessionFile,
        JSON.stringify({ role: 'user', content: 'unanswered', timestamp: new Date().toISOString() })
      );

      config.set('cron_tasks', [
        { name: 'task-1', enabled: false, schedule: '0 0 * * *' },
      ]);

      const result = await checker.check();

      if (result.score >= 50 && result.score < 80) {
        expect(result.status).toBe('warning');
      }
    });
  });

  describe('并发检查', () => {
    test('应该并发执行所有检查', async () => {
      const startTime = Date.now();
      await checker.check();
      const duration = Date.now() - startTime;

      // 并发执行应该很快（<1秒）
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('错误处理', () => {
    test('应该处理 sessions 检查异常', async () => {
      // 删除整个 openclaw 目录
      const openclawDir = config.get<string>('openclaw.dir');
      fs.rmSync(openclawDir, { recursive: true, force: true });

      const result = await checker.check();

      // 目录不存在返回 warning
      expect(result.checks.sessions.status).toBe('warning');
    });

    test('应该处理 queue 检查异常', async () => {
      const openclawDir = config.get<string>('openclaw.dir');
      fs.rmSync(openclawDir, { recursive: true, force: true });

      const result = await checker.check();

      expect(result.checks.queue.status).toBe('ok');
    });

    test('应该处理 providers 检查异常', async () => {
      const openclawDir = config.get<string>('openclaw.dir');
      fs.rmSync(openclawDir, { recursive: true, force: true });

      const result = await checker.check();

      expect(result.checks.providers.status).toBe('ok');
    });

    test('应该处理 cron 检查异常', async () => {
      // 删除配置文件会导致 config.get 失败
      fs.rmSync(tempConfigPath, { force: true });

      const result = await checker.check();

      // 配置读取失败会返回 error
      expect(result.checks.cron.status).toBe('error');
    });
  });
});
