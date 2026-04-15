import { ConfigManager } from '../../src/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager', () => {
  let tempConfigPath: string;
  let config: ConfigManager;

  beforeEach(() => {
    // 创建临时配置文件
    tempConfigPath = path.join(os.tmpdir(), `test-config-${Date.now()}.json`);
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
    // 清理临时文件
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
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
});
