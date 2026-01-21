const axios = require("axios");

async function mlAnomalyCheck(expenses, totalBudget) {
    try {
        const payload = {
            expenses: expenses.map(e => ({
                amount: e.amount,
                budgetRatio: totalBudget > 0 ? e.amount / totalBudget : 0,
                timeGap: 1, // Placeholder as per instructions
                categoryFrequency: 1, // Placeholder
                hasReceipt: e.receiptUrl ? 1 : 0
            }))
        };

        // Using the user's Hugging Face Space URL
        const res = await axios.post(
            "https://Geniusmp-event-anomaly-detector.hf.space/predict",
            payload
        );

        return res.data;
    } catch (error) {
        console.error("ML API Error:", error.message);
        return { anomaly_detected: false, error: true };
    }
}

module.exports = mlAnomalyCheck;
