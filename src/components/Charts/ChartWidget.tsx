import React, { useRef, useState } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { Input, Button, Segmented, InputNumber, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { echarts } from '@/lib/echarts';
import styles from './ChartWidget.module.css';

interface ChartWidgetProps {
    isEn: boolean;
    onAdd: (chartDataUrl: string) => Promise<void> | void;
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({ isEn, onAdd }) => {
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
    const [chartTitle, setChartTitle] = useState('示例图表');
    const [themeColor, setThemeColor] = useState<string>('#6B8068'); // Default Sage Green
    const [isChartReady, setIsChartReady] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const chartInstanceRef = useRef<EChartsInstance | null>(null);
    const [dataPoints, setDataPoints] = useState([
        { label: '一月', value: 120 },
        { label: '二月', value: 200 },
        { label: '三月', value: 150 },
        { label: '四月', value: 80 },
        { label: '五月', value: 170 },
    ]);

    const colors = [
        '#6B8068', // Sage Green
        '#8B795E', // Warm Taupe
        '#C2A38F', // Terracotta Light
        '#8EB4B1', // Misty Aqua
        '#B4A29A', // Mushroom
        '#D08C60', // Soft Orange
        '#7B8C78', // Deeper Sage
        '#E0C5A8', // Sand
    ];

    const getChartOption = () => {
        const labels = dataPoints.map((d) => d.label);
        const values = dataPoints.map((d) => d.value);

        if (chartType === 'pie') {
            return {
                title: {
                    text: chartTitle,
                    left: 'center',
                    textStyle: { fontFamily: 'Inter, sans-serif' },
                },
                tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)',
                },
                series: [
                    {
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: false,
                        itemStyle: {
                            borderRadius: 8,
                            borderColor: '#fff',
                            borderWidth: 2,
                        },
                        label: {
                            show: true,
                            position: 'outside',
                        },
                        data: dataPoints.map((d, i) => ({
                            value: d.value,
                            name: d.label,
                            itemStyle: { color: colors[i % colors.length] },
                        })),
                    },
                ],
            };
        }

        return {
            title: {
                text: chartTitle,
                left: 'center',
                textStyle: { fontFamily: 'Inter, sans-serif' },
            },
            tooltip: {
                trigger: 'axis',
            },
            xAxis: {
                type: 'category',
                data: labels,
            },
            yAxis: {
                type: 'value',
            },
            series: [
                {
                    type: chartType,
                    data: values,
                    itemStyle: {
                        color: themeColor,
                        borderRadius: chartType === 'bar' ? [8, 8, 0, 0] : 0,
                    },
                    smooth: chartType === 'line',
                    areaStyle: chartType === 'line' ? {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: `${themeColor}66` }, // 40% opacity
                                { offset: 1, color: `${themeColor}00` }, // 0% opacity
                            ],
                        },
                    } : undefined,
                },
            ],
        };
    };

    const addDataPoint = () => {
        setDataPoints([...dataPoints, { label: `项目${dataPoints.length + 1}`, value: 100 }]);
    };

    const removeDataPoint = (index: number) => {
        setDataPoints(dataPoints.filter((_, i) => i !== index));
    };

    const updateDataPoint = (index: number, field: 'label' | 'value', value: string | number) => {
        const newData = [...dataPoints];
        newData[index] = { ...newData[index], [field]: value };
        setDataPoints(newData);
    };

    const handleChartReady = (instance: EChartsInstance) => {
        chartInstanceRef.current = instance;
        setIsChartReady(true);
    };

    const handleAddChart = async () => {
        const chartInstance = chartInstanceRef.current;
        if (!chartInstance) {
            message.warning(isEn ? 'Chart preview is still loading. Please try again in a moment.' : '图表预览仍在加载，请稍后重试。');
            return;
        }

        const chartDataUrl = chartInstance.getDataURL({
            pixelRatio: 2,
            backgroundColor: '#ffffff',
        });

        if (!chartDataUrl) {
            message.warning(isEn ? 'Unable to capture the chart preview right now.' : '暂时无法捕获图表预览，请稍后重试。');
            return;
        }

        setIsAdding(true);
        try {
            await onAdd(chartDataUrl);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className={styles.chartWidget}>
            <div className={styles.preview}>
                <ReactEChartsCore
                    echarts={echarts}
                    option={getChartOption()}
                    onChartReady={handleChartReady}
                    style={{ height: 300, width: '100%' }}
                    className="echarts-for-react"
                />
            </div>

            <div className={styles.editor}>
                <div className={styles.formRow}>
                    <label>图表类型</label>
                    <Segmented
                        value={chartType}
                        onChange={(val) => setChartType(val as 'bar' | 'line' | 'pie')}
                        options={[
                            { label: '柱状图', value: 'bar' },
                            { label: '折线图', value: 'line' },
                            { label: '饼图', value: 'pie' },
                        ]}
                        block
                    />
                </div>

                <div className={styles.formRow}>
                    <label>标题</label>
                    <Input
                        value={chartTitle}
                        onChange={(e) => setChartTitle(e.target.value)}
                        placeholder="图表标题"
                    />
                </div>

                <div className={styles.formRow}>
                    <label>主题颜色</label>
                    <div className={styles.colorPalette}>
                        {['#6B8068', '#8B795E', '#C2A38F', '#8EB4B1', '#B4A29A', '#D08C60'].map(c => (
                            <button
                                type="button"
                                key={c}
                                onClick={() => setThemeColor(c)}
                                className={styles.colorSwatch}
                                style={{
                                    backgroundColor: c,
                                    borderColor: themeColor === c ? 'rgba(66, 62, 58, 0.75)' : 'transparent',
                                }}
                                aria-label={`选择颜色 ${c}`}
                            />
                        ))}
                    </div>
                </div>

                <div className={styles.dataSection}>
                    <div className={styles.dataHeader}>
                        <span>数据</span>
                        <Button
                            type="link"
                            icon={<PlusOutlined />}
                            onClick={addDataPoint}
                            size="small"
                        >
                            添加
                        </Button>
                    </div>

                    <div className={styles.dataList}>
                        {dataPoints.map((point, index) => (
                            <div key={index} className={styles.dataItem}>
                                <Input
                                    value={point.label}
                                    onChange={(e) => updateDataPoint(index, 'label', e.target.value)}
                                    placeholder="标签"
                                    className={styles.dataLabelInput}
                                />
                                <InputNumber
                                    value={point.value}
                                    onChange={(val) => updateDataPoint(index, 'value', val || 0)}
                                    placeholder="数值"
                                    className={styles.dataValueInput}
                                />
                                {dataPoints.length > 2 && (
                                    <Button
                                        type="text"
                                        danger
                                        icon={<MinusCircleOutlined />}
                                        onClick={() => removeDataPoint(index)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <Button
                    type="primary"
                    block
                    onClick={handleAddChart}
                    className={styles.addButton}
                    disabled={!isChartReady}
                    loading={isAdding}
                >
                    {isEn ? 'Add to canvas' : '添加到画布'}
                </Button>
            </div>
        </div>
    );
};

export default ChartWidget;
