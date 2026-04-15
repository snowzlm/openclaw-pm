import { IncrementalAnalyzer } from '../../src/incremental-analyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('IncrementalAnalyzer', () => {
  let analyzer: IncrementalAnalyzer;
  let testDir: string;
  let testLogFile: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `openclaw-pm-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    testLogFile = path.join(testDir, 'test.log');
    analyzer = new IncrementalAnalyzer(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('analyzeIncremental', () => {
    it('should analyze new content only', () => {
      // 初始内容
      fs.writeFileSync(
        testLogFile,
        '[2026-04-15T10:00:00.000Z] INFO: received message\n' +
          '[2026-04-15T10:01:00.000Z] ERROR: Connection failed\n'
      );

      const result1 = analyzer.analyzeIncremental(testLogFile);
      expect(result1.newMessages).toBe(1);
      expect(result1.newErrors).toBe(1);

      // 追加新内容
      fs.appendFileSync(
        testLogFile,
        '[2026-04-15T10:02:00.000Z] INFO: received message\n' +
          '[2026-04-15T10:03:00.000Z] INFO: Gateway started\n'
      );

      const result2 = analyzer.analyzeIncremental(testLogFile);
      expect(result2.newMessages).toBe(1);
      expect(result2.newErrors).toBe(0);
      expect(result2.newGatewayEvents).toBe(1);
    });

    it('should handle log file reset', () => {
      // 初始内容
      fs.writeFileSync(testLogFile, 'Line 1\nLine 2\nLine 3\n');
      const result1 = analyzer.analyzeIncremental(testLogFile);
      expect(result1.totalProcessed).toBeGreaterThan(0);

      // 重置文件（文件变小）
      fs.writeFileSync(testLogFile, 'New Line 1\n');
      const result2 = analyzer.analyzeIncremental(testLogFile);

      // 应该从头开始分析
      expect(result2.checkpoint.lastOffset).toBeLessThan(result1.checkpoint.lastOffset);
    });

    it('should return zero for unchanged file', () => {
      fs.writeFileSync(testLogFile, 'Line 1\nLine 2\n');
      analyzer.analyzeIncremental(testLogFile);

      // 再次分析相同文件
      const result = analyzer.analyzeIncremental(testLogFile);
      expect(result.newMessages).toBe(0);
      expect(result.newErrors).toBe(0);
      expect(result.totalProcessed).toBe(0);
    });

    it('should count sent messages and gateway stop events', () => {
      fs.writeFileSync(
        testLogFile,
        '[2026-04-15T10:00:00.000Z] INFO: sent message\n' +
          '[2026-04-15T10:01:00.000Z] INFO: outbound message\n' +
          '[2026-04-15T10:02:00.000Z] INFO: Gateway stopping\n' +
          '[2026-04-15T10:03:00.000Z] INFO: Gateway stopped\n'
      );

      const result = analyzer.analyzeIncremental(testLogFile);

      expect(result.checkpoint.stats.messagesSent).toBe(2);
      expect(result.checkpoint.stats.gatewayStops).toBe(2);
      expect(result.newGatewayEvents).toBe(2);
    });
  });

  describe('checkpoint management', () => {
    it('should save and load checkpoint', () => {
      fs.writeFileSync(testLogFile, 'Line 1\nLine 2\n');
      analyzer.analyzeIncremental(testLogFile);

      const checkpoint = analyzer.loadCheckpoint(testLogFile);
      expect(checkpoint).not.toBeNull();
      expect(checkpoint!.logFile).toBe(testLogFile);
      expect(checkpoint!.lastOffset).toBeGreaterThan(0);
    });

    it('should return null for corrupted checkpoint file', () => {
      fs.writeFileSync(testLogFile, 'Line 1\n');
      analyzer.analyzeIncremental(testLogFile);

      const checkpointDir = path.join(testDir, 'checkpoints');
      const checkpointFile = fs.readdirSync(checkpointDir)[0];
      fs.writeFileSync(path.join(checkpointDir, checkpointFile), '{invalid json');

      expect(analyzer.loadCheckpoint(testLogFile)).toBeNull();
    });

    it('should reset checkpoint', () => {
      fs.writeFileSync(testLogFile, 'Line 1\nLine 2\n');
      analyzer.analyzeIncremental(testLogFile);

      analyzer.resetCheckpoint(testLogFile);
      const checkpoint = analyzer.loadCheckpoint(testLogFile);
      expect(checkpoint).toBeNull();
    });
  });

  describe('getAllCheckpoints', () => {
    it('should return all checkpoints', () => {
      const logFile1 = path.join(testDir, 'test1.log');
      const logFile2 = path.join(testDir, 'test2.log');

      fs.writeFileSync(logFile1, 'Line 1\n');
      fs.writeFileSync(logFile2, 'Line 2\n');

      analyzer.analyzeIncremental(logFile1);
      analyzer.analyzeIncremental(logFile2);

      const checkpoints = analyzer.getAllCheckpoints();
      expect(checkpoints.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('cleanupOldCheckpoints', () => {
    it('should cleanup old checkpoints', async () => {
      fs.writeFileSync(testLogFile, 'Line 1\n');
      analyzer.analyzeIncremental(testLogFile);

      // 修改检查点时间为过期
      const checkpoint = analyzer.loadCheckpoint(testLogFile);
      if (checkpoint) {
        checkpoint.updatedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 天前
        analyzer.saveCheckpoint(checkpoint);
      }

      const deletedCount = analyzer.cleanupOldCheckpoints(7);
      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });

    it('should delete corrupted checkpoint files during cleanup', () => {
      const checkpointDir = path.join(testDir, 'checkpoints');
      fs.mkdirSync(checkpointDir, { recursive: true });
      fs.writeFileSync(path.join(checkpointDir, 'checkpoint-broken.json'), '{invalid json');

      const deletedCount = analyzer.cleanupOldCheckpoints(7);
      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCheckpointStats', () => {
    it('should calculate oldest and newest checkpoints', () => {
      const oldLog = path.join(testDir, 'old.log');
      const newLog = path.join(testDir, 'new.log');

      analyzer.saveCheckpoint({
        logFile: oldLog,
        lastOffset: 10,
        lastLineNumber: 1,
        lastTimestamp: '2026-04-15T10:00:00.000Z',
        stats: { messagesReceived: 1, messagesSent: 0, errors: 0, gatewayStarts: 0, gatewayStops: 0 },
        updatedAt: 1000,
      });
      analyzer.saveCheckpoint({
        logFile: newLog,
        lastOffset: 20,
        lastLineNumber: 2,
        lastTimestamp: '2026-04-15T11:00:00.000Z',
        stats: { messagesReceived: 2, messagesSent: 1, errors: 0, gatewayStarts: 1, gatewayStops: 0 },
        updatedAt: 2000,
      });

      const stats = analyzer.getCheckpointStats();
      expect(stats.totalCheckpoints).toBeGreaterThanOrEqual(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestCheckpoint).toBe(oldLog);
      expect(stats.newestCheckpoint).toBe(newLog);
    });

    it('should ignore corrupted checkpoints when collecting stats', () => {
      analyzer.saveCheckpoint({
        logFile: path.join(testDir, 'valid.log'),
        lastOffset: 20,
        lastLineNumber: 2,
        lastTimestamp: '2026-04-15T11:00:00.000Z',
        stats: { messagesReceived: 2, messagesSent: 1, errors: 0, gatewayStarts: 1, gatewayStops: 0 },
        updatedAt: 2000,
      });

      const checkpointDir = path.join(testDir, 'checkpoints');
      fs.writeFileSync(path.join(checkpointDir, 'checkpoint-bad.json'), '{invalid json');

      const stats = analyzer.getCheckpointStats();
      expect(stats.totalCheckpoints).toBeGreaterThanOrEqual(2);
      expect(stats.newestCheckpoint).toBe(path.join(testDir, 'valid.log'));
    });
  });
});
