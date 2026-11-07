const API_URL = "https://script.google.com/macros/s/AKfycbyHtGVPwfVmwtT9qumO-kHRs9Amfhvhn26_dKF5BEpyyNDRXw1vsKjF3hPWnAU00-hp/exec";

let allItems = [];

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = "amzCallback_" + Date.now();

    const script = document.createElement("script");

    const query = new URLSearchParams({
      ...params,
      callback: callbackName
    });

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Server connection failed."));
    };

    script.src = API_URL + "?" + query.toString();
    document.body.appendChild(script);
  });
}

async function loadData() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");

  if (loading) {
    loading.hidden = false;
    loading.textContent = "Loading expiry data...";
  }

  if (error) error.hidden = true;

  try {
    const result = await jsonp({ action: "dashboard" });

    if (!result.success) {
      throw new Error(result.message || "Unable to load data.");
    }

    allItems = result.items || [];

    updateDashboard(result);
    renderTable();

    if (loading) loading.hidden = true;

  } catch (err) {
    if (loading) loading.hidden = true;

    if (error) {
      error.textContent = err.message;
      error.hidden = false;
    }
  }
}

function updateDashboard(data) {
  document.getElementById("total").textContent = data.total ?? 0;
  document.getElementById("safe").textContent = data.safe ?? 0;
  document.getElementById("warning").textContent = data.warning ?? 0;
  document.getElementById("urgent").textContent = data.urgent ?? 0;
  document.getElementById("overdue").textContent = data.overdue ?? 0;
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  const empty = document.getElementById("empty");

  if (!tbody) return;

  const search = document.getElementById("searchInput")?.value
    .toLowerCase().trim() || "";

  const filter = document.getElementById("statusFilter")?.value || "ALL";

  tbody.innerHTML = "";

  const filtered = allItems.filter(item => {
    const matchesSearch = String(item.barcode || "")
      .toLowerCase().includes(search);

    const matchesStatus = filter === "ALL" || item.status === filter;

    return matchesSearch && matchesStatus;
  });

  if (empty) empty.hidden = filtered.length > 0;

  filtered.sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft));

  filtered.forEach(item => {
    const tr = document.createElement("tr");

    const values = [
      item.barcode,
      item.expiry,
      item.before + " Days",
      item.removeDate,
      item.daysLeft + " Days"
    ];

    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value ?? "";
      tr.appendChild(td);
    });

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");

    badge.className = "status status-" + item.status;
    badge.textContent = item.status;

    statusCell.appendChild(badge);
    tr.appendChild(statusCell);

    // DONE BUTTON
    const actionCell = document.createElement("td");
    const doneButton = document.createElement("button");

    doneButton.type = "button";
    doneButton.className = "done-btn";
    doneButton.textContent = "Done";

    doneButton.addEventListener("click", () => {
      confirmDone(item.rowNumber, item.barcode, doneButton);
    });

    actionCell.appendChild(doneButton);
    tr.appendChild(actionCell);

    tbody.appendChild(tr);
  });
}

async function confirmDone(rowNumber, barcode, button) {
  if (!rowNumber) {
    alert("Product row number missing. Please refresh the page.");
    return;
  }

  const confirmed = window.confirm(
    "Are you sure this product has been removed from the store?\n\nBarcode: " +
    barcode
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Processing...";

  try {
    const result = await jsonp({
      action: "markDone",
      row: rowNumber
    });

    if (!result.success) {
      throw new Error(result.message || "Unable to mark product as DONE.");
    }

    await loadData();

    alert("Product marked as DONE successfully!");

  } catch (err) {
    button.disabled = false;
    button.textContent = "Done";

    alert("Error: " + err.message);
  }
}

async function submitExpiry(event) {
  event.preventDefault();

  const form = document.getElementById("expiryForm");
  const message = document.getElementById("formMessage");
  const button = document.getElementById("submitBtn");

  button.disabled = true;
  message.textContent = "Saving...";

  try {
    const result = await jsonp({
      action: "submit",
      barcode: document.getElementById("barcodeInput").value.trim(),
      expiry: document.getElementById("expiryInput").value,
      before: document.getElementById("beforeInput").value,
      scanner: document.getElementById("scannerInput")?.value.trim() || ""
    });

    if (!result.success) {
      throw new Error(result.message || "Unable to save product.");
    }

    message.textContent = "Product saved successfully!";
    form.reset();

    await loadData();

  } catch (err) {
    message.textContent = "Error: " + err.message;
  }

  button.disabled = false;
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.getElementById("expiryForm")
    ?.addEventListener("submit", submitExpiry);

  document.getElementById("searchInput")
    ?.addEventListener("input", renderTable);

  document.getElementById("statusFilter")
    ?.addEventListener("change", renderTable);
});
