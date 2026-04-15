"use strict";
/**
 * OpenClaw PM v4.0.0 - TypeScript Core
 * 配置管理
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
exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ConfigManager {
    constructor(configPath) {
        this.config = null;
        this.configPath = configPath || this.getDefaultConfigPath();
    }
    getDefaultConfigPath() {
        const openclawDir = process.env.OPENCLAW_DIR || path.join(os.homedir(), '.openclaw');
        return path.join(openclawDir, 'pm-config.json');
    }
    /**
     * 加载配置文件
     */
    load() {
        if (this.config) {
            return this.config;
        }
        if (!fs.existsSync(this.configPath)) {
            throw new Error(`配置文件不存在: ${this.configPath}`);
        }
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
        return this.config;
    }
    /**
     * 保存配置文件
     */
    save(config) {
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
        this.config = config;
    }
    /**
     * 获取配置值
     */
    get(key, defaultValue) {
        const config = this.load();
        const keys = key.split('.');
        let value = config;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                return defaultValue;
            }
        }
        return value;
    }
    /**
     * 设置配置值
     */
    set(key, value) {
        const config = this.load();
        const keys = key.split('.');
        let target = config;
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in target)) {
                target[k] = {};
            }
            target = target[k];
        }
        target[keys[keys.length - 1]] = value;
        this.save(config);
    }
    /**
     * 获取完整配置
     */
    getAll() {
        return this.load();
    }
    /**
     * 创建默认配置
     */
    static createDefault(configPath) {
        const openclawDir = process.env.OPENCLAW_DIR || path.join(os.homedir(), '.openclaw');
        const defaultConfig = {
            openclaw: {
                dir: openclawDir,
                gateway_port: 3000,
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
                max_backups: 10,
                backup_dir: path.join(openclawDir, '.backup'),
            },
            notification: {
                enabled: false,
                channels: [],
            },
            cron_tasks: [
                {
                    name: 'gateway-health-check',
                    schedule: '*/5 * * * *',
                    enabled: true,
                },
                {
                    name: 'check-unanswered',
                    schedule: '*/15 * * * *',
                    enabled: true,
                },
                {
                    name: 'morning-briefing',
                    schedule: '0 9 * * *',
                    enabled: true,
                },
                {
                    name: 'daily-stats',
                    schedule: '0 23 * * *',
                    enabled: true,
                },
            ],
        };
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        return defaultConfig;
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config.js.map