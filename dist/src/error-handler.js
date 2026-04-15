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
exports.ErrorHandler = void 0;
const fs = __importStar(require("fs"));
const chalk_1 = __importDefault(require("chalk"));
class ErrorHandler {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * 处理文件不存在错误
     */
    handleFileNotFound(filePath, suggestions) {
        this.logger.error(`文件不存在: ${filePath}`);
        console.error(chalk_1.default.red('\n✗ 文件不存在'));
        console.error(chalk_1.default.gray(`  路径: ${filePath}`));
        if (suggestions.length > 0) {
            console.error(chalk_1.default.yellow('\n建议:'));
            suggestions.forEach((suggestion, i) => {
                console.error(chalk_1.default.gray(`  ${i + 1}. ${suggestion}`));
            });
        }
        process.exit(1);
    }
    /**
     * 处理配置错误
     */
    handleConfigError(message, configPath) {
        this.logger.error(`配置错误: ${message}`);
        console.error(chalk_1.default.red('\n✗ 配置错误'));
        console.error(chalk_1.default.gray(`  ${message}`));
        console.error(chalk_1.default.gray(`  配置文件: ${configPath}`));
        console.error(chalk_1.default.yellow('\n建议:'));
        console.error(chalk_1.default.gray('  1. 运行 openclaw-pm config init 重新生成配置'));
        console.error(chalk_1.default.gray('  2. 检查配置文件格式是否正确'));
        console.error(chalk_1.default.gray('  3. 参考文档: docs/configuration.md'));
        process.exit(1);
    }
    /**
     * 处理权限错误
     */
    handlePermissionError(filePath) {
        this.logger.error(`权限不足: ${filePath}`);
        console.error(chalk_1.default.red('\n✗ 权限不足'));
        console.error(chalk_1.default.gray(`  无法访问: ${filePath}`));
        console.error(chalk_1.default.yellow('\n建议:'));
        console.error(chalk_1.default.gray(`  1. 检查文件权限: ls -la ${filePath}`));
        console.error(chalk_1.default.gray(`  2. 使用 sudo 运行（如果需要）`));
        console.error(chalk_1.default.gray(`  3. 修改权限: chmod 644 ${filePath}`));
        process.exit(1);
    }
    /**
     * 处理 OpenClaw 未运行错误
     */
    handleOpenClawNotRunning() {
        this.logger.error('OpenClaw Gateway 未运行');
        console.error(chalk_1.default.red('\n✗ OpenClaw Gateway 未运行'));
        console.error(chalk_1.default.yellow('\n建议:'));
        console.error(chalk_1.default.gray('  1. 启动 Gateway: openclaw gateway start'));
        console.error(chalk_1.default.gray('  2. 检查状态: openclaw gateway status'));
        console.error(chalk_1.default.gray('  3. 查看日志: openclaw gateway logs'));
        process.exit(1);
    }
    /**
     * 处理日志文件错误
     */
    handleLogFileError(logFile) {
        const suggestions = [
            '检查 OpenClaw 是否正在运行',
            '确认日志目录存在且有写入权限',
            `检查配置中的日志路径: ${logFile}`,
            '运行 openclaw gateway logs 查看日志',
        ];
        this.handleFileNotFound(logFile, suggestions);
    }
    /**
     * 处理数据库错误
     */
    handleDatabaseError(error, dbPath) {
        this.logger.error(`数据库错误: ${error.message}`);
        console.error(chalk_1.default.red('\n✗ 数据库错误'));
        console.error(chalk_1.default.gray(`  ${error.message}`));
        console.error(chalk_1.default.gray(`  数据库: ${dbPath}`));
        console.error(chalk_1.default.yellow('\n建议:'));
        console.error(chalk_1.default.gray('  1. 检查数据库文件是否损坏'));
        console.error(chalk_1.default.gray('  2. 尝试删除并重建索引'));
        console.error(chalk_1.default.gray('  3. 检查磁盘空间是否充足'));
        process.exit(1);
    }
    /**
     * 处理通用错误
     */
    handleGenericError(error, context) {
        this.logger.error(`${context.operation} 失败: ${error.message}`);
        console.error(chalk_1.default.red(`\n✗ ${context.operation} 失败`));
        console.error(chalk_1.default.gray(`  ${error.message}`));
        if (context.file) {
            console.error(chalk_1.default.gray(`  文件: ${context.file}`));
        }
        if (context.details) {
            console.error(chalk_1.default.gray('\n详细信息:'));
            Object.entries(context.details).forEach(([key, value]) => {
                console.error(chalk_1.default.gray(`  ${key}: ${value}`));
            });
        }
        if (error.stack) {
            console.error(chalk_1.default.gray('\n堆栈跟踪:'));
            console.error(chalk_1.default.gray(error.stack));
        }
        process.exit(1);
    }
    /**
     * 验证文件存在
     */
    validateFileExists(filePath, suggestions) {
        if (!fs.existsSync(filePath)) {
            this.handleFileNotFound(filePath, suggestions);
        }
    }
    /**
     * 验证目录存在
     */
    validateDirectoryExists(dirPath, autoCreate = false) {
        if (!fs.existsSync(dirPath)) {
            if (autoCreate) {
                try {
                    fs.mkdirSync(dirPath, { recursive: true });
                    this.logger.info(`创建目录: ${dirPath}`);
                }
                catch (error) {
                    this.handleGenericError(error, {
                        operation: '创建目录',
                        file: dirPath,
                    });
                }
            }
            else {
                this.handleFileNotFound(dirPath, [
                    `创建目录: mkdir -p ${dirPath}`,
                    '检查配置中的路径设置',
                ]);
            }
        }
    }
    /**
     * 验证文件可读
     */
    validateFileReadable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
        }
        catch {
            this.handlePermissionError(filePath);
        }
    }
    /**
     * 验证文件可写
     */
    validateFileWritable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.W_OK);
        }
        catch {
            this.handlePermissionError(filePath);
        }
    }
    /**
     * 安全执行操作
     */
    async safeExecute(operation, context) {
        try {
            return await operation();
        }
        catch (error) {
            this.handleGenericError(error, context);
        }
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=error-handler.js.map