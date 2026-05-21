# 1. Create solution wrapper
cd "c:\src\Hub Coffee"
mkdir ChartViewerSolution; cd ChartViewerSolution
pac solution init --publisher-name Jenssch --publisher-prefix jenssch
pac solution add-reference --path ..\pcfChartViewer

# 2. Build solution .zip
dotnet build -c Release

# 3. Import to your environment
pac auth create --url https://jenssch-dev.crm4.dynamics.com
pac solution import --path bin\Release\ChartViewerSolution.zip