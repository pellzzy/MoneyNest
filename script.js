const STORAGE_KEY = "moneynest_data_v1";

function emptyData() {
    return {
        transactions: [],
        shopping: [],
        goals: [],
        bills: [],
        budget: {
            start: "",
            end: "",
            reserve: 0
        },
        theme: "bank"
    };
}

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!saved || typeof saved !== "object") {
            return emptyData();
        }

        const defaults = emptyData();

        return {
            transactions: Array.isArray(saved.transactions)
                ? saved.transactions : [],
            shopping: Array.isArray(saved.shopping)
                ? saved.shopping : [],
            goals: Array.isArray(saved.goals)
                ? saved.goals : [],
            bills: Array.isArray(saved.bills)
                ? saved.bills : [],
            budget: {
                ...defaults.budget,
                ...(saved.budget || {})
            },
            theme: ["bank", "modern", "luxury", "colorful"]
                .includes(saved.theme)
                ? saved.theme : "bank"
        };
    } catch (error) {
        return emptyData();
    }
}

let data = loadData();

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        alert("Your browser could not save the records. Please download a backup.");
    }
}
function money(amount) {
    return "₦" + Number(amount || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function today() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function makeId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return Date.now().toString() +
        Math.random().toString(36).slice(2);
}

function getNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}

function sumAmounts(items) {
    return items.reduce(function(total, item) {
        return total + getNumber(item.amount);
    }, 0);
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function createElement(tag, text, className = "") {
    const element = document.createElement(tag);

    element.textContent = text;

    if (className) {
        element.className = className;
    }

    return element;
}

function validAmount(value) {
    const amount = Number(value);

    return Number.isFinite(amount) && amount > 0;
}

function dateToUTC(dateString) {
    const parts = dateString.split("-").map(Number);

    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function daysBetween(start, end) {
    return Math.round(
        (dateToUTC(end) - dateToUTC(start)) / 86400000
    );
}

function formatDate(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(dateString + "T12:00:00");

    return date.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formValue(form, name) {
    return form.elements.namedItem(name).value;
}

function resetForm(form) {
    form.reset();

    const dateInput = form.elements.namedItem("date");

    if (dateInput) {
        dateInput.value = today();
    }
}
function calculateTotals() {
    let income = 0;
    let expenses = 0;
    let savings = 0;

    data.transactions.forEach(function(item) {
        const amount = getNumber(item.amount);

        if (item.type === "income") {
            income += amount;
        }

        if (item.type === "expense") {
            expenses += amount;
        }

        if (item.type === "saving") {
            if (item.action === "withdraw") {
                savings -= amount;
            } else {
                savings += amount;
            }
        }
    });

    const available = income - expenses - savings;

    const shoppingTotal = sumAmounts(data.shopping);
    const billsTotal = sumAmounts(data.bills);

    const reserve = Math.max(
        0,
        getNumber(data.budget.reserve)
    );

    const freeMoney =
        available - shoppingTotal - billsTotal - reserve;

    return {
        income,
        expenses,
        savings,
        available,
        shoppingTotal,
        billsTotal,
        reserve,
        freeMoney
    };
}
function getBudgetDays() {
    const start = data.budget.start;
    const end = data.budget.end;

    if (!start || !end || end < start) {
        return 0;
    }

    const current = today();

    if (current > end) {
        return 0;
    }

    const effectiveStart = current > start ? current : start;

    return daysBetween(effectiveStart, end) + 1;
}

function calculateDailyBudget() {
    const totals = calculateTotals();

    const days = getBudgetDays();

    const daily = days > 0
        ? Math.max(0, totals.freeMoney) / days
        : 0;

    return {
        days,
        daily,
        weekly: daily * 7,
        ...totals
    };
}
function updateDashboard() {
    const totals = calculateDailyBudget();

    setText("totalIncome", money(totals.income));
    setText("totalExpense", money(totals.expenses));
    setText("savedTotal", money(totals.savings));
    setText("available", money(totals.available));

    setText("heroDaily", money(totals.daily));
    setText("dailyLimit", money(totals.daily));
    setText("weeklyLimit", money(totals.weekly));

    setText("plannedTotal", money(totals.shoppingTotal));
    setText("freeMoney", money(totals.freeMoney));

    setText("daysLeft", totals.days.toString());

    setText(
        "todayLabel",
        new Date().toLocaleDateString("en-NG", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        })
    );

    setText(
        "heroDays",
        totals.days > 0
            ? `${totals.days} days remaining`
            : "Set your budget dates to begin"
    );

    const warning = document.getElementById("warning");
    const planMessage = document.getElementById("planMessage");

    warning.className = "notice";

    if (totals.income === 0) {
        warning.textContent =
            "Start by adding the money you received.";

    } else if (totals.available < 0) {
        warning.textContent =
            "Your recorded spending and savings are more than your income.";

        warning.classList.add("danger");

    } else if (totals.freeMoney < 0) {
        warning.textContent =
            "Your shopping, bills and reserve are more than your available money. Review your plan.";

        warning.classList.add("warning");

    } else {
        warning.textContent =
            "Your records are updated. Keep checking your daily spending guide.";
    }

    if (totals.days === 0) {
        planMessage.textContent =
            "Choose a valid budget period that has not ended.";

    } else {
        planMessage.textContent =
            `You can spend about ${money(totals.daily)} per day for the remaining ${totals.days} days, if you follow your plan.`;
    }

    setText(
        "heroAdvice",
        totals.freeMoney < 0
            ? "Your planned costs are higher than your available money."
            : "A little planning goes a long way."
    );
}
document.getElementById("incomeForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const category = formValue(form, "category");
        const amount = Number(formValue(form, "amount"));
        const date = formValue(form, "date");
        const note = formValue(form, "note").trim();

        if (!validAmount(amount) || !date) {
            alert("Please enter a valid amount and date.");
            return;
        }

        data.transactions.push({
            id: makeId(),
            type: "income",
            category,
            amount,
            date,
            note: note || category
        });

        saveData();
        resetForm(form);
        updateAll();

        alert("Money received has been saved!");
    }
);
document.getElementById("expenseForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const category = formValue(form, "category");
        const amount = Number(formValue(form, "amount"));
        const date = formValue(form, "date");
        const note = formValue(form, "note").trim();

        if (!note || !validAmount(amount) || !date) {
            alert("Please enter your spending details.");
            return;
        }

        data.transactions.push({
            id: makeId(),
            type: "expense",
            category,
            amount,
            date,
            note
        });

        saveData();
        resetForm(form);
        updateAll();

        alert("Spending has been recorded!");
    }
);
document.getElementById("budgetForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const start = formValue(form, "start");
        const end = formValue(form, "end");
        const reserve = Number(formValue(form, "reserve"));

        if (!start || !end || end < start) {
            alert("Please choose valid start and end dates.");
            return;
        }

        if (!Number.isFinite(reserve) || reserve < 0) {
            alert("Please enter a valid reserve amount.");
            return;
        }

        data.budget = {
            start,
            end,
            reserve
        };

        saveData();
        updateAll();

        alert("Your budget plan has been updated!");
    }
);
document.getElementById("shoppingForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const note = formValue(form, "note").trim();
        const amount = Number(formValue(form, "amount"));

        if (!note || !validAmount(amount)) {
            alert("Enter an item and its price.");
            return;
        }

        data.shopping.push({
            id: makeId(),
            note,
            amount
        });

        saveData();
        resetForm(form);
        updateAll();
    }
);

function renderShopping() {
    const container = document.getElementById("shoppingList");

    container.innerHTML = "";

    if (data.shopping.length === 0) {
        container.appendChild(
            createElement("p", "No shopping items yet.", "muted")
        );
        return;
    }

    data.shopping.forEach(function(item) {
        const row = createElement("div", "", "stack-item");
        const details = document.createElement("div");

        details.appendChild(createElement("strong", item.note));
        details.appendChild(
            createElement("span", money(item.amount))
        );

        const button = createElement("button", "Remove");
        button.type = "button";

        button.addEventListener("click", function() {
            if (!confirm("Remove this shopping item?")) return;

            data.shopping = data.shopping.filter(
                entry => entry.id !== item.id
            );

            saveData();
            updateAll();
        });

        row.append(details, button);
        container.appendChild(row);
    });
}
document.getElementById("savingForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const action = formValue(form, "action");
        const amount = Number(formValue(form, "amount"));
        const date = formValue(form, "date");

        if (!validAmount(amount) || !date) {
            alert("Enter a valid savings amount and date.");
            return;
        }

        const totals = calculateTotals();

        if (action === "deposit" && amount > totals.available) {
            alert("You cannot save more than your available money.");
            return;
        }

        if (action === "withdraw" && amount > totals.savings) {
            alert("You cannot withdraw more than your savings balance.");
            return;
        }

        data.transactions.push({
            id: makeId(),
            type: "saving",
            category: "Savings",
            action,
            amount,
            date,
            note: action === "deposit"
                ? "Money saved"
                : "Money taken from savings"
        });

        saveData();
        resetForm(form);
        updateAll();

        alert("Your savings have been updated!");
    }
);
document.getElementById("goalForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const note = formValue(form, "note").trim();
        const amount = Number(formValue(form, "amount"));

        if (!note || !validAmount(amount)) {
            alert("Enter a goal and target amount.");
            return;
        }

        data.goals.push({
            id: makeId(),
            note,
            amount
        });

        saveData();
        resetForm(form);
        updateAll();
    }
);

function renderGoals() {
    const container = document.getElementById("goalsList");

    container.innerHTML = "";

    const savings = Math.max(0, calculateTotals().savings);

    if (data.goals.length === 0) {
        container.appendChild(
            createElement("p", "No savings goals yet.", "muted")
        );
        return;
    }

    data.goals.forEach(function(goal) {
        const row = createElement("div", "", "stack-item");
        const details = document.createElement("div");

        const percent = Math.min(
            100,
            (savings / goal.amount) * 100
        );

        details.appendChild(createElement("strong", goal.note));

        details.appendChild(
            createElement(
                "span",
                `Target: ${money(goal.amount)}`
            )
        );

        const progress = createElement("div", "", "progress");
        const bar = createElement("div", "", "progress-bar");

        bar.style.width = percent + "%";

        progress.appendChild(bar);
        details.appendChild(progress);

        details.appendChild(
            createElement(
                "small",
                `${percent.toFixed(0)}% of target (using total savings)`
            )
        );

        const button = createElement("button", "Remove");
        button.type = "button";

        button.addEventListener("click", function() {
            if (!confirm("Remove this savings goal?")) return;

            data.goals = data.goals.filter(
                entry => entry.id !== goal.id
            );

            saveData();
            updateAll();
        });

        row.append(details, button);
        container.appendChild(row);
    });
}
document.getElementById("billForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const form = event.currentTarget;

        const note = formValue(form, "note").trim();
        const amount = Number(formValue(form, "amount"));
        const date = formValue(form, "date");

        if (!note || !validAmount(amount) || !date) {
            alert("Please enter your bill details.");
            return;
        }

        data.bills.push({
            id: makeId(),
            note,
            amount,
            date
        });

        saveData();
        resetForm(form);
        updateAll();
    }
);

function renderBills() {
    const container = document.getElementById("billsList");

    container.innerHTML = "";

    if (data.bills.length === 0) {
        container.appendChild(
            createElement("p", "No bills added yet.", "muted")
        );
        return;
    }

    const sortedBills = [...data.bills].sort(
        (a, b) => a.date.localeCompare(b.date)
    );

    sortedBills.forEach(function(bill) {
        const row = createElement("div", "", "stack-item");
        const details = document.createElement("div");

        details.appendChild(createElement("strong", bill.note));

        details.appendChild(
            createElement("span", money(bill.amount))
        );

        const status = bill.date < today()
            ? "Overdue"
            : bill.date === today()
                ? "Due today"
                : "Upcoming";

        details.appendChild(
            createElement(
                "small",
                `${formatDate(bill.date)} - ${status}`
            )
        );

        const button = createElement("button", "Remove");
        button.type = "button";

        button.addEventListener("click", function() {
            if (!confirm("Remove this bill?")) return;

            data.bills = data.bills.filter(
                entry => entry.id !== bill.id
            );

            saveData();
            updateAll();
        });

        row.append(details, button);
        container.appendChild(row);
    });
}
document.getElementById("affordButton").addEventListener(
    "click",
    function() {
        const input = document.getElementById("affordPrice");
        const price = Number(input.value);

        const result = document.getElementById("affordResult");
        const totals = calculateTotals();

        result.className = "notice subtle";

        if (!validAmount(price)) {
            result.textContent = "Enter a valid price first.";
            return;
        }

        if (price > totals.available) {
            result.textContent =
                "You do not have enough available money for this item.";

            result.classList.add("danger");

        } else if (price > totals.freeMoney) {
            result.textContent =
                "You have enough money, but buying this may affect your shopping, bills or reserve.";

            result.classList.add("warning");

        } else {
            result.textContent =
                `This item fits your current plan. You would have ${money(totals.freeMoney - price)} of free money left.`;
        }
    }
);
const moneyTips = [
    "Buy what you need before buying what you want.",
    "Try to save a little whenever money comes in.",
    "Write down your spending every day.",
    "Check your money before going shopping.",
    "Plan your bills before spending on other things.",
    "A small amount saved regularly can be useful later.",
    "Compare prices before buying expensive items.",
    "Keep some money for unexpected needs.",
    "Review your spending at the end of each month.",
    "Do not spend money just because someone else is spending."
];

document.getElementById("newTip").addEventListener(
    "click",
    function() {
        const random = Math.floor(
            Math.random() * moneyTips.length
        );

        setText("tip", moneyTips[random]);
    }
);
function renderRecords() {
    const tbody = document.getElementById("recordsBody");

    tbody.innerHTML = "";

    const search = document.getElementById("search")
        .value.toLowerCase().trim();

    const filter = document.getElementById("recordFilter").value;

    const records = [...data.transactions]
        .filter(function(item) {
            const matchesFilter =
                filter === "all" || item.type === filter;

            const text = (
                item.note + " " +
                item.category + " " +
                item.type
            ).toLowerCase();

            return matchesFilter && text.includes(search);
        })
        .sort((a, b) => b.date.localeCompare(a.date));

    if (records.length === 0) {
        const row = document.createElement("tr");
        const cell = createElement("td", "No records found.");

        cell.colSpan = 5;

        row.appendChild(cell);
        tbody.appendChild(row);

        return;
    }

    records.forEach(function(item) {
        const row = document.createElement("tr");

        row.appendChild(
            createElement("td", formatDate(item.date))
        );

        row.appendChild(
            createElement("td", item.note)
        );

        const typeCell = document.createElement("td");

        let typeName = item.type;

        if (item.type === "saving") {
            typeName = item.action === "withdraw"
                ? "Savings withdrawal"
                : "Savings deposit";
        }

        typeCell.appendChild(
            createElement(
                "span",
                typeName,
                "badge " + item.type
            )
        );

        row.appendChild(typeCell);

        row.appendChild(
            createElement("td", money(item.amount))
        );

        const actionCell = document.createElement("td");

        const button = createElement(
            "button",
            "Delete",
            "delete-btn"
        );

        button.type = "button";

        button.addEventListener("click", function() {
            if (!confirm("Delete this record?")) return;

            data.transactions = data.transactions.filter(
                entry => entry.id !== item.id
            );

            saveData();
            updateAll();
        });

        actionCell.appendChild(button);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}

document.getElementById("search").addEventListener(
    "input",
    renderRecords
);

document.getElementById("recordFilter").addEventListener(
    "change",
    renderRecords
);
function getMonthlyReport() {
    const month = document.getElementById("reportMonth").value;

    const records = data.transactions.filter(function(item) {
        return item.date.startsWith(month);
    });

    let income = 0;
    let expenses = 0;
    let saved = 0;

    const categories = {};

    records.forEach(function(item) {
        const amount = getNumber(item.amount);

        if (item.type === "income") {
            income += amount;
        }

        if (item.type === "expense") {
            expenses += amount;

            categories[item.category] =
                (categories[item.category] || 0) + amount;
        }

        if (item.type === "saving") {
            saved += item.action === "withdraw"
                ? -amount
                : amount;
        }
    });

    return {
        month,
        records,
        income,
        expenses,
        saved,
        balance: income - expenses - saved,
        categories
    };
}
function renderReport() {
    const container = document.getElementById("report");

    container.innerHTML = "";

    const report = getMonthlyReport();

    if (!report.month) {
        container.appendChild(
            createElement("p", "Choose a month to view your report.")
        );
        return;
    }

    const title = createElement(
        "h3",
        "Money Report - " + report.month
    );

    container.appendChild(title);

    const grid = createElement("div", "", "report-grid");

    const summary = [
        ["Money Received", report.income],
        ["Money Spent", report.expenses],
        ["Net Savings Added", report.saved],
        ["Income Minus Spending", report.income - report.expenses],
        ["After Savings Changes", report.balance]
    ];

    summary.forEach(function(item) {
        const card = createElement("div", "", "report-card");

        card.appendChild(createElement("span", item[0]));
        card.appendChild(createElement("strong", money(item[1])));

        grid.appendChild(card);
    });

    container.appendChild(grid);

    container.appendChild(
        createElement("h4", "Where Your Money Went")
    );

    const categories = Object.entries(report.categories);

    if (categories.length === 0) {
        container.appendChild(
            createElement("p", "No spending recorded this month.")
        );
    }

    categories.forEach(function([category, amount]) {
        const row = createElement("div", "", "chart-row");

        const label = createElement("div", "", "chart-label");

        label.appendChild(createElement("span", category));
        label.appendChild(createElement("span", money(amount)));

        const track = createElement("div", "", "chart-track");
        const fill = createElement("div", "", "chart-fill");

        const percent = report.expenses > 0
            ? (amount / report.expenses) * 100
            : 0;

        fill.style.width = Math.min(100, percent) + "%";

        track.appendChild(fill);
        row.append(label, track);

        container.appendChild(row);
    });

    container.appendChild(
        createElement("h4", "Transactions This Month")
    );

    const tableWrap = createElement("div", "", "table-wrap");
    const table = document.createElement("table");

    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    ["Date", "What", "Type", "Amount"].forEach(function(text) {
        header.appendChild(createElement("th", text));
    });

    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    report.records
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .forEach(function(item) {
            const row = document.createElement("tr");

            row.appendChild(
                createElement("td", formatDate(item.date))
            );

            row.appendChild(
                createElement("td", item.note)
            );

            row.appendChild(
                createElement("td", item.type)
            );

            row.appendChild(
                createElement("td", money(item.amount))
            );

            tbody.appendChild(row);
        });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);

    container.appendChild(
        createElement(
            "p",
            "This report shows transactions recorded for the selected month.",
            "muted"
        )
    );
}

document.getElementById("reportMonth").addEventListener(
    "change",
    renderReport
);
document.getElementById("printReport").addEventListener(
    "click",
    function() {
        const month = document.getElementById("reportMonth").value;

        if (!month) {
            alert("Choose a month first.");
            return;
        }

        renderReport();

        const printWindow = window.open("", "_blank");

        if (!printWindow) {
            alert("Please allow pop-ups to print your report.");
            return;
        }

        const reportContent =
            document.getElementById("report").innerHTML;

        printWindow.document.open();

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>MoneyNest Monthly Report</title>

                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 30px;
                        color: #26352c;
                    }

                    h1, h3, h4 {
                        color: #176b46;
                    }

                    .report-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                        margin-bottom: 25px;
                    }

                    .report-card {
                        border: 1px solid #ddd;
                        padding: 15px;
                        border-radius: 8px;
                    }

                    .report-card span,
                    .report-card strong {
                        display: block;
                        margin-bottom: 8px;
                    }

                    .chart-row {
                        margin-bottom: 15px;
                    }

                    .chart-label {
                        display: flex;
                        justify-content: space-between;
                    }

                    .chart-track {
                        background: #e5e5e5;
                        height: 10px;
                        border-radius: 10px;
                    }

                    .chart-fill {
                        background: #176b46;
                        height: 10px;
                        border-radius: 10px;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }

                    th, td {
                        border: 1px solid #ddd;
                        padding: 10px;
                        text-align: left;
                    }

                    th {
                        background: #edf5ef;
                    }

                    .table-wrap {
                        overflow: visible;
                    }
                </style>
            </head>

            <body>
                <h1>MoneyNest</h1>
                <p>Your Monthly Money Report</p>

                ${reportContent}

                <p>Created with MoneyNest.</p>
            </body>
            </html>
        `);

        printWindow.document.close();

        printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
        };
    }
);
document.getElementById("backup").addEventListener(
    "click",
    function() {
        const backupData = {
            app: "MoneyNest",
            version: 1,
            created: new Date().toISOString(),
            data
        };

        const file = new Blob(
            [JSON.stringify(backupData, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(file);

        const link = document.createElement("a");

        link.href = url;
        link.download = "MoneyNest-Backup-" + today() + ".json";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }
);
document.getElementById("restore").addEventListener(
    "change",
    async function(event) {
        const file = event.target.files[0];

        if (!file) return;

        try {
            if (file.size > 5 * 1024 * 1024) {
                throw new Error("Backup file is too large.");
            }

            const text = await file.text();
            const backup = JSON.parse(text);

            if (
                backup.app !== "MoneyNest" ||
                !backup.data ||
                !Array.isArray(backup.data.transactions) ||
                !Array.isArray(backup.data.shopping) ||
                !Array.isArray(backup.data.goals) ||
                !Array.isArray(backup.data.bills)
            ) {
                throw new Error("This is not a valid MoneyNest backup.");
            }

            const confirmed = confirm(
                "Restoring this backup will replace your current records. Continue?"
            );

            if (!confirmed) return;

            data = backup.data;

            if (!data.budget || typeof data.budget !== "object") {
                data.budget = emptyData().budget;
            }

            if (
                !["bank", "modern", "luxury", "colorful"]
                    .includes(data.theme)
            ) {
                data.theme = "bank";
            }

            saveData();
            updateAll();
            applyTheme();

            alert("Your backup has been restored!");

        } catch (error) {
            alert("Could not restore backup: " + error.message);
        }

        event.target.value = "";
    }
);
function applyTheme() {
    document.body.dataset.theme = data.theme;

    document.getElementById("theme").value = data.theme;
}

document.getElementById("theme").addEventListener(
    "change",
    function(event) {
        data.theme = event.target.value;

        applyTheme();
        saveData();
    }
);
function updateAll() {
    updateDashboard();
    renderShopping();
    renderGoals();
    renderBills();
    renderRecords();
    renderReport();
}
function startWebsite() {
    document.querySelectorAll('input[type="date"]').forEach(
        function(input) {
            if (!input.value) {
                input.value = today();
            }
        }
    );
    if (!data.budget.start || !data.budget.end) {
        const start = today();

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 29);

        const end = [
            endDate.getFullYear(),
            String(endDate.getMonth() + 1).padStart(2, "0"),
            String(endDate.getDate()).padStart(2, "0")
        ].join("-");

        data.budget.start = start;
        data.budget.end = end;

        saveData();
    }

    const budgetForm = document.getElementById("budgetForm");

    budgetForm.elements.namedItem("start").value =
        data.budget.start;

    budgetForm.elements.namedItem("end").value =
        data.budget.end;

    budgetForm.elements.namedItem("reserve").value =
        data.budget.reserve;

    document.getElementById("reportMonth").value =
        today().slice(0, 7);

    setText("year", new Date().getFullYear());

    applyTheme();
    updateAll();
}

startWebsite();

setInterval(function() {
    updateDashboard();
}, 60000);