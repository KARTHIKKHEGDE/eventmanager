function fraudCheck(event, expenses) {
    let alerts = [];

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = event.totalBudget - totalSpent;

    // Rule 1: Over budget
    if (totalSpent > event.totalBudget) {
        alerts.push("Budget exceeded!");
    }

    // Rule 2: High unused amount
    const unusedPercentage = (remaining / event.totalBudget) * 100;
    if (unusedPercentage > 40) { // > 40% unused
        alerts.push(`High unused funds detected: ${unusedPercentage.toFixed(1)}% of budget is unused`);
    }

    // Rule 3: Large expense
    expenses.forEach(e => {
        if (e.amount > event.totalBudget * 0.3) {
            const pct = (e.amount / event.totalBudget) * 100;
            alerts.push(`Large expense detected: ${e.amount} (${pct.toFixed(1)}% of total budget)`);
        }
    });

    // Rule 4: Missing receipt
    expenses.forEach(e => {
        if (!e.receiptUrl) {
            alerts.push("Expense without receipt detected");
        }
    });

    return {
        totalSpent,
        remaining,
        alerts
    };
}

module.exports = fraudCheck;
