import * as React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Brush,
    TooltipProps,
} from "recharts";
import type { Payload } from "recharts/types/component/DefaultLegendContent";
import { SensorDataPoint, ChartSeries, SERIES_CONFIG } from "../types/SensorData";
import { downsample } from "../utils/dataTransform";

export interface IChartContainerProps {
    data: SensorDataPoint[];
    isLoading: boolean;
    error: string | null;
    onPointSelected?: (point: SensorDataPoint | null) => void;
}

const MAX_RENDER_POINTS = 3000;

const styles = {
    container: {
        width: "100%",
        minHeight: 420,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: 8,
        boxSizing: "border-box" as const,
    },
    loading: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 400,
        fontSize: 14,
        color: "#666",
    },
    error: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 400,
        fontSize: 14,
        color: "#c0392b",
        padding: 20,
        textAlign: "center" as const,
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: 600,
        color: "#333",
        margin: 0,
    },
    pointCount: {
        fontSize: 12,
        color: "#888",
    },
    tooltipContainer: {
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        border: "1px solid #ccc",
        borderRadius: 4,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    },
    tooltipLabel: {
        fontWeight: 600,
        marginBottom: 4,
        color: "#333",
    },
    tooltipRow: {
        margin: "2px 0",
    },
};

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
    active,
    payload,
    label,
}) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div style={styles.tooltipContainer}>
            <div style={styles.tooltipLabel}>
                Time: {typeof label === "number" ? label.toFixed(3) : label}s
            </div>
            {payload.map((entry) => (
                <div
                    key={entry.dataKey}
                    style={{ ...styles.tooltipRow, color: entry.color }}
                >
                    {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(4) : entry.value}
                </div>
            ))}
        </div>
    );
};

export const ChartContainer: React.FC<IChartContainerProps> = ({
    data,
    isLoading,
    error,
    onPointSelected,
}) => {
    const [seriesVisibility, setSeriesVisibility] = React.useState<
        Record<string, boolean>
    >(() => {
        const initial: Record<string, boolean> = {};
        SERIES_CONFIG.forEach((s) => {
            initial[s.key] = s.visible;
        });
        return initial;
    });

    const chartData = React.useMemo(() => {
        if (data.length <= MAX_RENDER_POINTS) return data;
        return downsample(data, MAX_RENDER_POINTS);
    }, [data]);

    const handleLegendClick = React.useCallback(
        (data: Payload) => {
            const key = data.dataKey;
            if (!key || typeof key === "function") return;
            const keyStr = String(key);
            setSeriesVisibility((prev) => ({
                ...prev,
                [keyStr]: !prev[keyStr],
            }));
        },
        []
    );

    const handleChartClick = React.useCallback(
        (e: { activePayload?: { payload: SensorDataPoint }[] } | null) => {
            if (!e?.activePayload || e.activePayload.length === 0) return;
            const point = e.activePayload[0].payload;
            onPointSelected?.(point);
        },
        [onPointSelected]
    );

    if (isLoading) {
        return (
            <div style={styles.loading}>
                <span>Loading sensor data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.error}>
                <span>{error}</span>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div style={styles.loading}>
                <span>No sensor data available. Ensure the file column contains a valid CSV file.</span>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>Sensor Data</h3>
                <span style={styles.pointCount}>
                    {data.length.toLocaleString()} data points
                    {chartData.length < data.length && ` (showing ${chartData.length.toLocaleString()})`}
                </span>
            </div>
            <ResponsiveContainer width="100%" height={420}>
                <LineChart
                    data={chartData}
                    onClick={handleChartClick}
                    margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis
                        dataKey="elapsed_s"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        ticks={[0, 5, 10, 15, 20, 25, 30]}
                        tickFormatter={(v: number) => v.toFixed(0)}
                        stroke="#999"
                        tick={{ fontSize: 11 }}
                    />
                    <YAxis
                        stroke="#999"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        onClick={handleLegendClick}
                        wrapperStyle={{ cursor: "pointer", fontSize: 12, bottom: 0 }}
                        verticalAlign="bottom"
                    />
                    {SERIES_CONFIG.map((series) => (
                        <Line
                            key={series.key}
                            type="monotone"
                            dataKey={series.key}
                            name={series.name}
                            stroke={series.color}
                            dot={false}
                            strokeWidth={1.5}
                            hide={!seriesVisibility[series.key]}
                            isAnimationActive={false}
                        />
                    ))}
                    <Brush
                        dataKey="elapsed_s"
                        height={30}
                        stroke="#8884d8"
                        y={345}
                        tickFormatter={(v: number) =>
                            typeof v === "number" ? v.toFixed(1) + "s" : ""
                        }
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
