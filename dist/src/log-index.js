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
exports.LogIndexManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/**
 * 日志索引管理器
 */
class LogIndexManager {
    constructor(cacheDir) {
        this.indexDir = path.join(cacheDir, 'log-indexes');
        this.ensureIndexDir();
    }
    /**
     * 确保索引目录存在
     */
    ensureIndexDir() {
        if (!fs.existsSync(this.indexDir)) {
            fs.mkdirSync(this.indexDir, { recursive: true });
        }
    }
    /**
     * 获取索引文件路径
     */
    getIndexPath(date) {
        return path.join(this.indexDir, `log-index-${date}.json`);
    }
    /**
     * 计算文件哈希
     */
    calculateFileHash(filePath) {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(content).digest('hex');
    }
    /**
     * 检查索引是否有效
     */
    isIndexValid(date, logFilePath) {
        const indexPath = this.getIndexPath(date);
        if (!fs.existsSync(indexPath)) {
            return false;
        }
        try {
            const index = this.loadIndex(date);
            if (!index)
                return false;
            // 检查日志文件是否被修改
            const logStat = fs.statSync(logFilePath);
            if (logStat.mtimeMs > index.lastModified) {
                return false;
            }
            // 检查文件哈希（可选，更严格）
            // const currentHash = this.calculateFileHash(logFilePath);
            // if (currentHash !== index.fileHash) {
            //   return false;
            // }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 加载索引
     */
    loadIndex(date) {
        const indexPath = this.getIndexPath(date);
        if (!fs.existsSync(indexPath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(indexPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    /**
     * 保存索引
     */
    saveIndex(index) {
        const indexPath = this.getIndexPath(index.date);
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    }
    /**
     * 构建日志索引
     */
    buildIndex(date, logFilePath) {
        const content = fs.readFileSync(logFilePath, 'utf-8');
        const lines = content.split('\n');
        const logStat = fs.statSync(logFilePath);
        let messageCount = 0;
        let errorCount = 0;
        const hourlyMap = new Map();
        lines.forEach((line, index) => {
            if (!line.trim())
                return;
            // 统计消息
            if (line.includes('received message')) {
                messageCount++;
            }
            // 统计错误
            if (/ERROR|FailoverError|All models failed/.test(line)) {
                errorCount++;
            }
            // 按小时分布
            const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch) {
                const hour = parseInt(timeMatch[1], 10);
                if (!hourlyMap.has(hour)) {
                    hourlyMap.set(hour, { offset: index, count: 0 });
                }
                hourlyMap.get(hour).count++;
            }
        });
        const hourlyDistribution = Array.from(hourlyMap.entries())
            .map(([hour, data]) => ({ hour, offset: data.offset, count: data.count }))
            .sort((a, b) => a.hour - b.hour);
        const index = {
            date,
            filePath: logFilePath,
            fileHash: this.calculateFileHash(logFilePath),
            lineCount: lines.length,
            messageCount,
            errorCount,
            hourlyDistribution,
            lastModified: logStat.mtimeMs,
            createdAt: Date.now(),
        };
        this.saveIndex(index);
        return index;
    }
    /**
     * 获取或构建索引
     */
    getOrBuildIndex(date, logFilePath) {
        if (this.isIndexValid(date, logFilePath)) {
            const index = this.loadIndex(date);
            if (index)
                return index;
        }
        return this.buildIndex(date, logFilePath);
    }
    /**
     * 清理过期索引
     */
    cleanupOldIndexes(daysToKeep = 30) {
        const files = fs.readdirSync(this.indexDir);
        const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
        let deletedCount = 0;
        for (const file of files) {
            if (!file.startsWith('log-index-'))
                continue;
            const filePath = path.join(this.indexDir, file);
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < cutoffTime) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
        return deletedCount;
    }
    /**
     * 获取索引统计
     */
    getIndexStats() {
        const files = fs.readdirSync(this.indexDir);
        let totalSize = 0;
        let oldestTime = Infinity;
        let newestTime = 0;
        let oldestIndex = null;
        let newestIndex = null;
        for (const file of files) {
            if (!file.startsWith('log-index-'))
                continue;
            const filePath = path.join(this.indexDir, file);
            const stat = fs.statSync(filePath);
            totalSize += stat.size;
            if (stat.mtimeMs < oldestTime) {
                oldestTime = stat.mtimeMs;
                oldestIndex = file;
            }
            if (stat.mtimeMs > newestTime) {
                newestTime = stat.mtimeMs;
                newestIndex = file;
            }
        }
        return {
            totalIndexes: files.filter((f) => f.startsWith('log-index-')).length,
            totalSize,
            oldestIndex,
            newestIndex,
        };
    }
}
exports.LogIndexManager = LogIndexManager;
//# sourceMappingURL=log-index.js.map