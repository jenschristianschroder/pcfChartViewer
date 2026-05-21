import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ChartContainer, IChartContainerProps } from "./components/ChartContainer";
import { parseCsvText } from "./utils/csvParser";
import { SensorDataPoint } from "./types/SensorData";
import * as React from "react";

// Extended context types for Model-Driven app page context
interface PageContext {
    entityId: string;
    entityTypeName: string;
    getClientUrl?: () => string;
}

interface ExtendedContext extends ComponentFramework.Context<IInputs> {
    page?: PageContext;
}

// Declare Xrm global available in Model-Driven apps
declare const Xrm: {
    Utility: {
        getGlobalContext: () => { getClientUrl: () => string };
    };
} | undefined;

export class ChartViewer implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private _selectedPoint = "";
    private _data: SensorDataPoint[] = [];
    private _isLoading = false;
    private _error: string | null = null;
    private _lastCsvHash = "";
    private _lastEntityId = "";
    private _fetchedData = false;

    constructor() {
        // Empty
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const csvData = context.parameters.csvData?.raw ?? "";
        const extCtx = context as ExtendedContext;

        // Mode 1: Canvas app — CSV text passed directly via csvData property
        if (csvData && csvData !== "val") {
            const csvHash = this.simpleHash(csvData);
            if (csvHash !== this._lastCsvHash) {
                this._lastCsvHash = csvHash;
                const result = parseCsvText(csvData);
                this._data = result.data;
                this._error = result.error;
                this._isLoading = false;
            }
        }
        // Mode 2: Model-Driven app — fetch file from Dataverse via WebAPI
        else if (extCtx.page?.entityId && !this._fetchedData) {
            const entityId = extCtx.page.entityId;
            if (entityId !== this._lastEntityId) {
                this._lastEntityId = entityId;
                this._isLoading = true;
                this._fetchedData = false;
                void this.fetchFileFromDataverse(extCtx);
            }
        }

        const props: IChartContainerProps = {
            data: this._data,
            isLoading: this._isLoading,
            error: this._error,
            onPointSelected: this.onPointSelected.bind(this),
        };

        return React.createElement(ChartContainer, props);
    }

    private async fetchFileFromDataverse(context: ExtendedContext): Promise<void> {
        try {
            const entityId = context.page!.entityId;
            const entityTypeName = context.page!.entityTypeName;
            const fileColumnName = context.parameters.fileColumnName?.raw ?? "jenssch_file";

            // Resolve the entity set name (plural form) via metadata
            const entitySetName = await this.getEntitySetName(context, entityTypeName);

            // Build the file download URL
            let clientUrl = "";
            if (context.page?.getClientUrl) {
                clientUrl = context.page.getClientUrl();
            } else if (Xrm?.Utility?.getGlobalContext) {
                clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();
            }

            if (!clientUrl) {
                this._error = "Unable to determine Dataverse URL. Ensure the control is used in a Model-Driven app.";
                this._isLoading = false;
                this.notifyOutputChanged();
                return;
            }

            // Clean entity ID (remove braces if present)
            const cleanId = entityId.replace(/[{}]/g, "");

            const url = `${clientUrl}/api/data/v9.2/${entitySetName}(${cleanId})/${fileColumnName}/$value`;

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "text/plain",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    this._error = `No file found in column '${fileColumnName}'. Upload a CSV file first.`;
                } else {
                    this._error = `Failed to fetch file: ${response.status} ${response.statusText}`;
                }
                this._isLoading = false;
                this._fetchedData = true;
                this.notifyOutputChanged();
                return;
            }

            const csvText = await response.text();
            const result = parseCsvText(csvText);
            this._data = result.data;
            this._error = result.error;
            this._isLoading = false;
            this._fetchedData = true;
            this.notifyOutputChanged();
        } catch (err) {
            this._error = `Error fetching file: ${err instanceof Error ? err.message : String(err)}`;
            this._isLoading = false;
            this._fetchedData = true;
            this.notifyOutputChanged();
        }
    }

    private async getEntitySetName(
        context: ExtendedContext,
        entityTypeName: string
    ): Promise<string> {
        try {
            let clientUrl = "";
            if (context.page?.getClientUrl) {
                clientUrl = context.page.getClientUrl();
            } else if (Xrm?.Utility?.getGlobalContext) {
                clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();
            }

            if (clientUrl) {
                const metadataUrl = `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${entityTypeName}')?$select=EntitySetName`;
                const resp = await fetch(metadataUrl, {
                    headers: {
                        "Accept": "application/json",
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                    },
                });

                if (resp.ok) {
                    const meta = (await resp.json()) as { EntitySetName: string };
                    return meta.EntitySetName;
                }
            }
        } catch {
            // Fall through to pluralization heuristic
        }

        // Simple pluralization fallback
        if (entityTypeName.endsWith("s")) {
            return entityTypeName + "es";
        }
        if (entityTypeName.endsWith("y")) {
            return entityTypeName.slice(0, -1) + "ies";
        }
        return entityTypeName + "s";
    }

    private onPointSelected(point: SensorDataPoint | null): void {
        if (point) {
            this._selectedPoint = JSON.stringify({
                elapsed_s: point.elapsed_s,
                acc_x: point.acc_x,
                acc_y: point.acc_y,
                acc_z: point.acc_z,
                gyro_x: point.gyro_x,
                gyro_y: point.gyro_y,
                gyro_z: point.gyro_z,
            });
        } else {
            this._selectedPoint = "";
        }
        this.notifyOutputChanged();
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < Math.min(str.length, 1000); i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32-bit integer
        }
        return hash.toString() + "_" + str.length;
    }

    public getOutputs(): IOutputs {
        return {
            selectedPoint: this._selectedPoint,
        };
    }

    public destroy(): void {
        this._data = [];
    }
}
