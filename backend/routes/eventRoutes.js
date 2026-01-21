const Expense = require("../models/Expense");
const fraudCheck = require("../utils/fraudCheck");

const mlAnomalyCheck = require("../utils/mlCheck");
const verifyReceiptAmount = require("../utils/ocrCheck");

const express = require("express");
const Event = require("../models/Event");

const router = express.Router();

// CREATE EVENT
router.post("/create", async (req, res) => {
  try {
    const { name, totalBudget } = req.body;

    if (!name || !totalBudget) {
      return res.status(400).json({ message: "All fields required" });
    }

    const event = new Event({
      name,
      totalBudget
    });

    await event.save();
    res.status(201).json(event);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET ALL EVENTS
router.get("/", async (req, res) => {
  try {
    console.log("GET /events called");
    const events = await Event.find();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FRAUD / MISUSE CHECK
router.get("/check/:eventId", async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    const expenses = await Expense.find({ eventId: req.params.eventId });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const report = fraudCheck(event, expenses);

    // 🤖 ML ANOMALY CHECK
    if (expenses.length > 0) {
      const mlResult = await mlAnomalyCheck(expenses, event.totalBudget);
      if (mlResult.anomaly_detected) {
        let reason = "Irregular spending pattern detected";

        // Simple heuristics to explain the ML result
        const highRatio = expenses.some(e => (e.amount / event.totalBudget) > 0.3);
        const missingReceipt = expenses.some(e => !e.receiptUrl);

        if (highRatio && missingReceipt) reason = "High expense ratio & missing receipts";
        else if (highRatio) reason = "Unusually high expense amount vs budget";
        else if (missingReceipt) reason = "Expenses without receipts";

        report.alerts.push(`🤖 ML anomaly detected (score: ${mlResult.anomaly_score.toFixed(2)}) - ${reason}`);
      }
    }

    // 🧾 RECEIPT OCR CHECK
    for (const e of expenses) {
      if (e.receiptUrl) {
        const ocrResult = await verifyReceiptAmount(e.receiptUrl, e.amount);
        if (ocrResult.verified && !ocrResult.textFound) {
          report.alerts.push(`⚠ Receipt Mismatch: expense of ${e.amount} (${e.category}) not found in scanned receipt`);
        }
      }
    }

    res.json(report);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// DELETE EVENT
router.delete("/delete/:id", async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Also delete associated expenses
    await Expense.deleteMany({ eventId: req.params.id });

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
