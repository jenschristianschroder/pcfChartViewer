import * as Papa from "papaparse";
import { SensorDataPoint } from "../types/SensorData";

export interface ParseResult {
    data: SensorDataPoint[];
    error: string | null;
}

interface CsvRow {
    label: string;
    elapsed_s: string;
    acc_x: string;
    acc_y: string;
    acc_z: string;
    gyro_x: string;
    gyro_y: string;
    gyro_z: string;
    [key: string]: string;
}

/**
 * Attempts to reconstruct proper CSV from flat single-line text where newlines
 * were lost (e.g. pasted into a single-line input in the PCF test harness).
 * When newlines become spaces, the last value of each row merges with the first
 * value of the next row via a space: "...,gyro_z test_run,0.000001,..."
 * This function splits those merged segments and rebuilds proper rows.
 */
function tryReconstructFlatCsv(flatText: string, expectedColCount: number): string | null {
    if (flatText.includes("\n")) {
        return null; // Already has newlines, no reconstruction needed
    }

    const rawSegments = flatText.split(",").map((s) => s.trim());
    if (rawSegments.length <= expectedColCount) {
        return null; // Not enough data to reconstruct
    }

    // Expand segments containing spaces (which represent lost newlines)
    const expanded: string[] = [];
    for (const seg of rawSegments) {
        const spaceIdx = seg.indexOf(" ");
        if (spaceIdx > 0) {
            expanded.push(seg.substring(0, spaceIdx));
            expanded.push(seg.substring(spaceIdx + 1).trim());
        } else {
            expanded.push(seg);
        }
    }

    // Verify we can evenly divide into rows (header + data)
    if (expanded.length % expectedColCount !== 0) {
        return null; // Can't evenly reconstruct, abort
    }

    // Group into rows of expectedColCount
    const lines: string[] = [];
    for (let i = 0; i < expanded.length; i += expectedColCount) {
        lines.push(expanded.slice(i, i + expectedColCount).join(","));
    }

    return lines.join("\n");
}

export function parseCsvText(csvText: string): ParseResult {
    if (!csvText || csvText.trim().length === 0) {
        return { data: [], error: "No CSV data provided" };
    }

    try {
        // Remove BOM and normalize line endings to avoid invisible trailing chars
        let cleanedCsv = csvText
            .replace(/^\uFEFF/, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .trim();

        const expectedColumns = [
            "label", "elapsed_s", "acc_x", "acc_y", "acc_z",
            "gyro_x", "gyro_y", "gyro_z",
        ];

        // If no newlines, try to reconstruct from flat single-line input
        if (!cleanedCsv.includes("\n")) {
            const reconstructed = tryReconstructFlatCsv(cleanedCsv, expectedColumns.length);
            if (reconstructed) {
                cleanedCsv = reconstructed;
            }
        }

        const result = (Papa as unknown as { parse: typeof Papa.parse }).parse<CsvRow>(cleanedCsv, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
        });

        if (result.errors.length > 0) {
            const firstError = result.errors[0];
            console.warn("CSV parse warnings:", result.errors);
            // Only fail on fatal errors, not warnings
            if (result.data.length === 0) {
                return {
                    data: [],
                    error: `CSV parse error: ${firstError.message} (row ${firstError.row})`,
                };
            }
        }

        const headers: string[] = (result.meta.fields ?? []).map((h: string) => h.trim());
        const missingColumns = expectedColumns.filter(
            (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
            return {
                data: [],
                error: `Missing required columns: ${missingColumns.join(", ")}. Found: ${headers.join(", ")}`,
            };
        }

        const data: SensorDataPoint[] = result.data.map((row: CsvRow) => ({
            label: row.label ?? "",
            elapsed_s: parseFloat(row.elapsed_s) || 0,
            acc_x: parseFloat(row.acc_x) || 0,
            acc_y: parseFloat(row.acc_y) || 0,
            acc_z: parseFloat(row.acc_z) || 0,
            gyro_x: parseFloat(row.gyro_x) || 0,
            gyro_y: parseFloat(row.gyro_y) || 0,
            gyro_z: parseFloat(row.gyro_z) || 0,
        }));

        return { data, error: null };
    } catch (err) {
        return {
            data: [],
            error: `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
