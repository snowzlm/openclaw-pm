"use strict";
/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 备份管理器
 */
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
exports.BackupManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process = __importStar(require("child_process"));
class BackupManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * 创建备份
     */
    async createBackup(type = 'manual') {
        this.logger.info(`开始创建${type === 'auto' ? '自动' : '手动'}备份...`);
        const openclawDir = this.config.get('openclaw.dir');
        const backupDir = this.config.get('backup.dir');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `openclaw-backup-${timestamp}`;
        const backupPath = path.join(backupDir, backupName);
        // 确保备份目录存在
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        // 创建备份目录
        fs.mkdirSync(backupPath, { recursive: true });
        // 备份关键目录和文件
        const itemsToBackup = [
            'config.json',
            'sessions',
            'memory',
            'workspace',
            '.openclaw',
        ];
        for (const item of itemsToBackup) {
            const sourcePath = path.join(openclawDir, item);
            const destPath = path.join(backupPath, item);
            if (fs.existsSync(sourcePath)) {
                this.logger.debug(`备份: ${item}`);
                this.copyRecursive(sourcePath, destPath);
            }
        }
        // 压缩备份
        const tarPath = `${backupPath}.tar.gz`;
        this.logger.debug(`压缩备份: ${tarPath}`);
        child_process.execSync(`tar -czf "${tarPath}" -C "${backupDir}" "${backupName}"`, {
            stdio: 'inherit',
        });
        // 删除临时目录
        this.removeRecursive(backupPath);
        // 获取备份信息
        const stats = fs.statSync(tarPath);
        const backupInfo = {
            path: tarPath,
            timestamp: new Date(),
            size: stats.size,
            type,
        };
        this.logger.success(`备份创建成功: ${tarPath} (${this.formatSize(stats.size)})`);
        // 清理旧备份
        await this.cleanOldBackups();
        return backupInfo;
    }
    /**
     * 恢复备份
     */
    async restoreBackup(backupPath) {
        this.logger.info(`开始恢复备份: ${backupPath}`);
        if (!fs.existsSync(backupPath)) {
            throw new Error(`备份文件不存在: ${backupPath}`);
        }
        const openclawDir = this.config.get('openclaw.dir');
        const tempDir = path.join(openclawDir, '.backup-restore-temp');
        // 创建临时目录
        if (fs.existsSync(tempDir)) {
            this.removeRecursive(tempDir);
        }
        fs.mkdirSync(tempDir, { recursive: true });
        try {
            // 解压备份
            this.logger.debug('解压备份文件...');
            child_process.execSync(`tar -xzf "${backupPath}" -C "${tempDir}"`, {
                stdio: 'inherit',
            });
            // 查找解压后的目录
            const extractedDirs = fs.readdirSync(tempDir);
            if (extractedDirs.length === 0) {
                throw new Error('备份文件为空');
            }
            const extractedPath = path.join(tempDir, extractedDirs[0]);
            // 恢复文件
            this.logger.debug('恢复文件...');
            const items = fs.readdirSync(extractedPath);
            for (const item of items) {
                const sourcePath = path.join(extractedPath, item);
                const destPath = path.join(openclawDir, item);
                // 备份现有文件
                if (fs.existsSync(destPath)) {
                    const backupName = `${item}.backup-${Date.now()}`;
                    const backupPath = path.join(openclawDir, backupName);
                    this.logger.debug(`备份现有文件: ${item} -> ${backupName}`);
                    fs.renameSync(destPath, backupPath);
                }
                // 恢复文件
                this.logger.debug(`恢复: ${item}`);
                this.copyRecursive(sourcePath, destPath);
            }
            this.logger.success('备份恢复成功');
        }
        finally {
            // 清理临时目录
            if (fs.existsSync(tempDir)) {
                this.removeRecursive(tempDir);
            }
        }
    }
    /**
     * 列出所有备份
     */
    listBackups() {
        const backupDir = this.config.get('backup.dir');
        if (!fs.existsSync(backupDir)) {
            return [];
        }
        const files = fs.readdirSync(backupDir);
        const backups = [];
        for (const file of files) {
            if (!file.endsWith('.tar.gz'))
                continue;
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            // 从文件名解析时间戳
            const match = file.match(/openclaw-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
            const timestamp = match
                ? new Date(match[1].replace(/-/g, ':').replace('T', ' '))
                : stats.mtime;
            backups.push({
                path: filePath,
                timestamp,
                size: stats.size,
                type: 'auto', // 无法从文件名判断，默认为 auto
            });
        }
        // 按时间倒序排序
        backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return backups;
    }
    /**
     * 清理旧备份
     */
    async cleanOldBackups() {
        const maxBackups = this.config.get('backup.max_backups', 10);
        const backups = this.listBackups();
        if (backups.length <= maxBackups) {
            return;
        }
        this.logger.info(`清理旧备份 (保留最新 ${maxBackups} 个)...`);
        const toDelete = backups.slice(maxBackups);
        for (const backup of toDelete) {
            this.logger.debug(`删除旧备份: ${path.basename(backup.path)}`);
            fs.unlinkSync(backup.path);
        }
        this.logger.success(`已删除 ${toDelete.length} 个旧备份`);
    }
    /**
     * 递归复制文件/目录
     */
    copyRecursive(source, dest) {
        const stats = fs.statSync(source);
        if (stats.isDirectory()) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(source);
            for (const file of files) {
                this.copyRecursive(path.join(source, file), path.join(dest, file));
            }
        }
        else {
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(source, dest);
        }
    }
    /**
     * 递归删除目录
     */
    removeRecursive(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return;
        }
        const stats = fs.statSync(dirPath);
        if (stats.isDirectory()) {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                this.removeRecursive(path.join(dirPath, file));
            }
            fs.rmdirSync(dirPath);
        }
        else {
            fs.unlinkSync(dirPath);
        }
    }
    /**
     * 格式化文件大小
     */
    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}
exports.BackupManager = BackupManager;
//# sourceMappingURL=backup.js.map