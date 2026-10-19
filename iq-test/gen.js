// Generator for the two-colour polyomino mental-rotation items.
// Deterministic (seeded) so every participant sees the identical item bank.
// Usage: node gen.js  -> writes items.json
const fs = require('fs');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const K = (x, y) => x + ',' + y;

/* ---------- geometry helpers: cells are [x, y, colour] with colour 0 or 1 ---------- */
function normalize(cells) {
  const minx = Math.min(...cells.map(c => c[0])), miny = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y, c]) => [x - minx, y - miny, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}
const keyOf = cells => normalize(cells).map(c => c.join(',')).join(';');
const rot90 = cells => normalize(cells.map(([x, y, c]) => [-y, x, c]));
const mirror = cells => normalize(cells.map(([x, y, c]) => [-x, y, c]));
function rotationKeys(cells) {
  const out = []; let cur = normalize(cells);
  for (let i = 0; i < 4; i++) { out.push(keyOf(cur)); cur = rot90(cur); }
  return out;
}
const equivRot = (a, b) => rotationKeys(a).includes(keyOf(b));

function connected(pts) {
  if (!pts.length) return false;
  const set = new Set(pts.map(p => K(p[0], p[1])));
  const seen = new Set([K(pts[0][0], pts[0][1])]); const q = [pts[0]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) {
      const k = K(x + dx, y + dy);
      if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  return seen.size === set.size;
}
function hasHole(cells) {
  const set = new Set(cells.map(c => K(c[0], c[1])));
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const seen = new Set([K(x0, y0)]); const q = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const k = K(nx, ny);
      if (set.has(k) || seen.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen.size + set.size !== (x1 - x0 + 1) * (y1 - y0 + 1);
}
function contactEdges(cells) {
  const m = new Map(cells.map(c => [K(c[0], c[1]), c[2]]));
  let n = 0;
  for (const [x, y, c] of cells) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const o = m.get(K(x + dx, y + dy));
    if (o !== undefined && o !== c) n++;
  }
  return n;
}
function bbox(cells) {
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
}
function pieceOk(cells, colour) {
  const p = cells.filter(c => c[2] === colour);
  const [w, h] = bbox(p);
  return w >= 2 && h >= 2 && connected(p.map(c => [c[0], c[1]]));
}

/* ---------- random figure: piece 0 (kA cells) + piece 1 (kB cells), interlocking ---------- */
function randomFigure(r, kA, kB, maxDim, minFill) {
  for (let t = 0; t < 20000; t++) {
    const occ = new Map();
    const A = [[0, 0]]; occ.set(K(0, 0), 0);
    const grow = (list, c, k) => {
      while (list.length < k) {
        const [x, y] = list[Math.floor(r() * list.length)];
        const [dx, dy] = DIRS[Math.floor(r() * 4)];
        const nx = x + dx, ny = y + dy;
        if (occ.has(K(nx, ny))) continue;
        occ.set(K(nx, ny), c); list.push([nx, ny]);
      }
    };
    grow(A, 0, kA);
    const cand = [];
    for (const [x, y] of A) for (const [dx, dy] of DIRS) if (!occ.has(K(x + dx, y + dy))) cand.push([x + dx, y + dy]);
    const seed = cand[Math.floor(r() * cand.length)];
    const B = [seed]; occ.set(K(seed[0], seed[1]), 1);
    grow(B, 1, kB);

    const cells = normalize([...occ.entries()].map(([k, c]) => { const [x, y] = k.split(',').map(Number); return [x, y, c]; }));
    const [w, h] = bbox(cells);
    if (Math.max(w, h) > maxDim) continue;
    if (cells.length / (w * h) < minFill) continue;
    if (hasHole(cells)) continue;
    if (contactEdges(cells) < 2) continue;
    if (!pieceOk(cells, 0) || !pieceOk(cells, 1)) continue;
    if (equivRot(cells, mirror(cells))) continue;           // must be chiral so a mirror image is a true distractor
    return cells;
  }
  throw new Error('no figure found');
}

/* ---------- structural distractor: move one cell of one piece ---------- */
function shiftOneCell(r, cells, avoid) {
  for (let t = 0; t < 2000; t++) {
    const i = Math.floor(r() * cells.length);
    const [x, y, c] = cells[i];
    const rest = cells.filter((_, j) => j !== i);
    const piece = rest.filter(p => p[2] === c);
    if (!connected(piece.map(p => [p[0], p[1]]))) continue;
    const occ = new Set(rest.map(p => K(p[0], p[1])));
    const cand = [];
    for (const p of piece) for (const [dx, dy] of DIRS) {
      const nx = p[0] + dx, ny = p[1] + dy;
      if (!occ.has(K(nx, ny)) && !(nx === x && ny === y)) cand.push([nx, ny]);
    }
    if (!cand.length) continue;
    const [nx, ny] = cand[Math.floor(r() * cand.length)];
    const out = normalize(rest.concat([[nx, ny, c]]));
    if (!connected(out.map(p => [p[0], p[1]]))) continue;
    if (hasHole(out) || contactEdges(out) < 2) continue;
    if (!pieceOk(out, 0) || !pieceOk(out, 1)) continue;
    if (equivRot(out, cells)) continue;
    if (avoid.some(a => equivRot(out, a))) continue;
    const [w0, h0] = bbox(cells), [w1, h1] = bbox(out);
    if (Math.max(w1, h1) > Math.max(w0, h0) + 1) continue;
    return out;
  }
  return null;
}

/* ---------- angles ---------- */
const norm = a => ((a % 360) + 360) % 360;
const disparity = a => Math.min(norm(a), 360 - norm(a));          // 0..180
const angDiff = (a, b) => disparity(a - b);
const isOblique = a => { const m = norm(a) % 90; return m >= 15 && m <= 75; };
const randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function pickAngles(r, level) {
  for (let t = 0; t < 1000; t++) {
    let correct, wrong;
    if (level === 1) {
      correct = shuffle(r, [90, 180, 270]).slice(0, 2);
      wrong = [pick(r, [90, 180, 270]), pick(r, [90, 180, 270])];
    } else if (level === 2) {
      correct = [pick(r, [90, 135, 180, 225, 270]), pick(r, [90, 135, 180, 225, 270])];
      wrong = [pick(r, [45, 90, 135, 180, 225, 270, 315]), pick(r, [45, 90, 135, 180, 225, 270, 315])];
    } else if (level === 3) {
      correct = [pick(r, [90, 180, 270]), randInt(r, 40, 320)];
      if (!isOblique(correct[1])) continue;
      wrong = [randInt(r, 30, 330), randInt(r, 30, 330)];
    } else {
      correct = [randInt(r, 100, 260), randInt(r, 100, 260)];
      if (!isOblique(correct[0]) || !isOblique(correct[1])) continue;
      wrong = [randInt(r, 30, 330), randInt(r, 30, 330)];
      if (!isOblique(wrong[0]) || !isOblique(wrong[1])) continue;
    }
    if (angDiff(correct[0], correct[1]) < 40) continue;
    if (angDiff(wrong[0], wrong[1]) < 40) continue;
    if (correct.some(a => disparity(a) < 40)) continue;
    if (wrong.some(a => disparity(a) < 40)) continue;
    return { correct, wrong };
  }
  throw new Error('no angles');
}

/* ---------- level definitions ---------- */
const LEVELS = {
  1: { sizes: [[3, 4]],         maxDim: 3, minFill: 0.60, dist: [['shift', 'shift']] },
  2: { sizes: [[4, 4], [4, 5]], maxDim: 4, minFill: 0.55, dist: [['mirror', 'shift']] },
  3: { sizes: [[4, 5]],         maxDim: 4, minFill: 0.55, dist: [['mirror', 'mirror']] },
  4: { sizes: [[5, 6]],         maxDim: 5, minFill: 0.50, dist: [['mirror', 'mirror'], ['mirror', 'shift']] },
};

const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

function makeItem(id, level, seed, correctPos) {
  const r = mulberry32(seed);
  const L = LEVELS[level];
  const [kA, kB] = pick(r, L.sizes);
  const dtypes = pick(r, L.dist);
  for (let attempt = 0; attempt < 200; attempt++) {
    const target = randomFigure(r, kA, kB, L.maxDim, L.minFill);
    const { correct, wrong } = pickAngles(r, level);

    const distractors = [];
    const used = [];
    let ok = true;
    for (let d = 0; d < 2; d++) {
      if (dtypes[d] === 'mirror') {
        distractors.push({ cells: mirror(target), angle: wrong[d], kind: 'mirror' });
      } else {
        const s = shiftOneCell(r, target, used);
        if (!s) { ok = false; break; }
        used.push(s);
        distractors.push({ cells: s, angle: wrong[d], kind: 'shift' });
      }
    }
    if (!ok) continue;

    const options = [
      ...correct.map(a => ({ cells: target, angle: a, kind: 'target', correct: true })),
      ...distractors.map(o => ({ ...o, correct: false })),
    ];
    // place correct options at the balanced positions
    const slots = new Array(4).fill(null);
    const [p1, p2] = correctPos;
    const order = shuffle(r, [0, 1]);              // which correct goes where
    slots[p1] = options[order[0]]; slots[p2] = options[order[1]];
    const rest = shuffle(r, [2, 3]);
    const free = [0, 1, 2, 3].filter(i => i !== p1 && i !== p2);
    slots[free[0]] = options[rest[0]]; slots[free[1]] = options[rest[1]];

    return {
      id, level, nCells: target.length, nA: kA, nB: kB,
      target,
      options: slots.map(o => ({ cells: o.cells, angle: o.angle, kind: o.kind, correct: o.correct, disparity: disparity(o.angle) })),
      correct: [p1, p2],
      distractorTypes: dtypes,
    };
  }
  throw new Error('item failed ' + id);
}

/* ---------- build the bank ---------- */
const plan = [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4];   // 20 specialised items, easy -> hard
const posCycle = [];
{
  const r = mulberry32(777);
  while (posCycle.length < 40) posCycle.push(...shuffle(r, PAIRS));
}
const bank = plan.map((lv, i) => makeItem('S' + String(i + 1).padStart(2, '0'), lv, 1000 + i * 7919, posCycle[i]));

// 10-item general form: subset of the same bank (shared anchor items -> scores comparable)
const generalIds = ['S01', 'S02', 'S04', 'S05', 'S06', 'S07', 'S09', 'S10', 'S11', 'S12'];

const practice = [
  makeItem('P1', 1, 424242, [0, 3]),
  makeItem('P2', 2, 515151, [1, 2]),
];

fs.writeFileSync(__dirname + '/items.json', JSON.stringify({ practice, bank, generalIds }));
console.log('items written:', bank.length, 'bank +', practice.length, 'practice');
