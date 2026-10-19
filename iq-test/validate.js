// Independent check of items.json: every claim the test relies on is verified here.
const fs = require('fs');
// Usage: node validate.js [path/to/items.json]   (default: items.json next to this file)
const file = process.argv[2] || __dirname + '/items.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const normalize = cells => {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y, c]) => [x - mx, y - my, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
};
const key = cells => normalize(cells).map(c => c.join(',')).join(';');
const rot = cells => normalize(cells.map(([x, y, c]) => [-y, x, c]));
const mir = cells => normalize(cells.map(([x, y, c]) => [-x, y, c]));
const rots = cells => { const o = []; let c = normalize(cells); for (let i = 0; i < 4; i++) { o.push(key(c)); c = rot(c); } return o; };

let problems = 0;
const fail = (id, msg) => { problems++; console.log('FAIL', id, msg); };

const all = [...data.practice, ...data.bank];
for (const it of all) {
  const tRots = rots(it.target);
  if (it.options.length !== 4) fail(it.id, 'options != 4');
  if (it.options.filter(o => o.correct).length !== 2) fail(it.id, 'correct != 2');
  it.options.forEach((o, i) => {
    const isRotation = tRots.includes(key(o.cells));
    if (o.correct && !isRotation) fail(it.id, `option ${i} marked correct but is not a rotation of the target`);
    if (!o.correct && isRotation) fail(it.id, `option ${i} is a distractor but is a rotation of the target`);
    if (o.kind === 'mirror' && key(o.cells) !== key(mir(it.target))) fail(it.id, `option ${i} is not the mirror`);
  });
  if (it.correct.some(i => !it.options[i].correct)) fail(it.id, 'correct[] index mismatch');
  // chirality: mirror of target must not be a rotation of target
  if (tRots.includes(key(mir(it.target)))) fail(it.id, 'target is achiral');
  // duplicates of the same drawn image
  const drawn = it.options.map(o => key(o.cells) + '@' + o.angle);
  if (new Set(drawn).size !== 4) fail(it.id, 'duplicate option images');
  if (it.nCells !== it.target.length) fail(it.id, 'cell count');
}

// summaries
const byLevel = {};
for (const it of data.bank) (byLevel[it.level] = byLevel[it.level] || []).push(it);
for (const [lv, items] of Object.entries(byLevel)) {
  const cells = [...new Set(items.map(i => i.nCells))].join('/');
  const dtypes = [...new Set(items.map(i => i.distractorTypes.join('+')))].join(', ');
  const disp = items.flatMap(i => i.options.filter(o => o.correct).map(o => o.disparity));
  console.log(`level ${lv}: ${items.length} items, cells ${cells}, distractors ${dtypes}, correct-option disparity ${Math.min(...disp)}..${Math.max(...disp)}`);
}
const posCount = [0, 0, 0, 0];
data.bank.forEach(it => it.correct.forEach(i => posCount[i]++));
console.log('correct-answer position counts A-D:', posCount.join(','));
console.log('general form ids:', data.generalIds.join(' '), '->', data.generalIds.map(id => data.bank.find(i => i.id === id).level).join(''));
console.log(problems ? `${problems} PROBLEMS` : 'all items valid');
process.exit(problems ? 1 : 0);
