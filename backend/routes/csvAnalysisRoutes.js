const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// CSV Analysis endpoint
router.post("/analyze", upload.single("csvFile"), async (req, res) => {
    console.log("=== CSV ANALYSIS REQUEST ===");
    console.log("File received:", req.file ? req.file.originalname : "NO FILE");

    try {
        if (!req.file) {
            console.log("ERROR: No file uploaded");
            return res.status(400).json({ error: "No CSV file uploaded" });
        }

        console.log("File size:", req.file.size, "bytes");
        const csvData = req.file.buffer.toString("utf-8");
        console.log("CSV preview:", csvData.substring(0, 150));

        const analysis = analyzeCSV(csvData);
        console.log("SUCCESS: Analyzed", analysis.dataset_summary.total_rows, "rows");

        res.json(analysis);
    } catch (error) {
        console.error("=== CSV ERROR ===", error.message);
        console.error(error.stack);
        res.status(500).json({ error: "Failed to analyze CSV", details: error.message });
    }
});

function analyzeCSV(csvText) {
    try {
        // Normalize line endings (handle both \r\n and \n)
        const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText.trim().split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new Error('CSV must have at least a header row and one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map((line, lineNum) => {
            const values = line.split(',').map(v => v.trim());

            if (values.length !== headers.length) {
                console.warn(`Row ${lineNum + 1} has ${values.length} values but expected ${headers.length}`);
            }

            const row = {};
            headers.forEach((h, i) => {
                row[h] = values[i] || '';
            });
            return row;
        }).filter(row => Object.values(row).some(v => v)); // Filter out empty rows

        // Identify column types
        const numericColumns = [];
        const categoricalColumns = [];
        const dateColumns = [];

        headers.forEach(header => {
            const sampleValues = rows.slice(0, 10).map(r => r[header]);

            // Check if date column
            if (header.toLowerCase().includes("date") || header.toLowerCase().includes("time")) {
                dateColumns.push(header);
            }
            // Check if numeric
            else if (sampleValues.every(v => !isNaN(parseFloat(v)) && v !== "true" && v !== "false")) {
                numericColumns.push(header);
            }
            // Otherwise categorical
            else {
                categoricalColumns.push(header);
            }
        });

        // Numeric analysis
        const numericAnalysis = {};
        numericColumns.forEach(col => {
            const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
            numericAnalysis[col] = analyzeNumericColumn(values);
        });

        // Categorical analysis
        const categoricalAnalysis = {};
        categoricalColumns.forEach(col => {
            const values = rows.map(r => r[col]).filter(v => v);
            categoricalAnalysis[col] = analyzeCategoricalColumn(values);
        });

        // Financial insights
        const financialInsights = generateFinancialInsights(rows, headers, numericColumns, categoricalColumns);

        // Overall insights
        const overallInsights = generateOverallInsights(numericAnalysis, categoricalAnalysis, financialInsights);

        return {
            dataset_summary: {
                total_rows: rows.length,
                numeric_columns: numericColumns,
                categorical_columns: categoricalColumns,
                date_columns: dateColumns
            },
            numeric_analysis: numericAnalysis,
            categorical_analysis: categoricalAnalysis,
            financial_insights: financialInsights,
            overall_insights: overallInsights
        };
    } catch (error) {
        console.error('CSV Analysis Error:', error);
        throw error;
    }
}

function analyzeNumericColumn(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const q1 = sorted[Math.floor(n * 0.25)];
    const q2 = median;
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    // Detect outliers
    const outliers = [];
    values.forEach((v, idx) => {
        const zScore = Math.abs((v - mean) / stdDev);
        if (zScore > 2) {
            outliers.push({ row_index: idx, value: v, method: "z-score" });
        } else if (v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr) {
            if (!outliers.find(o => o.row_index === idx)) {
                outliers.push({ row_index: idx, value: v, method: "iqr" });
            }
        }
    });

    return {
        count: n,
        sum: parseFloat(sum.toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        min: Math.min(...values),
        max: Math.max(...values),
        range: Math.max(...values) - Math.min(...values),
        variance: parseFloat(variance.toFixed(2)),
        std_dev: parseFloat(stdDev.toFixed(2)),
        quartiles: {
            Q1: parseFloat(q1.toFixed(2)),
            Q2: parseFloat(q2.toFixed(2)),
            Q3: parseFloat(q3.toFixed(2))
        },
        iqr: parseFloat(iqr.toFixed(2)),
        outliers: outliers
    };
}

function analyzeCategoricalColumn(values) {
    const distribution = {};
    values.forEach(v => {
        distribution[v] = (distribution[v] || 0) + 1;
    });

    const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);

    return {
        unique_values: Object.keys(distribution).length,
        distribution: distribution,
        most_frequent: sorted[0][0],
        least_frequent: sorted[sorted.length - 1][0]
    };
}

function generateFinancialInsights(rows, headers, numericColumns, categoricalColumns) {
    const insights = {
        high_value_entries: [],
        category_wise_totals: {},
        anomaly_summary: []
    };

    // Find amount column
    const amountCol = headers.find(h =>
        h.toLowerCase().includes("amount") ||
        h.toLowerCase().includes("cost") ||
        h.toLowerCase().includes("price") ||
        h.toLowerCase().includes("expense")
    );

    if (amountCol) {
        const amounts = rows.map((r, idx) => ({
            row_index: idx,
            value: parseFloat(r[amountCol])
        })).filter(a => !isNaN(a.value));

        // High value entries (top 10%)
        const sorted = [...amounts].sort((a, b) => b.value - a.value);
        const top10Percent = Math.ceil(sorted.length * 0.1);
        insights.high_value_entries = sorted.slice(0, top10Percent);

        // Category-wise totals
        const categoryCol = categoricalColumns.find(c =>
            c.toLowerCase().includes("category") ||
            c.toLowerCase().includes("type")
        );

        if (categoryCol) {
            rows.forEach(r => {
                const cat = r[categoryCol];
                const amt = parseFloat(r[amountCol]);
                if (cat && !isNaN(amt)) {
                    insights.category_wise_totals[cat] =
                        (insights.category_wise_totals[cat] || 0) + amt;
                }
            });

            // Round category totals
            Object.keys(insights.category_wise_totals).forEach(k => {
                insights.category_wise_totals[k] = parseFloat(
                    insights.category_wise_totals[k].toFixed(2)
                );
            });
        }

        // Anomaly detection
        const mean = amounts.reduce((a, b) => a + b.value, 0) / amounts.length;
        const variance = amounts.reduce((acc, a) => acc + Math.pow(a.value - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);

        amounts.forEach(a => {
            const zScore = Math.abs((a.value - mean) / stdDev);
            if (zScore > 2.5) {
                insights.anomaly_summary.push(
                    `Row ${a.row_index}: Unusual ${amountCol} of ${a.value} (${zScore.toFixed(1)}σ from mean)`
                );
            }
        });

        // Check for missing receipts
        const receiptCol = headers.find(h => h.toLowerCase().includes("receipt"));
        if (receiptCol) {
            const missingReceipts = rows.filter(r =>
                r[receiptCol] === "false" || r[receiptCol] === "0" || !r[receiptCol]
            ).length;

            if (missingReceipts > 0) {
                insights.anomaly_summary.push(
                    `${missingReceipts} transactions missing receipts`
                );
            }
        }
    }

    return insights;
}

function generateOverallInsights(numericAnalysis, categoricalAnalysis, financialInsights) {
    const insights = [];

    // Numeric insights
    Object.entries(numericAnalysis).forEach(([col, stats]) => {
        if (stats.outliers.length > 0) {
            insights.push(`${col}: ${stats.outliers.length} outlier(s) detected`);
        }

        const cv = (stats.std_dev / stats.mean) * 100;
        if (cv > 50) {
            insights.push(`${col}: High variability detected (CV: ${cv.toFixed(1)}%)`);
        }
    });

    // Categorical insights
    Object.entries(categoricalAnalysis).forEach(([col, stats]) => {
        if (stats.unique_values === 1) {
            insights.push(`${col}: All values are identical (${stats.most_frequent})`);
        }
    });

    // Financial insights
    if (financialInsights.anomaly_summary.length > 0) {
        insights.push(...financialInsights.anomaly_summary);
    }

    if (financialInsights.high_value_entries.length > 0) {
        const topValue = financialInsights.high_value_entries[0].value;
        insights.push(`Highest transaction: ${topValue}`);
    }

    return insights;
}

module.exports = router;
