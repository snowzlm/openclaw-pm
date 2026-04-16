import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigInitializer } from '../../src/config-initializer';
import { Logger, LogLevel } from '../../src/logger';

describe('ConfigInitializer', () => {
  let tempDir: string;
  let configPath: string;
  let initializer: ConfigInitializer;
  let originalOpenclawDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-pm-init-'));
    configPath = path.join(tempDir, 'nested', 'pm-config.json');
    originalOpenclawDir = process.env.OPENCLAW_DIR;
    process.env.OPENCLAW_DIR = path.join(tempDir, '.openclaw');

    initializer = new ConfigInitializer(
      new Logger({ level: LogLevel.ERROR, enableConsole: false, enableFile: false })
    );
  });

  afterEach(() => {
    if (originalOpenclawDir === undefined) {
      delete process.env.OPENCLAW_DIR;
    } else {
      process.env.OPENCLAW_DIR = originalOpenclawDir;
    }

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should create current mainline config schema', async () => {
    await initializer.initConfig(configPath, { force: true });

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.openclaw.dir).toBe(process.env.OPENCLAW_DIR);
    expect(config.openclaw.sessions_dir).toBe(path.join(process.env.OPENCLAW_DIR!, 'agents', 'main', 'sessions'));
    expect(config.openclaw.queue_dir).toBe(path.join(process.env.OPENCLAW_DIR!, 'queue'));
    expect(config.openclaw.logs_dir).toBe(path.join(process.env.OPENCLAW_DIR!, 'logs'));
    expect(config.openclaw.workspace_dir).toBe(path.join(process.env.OPENCLAW_DIR!, 'workspace'));
    expect(config.openclaw.gateway_timeout).toBe(30);
    expect(config).toHaveProperty('health_check');
    expect(config.health_check.interval_minutes).toBe(5);
    expect(config.backup.backup_dir).toBe(path.join(process.env.OPENCLAW_DIR!, 'backups'));
    expect(config.notification).toEqual({ enabled: false, channels: [] });
    expect(config.cron_tasks[0]).toHaveProperty('schedule');
  });

  test('should validate current schema and reject legacy schema', () => {
    const valid = initializer.validateConfig({
      openclaw: {
        dir: '/tmp/.openclaw',
        sessions_dir: '/tmp/.openclaw/agents/main/sessions',
        gateway_port: 3000,
        gateway_timeout: 30,
      },
      health_check: {
        interval_minutes: 5,
      },
      backup: {
        enabled: true,
        backup_dir: '/tmp/.openclaw/backups',
        max_backups: 10,
      },
      cron_tasks: [],
    } as any);
    expect(valid.valid).toBe(true);

    const legacy = initializer.validateConfig({
      openclaw: {
        dir: '/tmp/.openclaw',
        sessions_dir: '/tmp/.openclaw/agents/main/sessions',
        gateway_port: 3000,
      },
      health: {
        check_interval: 300,
      },
      backup: {
        enabled: true,
        dir: '/tmp/.openclaw/backups',
        max_backups: 10,
      },
      cron_tasks: [],
    } as any);
    expect(legacy.valid).toBe(false);
    expect(legacy.errors).toContain('缺少 health_check 配置');
    expect(legacy.errors).toContain('openclaw.gateway_timeout 必须是数字');
  });
});
