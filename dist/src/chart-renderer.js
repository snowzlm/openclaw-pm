"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartRenderer = void 0;
const asciichart_1 = __importDefault(require("asciichart"));
const chalk_1 = __importDefault(require("chalk"));
class ChartRenderer {
    /**
     * 渲染柱状图
     */
    static renderBarChart(data, title) {
        const lines = [];
        if (title) {
            lines.push(chalk_1.default.bold.cyan(`\n${title}`));
            lines.push(chalk_1.default.gray('─'.repeat(title.length)));
        }
        // 找到最大值用于缩放
        const maxValue = Math.max(...data.map((d) => d.value));
        const maxBarWidth = 50;
        data.forEach((item) => {
            const barWidth = Math.round((item.value / maxValue) * maxBarWidth);
            const bar = '█'.repeat(barWidth);
            const colorFn = this.getColorFunction(item.color);
            lines.push(`${item.label.padEnd(20)} ${colorFn(bar)} ${chalk_1.default.bold(item.value.toString())}`);
        });
        return lines.join('\n');
    }
    /**
     * 渲染折线图
     */
    static renderLineChart(data, labels, title, height = 10) {
        const lines = [];
        if (title) {
            lines.push(chalk_1.default.bold.cyan(`\n${title}`));
        }
        // 使用 asciichart 渲染
        const chart = asciichart_1.default.plot(data, {
            height,
            colors: [asciichart_1.default.blue],
        });
        lines.push(chart);
        // 添加标签
        if (labels && labels.length > 0) {
            const labelLine = labels
                .map((label, i) => {
                const pos = Math.floor((i / (labels.length - 1)) * 60);
                return label.padStart(pos);
            })
                .join('');
            lines.push(chalk_1.default.gray(labelLine));
        }
        return lines.join('\n');
    }
    /**
     * 渲染趋势图（简化版）
     */
    static renderTrendChart(current, previous, label) {
        const diff = current - previous;
        const percent = previous === 0 ? 0 : (diff / previous) * 100;
        let arrow = '';
        let colorFn = chalk_1.default.gray;
        if (diff > 0) {
            arrow = '↑';
            colorFn = chalk_1.default.green;
        }
        else if (diff < 0) {
            arrow = '↓';
            colorFn = chalk_1.default.red;
        }
        else {
            arrow = '→';
        }
        return `${label}: ${chalk_1.default.bold(current)} ${colorFn(arrow)} ${colorFn(`${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`)}`;
    }
    /**
     * 渲染进度条
     */
    static renderProgressBar(current, total, label, width = 30) {
        const percent = total === 0 ? 0 : (current / total) * 100;
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;
        const bar = chalk_1.default.green('█'.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
        return `${label.padEnd(20)} [${bar}] ${percent.toFixed(1)}%`;
    }
    /**
     * 渲染分布图
     */
    static renderDistribution(data, title) {
        const lines = [];
        if (title) {
            lines.push(chalk_1.default.bold.cyan(`\n${title}`));
            lines.push(chalk_1.default.gray('─'.repeat(title.length)));
        }
        const total = data.reduce((sum, item) => sum + item.value, 0);
        data.forEach((item) => {
            const percent = total === 0 ? 0 : (item.value / total) * 100;
            const colorFn = this.getColorFunction(item.color);
            lines.push(`${item.label.padEnd(20)} ${colorFn('●')} ${item.value.toString().padStart(6)} (${percent.toFixed(1)}%)`);
        });
        return lines.join('\n');
    }
    /**
     * 获取颜色函数
     */
    static getColorFunction(color) {
        switch (color) {
            case 'red':
                return chalk_1.default.red;
            case 'green':
                return chalk_1.default.green;
            case 'yellow':
                return chalk_1.default.yellow;
            case 'blue':
                return chalk_1.default.blue;
            case 'magenta':
                return chalk_1.default.magenta;
            case 'cyan':
                return chalk_1.default.cyan;
            default:
                return chalk_1.default.white;
        }
    }
    /**
     * 渲染表格
     */
    static renderTable(headers, rows, title) {
        const lines = [];
        if (title) {
            lines.push(chalk_1.default.bold.cyan(`\n${title}`));
        }
        // 计算列宽
        const colWidths = headers.map((header, i) => {
            const maxWidth = Math.max(header.length, ...rows.map((row) => (row[i] || '').length));
            return maxWidth + 2;
        });
        // 渲染表头
        const headerLine = headers
            .map((header, i) => header.padEnd(colWidths[i]))
            .join('│');
        lines.push(chalk_1.default.bold(headerLine));
        lines.push(chalk_1.default.gray('─'.repeat(headerLine.length)));
        // 渲染行
        rows.forEach((row) => {
            const rowLine = row
                .map((cell, i) => cell.padEnd(colWidths[i]))
                .join('│');
            lines.push(rowLine);
        });
        return lines.join('\n');
    }
}
exports.ChartRenderer = ChartRenderer;
//# sourceMappingURL=chart-renderer.js.map