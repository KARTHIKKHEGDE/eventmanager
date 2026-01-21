const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./db");
require("dotenv").config();

const app = express();

// Connect to MongoDB
connectDB();

// Middlewares
// CORS configuration for cross-origin requests from frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use("/events", require("./routes/eventRoutes"));
app.use("/expenses", require("./routes/expenseRoutes"));
app.use("/csv", require("./routes/csvAnalysisRoutes"));

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html as the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
