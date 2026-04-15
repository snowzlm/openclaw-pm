"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * 增量分析管理器
 */
class IncrementalAnalyzer {
    constructor(cacheDir) {
        this.checkpointDir = path.join(cacheDir, 'checkpoints');
        this.ensureCheckpointDir();
    }
    /**
     * 确保检查点目录存在
     */
    ensureCheckpointDir() {
        if (!fs.existsSync(this.checkpointDir)) {
            fs.mkdirSync(this.checkpointDir, { recursive: true });
        }
    }
    /**
     * 获取检查点文件路径
     */
    getCheckpointPath(logFile) {
        const hash = crypto.createHash('md5').update(logFile).digest('hex');
        return path.join(this.checkpointDir, `checkpoint-${hash}.json`);
    }
    /**
     * 加载检查点
     */
    loadCheckpoint(logFile) {
        const checkpointPath = this.getCheckpointPath(logFile);
        if (!fs.existsSync(checkpointPath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(checkpointPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    /**
     * 保存检查点
     */
    saveCheckpoint(checkpoint) {
        const checkpointPath = this.getCheckpointPath(checkpoint.logFile);
        fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    }
    /**
     * 创建初始检查点
     */
    createInitialCheckpoint(logFile) {
        return {
            logFile,
            lastOffset: 0,
            lastLineNumber: 0,
            lastTimestamp: '',
            stats: {
                messagesReceived: 0,
                messagesSent: 0,
                errors: 0,
                gatewayStarts: 0,
                gatewayStops: 0,
            },
            updatedAt: Date.now(),
        };
    }
    /**
     * 检查日志文件是否被截断或重置
     */
    isLogFileReset(logFile, checkpoint) {
        const stat = fs.statSync(logFile);
        return stat.size < checkpoint.lastOffset;
    }
    /**
     * 分析新增内容
     */
    analyzeIncremental(logFile) {
        // 1. 加载或创建检查点
        let checkpoint = this.loadCheckpoint(logFile);
        if (!checkpoint) {
            checkpoint = this.createInitialCheckpoint(logFile);
        }
        // 2. 检查日志文件是否被重置
        if (this.isLogFileReset(logFile, checkpoint)) {
            checkpoint = this.createInitialCheckpoint(logFile);
        }
        // 3. 读取新增内容
        const fd = fs.openSync(logFile, 'r');
        const stat = fs.statSync(logFile);
        const newContentSize = stat.size - checkpoint.lastOffset;
        if (newContentSize <= 0) {
            fs.closeSync(fd);
            return {
                newMessages: 0,
                newErrors: 0,
                newGatewayEvents: 0,
                totalProcessed: 0,
                checkpoint,
            };
        }
        const buffer = Buffer.alloc(newContentSize);
        fs.readSync(fd, buffer, 0, newContentSize, checkpoint.lastOffset);
        fs.closeSync(fd);
        const newContent = buffer.toString('utf-8');
        const newLines = newContent.split('\n');
        // 4. 分析新增内容
        let newMessages = 0;
        let newErrors = 0;
        let newGatewayEvents = 0;
        let lastTimestamp = checkpoint.lastTimestamp;
        for (const line of newLines) {
            if (!line.trim())
                continue;
            // 提取时间戳
            const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
            if (timeMatch) {
                lastTimestamp = timeMatch[1];
            }
            // 统计消息
            if (line.includes('received message') || line.includes('inbound message')) {
                newMessages++;
                checkpoint.stats.messagesReceived++;
            }
            if (line.includes('sent message') || line.includes('outbound message')) {
                checkpoint.stats.messagesSent++;
            }
            // 统计错误
            if (/ERROR|FailoverError|All models failed/.test(line)) {
                newErrors++;
                checkpoint.stats.errors++;
            }
            // 统计 Gateway 事件
            if (line.includes('Gateway starting') || line.includes('Gateway started')) {
                newGatewayEvents++;
                checkpoint.stats.gatewayStarts++;
            }
            if (line.includes('Gateway stopping') || line.includes('Gateway stopped')) {
                newGatewayEvents++;
                checkpoint.stats.gatewayStops++;
            }
        }
        // 5. 更新检查点
        checkpoint.lastOffset = stat.size;
        checkpoint.lastLineNumber += newLines.length;
        checkpoint.lastTimestamp = lastTimestamp;
        checkpoint.updatedAt = Date.now();
        this.saveCheckpoint(checkpoint);
        return {
            newMessages,
            newErrors,
            newGatewayEvents,
            totalProcessed: newLines.length,
            checkpoint,
        };
    }
    /**
     * 重置检查点
     */
    resetCheckpoint(logFile) {
        const checkpointPath = this.getCheckpointPath(logFile);
        if (fs.existsSync(checkpointPath)) {
            fs.unlinkSync(checkpointPath);
        }
    }
    /**
     * 获取所有检查点
     */
    getAllCheckpoints() {
        const files = fs.readdirSync(this.checkpointDir);
        const checkpoints = [];
        for (const file of files) {
            if (!file.startsWith('checkpoint-'))
                continue;
            const filePath = path.join(this.checkpointDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                checkpoints.push(JSON.parse(content));
            }
            catch {
                // 忽略损坏的检查点文件
            }
        }
        return checkpoints;
    }
    /**
     * 清理过期检查点
     */
    cleanupOldCheckpoints(daysToKeep = 7) {
        const files = fs.readdirSync(this.checkpointDir);
        const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
        let deletedCount = 0;
        for (const file of files) {
            if (!file.startsWith('checkpoint-'))
                continue;
            const filePath = path.join(this.checkpointDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const checkpoint = JSON.parse(content);
                if (checkpoint.updatedAt < cutoffTime) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            catch {
                // 删除损坏的检查点文件
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * 获取检查点统计
     */
    getCheckpointStats() {
        const files = fs.readdirSync(this.checkpointDir);
        let totalSize = 0;
        let oldestTime = Infinity;
        let newestTime = 0;
        let oldestCheckpoint = null;
        let newestCheckpoint = null;
        for (const file of files) {
            if (!file.startsWith('checkpoint-'))
                continue;
            const filePath = path.join(this.checkpointDir, file);
            const stat = fs.statSync(filePath);
            totalSize += stat.size;
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const checkpoint = JSON.parse(content);
                if (checkpoint.updatedAt < oldestTime) {
                    oldestTime = checkpoint.updatedAt;
                    oldestCheckpoint = checkpoint.logFile;
                }
                if (checkpoint.updatedAt > newestTime) {
                    newestTime = checkpoint.updatedAt;
                    newestCheckpoint = checkpoint.logFile;
                }
            }
            catch {
                // 忽略损坏的文件
            }
        }
        return {
            totalCheckpoints: files.filter((f) => f.startsWith('checkpoint-')).length,
            totalSize,
            oldestCheckpoint,
            newestCheckpoint,
        };
    }
}
exports.IncrementalAnalyzer = IncrementalAnalyzer;
//# sourceMappingURL=incremental-analyzer.js.map