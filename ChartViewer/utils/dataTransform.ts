import { SensorDataPoint } from "../types/SensorData";

/**
 * Downsample data using largest-triangle-three-buckets (LTTB) algorithm.
 * This preserves visual shape while reducing point count for rendering performance.
 * For the current ~3,000 points Recharts handles it fine, but this future-proofs
 * for larger files (50k+ points).
 */
export function downsample(
    data: SensorDataPoint[],
    maxPoints: number
): SensorDataPoint[] {
    if (data.length <= maxPoints || maxPoints <= 2) {
        return data;
    }

    const bucketSize = (data.length - 2) / (maxPoints - 2);
    const sampled: SensorDataPoint[] = [data[0]]; // Always keep first point

    let prevIndex = 0;

    for (let i = 1; i < maxPoints - 1; i++) {
        const rangeStart = Math.floor((i - 1) * bucketSize) + 1;
        const rangeEnd = Math.min(
            Math.floor(i * bucketSize) + 1,
            data.length - 1
        );

        // Calculate average point for next bucket (used as target)
        const nextRangeStart = Math.floor(i * bucketSize) + 1;
        const nextRangeEnd = Math.min(
            Math.floor((i + 1) * bucketSize) + 1,
            data.length - 1
        );

        let avgX = 0;
        let avgY = 0;
        let count = 0;
        for (let j = nextRangeStart; j < nextRangeEnd; j++) {
            avgX += data[j].elapsed_s;
            avgY += data[j].acc_x; // Use acc_x as representative value
            count++;
        }
        if (count > 0) {
            avgX /= count;
            avgY /= count;
        }

        // Find point in current bucket that forms largest triangle
        let maxArea = -1;
        let selectedIndex = rangeStart;

        const prevPoint = data[prevIndex];
        for (let j = rangeStart; j < rangeEnd; j++) {
            const area = Math.abs(
                (prevPoint.elapsed_s - avgX) * (data[j].acc_x - prevPoint.acc_x) -
                (prevPoint.elapsed_s - data[j].elapsed_s) * (avgY - prevPoint.acc_x)
            );
            if (area > maxArea) {
                maxArea = area;
                selectedIndex = j;
            }
        }

        sampled.push(data[selectedIndex]);
        prevIndex = selectedIndex;
    }

    sampled.push(data[data.length - 1]); // Always keep last point
    return sampled;
}

/**
 * Compute basic statistics for a numeric series.
 */
export function computeStats(
    data: SensorDataPoint[],
    key: keyof Omit<SensorDataPoint, "label">
): { min: number; max: number; avg: number } {
    if (data.length === 0) {
        return { min: 0, max: 0, avg: 0 };
    }

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (const point of data) {
        const val = point[key];
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
    }

    return {
        min: Math.round(min * 1000) / 1000,
        max: Math.round(max * 1000) / 1000,
        avg: Math.round((sum / data.length) * 1000) / 1000,
    };
}
