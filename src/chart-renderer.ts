import asciichart from 'asciichart';
import chalk from 'chalk';

export interface ChartData {
  label: string;
  value: number;
  color?: string;
}

export class ChartRenderer {
  /**
   * 渲染柱状图
   */
  static renderBarChart(data: ChartData[], title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push(chalk.bold.cyan(`\n${title}`));
      lines.push(chalk.gray('─'.repeat(title.length)));
    }

    // 找到最大值用于缩放
    const maxValue = Math.max(...data.map((d) => d.value));
    const maxBarWidth = 50;

    data.forEach((item) => {
      const barWidth = Math.round((item.value / maxValue) * maxBarWidth);
      const bar = '█'.repeat(barWidth);
      const colorFn = this.getColorFunction(item.color);

      lines.push(
        `${item.label.padEnd(20)} ${colorFn(bar)} ${chalk.bold(item.value.toString())}`
      );
    });

    return lines.join('\n');
  }

  /**
   * 渲染折线图
   */
  static renderLineChart(
    data: number[],
    labels?: string[],
    title?: string,
    height = 10
  ): string {
    const lines: string[] = [];

    if (title) {
      lines.push(chalk.bold.cyan(`\n${title}`));
    }

    // 使用 asciichart 渲染
    const chart = asciichart.plot(data, {
      height,
      colors: [asciichart.blue],
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
      lines.push(chalk.gray(labelLine));
    }

    return lines.join('\n');
  }

  /**
   * 渲染趋势图（简化版）
   */
  static renderTrendChart(
    current: number,
    previous: number,
    label: string
  ): string {
    const diff = current - previous;
    const percent = previous === 0 ? 0 : (diff / previous) * 100;

    let arrow = '';
    let colorFn = chalk.gray;

    if (diff > 0) {
      arrow = '↑';
      colorFn = chalk.green;
    } else if (diff < 0) {
      arrow = '↓';
      colorFn = chalk.red;
    } else {
      arrow = '→';
    }

    return `${label}: ${chalk.bold(current)} ${colorFn(arrow)} ${colorFn(
      `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`
    )}`;
  }

  /**
   * 渲染进度条
   */
  static renderProgressBar(
    current: number,
    total: number,
    label: string,
    width = 30
  ): string {
    const percent = total === 0 ? 0 : (current / total) * 100;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

    return `${label.padEnd(20)} [${bar}] ${percent.toFixed(1)}%`;
  }

  /**
   * 渲染分布图
   */
  static renderDistribution(data: ChartData[], title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push(chalk.bold.cyan(`\n${title}`));
      lines.push(chalk.gray('─'.repeat(title.length)));
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);

    data.forEach((item) => {
      const percent = total === 0 ? 0 : (item.value / total) * 100;
      const colorFn = this.getColorFunction(item.color);

      lines.push(
        `${item.label.padEnd(20)} ${colorFn('●')} ${item.value.toString().padStart(6)} (${percent.toFixed(1)}%)`
      );
    });

    return lines.join('\n');
  }

  /**
   * 获取颜色函数
   */
  private static getColorFunction(color?: string): (text: string) => string {
    switch (color) {
      case 'red':
        return chalk.red;
      case 'green':
        return chalk.green;
      case 'yellow':
        return chalk.yellow;
      case 'blue':
        return chalk.blue;
      case 'magenta':
        return chalk.magenta;
      case 'cyan':
        return chalk.cyan;
      default:
        return chalk.white;
    }
  }

  /**
   * 渲染表格
   */
  static renderTable(
    headers: string[],
    rows: string[][],
    title?: string
  ): string {
    const lines: string[] = [];

    if (title) {
      lines.push(chalk.bold.cyan(`\n${title}`));
    }

    // 计算列宽
    const colWidths = headers.map((header, i) => {
      const maxWidth = Math.max(
        header.length,
        ...rows.map((row) => (row[i] || '').length)
      );
      return maxWidth + 2;
    });

    // 渲染表头
    const headerLine = headers
      .map((header, i) => header.padEnd(colWidths[i]))
      .join('│');
    lines.push(chalk.bold(headerLine));
    lines.push(chalk.gray('─'.repeat(headerLine.length)));

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
