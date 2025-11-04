const BASE_URL = "http://localhost:3000";




// Currency conversion rates (relative to USD) - NOTE: These are static and approximate.
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

// Initialize data
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];

// --- START: Specific Expense Deletion FIX ---
// Automatically check for and remove the reported stuck expense upon load.
const initialLength = expenses.length;
expenses = expenses.filter(exp =>
    !(exp.category === 'Food & Dining' && exp.description.toLowerCase().trim() === 'tyt')
);

// If the stuck item was found and removed, overwrite localStorage with the clean array.
if (expenses.length < initialLength) {
    console.log("Cleanup: Successfully removed the stuck expense 'tyt' from Food & Dining.");
    localStorage.setItem('expenses', JSON.stringify(expenses));
}
// --- END: Specific Expense Deletion FIX ---

let lineChartInstance, pieChartInstance;


// --- Event Listener Initialization ---
function initializeListeners() {
    // Attach permanent listeners
    document.getElementById('displayCurrency').addEventListener('change', updateDisplay);
    document.getElementById('expenseForm').addEventListener('submit', addExpense);

    // Set today's date as default
    document.getElementById('date').valueAsDate = new Date();

    // Close modal when clicking outside
    window.onclick = function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    }
}

// --- Modal functions ---
function openExpenseModal() {
    document.getElementById('expenseModal').classList.add('active');
    // Ensure date defaults to today every time
    document.getElementById('date').valueAsDate = new Date();
}

function openConverterModal() {
    document.getElementById('converterModal').classList.add('active');
    document.getElementById('conversionResult').innerHTML = ''; // Clear previous result
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'expenseModal') {
        document.getElementById('expenseForm').reset();
    }
}

// --- Expense Logic ---

// Add expense
function addExpense(e) {
    e.preventDefault();

    const expense = {
        id: Date.now(), // ID is a number/timestamp
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value,
        currency: document.getElementById('expenseCurrency').value
    };

    // Basic validation
    if (isNaN(expense.amount) || expense.amount <= 0) {
        // Use a custom message box or alert for simplicity in this single file context
        alert("Please enter a valid expense amount.");
        return;
    }
    if (expense.category === "") {
        alert("Please select an expense category.");
        return;
    }

    expenses.push(expense);
    localStorage.setItem('expenses', JSON.stringify(expenses));

    closeModal('expenseModal');
    updateDisplay();
}

/**
 * Core Deletion Logic: Removes the expense item matching the ID.
 */
function deleteExpense(idToDelete) {
    // Convert the ID parameter to a number to ensure strict comparison works
    const id = Number(idToDelete);

    // Filter out the expense with the matching numeric ID
    expenses = expenses.filter(exp => exp.id !== id);
    localStorage.setItem('expenses', JSON.stringify(expenses));

    // Refresh the UI
    updateDisplay();
}

// Convert currency
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

// Convert amount to display currency
function convertAmount(amount, fromCurrency, toCurrency) {
    const fromRate = CONVERSION_RATES[fromCurrency];
    const toRate = CONVERSION_RATES[toCurrency];
    if (!fromRate || !toRate) return 0;
    return (amount / fromRate) * toRate;
}

// Update display (main render function)
function updateDisplay() {
    const displayCurrency = document.getElementById('displayCurrency').value;
    const symbol = CURRENCY_SYMBOLS[displayCurrency];

    // Convert all expenses to display currency
    const convertedExpenses = expenses.map(exp => ({
        ...exp,
        convertedAmount: convertAmount(exp.amount, exp.currency, displayCurrency)
    }));

    // Calculate total stats
    const total = convertedExpenses.reduce((sum, exp) => sum + exp.convertedAmount, 0);
    document.getElementById('totalExpenses').textContent = `${symbol} ${total.toFixed(2)}`;
    document.getElementById('totalTransactions').textContent = expenses.length;

    // Update UI components
    updateExpenseList(convertedExpenses, symbol);
    updateCharts(convertedExpenses, displayCurrency);
}

// Update expense list
function updateExpenseList(convertedExpenses, symbol) {
    const list = document.getElementById('expensesList');

    if (convertedExpenses.length === 0) {
        list.innerHTML = '<p class="no-data">No expenses recorded yet. Add your first expense!</p>';
        return;
    }

    // Sort by date (newest first)
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

// Update charts
function updateCharts(convertedExpenses, displayCurrency) {
    // Destroy existing charts to prevent stacking/errors
    if (lineChartInstance) lineChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    const lineContainer = document.getElementById('lineChartContainer');
    const pieContainer = document.getElementById('pieChartContainer');

    // Clear containers and re-add canvas elements (to fix redraw issues)
    lineContainer.innerHTML = '<canvas id="lineChart"></canvas>';
    pieContainer.innerHTML = '<canvas id="pieChart"></canvas>';


    if (convertedExpenses.length === 0) {
        // Display no data message instead of erroring on an empty chart render
        lineContainer.innerHTML = '<p class="no-data">No data to display in trend chart.</p>';
        pieContainer.innerHTML = '<p class="no-data">No data to display in category chart.</p>';
        return;
    }

    // --- Line Chart Data (Daily Expenses) ---
    const dailyData = {};
    convertedExpenses.forEach(exp => {
        const date = exp.date;
        dailyData[date] = (dailyData[date] || 0) + exp.convertedAmount;
    });

    const sortedDates = Object.keys(dailyData).sort();
    const lineData = {
        labels: sortedDates,
        datasets: [{
            label: `Daily Expenses (${CURRENCY_SYMBOLS[displayCurrency]})`,
            data: sortedDates.map(date => dailyData[date]),
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: 'rgba(102, 126, 234, 0.2)',
            tension: 0.4,
            fill: true
        }]
    };

    // Create line chart
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: lineData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // --- Pie Chart Data (Category Breakdown) ---
    const categoryData = {};
    convertedExpenses.forEach(exp => {
        categoryData[exp.category] = (categoryData[exp.category] || 0) + exp.convertedAmount;
    });

    const pieData = {
        labels: Object.keys(categoryData),
        datasets: [{
            data: Object.values(categoryData),
            backgroundColor: [
                '#667eea',
                '#764ba2',
                '#a36eeb',
                '#c7a3ff',
                '#3a66ff',
                '#ff7979',
                '#ffaf79',
                '#a0ff79',
                '#79fff1'
            ].slice(0, Object.keys(categoryData).length),
            borderWidth: 0
        }]
    };

    // Create pie chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: pieData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }}
            }
        });
}

// Initial load sequence
initializeListeners();
updateDisplay();

// Expose functions globally for HTML elements to call them (like onclick)
window.openConverterModal = openConverterModal;
window.openExpenseModal = openExpenseModal;
window.closeModal = closeModal;
window.convertCurrency = convertCurrency;
window.deleteExpense = deleteExpense;




//  database//


