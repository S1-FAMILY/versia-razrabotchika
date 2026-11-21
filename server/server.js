/* S1 CONTEST — сервер заказов, оплаты, опроса и анкет волонтёров.
   Без зависимостей: Node.js 18+.   Запуск:  node server/server.js
   Настройки — переменные окружения (см. server/README.md). */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const C = require('../config.js');

const PORT = +process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const SITE_URL = (process.env.SITE_URL || 'http://localhost:' + PORT).replace(/\/$/, '');
const YK_ID = process.env.YK_SHOP_ID, YK_KEY = process.env.YK_SECRET;
const TG_TOKEN = process.env.TG_BOT_TOKEN, TG_CHAT = process.env.TG_CHAT_ID;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SALT = process.env.POLL_SALT || 'change-me';
fs.mkdirSync(DATA, { recursive: true });

/* ---------- мини-хранилище (JSON-файлы) ---------- */
const file = n => path.join(DATA, n);
function load(n, def) { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return def; } }
function save(n, v) { const t = file(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, file(n)); }
const orders = load('orders.json', { seq: 0, items: {} });
const vols = load('volunteers.json', []);
const poll = load('poll.json', []);

/* ---------- утилиты ---------- */
const rnd = () => crypto.randomBytes(16).toString('hex');
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const cleanML = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const hits = new Map();
function limited(ip, max) { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000); a.push(now); hits.set(ip, a); return a.length > max; }
function send(res, code, obj, extra) { const b = JSON.stringify(obj); res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {})); res.end(b); }
function body(req) { return new Promise((ok, no) => { let s = ''; req.on('data', d => { s += d; if (s.length > 60000) { no(new Error('big')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { no(new Error('json')); } }); }); }
async function notify(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try { await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }) }); } catch (e) { console.error('tg', e.message); }
}

/* ---------- ЮKassa ---------- */
const ykAuth = () => 'Basic ' + Buffer.from(YK_ID + ':' + YK_KEY).toString('base64');
async function ykCreate(o) {
  const val = n => n.toFixed(2);
  const advance = o.type === 'master' && o.prepay;
  const items = o.type === 'vip'
    ? [{ description: 'VIP-билет S1 CONTEST', quantity: String(o.qty), amount: { value: val(o.unit), currency: 'RUB' }, vat_code: C.pay.vatCode, payment_mode: 'full_payment', payment_subject: 'service' }]
    : [{ description: (advance ? 'Предоплата: ' : '') + 'Мастер-классы S1 CONTEST', quantity: '1', amount: { value: val(o.amount), currency: 'RUB' }, vat_code: C.pay.vatCode, payment_mode: advance ? 'advance' : 'full_payment', payment_subject: 'service' }];
  const req = {
    amount: { value: val(o.amount), currency: 'RUB' }, capture: true,
    description: ('Заказ ' + o.num + ' · S1 CONTEST').slice(0, 128),
    metadata: { order_id: o.id, num: o.num },
    receipt: { customer: { full_name: o.fio, email: o.email, phone: '+' + o.phone.replace(/\D/g, '') }, items },
    payment_method_data: { type: o.method === 'sbp' ? 'sbp' : 'bank_card' },
    confirmation: o.method === 'sbp' ? { type: 'qr' } : { type: 'redirect', return_url: SITE_URL + '/pay.html?id=' + o.id }
  };
  const r = await fetch('https://api.yookassa.ru/v3/payments', { method: 'POST', headers: { 'Authorization': ykAuth(), 'Idempotence-Key': o.id, 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
  const j = await r.json();
  if (!r.ok) throw new Error('yookassa ' + r.status + ' ' + (j.description || ''));
  return j;
}
async function ykGet(pid) { const r = await fetch('https://api.yookassa.ru/v3/payments/' + pid, { headers: { 'Authorization': ykAuth() } }); if (!r.ok) throw new Error('yk get ' + r.status); return r.json(); }
function applyYk(o, p) {
  const was = o.status;
  if (p.status === 'succeeded') o.status = 'paid'; else if (p.status === 'canceled') o.status = 'canceled';
  if (was !== 'paid' && o.status === 'paid') { o.paidAt = new Date().toISOString(); save('orders.json', orders); notify('✅ <b>Оплачен заказ ' + o.num + '</b>\n' + (o.type === 'vip' ? 'VIP × ' + o.qty : 'Мастер-классы: ' + o.masters.join(', ') + (o.prepay ? ' (предоплата)' : '')) + '\n' + esc(o.amount) + ' ₽\n' + esc(o.fio) + ' · ' + esc(o.phone) + ' · ' + esc(o.tg)); }
  else if (was !== o.status) save('orders.json', orders);
}

/* ---------- заказ ---------- */
async function createOrder(req, res, d) {
  if (!d.agree) return send(res, 400, { error: 'Необходимо согласие с политикой и офертой' });
  const o = { id: rnd(), createdAt: new Date().toISOString(), status: 'pending', type: d.type === 'master' ? 'master' : 'vip',
    fio: clean(d.fio, 120), email: clean(d.email, 120), phone: clean(d.phone, 30), tg: clean(d.tg, 80), method: d.method === 'card' ? 'card' : 'sbp' };
  if (o.fio.split(/\s+/).length < 2) return send(res, 400, { error: 'Укажите ФИО' });
  if (!emailOk(o.email)) return send(res, 400, { error: 'Некорректная почта' });
  if (o.phone.replace(/\D/g, '').length < 10) return send(res, 400, { error: 'Некорректный телефон' });
  if (o.tg.length < 3) return send(res, 400, { error: 'Укажите Telegram' });
  if (o.type === 'vip') {
    o.qty = Math.floor(+d.qty); if (!(o.qty >= 1 && o.qty <= C.vip.maxPerOrder)) return send(res, 400, { error: 'Некорректное количество' });
    o.guests = cleanML(d.guests, 2000);
    if (o.qty > 1 && o.guests.split(/\n+/).filter(x => x.trim().length > 3).length < o.qty) return send(res, 400, { error: 'Укажите ФИО всех зрителей' });
    const p = C.vipPrice(); o.unit = p.price; o.promo = p.promo; o.amount = p.price * o.qty;
  } else {
    o.method = 'sbp';
    const valid = C.masters.list.map(m => m.id);
    o.masters = [...new Set(Array.isArray(d.masters) ? d.masters : [])].filter(x => valid.includes(x));
    if (!o.masters.length) return send(res, 400, { error: 'Выберите мастер-класс' });
    o.repost = !!d.repost; o.repostLink = clean(d.repostLink, 300);
    if (o.repost && o.repostLink.length < 6) return send(res, 400, { error: 'Укажите ссылку на репост' });
    o.prepay = !!d.prepay; o.total = C.mastersPrice(o.masters, o.repost);
    o.amount = o.prepay ? Math.round(o.total * C.masters.prepayPercent / 100) : o.total;
  }
  o.num = 'S1-' + String(++orders.seq).padStart(4, '0');
  orders.items[o.id] = o;
  if (YK_ID && YK_KEY) {
    try { const p = await ykCreate(o); o.paymentId = p.id; o.mode = 'live';
      if (p.confirmation) { if (p.confirmation.type === 'qr') o.qr = p.confirmation.confirmation_data; else o.payUrl = p.confirmation.confirmation_url; } }
    catch (e) { console.error(e.message); delete orders.items[o.id]; orders.seq--; return send(res, 502, { error: 'Платёжная система временно недоступна. Попробуйте позже.' }); }
  } else o.mode = 'demo';
  save('orders.json', orders);
  notify('🆕 <b>Новый заказ ' + o.num + '</b> (ожидает оплаты)\n' + (o.type === 'vip' ? 'VIP × ' + o.qty : 'Мастер-классы: ' + o.masters.join(', ')) + ' — ' + o.amount + ' ₽\n' + esc(o.fio) + ' · ' + esc(o.tg));
  send(res, 200, { id: o.id, num: o.num, next: 'pay.html?id=' + o.id });
}
async function getOrder(res, id) {
  const o = orders.items[id]; if (!o) return send(res, 404, { error: 'not found' });
  if (o.status === 'pending' && o.paymentId && YK_ID) { try { applyYk(o, await ykGet(o.paymentId)); } catch (e) { console.error(e.message); } }
  send(res, 200, { id: o.id, num: o.num, status: o.status, amount: o.amount, method: o.method, qr: o.qr || null, payUrl: o.payUrl || null, mode: o.mode });
}

/* ---------- опрос ---------- */
const pollOut = () => { const counts = C.poll.options.map(op => ({ id: op.id, n: poll.filter(v => v.choices.includes(op.id)).length })); return { counts, voters: poll.length }; };
function votePoll(req, res, d) {
  const h = crypto.createHash('sha256').update(SALT + (req.headers['x-forwarded-for'] || req.socket.remoteAddress) + (req.headers['user-agent'] || '')).digest('hex').slice(0, 24);
  const ids = C.poll.options.map(o => o.id);
  const choices = [...new Set(Array.isArray(d.choices) ? d.choices : [])].filter(x => ids.includes(x)).slice(0, C.poll.maxChoices);
  const own = clean(d.own, 80);
  if (!choices.length && !own) return send(res, 400, { error: 'Выберите вариант' });
  if (poll.some(v => v.h === h)) return send(res, 409, { error: 'Вы уже голосовали' }, {});
  poll.push({ h, choices, own, ts: Date.now() }); save('poll.json', poll);
  send(res, 200, pollOut());
}

/* ---------- волонтёры ---------- */
function addVolunteer(res, d) {
  if (!d.agree) return send(res, 400, { error: 'Нужно согласие на обработку данных' });
  const v = { ts: new Date().toISOString(), fio: clean(d.fio, 120), age: Math.floor(+d.age), phone: clean(d.phone, 30), email: clean(d.email, 120), tg: clean(d.tg, 80),
    days: (Array.isArray(d.days) ? d.days : []).map(x => clean(x, 20)).slice(0, 4), note: cleanML(d.note, 1000) };
  if (v.fio.split(/\s+/).length < 2 || !(v.age >= 12) || v.phone.replace(/\D/g, '').length < 10 || !emailOk(v.email) || v.tg.length < 3 || !v.days.length) return send(res, 400, { error: 'Проверьте заполнение анкеты' });
  vols.push(v); save('volunteers.json', vols);
  notify('🙋 <b>Новый волонтёр</b>\n' + esc(v.fio) + ', ' + v.age + ' лет\n' + esc(v.tg) + ' · ' + esc(v.phone) + '\nДни: ' + esc(v.days.join(', ')));
  send(res, 200, { ok: true });
}

/* ---------- сервер ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress, u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  try {
    if (p.startsWith('/api/') || p.startsWith('/admin/')) {
      const cors = process.env.CORS_ORIGIN;
      if (cors) { res.setHeader('Access-Control-Allow-Origin', cors); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); } }
      if (limited(ip, 40)) return send(res, 429, { error: 'Слишком много запросов, подождите минуту' });
      if (req.method === 'POST' && p === '/api/order') return createOrder(req, res, await body(req));
      if (req.method === 'GET' && p.startsWith('/api/order/')) return getOrder(res, p.slice(11));
      if (req.method === 'POST' && p === '/api/yookassa') { const d = await body(req); const pid = d.object && d.object.id; const o = Object.values(orders.items).find(x => x.paymentId === pid); if (o && YK_ID) applyYk(o, await ykGet(pid)); return send(res, 200, { ok: true }); }
      if (p === '/api/poll') return req.method === 'POST' ? votePoll(req, res, await body(req)) : send(res, 200, pollOut());
      if (req.method === 'POST' && p === '/api/volunteer') return addVolunteer(res, await body(req));
      if (p.startsWith('/admin/')) {
        const k = u.searchParams.get('key') || '';
        if (!ADMIN_KEY || k.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY))) return send(res, 403, { error: 'forbidden' });
        if (p === '/admin/orders') return send(res, 200, Object.values(orders.items));
        if (p === '/admin/volunteers') return send(res, 200, vols);
        if (p === '/admin/poll') return send(res, 200, Object.assign(pollOut(), { own: poll.filter(v => v.own).map(v => v.own) }));
      }
      return send(res, 404, { error: 'not found' });
    }
    /* статика сайта (кроме server/ и скрытых файлов) */
    let f = path.normalize(path.join(ROOT, p === '/' ? 'index.html' : p));
    if (!f.startsWith(ROOT) || f.startsWith(path.join(ROOT, 'server')) || path.basename(f).startsWith('.')) { res.writeHead(404); return res.end('Not found'); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e.message); if (!res.headersSent) send(res, 400, { error: 'Некорректный запрос' }); }
}).listen(PORT, () => console.log('S1 CONTEST: http://localhost:' + PORT + (YK_ID ? '  [ЮKassa подключена]' : '  [ДЕМО-режим: оплата не подключена]')));
