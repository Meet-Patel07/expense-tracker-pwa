const $ = (s) => $d.querySelector(s),
  $d = document;
const KEY = "ex.v1",
  COLS = [
    "#6366f1",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
    "#ef4444",
    "#8b5cf6",
    "#64748b",
    "#84cc16",
    "#f97316",
  ];
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
let S = { cats: [], tx: [], cfg: {} };
try {
  S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}"));
} catch (e) {}
S.cfg = Object.assign(
  {
    theme: "auto",
    cur: "₹",
    budget: 0,
    lastTab: "home",
  },
  S.cfg,
);
if (!S.cats.length) {
  [
    ["Food", "🍔"],
    ["Transport", "🚗"],
    ["Bills", "🧾"],
    ["Shopping", "🛍️"],
    ["Health", "💊"],
    ["Fun", "🎬"],
    ["Other", "📦"],
  ].forEach(([n, i], k) =>
    S.cats.push({
      id: uid(),
      name: n,
      icon: i,
      type: "exp",
      budget: 0,
      color: COLS[k],
    }),
  );
  [
    ["Salary", "💼"],
    ["Other income", "💰"],
  ].forEach(([n, i], k) =>
    S.cats.push({
      id: uid(),
      name: n,
      icon: i,
      type: "inc",
      budget: 0,
      color: COLS[3 + k],
    }),
  );

  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.warn("Could not initialize Expense Tracker storage:", e);
  }
}
let tab = ["home", "tx", "bud", "rep", "set"].includes(S.cfg.lastTab)
    ? S.cfg.lastTab
    : "home",
  off = 0,
  ft = "all",
  xt = "exp",
  xc = "",
  ed = null,
  ce = null,
  anim = true,
  tt,
  undoSnap;
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
};

/* Add default income categories for existing and new users */
function ensureIncomeCategories() {
  const defaults = [
    ["Freelance", "💻"],
    ["Business income", "🏪"],
    ["Investment returns", "📈"],
    ["Rental income", "🏠"],
    ["Interest income", "🏦"],
    ["Gifts received", "🎁"],
    ["Cashback", "💳"],
  ];

  let changed = false;

  defaults.forEach(([name, icon], index) => {
    const exists = S.cats.some(
      (c) =>
        c.type === "inc" && c.name.trim().toLowerCase() === name.toLowerCase(),
    );

    if (!exists) {
      S.cats.push({
        id: uid(),
        name,
        icon,
        type: "inc",
        budget: 0,
        color: COLS[(index + 3) % COLS.length],
      });

      changed = true;
    }
  });

  if (changed) {
    save();
  }
}

ensureIncomeCategories();
const snap = () => JSON.stringify({ c: S.cats, t: S.tx });
const p2 = (n) => String(n).padStart(2, "0");
const ymd = (d) =>
  d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const dt = (s) => new Date(s + "T00:00:00");
function formatTransactionDateTime(t) {
  const date = dt(t.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timestamp = Number(t.ts);
  const time =
    Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "Time not recorded";

  return `${date} · ${time}`;
}
fd = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const col = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#64748b");
const money = (n) =>
  (n < 0 ? "−" : "") +
  S.cfg.cur +
  (Math.round(Math.abs(n) * 100) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
const cat = (id) =>
  S.cats.find((c) => c.id === id) || {
    name: "(deleted)",
    icon: "❔",
    color: "#94a3b8",
    budget: 0,
    type: "exp",
  };
const sumT = (l, ty) =>
  l.filter((t) => t.type === ty).reduce((a, t) => a + t.amt, 0);
const ms = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + off, 1);
};
const month = () =>
  S.tx.filter((t) => t.date.startsWith(ymd(ms()).slice(0, 7)));
const pbar = (v, b) =>
  `<div class="pb"><div class="${v > b ? "over" : v >= b * 0.75 ? "warn" : "ok"}" style="width:${Math.min(100, (v / b) * 100)}%"></div></div>`;
function addMonth(s, day) {
  const d = dt(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(
    Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
  );
  return ymd(d);
}
function fmtDay(d) {
  const t = ymd(new Date());
  if (d === t) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d === ymd(y)) return "Yesterday";
  return dt(d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
function runRec() {
  const t0 = ymd(new Date());
  let ch = false;
  S.tx
    .filter((t) => t.rep && t.nxt)
    .forEach((t) => {
      let g = 0;
      while (t.nxt <= t0 && g++ < 60) {
        S.tx.push({
          id: uid(),
          ts: Date.now(),
          type: t.type,
          amt: t.amt,
          cat: t.cat,
          date: t.nxt,
          note: t.note,
          rep: "",
          nxt: "",
        });
        t.nxt = addMonth(t.nxt, t.rday);
        ch = true;
      }
    });
  if (ch) save();
}
function toast(msg, sn) {
  $("#tm").textContent = msg;
  undoSnap = sn;
  $("#undo").hidden = !sn;
  $("#toast").classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
$("#undo").onclick = () => {
  if (undoSnap) {
    const d = JSON.parse(undoSnap);
    S.cats = d.c;
    S.tx = d.t;
    save();
    render();
  }
  $("#toast").classList.remove("show");
};

function trow(t, i) {
  const c = cat(t.cat);
  const li = $d.createElement("li");
  const inc = t.type === "inc";

  li.style.setProperty("--i", Math.min(i, 8));

  li.innerHTML = `
    <div class="ic" style="background:${col(c.color)}22">
      ${esc(c.icon)}
    </div>

    <div class="b">
      <div class="t">${esc(t.note || c.name)}</div>
      <div class="m">
        ${esc(c.name)} · ${esc(formatTransactionDateTime(t))}
        ${t.rep ? " · 🔁 monthly" : ""}
      </div>
    </div>

    <div class="r">
      <b class="${inc ? "pos" : ""}">
        ${inc ? "+" : "−"}${money(t.amt)}
      </b>
    </div>
  `;

  li.onclick = () => editX(t.id);
  return li;
}

function fillCategoryFilter(selector) {
  const select = $(selector);
  if (!select) return;

  const previous = select.value;

  select.innerHTML =
    '<option value="all">All categories</option>' +
    S.cats
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
      .join("");

  select.value = [...select.options].some((option) => option.value === previous)
    ? previous
    : "all";
}

function onElement(selector, event, handler) {
  const element = $(selector);

  if (!element) {
    console.error(`Missing HTML element: ${selector}`);
    return;
  }

  element.addEventListener(event, handler);
}

function matchesAmountRange(t, minSelector, maxSelector) {
  const minValue = $(minSelector).value;
  const maxValue = $(maxSelector).value;

  if (minValue !== "" && t.amt < Number(minValue)) return false;
  if (maxValue !== "" && t.amt > Number(maxValue)) return false;

  return true;
}

function sortTransactions(list, sort) {
  const rows = [...list];

  switch (sort) {
    case "amount-desc":
      return rows.sort(
        (a, b) =>
          b.amt - a.amt ||
          b.date.localeCompare(a.date) ||
          (b.ts || 0) - (a.ts || 0),
      );

    case "amount-asc":
      return rows.sort(
        (a, b) =>
          a.amt - b.amt ||
          b.date.localeCompare(a.date) ||
          (b.ts || 0) - (a.ts || 0),
      );

    case "oldest":
      return rows.sort(
        (a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0),
      );

    case "newest":
    default:
      return rows.sort(
        (a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0),
      );
  }
}

const byCat = (l) => {
  const by = {};
  l.filter((t) => t.type === "exp").forEach(
    (t) => (by[t.cat] = (by[t.cat] || 0) + t.amt),
  );
  return by;
};
function rHome() {
  const l = month(),
    I = sumT(l, "inc"),
    E = sumT(l, "exp"),
    B = +S.cfg.budget || 0;
  $("#bal").textContent = money(I - E);
  $("#hI").textContent = money(I);
  $("#hE").textContent = money(E);
  $("#hBud").innerHTML = B
    ? `<div class="m2">${money(E)} of ${money(B)} budget · ${E > B ? money(E - B) + " over" : money(B - E) + " left"}</div>` +
      pbar(E, B)
    : '<div class="m2">Set a monthly budget in the Budgets tab</div>';
  const rows = Object.entries(byCat(l))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  $("#hTop").innerHTML = rows.length
    ? rows
        .map(([id, v]) => {
          const c = cat(id);
          return `<div class="br"><div class="bt"><span>${esc(c.icon)} ${esc(c.name)}</span><b>${money(v)}</b></div>${c.budget ? pbar(v, c.budget) : `<div class="pb"><div style="width:${(v / E) * 100}%;background:${col(c.color)}"></div></div>`}</div>`;
        })
        .join("")
    : '<p class="empty">No spending this month</p>';
  fillCategoryFilter("#hCat");

  const ul = $("#hRec");
  ul.innerHTML = "";

  const homeType = $("#hType").value;
  const homeCat = $("#hCat").value;
  const homeSort = $("#hSort").value;

  let rec = l.filter(
    (t) =>
      (homeType === "all" || t.type === homeType) &&
      (homeCat === "all" || t.cat === homeCat) &&
      matchesAmountRange(t, "#hMin", "#hMax"),
  );

  rec = sortTransactions(rec, homeSort).slice(0, 5);

  rec.forEach((t, i) => ul.append(trow(t, i)));

  $("#hEmpty").hidden = l.length > 0;
  $("#hFilterEmpty").hidden = rec.length > 0 || l.length === 0;
}
function rTx() {
  fillCategoryFilter("#txCat");

  const q = $("#q").value.trim().toLowerCase();
  const type = $("#fT").value;
  const category = $("#txCat").value;
  const sort = $("#txSort").value;
  const from = $("#txFrom").value;
  const to = $("#txTo").value;

  const source = from || to ? S.tx : month();

  let rows = source.filter((t) => {
    const categoryName = cat(t.cat).name;
    const searchableText = `${t.note || ""} ${categoryName}`.toLowerCase();

    if (type !== "all" && t.type !== type) return false;
    if (category !== "all" && t.cat !== category) return false;
    if (q && !searchableText.includes(q)) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;

    return matchesAmountRange(t, "#txMin", "#txMax");
  });

  rows = sortTransactions(rows, sort);

  const box = $("#txl");
  box.innerHTML = "";

  if (sort === "amount-desc" || sort === "amount-asc") {
    const ul = document.createElement("ul");
    ul.className = "list";

    rows.forEach((t, i) => ul.append(trow(t, i)));
    box.append(ul);
  } else {
    const groups = {};

    rows.forEach((t) => {
      (groups[t.date] ||= []).push(t);
    });

    Object.keys(groups)
      .sort((a, b) =>
        sort === "oldest" ? a.localeCompare(b) : b.localeCompare(a),
      )
      .forEach((date) => {
        const dayRows = groups[date];
        const expenses = sumT(dayRows, "exp");
        const heading = document.createElement("div");

        heading.className = "gh";
        heading.innerHTML =
          `<span>${fmtDay(date)}</span>` +
          `<b>${expenses ? "−" + money(expenses) : ""}</b>`;

        box.append(heading);

        const ul = document.createElement("ul");
        ul.className = "list";

        dayRows.forEach((t, i) => ul.append(trow(t, i)));
        box.append(ul);
      });
  }

  $("#tEmpty").hidden = rows.length > 0;
}
function crow(c, sp, i) {
  const li = $d.createElement("li");
  li.style.setProperty("--i", Math.min(i, 8));
  li.innerHTML = `<div class="ic" style="background:${col(c.color)}22">${esc(c.icon)}</div><div class="b"><div class="t">${esc(c.name)}</div><div class="m">${c.type === "exp" ? (c.budget ? money(sp) + " of " + money(c.budget) : money(sp) + " spent · no limit") : "Income category"}</div>${c.type === "exp" && c.budget ? pbar(sp, c.budget) : ""}</div>`;
  li.onclick = () => editC(c.id);
  return li;
}
function rBud() {
  const l = month();
  const B = +S.cfg.budget || 0;
  const E = sumT(l, "exp");
  const by = byCat(l);

  $("#oB").value = B || "";

  $("#oBar").innerHTML = B
    ? `<div class="m2">${money(E)} of ${money(B)} · ${
        E > B ? money(E - B) + " over" : money(B - E) + " left"
      }</div>` + pbar(E, B)
    : "";

  const search = $("#budSearch").value.trim().toLowerCase();
  const sort = $("#budSort").value;
  const status = $("#budStatus").value;

  const matchesSearch = (c) => c.name.toLowerCase().includes(search);

  let expenseCategories = S.cats.filter((c) => {
    if (c.type !== "exp" || !matchesSearch(c)) return false;

    const spent = by[c.id] || 0;
    const hasLimit = Number(c.budget) > 0;
    const over = hasLimit && spent > c.budget;
    const within = hasLimit && spent <= c.budget;

    if (status === "over" && !over) return false;
    if (status === "within" && !within) return false;
    if (status === "limited" && !hasLimit) return false;
    if (status === "unlimited" && hasLimit) return false;

    return true;
  });

  expenseCategories.sort((a, b) => {
    if (sort === "spend-asc") {
      return (by[a.id] || 0) - (by[b.id] || 0);
    }

    if (sort === "name-asc") {
      return a.name.localeCompare(b.name);
    }

    if (sort === "name-desc") {
      return b.name.localeCompare(a.name);
    }

    return (by[b.id] || 0) - (by[a.id] || 0);
  });

  const incomeCategories = S.cats
    .filter((c) => c.type === "inc" && matchesSearch(c))
    .sort((a, b) =>
      sort === "name-desc"
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name),
    );

  const bl = $("#bl");
  const il = $("#il");

  bl.innerHTML = "";
  il.innerHTML = "";

  expenseCategories.forEach((c, i) => {
    bl.append(crow(c, by[c.id] || 0, i));
  });

  incomeCategories.forEach((c, i) => {
    il.append(crow(c, 0, i));
  });

  if (!expenseCategories.length) {
    bl.innerHTML = '<li class="empty">No matching expense categories.</li>';
  }

  if (!incomeCategories.length) {
    il.innerHTML = '<li class="empty">No matching income categories.</li>';
  }
}
function rRep() {
  const l = month(),
    E = sumT(l, "exp"),
    I = sumT(l, "inc"),
    m = ms(),
    y = m.getFullYear(),
    mo = m.getMonth(),
    dim = new Date(y, mo + 1, 0).getDate(),
    n = new Date();
  const days = off === 0 ? n.getDate() : dim;
  $("#pS").textContent = money(E);
  $("#pA").textContent = money(E / days);
  $("#pV").textContent = money(I - E);
  const reportSort = $("#repSort").value;

  const rows = Object.entries(byCat(l));

  rows.sort((a, b) => {
    if (reportSort === "amount-asc") {
      return a[1] - b[1];
    }

    if (reportSort === "name-asc") {
      return cat(a[0]).name.localeCompare(cat(b[0]).name);
    }

    if (reportSort === "name-desc") {
      return cat(b[0]).name.localeCompare(cat(a[0]).name);
    }

    return b[1] - a[1];
  });
  let acc = 0;
  $("#dnT").textContent = money(E);
  $("#dn").style.background = rows.length
    ? "conic-gradient(" +
      rows
        .map(([id, v]) => {
          const s = acc;
          acc += (v / E) * 100;
          return col(cat(id).color) + " " + s + "% " + acc + "%";
        })
        .join(",") +
      ")"
    : "var(--line)";
  $("#dnL").innerHTML = rows
    .map(([id, v]) => {
      const c = cat(id);
      return `<div class="bt" style="margin:8px 0"><i class="dot" style="background:${col(c.color)}"></i><span>${esc(c.icon)} ${esc(c.name)}</span><small>${Math.round((v / E) * 100)}%</small><b>${money(v)}</b></div>`;
    })
    .join("");
  const per = {};
  l.filter((t) => t.type === "exp").forEach((t) => {
    const d = +t.date.slice(8);
    per[d] = (per[d] || 0) + t.amt;
  });
  const mx = Math.max(1, ...Object.values(per)),
    t0 = ymd(n);
  $("#chart").innerHTML = Array.from({ length: dim }, (_, i) => {
    const d = i + 1,
      v = per[d] || 0;
    return `<div class="c${ymd(new Date(y, mo, d)) === t0 ? " now" : ""}"><em></em><div class="bw"><div class="bar" style="height:${(v / mx) * 100}%;--i:${i}"></div></div><small>${d === 1 || d % 5 === 0 ? d : ""}</small></div>`;
  }).join("");
  const T = [];
  for (let k = 5; k >= 0; k--) {
    const s = new Date(y, mo - k, 1),
      key = ymd(s).slice(0, 7),
      x = S.tx.filter((t) => t.date.startsWith(key));
    T.push([
      s.toLocaleDateString(undefined, { month: "short" }),
      sumT(x, "inc"),
      sumT(x, "exp"),
    ]);
  }
  const tm = Math.max(1, ...T.flatMap((a) => [a[1], a[2]]));
  $("#trend").innerHTML =
    '<div style="display:flex;gap:6px">' +
    T.map(
      (a, i) =>
        `<div class="c"><div class="bw pair"><div class="bar" style="height:${(a[1] / tm) * 100}%;background:#10b981;--i:${i}"></div><div class="bar" style="height:${(a[2] / tm) * 100}%;--i:${i}"></div></div><small>${a[0]}</small></div>`,
    ).join("") +
    "</div>";
}
function rSet() {
  $("#cur").value = S.cfg.cur;
}
const R = { home: rHome, tx: rTx, bud: rBud, rep: rRep, set: rSet };
function render() {
  const N = {
    home: "Home",
    tx: "Activity",
    bud: "Budgets",
    rep: "Reports",
    set: "Settings",
  };
  $("#ttl").textContent = N[tab];
  $("#dt").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  $d.querySelectorAll("main>section").forEach(
    (s) => (s.hidden = s.id !== "t-" + tab),
  );
  $d.querySelectorAll("#nav button").forEach((b) =>
    b.classList.toggle("on", b.dataset.t === tab),
  );
  $("#mn").hidden = tab === "set";
  $("#fab").hidden = tab === "set";
  $("#mLab").textContent = ms().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  $("#mNext").disabled = off >= 0;
  R[tab]();
  anim = false;
}

function setTab(t) {
  if (!["home", "tx", "bud", "rep", "set"].includes(t)) {
    return;
  }
  tab = t;
  S.cfg.lastTab = tab;
  save();

  anim = true;
  render();
  const s = $("#t-" + t);
  s.style.animation = "none";
  void s.offsetWidth;
  s.style.animation = "";
  scrollTo({ top: 0 });
}
$d.querySelectorAll("#nav button").forEach(
  (b) => (b.onclick = () => setTab(b.dataset.t)),
);
$("#mPrev").onclick = () => {
  off--;
  anim = true;
  render();
};
$("#mNext").onclick = () => {
  off++;
  anim = true;
  render();
};
// Search and advanced filter event listeners

// Home filters
onElement("#hType", "change", render);
onElement("#hCat", "change", render);
onElement("#hSort", "change", render);
onElement("#hMin", "input", render);
onElement("#hMax", "input", render);

onElement("#hReset", "click", () => {
  $("#hType").value = "all";
  $("#hCat").value = "all";
  $("#hSort").value = "newest";
  $("#hMin").value = "";
  $("#hMax").value = "";
  render();
});

// Activity filters
onElement("#q", "input", render);
onElement("#fT", "change", render);
onElement("#txCat", "change", render);
onElement("#txSort", "change", render);
onElement("#txFrom", "change", render);
onElement("#txTo", "change", render);
onElement("#txMin", "input", render);
onElement("#txMax", "input", render);

onElement("#txReset", "click", () => {
  $("#q").value = "";
  $("#fT").value = "all";
  $("#txCat").value = "all";
  $("#txSort").value = "newest";
  $("#txFrom").value = "";
  $("#txTo").value = "";
  $("#txMin").value = "";
  $("#txMax").value = "";
  render();
});

// Budget filters
onElement("#budSearch", "input", render);
onElement("#budSort", "change", render);
onElement("#budStatus", "change", render);

onElement("#budReset", "click", () => {
  $("#budSearch").value = "";
  $("#budSort").value = "spend-desc";
  $("#budStatus").value = "all";
  render();
});

// Reports filters
onElement("#repSort", "change", render);
$("#repSort").addEventListener("change", render);
$("#oB").onchange = (e) => {
  S.cfg.budget = +e.target.value || 0;
  save();
  render();
};
// Transaction editor
function chips() {
  const b = $("#xC");
  b.innerHTML = "";
  S.cats
    .filter((c) => c.type === xt)
    .forEach((c) => {
      const x = $d.createElement("button");
      x.type = "button";
      x.className = "chip" + (c.id === xc ? " on" : "");
      x.innerHTML = `<span>${esc(c.icon)}</span>${esc(c.name)}`;
      x.onclick = () => {
        xc = c.id;
        chips();
      };
      b.append(x);
    });
}
function setT(t) {
  xt = t;
  if (!S.cats.some((c) => c.id === xc && c.type === t)) xc = "";
  $d.querySelectorAll("#xT button").forEach((b) =>
    b.classList.toggle("on", b.dataset.t === t),
  );
  chips();
}
$d.querySelectorAll("#xT button").forEach(
  (b) => (b.onclick = () => setT(b.dataset.t)),
);
function editX(id) {
  const t = id ? S.tx.find((x) => x.id === id) : null;
  if (id && !t) return;
  ed = t || {
    id: "",
    type: "exp",
    amt: 0,
    cat: "",
    date: off ? ymd(ms()) : ymd(new Date()),
    note: "",
    rep: "",
  };
  xc = ed.cat;
  setT(ed.type);
  $("#xA").value = ed.amt || "";
  $("#xD").value = ed.date;
  $("#xN").value = ed.note || "";
  $("#xR").value = ed.rep || "";
  $("#xE").textContent = "";
  $("#xDel").hidden = !ed.id;
  $("#dx").returnValue = "";
  $("#dx").showModal();
}
$("#fab").onclick = () => editX("");
$("#fx").addEventListener("submit", (ev) => {
  if (ev.submitter && ev.submitter.value !== "save") return;
  if (!xc) {
    ev.preventDefault();
    $("#xE").textContent = "Please pick a category.";
  }
});
$("#dx").addEventListener("close", () => {
  const r = $("#dx").returnValue,
    e = ed;
  if (!e) return;
  ed = null;
  const sn = snap();
  let msg = "Saved ✔";
  if (r === "save") {
    const old = e.date;
    Object.assign(e, {
      type: xt,
      amt: Math.round(parseFloat($("#xA").value) * 100) / 100,
      cat: xc,
      date: $("#xD").value,
      note: $("#xN").value.trim(),
      rep: $("#xR").value,
    });
    if (e.rep) {
      const day = dt(e.date).getDate();
      if (!e.nxt || old !== e.date) {
        e.rday = day;
        e.nxt = addMonth(e.date, day);
      }
    } else e.nxt = "";
    if (!e.id) {
      e.id = uid();
      e.ts = Date.now();
      S.tx.push(e);
    }
    runRec();
    if (e.type === "exp") {
      const l = S.tx.filter((t) => t.date.startsWith(e.date.slice(0, 7))),
        c = cat(e.cat),
        B = +S.cfg.budget || 0;
      if (c.budget && byCat(l)[e.cat] > c.budget)
        msg = "⚠️ " + c.name + " budget exceeded";
      else if (B && sumT(l, "exp") > B) msg = "⚠️ Monthly budget exceeded";
    }
  } else if (r === "del") {
    S.tx = S.tx.filter((x) => x !== e);
    msg = "Deleted";
  } else return;
  save();
  render();
  toast(msg, r === "del" ? sn : null);
});
// Category editor
function editC(id) {
  ce = id
    ? S.cats.find((c) => c.id === id)
    : {
        id: "",
        name: "",
        icon: "📦",
        type: "exp",
        budget: 0,
        color: COLS[S.cats.length % COLS.length],
      };
  $("#cName").value = ce.name;
  $("#cIcon").value = ce.icon;
  $("#cType").value = ce.type;
  $("#cType").disabled = !!ce.id;
  $("#cBud").value = ce.budget || "";
  $("#cBL").hidden = ce.type !== "exp";
  $("#cDel").hidden =
    !ce.id ||
    S.tx.some((t) => t.cat === ce.id) ||
    S.cats.filter((c) => c.type === ce.type).length < 2;
  $("#dc").returnValue = "";
  $("#dc").showModal();
}
$("#addC").onclick = () => editC("");
$("#cType").onchange = (e) => ($("#cBL").hidden = e.target.value !== "exp");
$("#dc").addEventListener("close", () => {
  const r = $("#dc").returnValue,
    c = ce;
  if (!c) return;
  ce = null;
  const sn = snap();
  if (r === "save") {
    Object.assign(c, {
      name: $("#cName").value.trim(),
      icon: $("#cIcon").value.trim() || "📦",
      type: $("#cType").value,
      budget: c.id && c.type !== "exp" ? 0 : +$("#cBud").value || 0,
    });
    if (c.type !== "exp") c.budget = 0;
    if (!c.id) {
      c.id = uid();
      S.cats.push(c);
    }
  } else if (r === "del") S.cats = S.cats.filter((x) => x !== c);
  else return;
  save();
  render();
  if (r === "del") toast("Category deleted", sn);
});

/* Theme settings */
const TH = ["auto", "light", "dark"];

function getTheme() {
  return TH.includes(S.cfg.theme) ? S.cfg.theme : "auto";
}

function isDarkTheme(selected) {
  return (
    selected === "dark" ||
    (selected === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function theme() {
  const selected = getTheme();
  document.documentElement.dataset.theme = selected;

  const icon = $("#themeIcon");
  const button = $("#themeToggle");

  const icons = {
    auto: "🌓",
    light: "☀️",
    dark: "🌙",
  };

  if (icon && button) {
    icon.textContent = icons[selected];

    const label = `Theme: ${selected.charAt(0).toUpperCase()}${selected.slice(1)}`;

    button.setAttribute("aria-label", label);
    button.title = `${label} — click to change`;
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');

  if (themeColor) {
    themeColor.content = isDarkTheme(selected) ? "#0b1020" : "#6366f1";
  }
}

function cycleTheme() {
  const current = getTheme();
  const nextIndex = (TH.indexOf(current) + 1) % TH.length;

  S.cfg.theme = TH[nextIndex];

  save();
  theme();

  const messages = {
    auto: "Theme: Auto (follows your device)",
    light: "Theme: Light",
    dark: "Theme: Dark",
  };

  toast(messages[S.cfg.theme]);

  const icon = $("#themeIcon");

  if (icon) {
    icon.classList.remove("theme-turn");
    void icon.offsetWidth;
    icon.classList.add("theme-turn");
  }
}

$("#themeToggle").onclick = cycleTheme;

$("#themeToggle").onclick = cycleTheme;

$("#cur").oninput = (e) => {
  S.cfg.cur = e.target.value;
  save();
};
function dl(name, text, type) {
  const a = $d.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
}
$("#xCsv").onclick = () => {
  const q = (v) => {
    v = String(v);
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const rows = [["Date", "Type", "Category", "Amount", "Note", "Repeat"]];
  [...S.tx]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) =>
      rows.push([
        t.date,
        t.type === "inc" ? "Income" : "Expense",
        cat(t.cat).name,
        t.amt.toFixed(2),
        t.note || "",
        t.rep || "",
      ]),
    );
  dl(
    "transactions-" + ymd(new Date()) + ".csv",
    rows.map((r) => r.map(q).join(",")).join("\n"),
    "text/csv",
  );
};
$("#xBk").onclick = () =>
  dl(
    "expense-backup-" + ymd(new Date()) + ".json",
    JSON.stringify(S, null, 2),
    "application/json",
  );
$("#iBk").onclick = () => $("#file").click();
$("#file").onchange = async (e) => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(d.cats) || !Array.isArray(d.tx)) throw 0;
    if (confirm("Replace all current data with this backup?")) {
      S.cats = d.cats;
      S.tx = d.tx;
      S.cfg = Object.assign(S.cfg, d.cfg);
      save();
      theme();
      render();
    }
  } catch (x) {
    alert("This is not a valid backup file.");
  }
  e.target.value = "";
};
$("#clrT").onclick = () => {
  if (!S.tx.length) return toast("No transactions to delete");
  if (confirm("Delete ALL transactions? Categories are kept.")) {
    const sn = snap();
    S.tx = [];
    save();
    render();
    toast("All transactions deleted", sn);
  }
};

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

systemTheme.addEventListener?.("change", () => {
  if (getTheme() === "auto") {
    theme();
  }
});

theme();
runRec();
render();
addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    runRec();
    render();
  }
});
// ---- PWA plumbing ----
if ("serviceWorker" in navigator)
  addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
const off$ = $("#offline"),
  setOn = () => (off$.hidden = navigator.onLine);
addEventListener("online", setOn);
addEventListener("offline", setOn);
setOn();
let deferred;
const btn = $("#install");
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  btn.hidden = false;
});
btn.onclick = async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  btn.hidden = true;
};
addEventListener("appinstalled", () => (btn.hidden = true));
