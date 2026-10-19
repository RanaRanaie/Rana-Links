const fs = require('fs');
const items = fs.readFileSync(__dirname + '/items.json', 'utf8');
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
if (!tpl.includes('/*__ITEMS__*/null')) throw new Error('placeholder missing');
fs.writeFileSync(__dirname + '/index.html', tpl.replace('/*__ITEMS__*/null', () => items));
console.log('index.html built,', fs.statSync(__dirname + '/index.html').size, 'bytes');
