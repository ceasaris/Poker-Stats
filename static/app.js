const MAX_HANDS = 9;
const MIN_HANDS = 2;
const handsEl = document.getElementById("hands");
const outEl = document.getElementById("out");
const addBtn = document.getElementById("addHand");

const state = { flop: [], hands: [], invalid: false, blocked: false, attempt: null };  // attempt: set once Calculate is pressed  // hands: { cards, panel } objects

const SUIT_SYMBOL = { c: "♣", d: "♦", h: "♥", s: "♠" };

function makeCard(c) {
  const el = document.createElement("span");
  el.className = "card" + ("dh".includes(c[1]) ? " red" : "");
  el.dataset.code = c;
  const rank = document.createElement("b");
  rank.textContent = c[0] === "T" ? "10" : c[0];
  const suit = document.createElement("i");
  suit.textContent = SUIT_SYMBOL[c[1]] || "?";
  el.append(rank, suit);
  return el;
}

// Pip positions (x, y) on a 100x140 card for ranks 2-10, like a real deck.
const L = 30, C = 50, R = 70;
const PIPS = {
  2: [[C, 32], [C, 108]],
  3: [[C, 32], [C, 70], [C, 108]],
  4: [[L, 32], [R, 32], [L, 108], [R, 108]],
  5: [[L, 32], [R, 32], [C, 70], [L, 108], [R, 108]],
  6: [[L, 32], [R, 32], [L, 70], [R, 70], [L, 108], [R, 108]],
  7: [[L, 32], [R, 32], [C, 51], [L, 70], [R, 70], [L, 108], [R, 108]],
  8: [[L, 32], [R, 32], [C, 51], [L, 70], [R, 70], [C, 89], [L, 108], [R, 108]],
  9: [[L, 32], [R, 32], [L, 56], [R, 56], [C, 70], [L, 84], [R, 84], [L, 108], [R, 108]],
  10: [[L, 32], [R, 32], [C, 44], [L, 56], [R, 56], [L, 84], [R, 84], [C, 96], [L, 108], [R, 108]],
};
const FACE_NAME = { J: "J", Q: "Q", K: "K" };

function cardSVG(code) {
  const rank = code[0], suit = SUIT_SYMBOL[code[1]];
  const color = "dh".includes(code[1]) ? "#c8102e" : "#14181a";
  const label = rank === "T" ? "10" : rank;
  const t = (x, y, size, txt, extra = "") =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${extra}>${txt}</text>`;
  const rot = (x, y, inner) => `<g transform="rotate(180 ${x} ${y})">${inner}</g>`;

  let body = "";
  if (rank === "A") {
    body = t(C, 72, 64, suit);
  } else if (FACE_NAME[rank]) {
    body = `<rect x="24" y="26" width="52" height="88" rx="5" fill="${color}" fill-opacity=".07" stroke="${color}" stroke-width="1.5"/>`
      + t(C, 70, 50, label, 'font-weight="700" font-family="Georgia, serif"')
      + t(C, 40, 20, suit) + rot(C, 70, t(C, 40, 20, suit));
  } else {
    body = PIPS[label === "10" ? 10 : +rank]
      .map(([x, y]) => (y > 70 ? rot(x, y, t(x, y, 26, suit)) : t(x, y, 26, suit)))
      .join("");
  }
  const corner = t(10, 18, label === "10" ? 14 : 17, label, 'font-weight="700" font-family="Georgia, serif"')
    + t(10, 34, 15, suit);
  return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" fill="${color}" role="img" aria-label="${label} of ${suit}">
    <rect x="1" y="1" width="98" height="138" rx="9" fill="#fff" stroke="#b9b9b0" stroke-width="1.5"/>
    ${corner}${rot(C, 70, corner)}${body}</svg>`;
}

// A realistic card face for the flop/hand slots (falls back to a plain tile for bad input).
function makeFace(code) {
  if (!VALID_CARD.test(code)) return makeCard(code);
  const el = document.createElement("span");
  el.className = "card face";
  el.dataset.code = code;
  el.innerHTML = cardSVG(code);
  return el;
}

function renderCards(el, cards) {
  el.replaceChildren(...cards.map(makeFace));
  validate();
}

const VALID_CARD = /^[2-9TJQKA][cdhs]$/;
const FLOP_SIZE = 3;
const HAND_SIZE = 2;

function prettyCard(c) {
  return (c[0] === "T" ? "10" : c[0]) + (SUIT_SYMBOL[c[1]] || "");
}

function setCount(el, n, need) {
  el.textContent = `${n}/${need}`;
  el.classList.toggle("ok", n === need);
  el.classList.toggle("over", n > need);
}

// Messages for slots that don't have the right number of cards.
function countProblems(needFlop) {
  const out = [];
  if (needFlop && state.flop.length !== FLOP_SIZE)
    out.push(`The flop needs exactly ${FLOP_SIZE} cards (it has ${state.flop.length}).`);
  state.hands.forEach((h, i) => {
    if (h.cards.length !== HAND_SIZE)
      out.push(`Hand ${i + 1} needs exactly ${HAND_SIZE} cards (it has ${h.cards.length}).`);
  });
  return out;
}

// Flags repeated or malformed cards across the flop and every hand, and
// disables the calculate buttons until they are fixed.
function validate() {
  const slots = [{ cards: state.flop, el: document.getElementById("flopCards") },
                 ...state.hands.map(h => ({ cards: h.cards, el: h.panel.querySelector(".cards") }))];
  const counts = new Map();
  for (const { cards } of slots)
    for (const c of cards) counts.set(c, (counts.get(c) || 0) + 1);

  const dups = [...counts].filter(([c, n]) => VALID_CARD.test(c) && n > 1).map(([c]) => c);
  const invalid = [...new Set(slots.flatMap(s => s.cards).filter(c => !VALID_CARD.test(c)))];
  for (const { el } of slots)
    for (const cardEl of el.querySelectorAll(".card")) {
      const code = cardEl.dataset.code;
      cardEl.classList.toggle("bad", dups.includes(code) || !VALID_CARD.test(code));
    }

  // live "n/needed" counters on every slot
  const flopCount = document.getElementById("flopCount");
  setCount(flopCount, state.flop.length, FLOP_SIZE);
  state.hands.forEach(h => setCount(h.panel.querySelector(".count"), h.cards.length, HAND_SIZE));

  const msgs = [];
  if (state.attempt) msgs.push(...countProblems(state.attempt.needFlop));
  if (dups.length) msgs.push(`Duplicate card${dups.length > 1 ? "s" : ""}: ${dups.map(prettyCard).join(", ")} — each card can only be used once.`);
  if (invalid.length) msgs.push(`Unrecognized card${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}. Use rank + suit, e.g. As, Td, 7c.`);
  const warn = document.getElementById("warn");
  warn.textContent = msgs.join(" ");
  warn.hidden = !msgs.length;
  state.invalid = msgs.length > 0;                       // anything wrong: calculating is refused
  state.blocked = dups.length > 0 || invalid.length > 0; // duplicates/bad codes also grey out the buttons
  document.querySelectorAll("#calc, #calcPre").forEach(b => (b.disabled = state.blocked));
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

const ICON_CAMERA = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
const ICON_UPLOAD = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>`;

function pickerHTML() {
  return `
    <label class="pick camera">${ICON_CAMERA}<span>Camera</span><input type="file" accept="image/*" capture="environment" hidden></label>
    <label class="pick upload">${ICON_UPLOAD}<span>Upload</span><input type="file" accept="image/*" hidden></label>
    <input type="text" placeholder="or type: As Kh">`;
}

function bindInputs({ root, cardsEl, kind, onCards }) {
  const textEl = root.querySelector("input[type=text]");
  for (const fileEl of root.querySelectorAll("input[type=file]")) {
    fileEl.addEventListener("change", async () => {
      const file = fileEl.files[0];
      fileEl.value = "";  // allow picking the same photo again
      if (!file) return;
      cardsEl.textContent = "Reading…";
      try {
        const cards = await recognize(file, kind);
        textEl.value = cards.join(" ");
        onCards(cards);
        renderCards(cardsEl, cards);
      } catch (e) {
        showError(cardsEl, e.message);
      }
    });
  }
  textEl.addEventListener("input", () => {
    const cards = parseText(textEl.value);
    onCards(cards);
    renderCards(cardsEl, cards);
  });
}

const flopRow = document.getElementById("flopRow");
flopRow.innerHTML = pickerHTML();
bindInputs({
  root: flopRow,
  cardsEl: document.getElementById("flopCards"),
  kind: "flop",
  onCards: c => (state.flop = c),
});

function refreshHands() {
  state.hands.forEach((h, i) => {
    h.panel.querySelector(".badge").textContent = i + 1;
    h.panel.querySelector(".title").textContent = `Hand ${i + 1}`;
    h.panel.querySelector(".remove").disabled = state.hands.length <= MIN_HANDS;
  });
  addBtn.disabled = state.hands.length >= MAX_HANDS;
  validate();
}

function addHand() {
  if (state.hands.length >= MAX_HANDS) return;
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2><span class="badge"></span> <span class="title"></span>
      <span class="count"></span>
      <button class="remove" title="Remove this hand">✕</button></h2>
    <div class="row">${pickerHTML()}</div>
    <div class="cards"></div>`;
  handsEl.appendChild(panel);
  const hand = { cards: [], panel };
  state.hands.push(hand);
  bindInputs({
    root: panel.querySelector(".row"),
    cardsEl: panel.querySelector(".cards"),
    kind: "hand",
    onCards: c => (hand.cards = c),
  });
  panel.querySelector(".remove").addEventListener("click", () => {
    if (state.hands.length <= MIN_HANDS) return;
    state.hands.splice(state.hands.indexOf(hand), 1);
    panel.remove();
    refreshHands();
  });
  refreshHands();
}

addBtn.addEventListener("click", addHand);

async function calculate(btn, flop, title) {
  state.attempt = { needFlop: flop.length > 0 || btn.id === "calc" };
  validate();
  if (state.invalid) return;
  const buttons = document.querySelectorAll("#calc, #calcPre");
  buttons.forEach(b => (b.disabled = true));
  outEl.hidden = false;
  outEl.textContent = "Calculating…";
  try {
    const res = await fetch("/api/odds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flop, hands: state.hands.map(h => h.cards) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    outEl.innerHTML = `<h2>${title}</h2>`;
    const best = Math.max(...data.results.map(r => r.equity));
    data.results.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "result" + (r.equity === best ? " leader" : "");
      div.innerHTML = `
        <div class="result-head">
          <span class="badge">${i + 1}</span>
          <span class="mini-cards"></span>
          <span class="pct">${r.equity}%</span>
        </div>
        <div class="bar"><div style="width:${r.equity}%"></div></div>
        <div class="hint">win ${r.win}% · tie ${r.tie}%</div>`;
      div.querySelector(".mini-cards").append(...r.hand.map(makeCard));
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
    buttons.forEach(b => (b.disabled = state.blocked));
  }
}

document.getElementById("calc").addEventListener("click", e =>
  calculate(e.currentTarget, state.flop, "Odds of winning (with flop)"));
document.getElementById("calcPre").addEventListener("click", e =>
  calculate(e.currentTarget, [], "Pre-flop odds of winning"));

addHand();
addHand();
