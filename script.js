const API_URL = "https://script.google.com/macros/s/AKfycbyHtGVPwfVmwtT9qumO-kHRs9Amfhvhn26_dKF5BEpyyNDRXw1vsKjF3hPWnAU00-hp/exec";

let allItems = [];

// ---- DONE / ARCHIVE (Google Sheet e save hoy, shob device e same) ----
async function setDone(item, isDone) {
  const error = document.getElementById("error");
  if (error) error.hidden = true;

  // Instant UI update, tarpor server e save
  if (!item.row) {
    if (error) {
      error.textContent = "Server purano version. Apps Script New version e Deploy koro, tarpor Refresh koro.";
      error.hidden = false;
    }
    return;
  }

  const before = item.done;
  item.done = isDone;
  updateDashboard();
  renderTable();

  try {
    const result = await jsonp({
      action: "done",
      row: item.row,
      barcode: item.barcode,
      done: isDone ? "true" : "false"
    });
    if (!result.success) throw new Error(result.message);

    // Purano Apps Script 'done' action chine na, shudhu "Running" bole
    if (result.message !== "Updated") {
      throw new Error("Server e save hoyni. Apps Script ke New version e Deploy korte hobe.");
    }
  } catch (err) {
    item.done = before;
    updateDashboard();
    renderTable();
    if (error) {
      error.textContent = err.message;
      error.hidden = false;
    }
  }
}

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

    updateDashboard();
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

function updateDashboard() {
  const active = allItems.filter(i => !i.done);
  const count = s => active.filter(i => i.status === s).length;

  document.getElementById("total").textContent = active.length;
  document.getElementById("safe").textContent = count("SAFE");
  document.getElementById("warning").textContent = count("WARNING");
  document.getElementById("urgent").textContent = count("URGENT");
  document.getElementById("overdue").textContent = count("OVERDUE");
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  const empty = document.getElementById("empty");

  if (!tbody) return;

  const search = document.getElementById("searchInput")?.value
    .toLowerCase().trim() || "";

  const filter = document.getElementById("statusFilter")?.value || "ALL";

  tbody.innerHTML = "";

  const view = document.getElementById("viewFilter")?.value || "ACTIVE";
  const filtered = allItems.filter(item => {
    const isDone = !!item.done;
    if (view === "ACTIVE" && isDone) return false;
    if (view === "DONE" && !isDone) return false;

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

    const actionCell = document.createElement("td");
    const btn = document.createElement("button");
    const isDone = view === "DONE";
    btn.type = "button";
    btn.className = "done-btn";
    btn.textContent = isDone ? "↩ Restore" : "✓ Done";
    btn.onclick = () => setDone(item, !isDone);
    actionCell.appendChild(btn);
    tr.appendChild(actionCell);

    tbody.appendChild(tr);
  });
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

    if (!result.success) throw new Error(result.message);

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

  document.getElementById("viewFilter")
    ?.addEventListener("change", renderTable);
});
