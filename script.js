const BASE_URL = "http://localhost:3000"; // backend server

// Currency conversion rates (relative to USD)
const CONVERSION_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
    INR: 83.2,
    CNY: 7.24,
    AUD: 1.52,
    CAD: 1.36
};

const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    INR: '₹',
    CNY: '¥',
    AUD: 'A$',
    CAD: 'C$'
};

let expenses = [];
let lineChartInstance, pieChartInstance;

// ======================= 🧠 DATABASE CONNECTION HELPERS =======================

// Load all expenses from backend DB
async function loadExpensesFromDB() {
    try {
        const res = await fetch(`${BASE_URL}/expenses`);
        expenses = await res.json();
        console.log("✅ Expenses loaded from DB:", expenses);
        updateDisplay();
    } catch (err) {
        console.error("❌ Error fetching expenses from DB:", err);
    }
}

// Add a new expense to backend DB
async function addExpenseToDB(expense) {
    try {
        const res = await fetch(`${BASE_URL}/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(expense)
        });
        const data = await res.json();
        console.log("✅ Expense added to DB:", data);
    } catch (err) {
        console.error("❌ Error adding expense:", err);
    }
}

// Delete expense from DB
async function deleteExpenseFromDB(id) {
    try {
        await fetch(`${BASE_URL}/expenses/${id}`, { method: "DELETE" });
        console.log("🗑️ Expense deleted:", id);
    } catch (err) {
        console.error("❌ Error deleting expense:", err);
    }
}

// ======================= ⚙️ FRONTEND LOGIC =======================

function initializeListeners() {
    document.getElementById('displayCurrency').addEventListener('change', updateDisplay);
    document.getElementById('expenseForm').addEventListener('submit', addExpense);

    document.getElementById('date').valueAsDate = new Date();

    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) event.target.classList.remove('active');
    };
}

// --- Modal ---
function openExpenseModal() {
    document.getElementById('expenseModal').classList.add('active');
    document.getElementById('date').valueAsDate = new Date();
}

function openConverterModal() {
    document.getElementById('converterModal').classList.add('active');
    document.getElementById('conversionResult').innerHTML = '';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'expenseModal') document.getElementById('expenseForm').reset();
}

// --- Add Expense ---
async function addExpense(e) {
    e.preventDefault();

    const expense = {
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value,
        currency: document.getElementById('expenseCurrency').value
    };

    if (isNaN(expense.amount) || expense.amount <= 0) {
        alert("Please enter a valid expense amount.");
        return;
    }
    if (expense.category === "") {
        alert("Please select an expense category.");
        return;
    }

    await addExpenseToDB(expense);
    closeModal('expenseModal');
    await loadExpensesFromDB(); // reload from DB
}

// --- Delete Expense ---
async function deleteExpense(idToDelete) {
    await deleteExpenseFromDB(idToDelete);
    await loadExpensesFromDB();
}

// ======================= 💱 CURRENCY CONVERSION =======================

function convertCurrency() {
    const amount = parseFloat(document.getElementById('converterAmount').value);
    const from = document.getElementById('fromCurrency').value;
    const to = document.getElementById('toCurrency').value;

    if (isNaN(amount) || amount <= 0) {
        document.getElementById('conversionResult').innerHTML = '<p class="no-data">Please enter a valid amount to convert.</p>';
        return;
    }

    const fromRate = CONVERSION_RATES[from];
    const toRate = CONVERSION_RATES[to];
    const result = (amount / fromRate) * toRate;
    const symbol = CURRENCY_SYMBOLS[to];

    document.getElementById('conversionResult').innerHTML = `
        <div class="conversion-result">
            <strong>Result:</strong>
            <span class="result-value">${symbol} ${result.toFixed(2)}</span>
        </div>
    `;
}

function convertAmount(amount, fromCurrency, toCurrency) {
    const fromRate = CONVERSION_RATES[fromCurrency];
    const toRate = CONVERSION_RATES[toCurrency];
    return (amount / fromRate) * toRate;
}

// ======================= 📊 UI RENDERING =======================

function updateDisplay() {
    const displayCurrency = document.getElementById('displayCurrency').value;
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    const convertedExpenses = expenses.map(exp => ({
        ...exp,
        convertedAmount: convertAmount(exp.amount, exp.currency || 'USD', displayCurrency)
    }));

    const total = convertedExpenses.reduce((sum, exp) => sum + exp.convertedAmount, 0);
    document.getElementById('totalExpenses').textContent = `${symbol} ${total.toFixed(2)}`;
    document.getElementById('totalTransactions').textContent = expenses.length;

    updateExpenseList(convertedExpenses, symbol);
    updateCharts(convertedExpenses, displayCurrency);
}

function updateExpenseList(convertedExpenses, symbol) {
    const list = document.getElementById('expensesList');

    if (!convertedExpenses.length) {
        list.innerHTML = '<p class="no-data">No expenses recorded yet.</p>';
        return;
    }

    convertedExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = convertedExpenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-category">${exp.category}</div>
                <div class="expense-description">${exp.description}</div>
                <div class="expense-date">${exp.date}</div>
            </div>
            <div class="expense-actions">
                <div class="expense-amount">${symbol} ${exp.convertedAmount.toFixed(2)}</div>
                <button class="delete-btn" onclick="deleteExpense(${exp.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function updateCharts(convertedExpenses, displayCurrency) {
    if (lineChartInstance) lineChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    const lineContainer = document.getElementById('lineChartContainer');
    const pieContainer = document.getElementById('pieChartContainer');
    lineContainer.innerHTML = '<canvas id="lineChart"></canvas>';
    pieContainer.innerHTML = '<canvas id="pieChart"></canvas>';

    if (!convertedExpenses.length) {
        lineContainer.innerHTML = '<p class="no-data">No data to display.</p>';
        pieContainer.innerHTML = '<p class="no-data">No data to display.</p>';
        return;
    }

    const dailyData = {};
    convertedExpenses.forEach(exp => {
        const d = exp.date;
        dailyData[d] = (dailyData[d] || 0) + exp.convertedAmount;
    });

    const sortedDates = Object.keys(dailyData).sort();
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: `Daily Expenses (${CURRENCY_SYMBOLS[displayCurrency]})`,
                data: sortedDates.map(d => dailyData[d]),
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const categoryData = {};
    convertedExpenses.forEach(exp => {
        categoryData[exp.category] = (categoryData[exp.category] || 0) + exp.convertedAmount;
    });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: ['#667eea', '#764ba2', '#a36eeb', '#c7a3ff', '#3a66ff', '#ff7979']
            }]
        },
        options: { plugins: { legend: { position: 'right' } } }
    });
}

// ======================= 🚀 INIT =======================

document.addEventListener('DOMContentLoaded', () => {
    initializeListeners();
    loadExpensesFromDB(); // 🔗 Load data from backend instead of localStorage
});

// Expose globally
window.openConverterModal = openConverterModal;
window.openExpenseModal = openExpenseModal;
window.closeModal = closeModal;
window.convertCurrency = convertCurrency;
window.deleteExpense = deleteExpense;
