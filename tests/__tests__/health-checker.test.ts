import { GatewayHealthChecker } from '../../src/health-checker';
import { ConfigManager } from '../../src/config';
import { Logger } from '../../src/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('GatewayHealthChecker', () => {
  let tempConfigPath: string;
  let config: ConfigManager;
  let logger: Logger;
  let checker: GatewayHealthChecker;

  beforeEach(() => {
    // 创建临时配置
    tempConfigPath = path.join(os.tmpdir(), `test-config-${Date.now()}.json`);
    const testConfig = {
      openclaw: {
        dir: '/tmp/test-openclaw',
        sessions_dir: '/tmp/test-openclaw/sessions',
        gateway_port: 3000,
      },
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2));
    
    config = new ConfigManager(tempConfigPath);
    logger = new Logger({ logFile: '/tmp/test-openclaw-pm.log' });
    checker = new GatewayHealthChecker(config, logger);
  });

  afterEach(() => {
    // 清理
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  describe('check', () => {
    test('should return health check result structure', async () => {
      const result = await checker.check();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('score');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('should include all check categories', async () => {
      const result = await checker.check();
      
      expect(result.checks).toHaveProperty('gateway');
      expect(result.checks).toHaveProperty('sessions');
      expect(result.checks).toHaveProperty('queue');
      expect(result.checks).toHaveProperty('providers');
      expect(result.checks).toHaveProperty('cron');
    });

    test('should have valid check status', async () => {
      const result = await checker.check();
      
      Object.values(result.checks).forEach((check: any) => {
        expect(check).toHaveProperty('status');
        expect(['ok', 'warning', 'error']).toContain(check.status);
        expect(check).toHaveProperty('message');
      });
    });

    test('should calculate score correctly', async () => {
      const result = await checker.check();
      
      // 验证分数在合理范围内
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(typeof result.score).toBe('number');
      
      // 验证分数与检查结果相关
      const checks = Object.values(result.checks);
      const allOk = checks.every((c: any) => c.status === 'ok');
      const allError = checks.every((c: any) => c.status === 'error');
      
      if (allOk) {
        expect(result.score).toBe(100);
      } else if (allError) {
        expect(result.score).toBe(0);
      } else {
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThan(100);
      }
    });
  });
});
