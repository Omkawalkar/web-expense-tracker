// ======================= IMPORTS =======================
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();

// ======================= APP SETUP =======================
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ======================= DATABASE CONNECTION =======================
const db = new sqlite3.Database("./expenses.db", (err) => {
  if (err) {
    console.error("❌ Database connection error:", err.message);
  } else {
    console.log("✅ Connected to SQLite database (expenses.db)");
  }
});

// ======================= CREATE TABLE =======================
db.run(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT
  )
`, (err) => {
  if (err) {
    console.error("❌ Table creation error:", err.message);
  } else {
    console.log("🗂️  Table 'expenses' is ready.");
  }
});

// ======================= ROUTES =======================

// ---- GET all expenses ----
app.get("/expenses", (req, res) => {
  db.all("SELECT * FROM expenses ORDER BY date DESC", [], (err, rows) => {
    if (err) {
      console.error("❌ Error fetching expenses:", err.message);
      return res.status(500).json({ error: "Failed to fetch expenses" });
    }
    res.status(200).json(rows);
  });
});

// ---- POST new expense ----
app.post("/expenses", (req, res) => {
  const { date, amount, category, description } = req.body;

  // Basic validation
  if (!date || !amount || !category) {
    return res.status(400).json({ error: "Date, amount, and category are required." });
  }

  const sql = `
    INSERT INTO expenses (date, amount, category, description)
    VALUES (?, ?, ?, ?)
  `;

  db.run(sql, [date, amount, category, description || ""], function (err) {
    if (err) {
      console.error("❌ Error inserting expense:", err.message);
      return res.status(500).json({ error: "Failed to add expense" });
    }
    res.status(201).json({
      message: "✅ Expense added successfully",
      expense: {
        id: this.lastID,
        date,
        amount,
        category,
        description,
      },
    });
  });
});

// ---- DELETE expense by ID ----
app.delete("/expenses/:id", (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Expense ID is required" });
  }

  db.run("DELETE FROM expenses WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("❌ Error deleting expense:", err.message);
      return res.status(500).json({ error: "Failed to delete expense" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "⚠️ Expense not found" });
    }

    res.status(200).json({ message: "🗑️ Expense deleted successfully", deletedID: id });
  });
});

// ======================= SERVER START =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
