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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigInitializer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("./config");
class ConfigInitializer {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * 初始化配置文件
     */
    async initConfig(configPath, options = {}) {
        // 检查配置文件是否已存在
        if (fs.existsSync(configPath) && !options.force) {
            console.log(chalk_1.default.yellow('⚠ 配置文件已存在'));
            console.log(chalk_1.default.gray(`  路径: ${configPath}`));
            console.log(chalk_1.default.gray('  使用 --force 参数强制覆盖'));
            return;
        }
        let config;
        if (options.interactive) {
            config = await this.interactiveConfig();
        }
        else {
            config = this.getDefaultConfig();
        }
        // 写入配置文件
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(chalk_1.default.green('✓ 配置文件已创建'));
        console.log(chalk_1.default.gray(`  路径: ${configPath}`));
        this.logger.success(`配置文件已创建: ${configPath}`);
    }
    /**
     * 交互式配置
     */
    async interactiveConfig() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const question = (prompt) => {
            return new Promise((resolve) => {
                rl.question(prompt, resolve);
            });
        };
        console.log(chalk_1.default.bold.cyan('\n📝 OpenClaw PM 配置向导\n'));
        const detectedOpenClawDir = (0, config_1.detectOpenClawDir)();
        const detectedSessionsDir = (0, config_1.getDefaultSessionsDir)(detectedOpenClawDir);
        const detectedBackupDir = (0, config_1.getDefaultBackupDir)(detectedOpenClawDir);
        // OpenClaw 目录
        const openclawDir = await question(chalk_1.default.cyan(`OpenClaw 数据目录 [${detectedOpenClawDir}]: `));
        // Sessions 目录
        const sessionsDir = await question(chalk_1.default.cyan(`Sessions 目录 [${detectedSessionsDir}]: `));
        // Gateway 端口
        const gatewayPort = await question(chalk_1.default.cyan('Gateway 端口 [3000]: '));
        // 备份目录
        const backupDir = await question(chalk_1.default.cyan(`备份目录 [${detectedBackupDir}]: `));
        // 最大备份数
        const maxBackups = await question(chalk_1.default.cyan('最大备份数 [10]: '));
        rl.close();
        return this.buildConfig(openclawDir || detectedOpenClawDir, sessionsDir || detectedSessionsDir, backupDir || detectedBackupDir, parseInt(gatewayPort) || 3000, parseInt(maxBackups) || 10);
    }
    /**
     * 获取默认配置
     */
    getDefaultConfig() {
        const openclawDir = (0, config_1.detectOpenClawDir)();
        return this.buildConfig(openclawDir, (0, config_1.getDefaultSessionsDir)(openclawDir), (0, config_1.getDefaultBackupDir)(openclawDir), 3000, 10);
    }
    buildConfig(openclawDir, sessionsDir, backupDir, gatewayPort, maxBackups) {
        return {
            openclaw: {
                dir: openclawDir,
                sessions_dir: sessionsDir,
                queue_dir: path.join(openclawDir, 'queue'),
                logs_dir: path.join(openclawDir, 'logs'),
                workspace_dir: (0, config_1.getDefaultWorkspaceDir)(openclawDir),
                gateway_port: gatewayPort,
                gateway_timeout: 30,
            },
            health_check: {
                interval_minutes: 5,
                max_lock_age_hours: 1,
                max_queue_age_hours: 2,
                provider_error_threshold: 10,
            },
            backup: {
                enabled: true,
                max_backups: maxBackups,
                backup_dir: backupDir,
                dir: backupDir,
            },
            notification: {
                enabled: false,
                channels: [],
            },
            cron_tasks: [
                { name: 'gateway-health-check', schedule: '*/5 * * * *', enabled: true },
                { name: 'check-unanswered', schedule: '*/15 * * * *', enabled: true },
                { name: 'morning-briefing', schedule: '0 9 * * *', enabled: true },
                { name: 'daily-stats', schedule: '0 23 * * *', enabled: true },
            ],
        };
    }
    /**
     * 验证配置
     */
    validateConfig(config) {
        const errors = [];
        // 验证 openclaw 配置
        if (!config.openclaw || typeof config.openclaw !== 'object') {
            errors.push('缺少 openclaw 配置');
        }
        else {
            const openclaw = config.openclaw;
            if (!openclaw.dir || typeof openclaw.dir !== 'string') {
                errors.push('openclaw.dir 必须是字符串');
            }
            if (!openclaw.sessions_dir || typeof openclaw.sessions_dir !== 'string') {
                errors.push('openclaw.sessions_dir 必须是字符串');
            }
            if (!openclaw.queue_dir || typeof openclaw.queue_dir !== 'string') {
                errors.push('openclaw.queue_dir 必须是字符串');
            }
            if (!openclaw.logs_dir || typeof openclaw.logs_dir !== 'string') {
                errors.push('openclaw.logs_dir 必须是字符串');
            }
            if (!openclaw.workspace_dir || typeof openclaw.workspace_dir !== 'string') {
                errors.push('openclaw.workspace_dir 必须是字符串');
            }
            if (!openclaw.gateway_port || typeof openclaw.gateway_port !== 'number') {
                errors.push('openclaw.gateway_port 必须是数字');
            }
            if (typeof openclaw.gateway_timeout !== 'number') {
                errors.push('openclaw.gateway_timeout 必须是数字');
            }
        }
        if (!config.health_check || typeof config.health_check !== 'object') {
            errors.push('缺少 health_check 配置');
        }
        else {
            const healthCheck = config.health_check;
            if (typeof healthCheck.interval_minutes !== 'number') {
                errors.push('health_check.interval_minutes 必须是数字');
            }
            if (typeof healthCheck.max_lock_age_hours !== 'number') {
                errors.push('health_check.max_lock_age_hours 必须是数字');
            }
            if (typeof healthCheck.max_queue_age_hours !== 'number') {
                errors.push('health_check.max_queue_age_hours 必须是数字');
            }
            if (typeof healthCheck.provider_error_threshold !== 'number') {
                errors.push('health_check.provider_error_threshold 必须是数字');
            }
        }
        // 验证 backup 配置
        if (!config.backup || typeof config.backup !== 'object') {
            errors.push('缺少 backup 配置');
        }
        else {
            const backup = config.backup;
            if (typeof backup.enabled !== 'boolean') {
                errors.push('backup.enabled 必须是布尔值');
            }
            const backupDir = backup.backup_dir ?? backup.dir;
            if (!backupDir || typeof backupDir !== 'string') {
                errors.push('backup.backup_dir 必须是字符串');
            }
            if (!backup.max_backups || typeof backup.max_backups !== 'number') {
                errors.push('backup.max_backups 必须是数字');
            }
        }
        if (!config.notification || typeof config.notification !== 'object') {
            errors.push('缺少 notification 配置');
        }
        if (!Array.isArray(config.cron_tasks)) {
            errors.push('cron_tasks 必须是数组');
        }
        else {
            config.cron_tasks.forEach((task, index) => {
                const cronTask = task;
                if (typeof cronTask.name !== 'string') {
                    errors.push(`cron_tasks[${index}].name 必须是字符串`);
                }
                if (typeof cronTask.schedule !== 'string') {
                    errors.push(`cron_tasks[${index}].schedule 必须是字符串`);
                }
                if (typeof cronTask.enabled !== 'boolean') {
                    errors.push(`cron_tasks[${index}].enabled 必须是布尔值`);
                }
            });
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * 修复配置
     */
    repairConfig(config) {
        const defaultConfig = this.getDefaultConfig();
        // 深度合并配置
        const mergeDeep = (target, source) => {
            const result = { ...target };
            for (const key in source) {
                if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = mergeDeep(result[key] || {}, source[key]);
                }
                else if (result[key] === undefined) {
                    result[key] = source[key];
                }
            }
            return result;
        };
        return mergeDeep(config, defaultConfig);
    }
    /**
     * 自动检测配置
     */
    autoDetectConfig() {
        const openclawDir = (0, config_1.detectOpenClawDir)();
        // 检测 sessions 目录
        let sessionsDir = (0, config_1.getDefaultSessionsDir)(openclawDir);
        if (!fs.existsSync(sessionsDir)) {
            // 尝试其他可能的路径
            const alternatives = [
                path.join(openclawDir, 'sessions'),
                path.join(openclawDir, 'data', 'sessions'),
            ];
            for (const alt of alternatives) {
                if (fs.existsSync(alt)) {
                    sessionsDir = alt;
                    break;
                }
            }
        }
        return this.buildConfig(openclawDir, sessionsDir, (0, config_1.getDefaultBackupDir)(openclawDir), 3000, 10);
    }
}
exports.ConfigInitializer = ConfigInitializer;
//# sourceMappingURL=config-initializer.js.map