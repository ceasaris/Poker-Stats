const MAX_HANDS = 9;
const handsEl = document.getElementById("hands");
const outEl = document.getElementById("out");
const addBtn = document.getElementById("addHand");

const state = { flop: [], hands: [] };  // hands: arrays of card strings

const SUIT_SYMBOL = { c: "♣", d: "♦", h: "♥", s: "♠" };

function label(c) {
  return (c[0] === "T" ? "10" : c[0]) + (SUIT_SYMBOL[c[1]] || "?");
}

function renderCards(el, cards) {
  el.innerHTML = "";
  for (const c of cards) {
    const span = document.createElement("span");
    span.className = "card" + ("dh".includes(c[1]) ? " red" : "");
    span.textContent = label(c);
    el.appendChild(span);
  }
}

function showError(el, message) {
  el.innerHTML = "";
  const span = document.createElement("span");
  span.className = "err";
  span.textContent = message;
  el.appendChild(span);
}

function parseText(text) {
  return text.split(/[\s,]+/).filter(Boolean).map(t => {
    t = t.replace("10", "T");
    return t[0].toUpperCase() + (t[1] || "").toLowerCase();
  });
}

async function recognize(file, kind) {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("kind", kind);
  const res = await fetch("/api/recognize", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Recognition failed");
  return data.cards;
}

function bindInputs({ fileEl, textEl, cardsEl, kind, onCards }) {
  fileEl.addEventListener("change", async () => {
    if (!fileEl.files[0]) return;
    cardsEl.textContent = "Reading…";
    try {
      const cards = await recognize(fileEl.files[0], kind);
      textEl.value = cards.join(" ");
      onCards(cards);
      renderCards(cardsEl, cards);
    } catch (e) {
      showError(cardsEl, e.message);
    }
  });
  textEl.addEventListener("input", () => {
    const cards = parseText(textEl.value);
    onCards(cards);
    renderCards(cardsEl, cards);
  });
}

bindInputs({
  fileEl: document.getElementById("flopFile"),
  textEl: document.getElementById("flopText"),
  cardsEl: document.getElementById("flopCards"),
  kind: "flop",
  onCards: c => (state.flop = c),
});

function addHand() {
  if (state.hands.length >= MAX_HANDS) return;
  const idx = state.hands.length;
  state.hands.push([]);
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>Hand ${idx + 1}</h2>
    <div class="row">
      <input type="file" accept="image/*">
      <input type="text" placeholder="e.g. As Kh">
    </div>
    <div class="cards"></div>`;
  handsEl.appendChild(panel);
  const [fileEl, textEl] = panel.querySelectorAll("input");
  bindInputs({
    fileEl, textEl, cardsEl: panel.querySelector(".cards"), kind: "hand",
    onCards: c => (state.hands[idx] = c),
  });
  addBtn.disabled = state.hands.length >= MAX_HANDS;
}

addBtn.addEventListener("click", addHand);

async function calculate(btn, flop, title) {
  const buttons = document.querySelectorAll("#calc, #calcPre");
  buttons.forEach(b => (b.disabled = true));
  outEl.hidden = false;
  outEl.textContent = "Calculating…";
  try {
    const res = await fetch("/api/odds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flop, hands: state.hands }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    outEl.innerHTML = `<h2>${title}</h2>`;
    data.results.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "result";
      div.innerHTML = `<strong>Hand ${i + 1}</strong>: <span class="cards-inline"></span>
        — <strong>${r.equity}%</strong> equity
        <span class="hint">(win ${r.win}%, tie ${r.tie}%)</span>
        <div class="bar"><div style="width:${r.equity}%"></div></div>`;
      div.querySelector(".cards-inline").textContent = r.hand.map(label).join(" ");
      outEl.appendChild(div);
    });
    if (!flop.length) {
      const note = document.createElement("div");
      note.className = "hint";
      note.style.marginTop = "10px";
      note.textContent = "Pre-flop odds are estimated from 30,000 random boards (about ±0.3%).";
      outEl.appendChild(note);
    }
  } catch (e) {
    showError(outEl, e.message);
  } finally {
    buttons.forEach(b => (b.disabled = false));
  }
}

document.getElementById("calc").addEventListener("click", e =>
  calculate(e.currentTarget, state.flop, "Odds of winning (with flop)"));
document.getElementById("calcPre").addEventListener("click", e =>
  calculate(e.currentTarget, [], "Pre-flop odds of winning"));

addHand();
addHand();
