const express = require("express");
const Expense = require("../models/Expense");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer config (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ADD EXPENSE WITH RECEIPT
router.post("/add", upload.single("receipt"), async (req, res) => {
  try {
    const { eventId, amount, category } = req.body;

    if (!eventId || !amount || !category) {
      return res.status(400).json({ message: "All fields required" });
    }

    let receiptUrl = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload_stream(
        { folder: "receipts" },
        async (error, result) => {
          if (error) throw error;

          receiptUrl = result.secure_url;

          const expense = new Expense({
            eventId,
            amount,
            category,
            receiptUrl
          });

          await expense.save();
          res.status(201).json(expense);
        }
      );

      result.end(req.file.buffer);
    } else {
      const expense = new Expense({
        eventId,
        amount,
        category,
        receiptUrl
      });

      await expense.save();
      res.status(201).json(expense);
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET EXPENSES BY EVENT
router.get("/:eventId", async (req, res) => {
  try {
    const expenses = await Expense.find({ eventId: req.params.eventId });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE EXPENSE
router.delete("/delete/:id", async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
