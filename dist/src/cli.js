#!/usr/bin/env node
"use strict";
/**
 * OpenClaw PM v4.2.0 - TypeScript Core
 * 命令行接口
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
const commander_1 = require("commander");
const config_1 = require("./config");
const logger_1 = require("./logger");
const health_checker_1 = require("./health-checker");
const backup_1 = require("./backup");
const unanswered_checker_1 = require("./unanswered-checker");
const stats_generator_1 = require("./stats-generator");
const config_initializer_1 = require("./config-initializer");
const chart_renderer_1 = require("./chart-renderer");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const program = new commander_1.Command();
program.name('openclaw-pm').description('OpenClaw 项目管理工具 v5.0.0').version('5.0.0');
// 全局选项
program
    .option('-c, --config <path>', '配置文件路径')
    .option('-v, --verbose', '详细输出')
    .option('--debug', '调试模式');
// 健康检查命令
program
    .command('health')
    .description('执行 Gateway 健康检查')
    .option('-j, --json', '输出 JSON 格式')
    .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const checker = new health_checker_1.GatewayHealthChecker(config, logger);
    try {
        const result = await checker.check();
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            printHealthResult(result);
        }
        process.exit(result.status === 'healthy' ? 0 : 1);
    }
    catch (error) {
        logger.error('健康检查失败', error);
        process.exit(1);
    }
});
// 备份命令
program
    .command('backup')
    .description('创建备份')
    .option('-t, --type <type>', '备份类型 (auto|manual)', 'manual')
    .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const backupManager = new backup_1.BackupManager(config, logger);
    try {
        const backup = await backupManager.createBackup(options.type);
        logger.success(`备份已创建: ${backup.path}`);
        process.exit(0);
    }
    catch (error) {
        logger.error('备份失败', error);
        process.exit(1);
    }
});
// 恢复命令
program
    .command('restore <backup>')
    .description('恢复备份')
    .action(async (backupPath) => {
    const { config, logger } = initializeApp(program.opts());
    const backupManager = new backup_1.BackupManager(config, logger);
    try {
        await backupManager.restoreBackup(backupPath);
        logger.success('备份已恢复');
        process.exit(0);
    }
    catch (error) {
        logger.error('恢复失败', error);
        process.exit(1);
    }
});
// 列出备份
program
    .command('backups')
    .description('列出所有备份')
    .action(() => {
    const { config, logger } = initializeApp(program.opts());
    const backupManager = new backup_1.BackupManager(config, logger);
    try {
        const backups = backupManager.listBackups();
        if (backups.length === 0) {
            console.log(chalk_1.default.yellow('没有找到备份'));
            process.exit(0);
        }
        console.log(chalk_1.default.bold('\n可用备份:\n'));
        for (const backup of backups) {
            const size = formatSize(backup.size);
            const date = backup.timestamp.toLocaleString();
            console.log(`  ${chalk_1.default.cyan(date)} - ${size} - ${backup.path}`);
        }
        console.log();
        process.exit(0);
    }
    catch (error) {
        logger.error('列出备份失败', error);
        process.exit(1);
    }
});
// 配置命令
const configCmd = program
    .command('config')
    .description('配置管理');
configCmd
    .command('show')
    .description('显示当前配置')
    .action(() => {
    const { config } = initializeApp(program.opts());
    try {
        const configData = config.getAll();
        console.log(JSON.stringify(configData, null, 2));
        process.exit(0);
    }
    catch (error) {
        console.error(chalk_1.default.red('读取配置失败:'), error);
        process.exit(1);
    }
});
configCmd
    .command('init')
    .description('初始化配置文件')
    .option('-i, --interactive', '交互式配置')
    .option('-f, --force', '强制覆盖已有配置')
    .action(async (options) => {
    const { logger } = initializeApp(program.opts());
    const initializer = new config_initializer_1.ConfigInitializer(logger);
    const configPath = program.opts().config || '/root/.openclaw/pm-config.json';
    try {
        await initializer.initConfig(configPath, {
            interactive: options.interactive,
            force: options.force,
        });
        process.exit(0);
    }
    catch (error) {
        logger.error('初始化配置失败', error);
        process.exit(1);
    }
});
configCmd
    .command('validate')
    .description('验证配置文件')
    .action(() => {
    const { logger } = initializeApp(program.opts());
    const initializer = new config_initializer_1.ConfigInitializer(logger);
    const configPath = program.opts().config || '/root/.openclaw/pm-config.json';
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const result = initializer.validateConfig(config);
        if (result.valid) {
            console.log(chalk_1.default.green('✓ 配置文件有效'));
            process.exit(0);
        }
        else {
            console.log(chalk_1.default.red('✗ 配置文件无效'));
            result.errors.forEach((error) => {
                console.log(chalk_1.default.gray(`  - ${error}`));
            });
            process.exit(1);
        }
    }
    catch (error) {
        logger.error('验证配置失败', error);
        process.exit(1);
    }
});
// 检查未回复消息命令
program
    .command('check-unanswered')
    .description('检查未回复的用户消息')
    .option('-j, --json', '输出 JSON 格式')
    .option('-a, --all', '包括旧 session（默认只检查 24h 内活跃的）')
    .option('--agent <id>', '只检查指定 agent')
    .option('--recover', '自动发送恢复消息')
    .option('--max-age <hours>', '最大 session 年龄（小时）', '24')
    .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const checker = new unanswered_checker_1.UnansweredChecker(config, logger);
    try {
        const result = await checker.check({
            includeOld: options.all,
            maxAgeHours: parseInt(options.maxAge, 10),
            agentFilter: options.agent,
            autoRecover: options.recover,
        });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            printUnansweredResult(result);
        }
        process.exit(result.count > 0 ? 1 : 0);
    }
    catch (error) {
        logger.error('检查未回复消息失败', error);
        process.exit(1);
    }
});
// 每日统计命令
program
    .command('daily-stats [date]')
    .description('生成每日活动统计')
    .option('-j, --json', '输出 JSON 格式')
    .option('--chart', '显示图表')
    .action(async (date, options) => {
    const { config, logger } = initializeApp(program.opts());
    const generator = new stats_generator_1.StatsGenerator(config, logger);
    try {
        const stats = await generator.generateDailyStats(date);
        if (options.json) {
            console.log(JSON.stringify(stats, null, 2));
        }
        else {
            printDailyStats(stats, options.chart);
        }
        process.exit(0);
    }
    catch (error) {
        logger.error('统计失败', error);
        process.exit(1);
    }
});
// 晨间简报命令
program
    .command('morning-briefing')
    .description('生成晨间简报')
    .option('-j, --json', '输出 JSON 格式')
    .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const generator = new stats_generator_1.StatsGenerator(config, logger);
    try {
        const briefing = await generator.generateMorningBriefing();
        if (options.json) {
            console.log(JSON.stringify(briefing, null, 2));
        }
        else {
            printMorningBriefing(briefing);
        }
        process.exit(0);
    }
    catch (error) {
        logger.error('简报生成失败', error);
        process.exit(1);
    }
});
// 心跳检查命令
program
    .command('heartbeat')
    .description('执行心跳检查')
    .option('-j, --json', '输出 JSON 格式')
    .action(async (options) => {
    const { config, logger } = initializeApp(program.opts());
    const generator = new stats_generator_1.StatsGenerator(config, logger);
    try {
        const result = await generator.performHeartbeatCheck();
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            printHeartbeatResult(result);
        }
        process.exit(result.allPassed ? 0 : 1);
    }
    catch (error) {
        logger.error('心跳检查失败', error);
        process.exit(1);
    }
});
// 初始化应用
function initializeApp(options) {
    const logLevel = options.debug ? logger_1.LogLevel.DEBUG : options.verbose ? logger_1.LogLevel.INFO : logger_1.LogLevel.WARN;
    const logger = new logger_1.Logger({
        level: logLevel,
        enableConsole: true,
        enableFile: false,
    });
    const config = new config_1.ConfigManager(options.config);
    return { config, logger };
}
// 打印健康检查结果
function printHealthResult(result) {
    console.log();
    console.log(chalk_1.default.bold('=== OpenClaw Gateway 健康检查 ==='));
    console.log();
    // 状态
    const statusColor = result.status === 'healthy'
        ? chalk_1.default.green
        : result.status === 'warning'
            ? chalk_1.default.yellow
            : chalk_1.default.red;
    console.log(`状态: ${statusColor(result.status.toUpperCase())}`);
    console.log(`评分: ${result.score}/100`);
    console.log(`时间: ${new Date(result.timestamp).toLocaleString()}`);
    console.log();
    // 检查项
    console.log(chalk_1.default.bold('检查项:'));
    for (const [name, check] of Object.entries(result.checks)) {
        const statusIcon = check.status === 'ok'
            ? chalk_1.default.green('✓')
            : check.status === 'warning'
                ? chalk_1.default.yellow('⚠')
                : chalk_1.default.red('✗');
        console.log(`  ${statusIcon} ${name}: ${check.message}`);
    }
    console.log();
    // 问题
    if (result.issues.length > 0) {
        console.log(chalk_1.default.bold('发现的问题:'));
        for (const issue of result.issues) {
            const severityColor = issue.severity === 'critical'
                ? chalk_1.default.red
                : issue.severity === 'error'
                    ? chalk_1.default.red
                    : issue.severity === 'warning'
                        ? chalk_1.default.yellow
                        : chalk_1.default.blue;
            console.log(`  ${severityColor('●')} [${issue.category}] ${issue.message}`);
        }
        console.log();
    }
}
// 打印未回复消息检查结果
function printUnansweredResult(result) {
    console.log();
    console.log(chalk_1.default.bold('=== 未回复消息检查 ==='));
    console.log();
    console.log(`未回复会话数: ${result.count}`);
    console.log();
    if (result.unanswered.length === 0) {
        console.log(chalk_1.default.green('✓ 没有发现未回复的消息'));
        return;
    }
    console.log(chalk_1.default.bold('未回复的会话:'));
    for (const session of result.unanswered) {
        console.log();
        console.log(chalk_1.default.cyan(`  Session: ${session.sessionKey}`));
        console.log(chalk_1.default.blue(`  时间: ${session.timestamp}`));
        if (session.preview) {
            console.log(chalk_1.default.blue(`  预览: ${session.preview}...`));
        }
    }
    console.log();
    if (result.recovered && result.recovered > 0) {
        console.log(chalk_1.default.green(`✓ 成功恢复 ${result.recovered} 个会话`));
    }
    if (result.failed && result.failed > 0) {
        console.log(chalk_1.default.red(`✗ 恢复失败 ${result.failed} 个会话`));
    }
    if (!result.recovered && !result.failed) {
        console.log(chalk_1.default.yellow('提示: 使用 --recover 自动发送恢复通知'));
    }
}
// 打印每日统计结果
function printDailyStats(stats, showChart = false) {
    console.log();
    console.log(chalk_1.default.bold('=== 每日活动统计 ==='));
    console.log(`日期: ${stats.date}`);
    console.log();
    // 基本统计
    console.log(chalk_1.default.bold('📊 基本统计'));
    console.log(`  📨 消息接收: ${stats.messages.received} 条`);
    console.log(`  📤 消息发送: ${stats.messages.sent} 条`);
    console.log(`  💬 活跃会话: ${stats.messages.activeSessions} 个`);
    console.log();
    // 小时分布
    if (stats.hourlyDistribution && stats.hourlyDistribution.length > 0) {
        console.log(chalk_1.default.bold('⏰ 按小时分布'));
        if (showChart) {
            // 使用图表展示
            const chartData = stats.hourlyDistribution.map((h) => ({
                label: `${h.hour.toString().padStart(2, '0')}:00`,
                value: h.count,
                color: h.count > 10 ? 'green' : h.count > 5 ? 'yellow' : 'gray'
            }));
            console.log(chart_renderer_1.ChartRenderer.renderBarChart(chartData));
        }
        else {
            // 传统文本展示
            for (const h of stats.hourlyDistribution) {
                const bar = '█'.repeat(Math.ceil(h.count / 5));
                console.log(`  ${h.hour.toString().padStart(2, '0')}:00 - ${h.hour.toString().padStart(2, '0')}:59  ${bar} (${h.count})`);
            }
        }
        console.log();
    }
    // 错误分析
    console.log(chalk_1.default.bold('❌ 错误分析'));
    if (stats.errors.total === 0) {
        console.log(chalk_1.default.green('  ✓ 无错误记录'));
    }
    else {
        console.log(`  总错误数: ${stats.errors.total}`);
        if (showChart) {
            // 使用分布图展示错误类型
            const errorData = [
                { label: 'Failover', value: stats.errors.failover, color: 'red' },
                { label: 'Timeout', value: stats.errors.timeout, color: 'yellow' },
                { label: 'Connection', value: stats.errors.connection, color: 'magenta' }
            ].filter(e => e.value > 0);
            if (errorData.length > 0) {
                console.log(chart_renderer_1.ChartRenderer.renderDistribution(errorData, '错误类型分布'));
            }
        }
        else {
            console.log('  错误类型:');
            if (stats.errors.failover > 0)
                console.log(`    - Failover 错误: ${stats.errors.failover}`);
            if (stats.errors.timeout > 0)
                console.log(`    - 超时错误: ${stats.errors.timeout}`);
            if (stats.errors.connection > 0)
                console.log(`    - 连接错误: ${stats.errors.connection}`);
        }
        if (stats.errors.recent.length > 0) {
            console.log('  最近错误:');
            stats.errors.recent.forEach((e) => console.log(`    ${e}`));
        }
    }
    console.log();
    // Gateway 状态
    console.log(chalk_1.default.bold('🔧 Gateway 状态'));
    if (stats.gateway.starts === 0) {
        console.log('  无 Gateway 启动记录');
    }
    else {
        console.log(`  启动次数: ${stats.gateway.starts}`);
        stats.gateway.startTimes.forEach((t) => console.log(`    - ${t}`));
    }
    if (stats.gateway.stops > 0)
        console.log(`  停止次数: ${stats.gateway.stops}`);
    console.log();
    // 频道统计
    if (showChart && (stats.channels.telegram > 0 || stats.channels.discord > 0 || stats.channels.slack > 0)) {
        const channelData = [
            { label: 'Telegram', value: stats.channels.telegram, color: 'blue' },
            { label: 'Discord', value: stats.channels.discord, color: 'cyan' },
            { label: 'Slack', value: stats.channels.slack, color: 'green' },
            { label: 'Other', value: stats.channels.other, color: 'gray' }
        ].filter(c => c.value > 0);
        console.log(chart_renderer_1.ChartRenderer.renderDistribution(channelData, '📡 频道分布'));
        console.log();
    }
    // 总结
    console.log(chalk_1.default.bold('📝 总结'));
    const scoreColor = stats.health.score >= 90 ? chalk_1.default.green : stats.health.score >= 70 ? chalk_1.default.yellow : chalk_1.default.red;
    console.log(`  健康分数: ${scoreColor(stats.health.score + '/100')}`);
    console.log(`  活跃度: ${stats.health.activity}`);
    console.log(`  稳定性: ${stats.health.stability}`);
    console.log();
}
// 打印晨间简报
function printMorningBriefing(briefing) {
    console.log();
    console.log(chalk_1.default.bold('=== ☀️  OpenClaw 晨间简报 ==='));
    console.log(`时间: ${new Date(briefing.timestamp).toLocaleString('zh-CN')}`);
    console.log();
    // 系统健康状态
    console.log(chalk_1.default.bold('📊 系统健康状态'));
    if (briefing.system.gatewayRunning) {
        console.log(chalk_1.default.green(`  ✓ Gateway 运行中 (PID: ${briefing.system.gatewayPid})`));
    }
    else {
        console.log(chalk_1.default.red('  ✗ Gateway 未运行'));
    }
    if (briefing.system.lockFiles === 0) {
        console.log(chalk_1.default.green('  ✓ 无 session lock 文件'));
    }
    else {
        console.log(chalk_1.default.yellow(`  ⚠ ${briefing.system.lockFiles} 个 session lock 文件`));
    }
    if (briefing.system.diskUsage) {
        const diskColor = briefing.system.diskUsage > 80 ? chalk_1.default.yellow : chalk_1.default.green;
        console.log(diskColor(`  磁盘使用率: ${briefing.system.diskUsage}%`));
    }
    console.log();
    // 昨夜活动摘要
    console.log(chalk_1.default.bold(`🌙 昨夜活动摘要 (${briefing.yesterday.date})`));
    console.log(`  📨 消息: 收到 ${briefing.yesterday.messagesReceived} 条, 发送 ${briefing.yesterday.messagesSent} 条`);
    if (briefing.yesterday.restarts > 0) {
        console.log(chalk_1.default.yellow(`  ⚠ Gateway 重启: ${briefing.yesterday.restarts} 次`));
    }
    if (briefing.yesterday.errors === 0) {
        console.log(chalk_1.default.green('  ✓ 无错误'));
    }
    else {
        console.log(chalk_1.default.red(`  ✗ 错误: ${briefing.yesterday.errors} 次`));
        if (briefing.yesterday.lastError) {
            console.log(`     最后错误: ${briefing.yesterday.lastError}`);
        }
    }
    console.log();
    // Cron 任务状态
    console.log(chalk_1.default.bold('⏰ Cron 任务状态'));
    if (briefing.cron.missedCount === 0) {
        console.log(chalk_1.default.green(`  ✓ 所有关键任务已执行 (${briefing.cron.okCount} 个)`));
    }
    else {
        console.log(chalk_1.default.yellow(`  ⚠ ${briefing.cron.missedCount} 个任务未执行:`));
        briefing.cron.missedTasks.forEach((t) => console.log(`     - ${t}`));
    }
    console.log();
    // 待办事项
    console.log(chalk_1.default.bold('📝 待办事项'));
    if (briefing.todos.inProgress.length === 0) {
        console.log(chalk_1.default.green('  ✓ 无进行中任务'));
    }
    else {
        console.log(chalk_1.default.yellow('  ⚠ 发现进行中任务:'));
        briefing.todos.inProgress.forEach((t) => console.log(`     - ${t}`));
    }
    console.log();
    // 今日建议
    console.log(chalk_1.default.bold('💡 今日建议'));
    if (briefing.suggestions.length === 0) {
        console.log(chalk_1.default.green('  ✓ 一切正常，无需特别关注'));
    }
    else {
        briefing.suggestions.forEach((s) => console.log(chalk_1.default.yellow(`  → ${s}`)));
    }
    console.log();
}
// 打印心跳检查结果
function printHeartbeatResult(result) {
    console.log();
    console.log(chalk_1.default.bold('=== 💓 Heartbeat Check ==='));
    console.log(`时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}`);
    console.log();
    const statusIcon = result.allPassed ? chalk_1.default.green('✓') : chalk_1.default.red('✗');
    console.log(`状态: ${statusIcon} ${result.allPassed ? '正常' : '异常'}`);
    console.log();
    console.log(chalk_1.default.bold('检查项:'));
    const checks = [
        { name: 'Context Health', data: result.checks.contextHealth },
        { name: '进行中任务', data: result.checks.inProgressTasks },
        { name: 'Cron 任务', data: result.checks.cronTasks },
    ];
    checks.forEach((check, i) => {
        const icon = check.data.status === 'ok'
            ? chalk_1.default.green('✓')
            : check.data.status === 'warning'
                ? chalk_1.default.yellow('⚠')
                : chalk_1.default.red('✗');
        console.log(`  [${i + 1}/3] ${check.name}`);
        console.log(`    ${icon} ${check.data.message}`);
    });
    console.log();
}
// 格式化文件大小
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
// 解析命令行参数
program.parse();
//# sourceMappingURL=cli.js.map