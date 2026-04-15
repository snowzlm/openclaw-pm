export interface ChartData {
    label: string;
    value: number;
    color?: string;
}
export declare class ChartRenderer {
    /**
     * 渲染柱状图
     */
    static renderBarChart(data: ChartData[], title?: string): string;
    /**
     * 渲染折线图
     */
    static renderLineChart(data: number[], labels?: string[], title?: string, height?: number): string;
    /**
     * 渲染趋势图（简化版）
     */
    static renderTrendChart(current: number, previous: number, label: string): string;
    /**
     * 渲染进度条
     */
    static renderProgressBar(current: number, total: number, label: string, width?: number): string;
    /**
     * 渲染分布图
     */
    static renderDistribution(data: ChartData[], title?: string): string;
    /**
     * 获取颜色函数
     */
    private static getColorFunction;
    /**
     * 渲染表格
     */
    static renderTable(headers: string[], rows: string[][], title?: string): string;
}
//# sourceMappingURL=chart-renderer.d.ts.map