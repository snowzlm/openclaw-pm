import {
  ConfigManager,
  getDefaultConfigPath,
  detectOpenClawDir,
  getDefaultSessionsDir,
  getDefaultWorkspaceDir,
  getDefaultBackupDir,
  getDefaultCacheDir,
} from '../../src/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager', () => {
  let tempConfigPath: string;
  let config: ConfigManager;
  let originalOpenclawDir: string | undefined;
  let originalHome: string | undefined;
  let originalCwd: string;
  let tempRootDir: string;

  beforeEach(() => {
    originalOpenclawDir = process.env.OPENCLAW_DIR;
    originalHome = process.env.HOME;
    originalCwd = process.cwd();
    tempRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-pm-config-'));

    // 创建临时配置文件
    tempConfigPath = path.join(tempRootDir, 'test-config.json');
    const testConfig = {
      openclaw: {
        dir: '/tmp/test-openclaw',
        sessions_dir: '/tmp/test-openclaw/sessions',
        gateway_port: 3000,
      },
      backup: {
        enabled: true,
        dir: '/tmp/test-openclaw/backups',
        max_backups: 10,
      },
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2));
    config = new ConfigManager(tempConfigPath);
  });

  afterEach(() => {
    if (originalOpenclawDir === undefined) {
      delete process.env.OPENCLAW_DIR;
    } else {
      process.env.OPENCLAW_DIR = originalOpenclawDir;
    }

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    process.chdir(originalCwd);
    jest.restoreAllMocks();

    if (fs.existsSync(tempRootDir)) {
      fs.rmSync(tempRootDir, { recursive: true, force: true });
    }
  });

  describe('default path detection', () => {
    test('should use OPENCLAW_DIR for default config path', () => {
      process.env.OPENCLAW_DIR = path.join(tempRootDir, '.openclaw-custom');
      expect(getDefaultConfigPath()).toBe(
        path.join(process.env.OPENCLAW_DIR, 'pm-config.json')
      );
    });

    test('should auto-detect an absolute OpenClaw directory when env is not set', () => {
      delete process.env.OPENCLAW_DIR;

      const detected = detectOpenClawDir();

      expect(path.isAbsolute(detected)).toBe(true);
      expect(detected.endsWith('.openclaw')).toBe(true);
    });

    test('should build helper paths from detected OpenClaw directory', () => {
      const baseDir = path.join(tempRootDir, '.openclaw-runtime');
      expect(getDefaultSessionsDir(baseDir)).toBe(path.join(baseDir, 'agents', 'main', 'sessions'));
      expect(getDefaultWorkspaceDir(baseDir)).toBe(path.join(baseDir, 'workspace'));
      expect(getDefaultBackupDir(baseDir)).toBe(path.join(baseDir, 'backups'));
      expect(getDefaultCacheDir(baseDir)).toBe(path.join(baseDir, 'pm-cache'));
    });
  });

  describe('load', () => {
    test('should load config from file', () => {
      expect(config.get('openclaw.dir')).toBe('/tmp/test-openclaw');
      expect(config.get('openclaw.gateway_port')).toBe(3000);
    });

    test('should return default value if key not found', () => {
      expect(config.get('nonexistent.key', 'default')).toBe('default');
    });
  });

  describe('get', () => {
    test('should get nested config value', () => {
      expect(config.get('openclaw.sessions_dir')).toBe('/tmp/test-openclaw/sessions');
    });

    test('should get top-level config value', () => {
      const backup = config.get('backup');
      expect(backup).toEqual({
        enabled: true,
        dir: '/tmp/test-openclaw/backups',
        max_backups: 10,
      });
    });

    test('should return undefined for missing key', () => {
      expect(config.get('missing.key')).toBeUndefined();
    });
  });

  describe('set', () => {
    test('should set nested config value', () => {
      config.set('openclaw.gateway_port', 4000);
      expect(config.get('openclaw.gateway_port')).toBe(4000);
    });

    test('should create nested path if not exists', () => {
      config.set('new.nested.value', 'test');
      expect(config.get('new.nested.value')).toBe('test');
    });
  });

  describe('save', () => {
    test('should save config to file', () => {
      config.set('openclaw.gateway_port', 5000);
      const currentConfig = config.getAll();
      config.save(currentConfig);

      // 重新加载配置
      const newConfig = new ConfigManager(tempConfigPath);
      expect(newConfig.get('openclaw.gateway_port')).toBe(5000);
    });

    test('should create parent directory if not exists', () => {
      const nestedConfigPath = path.join(tempRootDir, 'nested', 'deep', 'pm-config.json');
      const nestedConfig = new ConfigManager(nestedConfigPath);
      const configData = config.getAll();

      nestedConfig.save(configData);

      expect(fs.existsSync(nestedConfigPath)).toBe(true);
      expect(new ConfigManager(nestedConfigPath).get('openclaw.dir')).toBe('/tmp/test-openclaw');
    });
  });

  describe('getAll', () => {
    test('should return entire config object', () => {
      const allConfig = config.getAll();
      expect(allConfig).toHaveProperty('openclaw');
      expect(allConfig).toHaveProperty('backup');
    });
  });

  describe('reload', () => {
    test('should reload config from file', () => {
      // 修改文件
      const newConfig = {
        openclaw: {
          dir: '/tmp/new-openclaw',
          sessions_dir: '/tmp/new-openclaw/sessions',
          gateway_port: 6000,
        },
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(newConfig, null, 2));

      // 重新创建 ConfigManager 实例来加载新配置
      config = new ConfigManager(tempConfigPath);
      expect(config.get('openclaw.gateway_port')).toBe(6000);
    });
  });

  describe('createDefault', () => {
    test('should create default config with detected OpenClaw directories', () => {
      const detectedDir = path.join(tempRootDir, '.openclaw-detected');
      process.env.OPENCLAW_DIR = detectedDir;
      const outputPath = path.join(tempRootDir, 'generated', 'pm-config.json');

      const created = ConfigManager.createDefault(outputPath);

      expect(fs.existsSync(outputPath)).toBe(true);
      expect(created.openclaw.dir).toBe(detectedDir);
      expect(created.openclaw.sessions_dir).toBe(path.join(detectedDir, 'agents', 'main', 'sessions'));
      expect(created.openclaw.workspace_dir).toBe(path.join(detectedDir, 'workspace'));
      expect(created.backup.backup_dir).toBe(path.join(detectedDir, 'backups'));
      expect(created.cron_tasks.length).toBeGreaterThan(0);
    });

    test('should create output directory when generating default config', () => {
      process.env.OPENCLAW_DIR = path.join(tempRootDir, '.openclaw');
      const outputPath = path.join(tempRootDir, 'a', 'b', 'c', 'pm-config.json');

      ConfigManager.createDefault(outputPath);

      expect(fs.existsSync(path.dirname(outputPath))).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });
});
