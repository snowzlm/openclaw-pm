import { CacheManager } from '../../src/cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let testCacheDir: string;

  beforeEach(() => {
    testCacheDir = path.join(os.tmpdir(), `openclaw-pm-test-${Date.now()}`);
    cacheManager = new CacheManager(testCacheDir);
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('set and get', () => {
    it('should set and get cache value', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      const ttl = 60;

      cacheManager.set(key, value, ttl);
      const result = cacheManager.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', () => {
      const result = cacheManager.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null for expired cache', async () => {
      const key = 'expired-key';
      const value = { data: 'test' };
      const ttl = 1; // 1 second

      cacheManager.set(key, value, ttl);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = cacheManager.get(key);
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete cache entry', () => {
      const key = 'test-key';
      const value = { data: 'test' };

      cacheManager.set(key, value, 60);
      expect(cacheManager.get(key)).toEqual(value);

      cacheManager.delete(key);
      expect(cacheManager.get(key)).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      cacheManager.set('key1', { data: 'value1' }, 60);
      cacheManager.set('key2', { data: 'value2' }, 60);

      cacheManager.clear();

      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache entries matching pattern', () => {
      cacheManager.set('daily-stats:2026-04-15', { data: 'stats1' }, 60);
      cacheManager.set('daily-stats:2026-04-14', { data: 'stats2' }, 60);
      cacheManager.set('health-check:latest', { data: 'health' }, 60);

      const deletedCount = cacheManager.invalidate('^daily-stats:');

      expect(deletedCount).toBeGreaterThanOrEqual(2);
      expect(cacheManager.get('daily-stats:2026-04-15')).toBeNull();
      expect(cacheManager.get('daily-stats:2026-04-14')).toBeNull();
      expect(cacheManager.get('health-check:latest')).not.toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired entries', async () => {
      cacheManager.set('key1', { data: 'value1' }, 1); // 1 second
      cacheManager.set('key2', { data: 'value2' }, 60); // 60 seconds

      // 等待第一个过期
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const deletedCount = cacheManager.cleanup();

      expect(deletedCount).toBeGreaterThanOrEqual(1);
      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).not.toBeNull();
    });
  });

  describe('disk cache fallback', () => {
    it('should load cache from disk and repopulate memory cache', () => {
      const key = 'disk-backed-key';
      const value = { data: 'from-disk' };

      cacheManager.set(key, value, 60);
      const freshManager = new CacheManager(testCacheDir);

      expect(freshManager.get(key)).toEqual(value);
      expect(freshManager.getStats().memoryEntries).toBeGreaterThanOrEqual(1);
    });

    it('should delete corrupted cache file on get', () => {
      const key = 'broken-key';
      const hashed = require('crypto').createHash('md5').update(key).digest('hex');
      const brokenFile = path.join(testCacheDir, 'disk-cache', `${hashed}.json`);
      fs.mkdirSync(path.dirname(brokenFile), { recursive: true });
      fs.writeFileSync(brokenFile, '{invalid json');

      expect(cacheManager.get(key)).toBeNull();
      expect(fs.existsSync(brokenFile)).toBe(false);
    });
  });

  describe('memory limit handling', () => {
    it('should evict oldest entries when memory limit is exceeded', () => {
      const limitedManager = new CacheManager(testCacheDir, 0.0001);

      limitedManager.set('oldest', { data: 'x'.repeat(400) }, 60);
      limitedManager.set('newest', { data: 'y'.repeat(400) }, 60);

      const stats = limitedManager.getStats();
      expect(stats.memoryEntries).toBeLessThan(2);
      expect(limitedManager.get('newest')).not.toBeNull();
    });
  });

  describe('corrupted cache cleanup', () => {
    it('should remove corrupted cache files during invalidate', () => {
      const brokenFile = path.join(testCacheDir, 'disk-cache', 'broken.json');
      fs.mkdirSync(path.dirname(brokenFile), { recursive: true });
      fs.writeFileSync(brokenFile, '{invalid json');

      cacheManager.invalidate('.*');

      expect(fs.existsSync(brokenFile)).toBe(false);
    });

    it('should remove corrupted cache files during cleanup and count them', () => {
      const brokenFile = path.join(testCacheDir, 'disk-cache', 'cleanup-broken.json');
      fs.mkdirSync(path.dirname(brokenFile), { recursive: true });
      fs.writeFileSync(brokenFile, '{invalid json');

      const deletedCount = cacheManager.cleanup();

      expect(deletedCount).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(brokenFile)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cacheManager.set('key1', { data: 'value1' }, 60);
      cacheManager.set('key2', { data: 'value2' }, 60);

      const stats = cacheManager.getStats();

      expect(stats.memoryEntries).toBeGreaterThanOrEqual(2);
      expect(stats.memorySizeBytes).toBeGreaterThan(0);
    });
  });
});
