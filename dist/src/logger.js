"use strict";
/**
 * OpenClaw PM - TypeScript Core
 * 日志管理
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(options = {}) {
        this.level = options.level ?? LogLevel.INFO;
        this.logFile = options.logFile;
        this.enableConsole = options.enableConsole ?? true;
        this.enableFile = options.enableFile ?? false;
        if (this.enableFile && this.logFile) {
            const dir = path.dirname(this.logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }
    writeToFile(message) {
        if (this.enableFile && this.logFile) {
            fs.appendFileSync(this.logFile, message + '\n', 'utf-8');
        }
    }
    debug(message) {
        if (this.level <= LogLevel.DEBUG) {
            const formatted = this.formatMessage('DEBUG', message);
            if (this.enableConsole) {
                console.log(chalk_1.default.gray(formatted));
            }
            this.writeToFile(formatted);
        }
    }
    info(message) {
        if (this.level <= LogLevel.INFO) {
            const formatted = this.formatMessage('INFO', message);
            if (this.enableConsole) {
                console.log(chalk_1.default.blue(formatted));
            }
            this.writeToFile(formatted);
        }
    }
    warn(message) {
        if (this.level <= LogLevel.WARN) {
            const formatted = this.formatMessage('WARN', message);
            if (this.enableConsole) {
                console.log(chalk_1.default.yellow(formatted));
            }
            this.writeToFile(formatted);
        }
    }
    error(message, error) {
        if (this.level <= LogLevel.ERROR) {
            const formatted = this.formatMessage('ERROR', message);
            if (this.enableConsole) {
                console.log(chalk_1.default.red(formatted));
                if (error) {
                    console.log(chalk_1.default.red(error.stack || error.message));
                }
            }
            this.writeToFile(formatted);
            if (error) {
                this.writeToFile(error.stack || error.message);
            }
        }
    }
    success(message) {
        const formatted = this.formatMessage('SUCCESS', message);
        if (this.enableConsole) {
            console.log(chalk_1.default.green(formatted));
        }
        this.writeToFile(formatted);
    }
}
exports.Logger = Logger;
// 全局 Logger 实例
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map