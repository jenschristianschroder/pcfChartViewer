export interface SensorDataPoint {
    label: string;
    elapsed_s: number;
    acc_x: number;
    acc_y: number;
    acc_z: number;
    gyro_x: number;
    gyro_y: number;
    gyro_z: number;
}

export interface ChartSeries {
    key: keyof Omit<SensorDataPoint, "label" | "elapsed_s">;
    name: string;
    color: string;
    visible: boolean;
}

export const SERIES_CONFIG: ChartSeries[] = [
    { key: "acc_x", name: "Accel X", color: "#e74c3c", visible: true },
    { key: "acc_y", name: "Accel Y", color: "#2ecc71", visible: true },
    { key: "acc_z", name: "Accel Z", color: "#3498db", visible: true },
    { key: "gyro_x", name: "Gyro X", color: "#f39c12", visible: true },
    { key: "gyro_y", name: "Gyro Y", color: "#9b59b6", visible: true },
    { key: "gyro_z", name: "Gyro Z", color: "#1abc9c", visible: true },
];
