import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Input, Button, Segmented, InputNumber } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import styles from './ChartWidget.module.css';

interface ChartWidgetProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAdd: (chartData: any) => void;
}



export const ChartWidget: React.FC<ChartWidgetProps> = ({ onAdd }) => {
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
    const [chartTitle, setChartTitle] = useState('示例图表');
    const [dataPoints, setDataPoints] = useState([
        { label: '一月', value: 120 },
        { label: '二月', value: 200 },
        { label: '三月', value: 150 },
        { label: '四月', value: 80 },
        { label: '五月', value: 170 },
    ]);

    const colors = [
        '#667eea',
        '#764ba2',
        '#f093fb',
        '#f5576c',
        '#4facfe',
        '#00f2fe',
        '#43e97b',
        '#38f9d7',
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
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: '#667eea' },
                                { offset: 1, color: '#764ba2' },
                            ],
                        },
                        borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : 0,
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
                                { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                                { offset: 1, color: 'rgba(102, 126, 234, 0)' },
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

    return (
        <div className={styles.chartWidget}>
            <div className={styles.preview}>
                <ReactECharts
                    option={getChartOption()}
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
                                    style={{ width: 100 }}
                                />
                                <InputNumber
                                    value={point.value}
                                    onChange={(val) => updateDataPoint(index, 'value', val || 0)}
                                    placeholder="数值"
                                    style={{ width: 80 }}
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
                    onClick={() => onAdd({ type: chartType, title: chartTitle, data: dataPoints })}
                    className={styles.addButton}
                >
                    添加到画布
                </Button>
            </div>
        </div>
    );
};

export default ChartWidget;
