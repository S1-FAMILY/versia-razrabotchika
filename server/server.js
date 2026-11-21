/* S1 CONTEST — сервер приёма заявок и заказов (без онлайн-оплаты).
   Без зависимостей: Node.js 18+.   Запуск:  node server/server.js
   После отправки формы администратор связывается с заявителем для оплаты.
   Настройки — переменные окружения (см. server/README.md). */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const C = require('../config.js');

const PORT = +process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const TG_TOKEN = process.env.TG_BOT_TOKEN, TG_CHAT = process.env.TG_CHAT_ID;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
fs.mkdirSync(DATA, { recursive: true });

const file = n => path.join(DATA, n);
function load(n, def) { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return def; } }
function save(n, v) { const t = file(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, file(n)); }
const orders = load('orders.json', { seq: 0, items: {} });

const rnd = () => crypto.randomBytes(16).toString('hex');
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const cleanML = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const lines = s => s.split(/\n+/).filter(x => x.trim().length > 3);
const hits = new Map();
function limited(ip, max) { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000); a.push(now); hits.set(ip, a); return a.length > max; }
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((ok, no) => { let s = ''; req.on('data', d => { s += d; if (s.length > 60000) { no(new Error('big')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { no(e); } }); }); }
async function notify(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try { await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }) }); }
  catch (e) { console.error('telegram:', e.message); }
}

const ENT = { solo: 'SOLO', duet: 'DUET', crew: 'CREW' };
function createOrder(req, res, d) {
  if (!d.agree) return send(res, 400, { error: 'Необходимо согласие с политикой и офертой' });
  const type = ['entry', 'master', 'ticket'].includes(d.type) ? d.type : null;
  if (!type) return send(res, 400, { error: 'Неизвестный тип заявки' });
  const o = { id: rnd(), createdAt: new Date().toISOString(), status: 'new', type,
    fio: clean(d.fio, 120), email: clean(d.email, 120), phone: clean(d.phone, 30), tg: clean(d.tg, 80) };
  if (o.fio.split(/\s+/).length < 2) return send(res, 400, { error: 'Укажите ФИО' });
  if (!emailOk(o.email)) return send(res, 400, { error: 'Некорректная почта' });
  if (o.phone.replace(/\D/g, '').length < 10) return send(res, 400, { error: 'Некорректный телефон' });
  if (o.tg.length < 3) return send(res, 400, { error: 'Укажите Telegram' });
  let desc;
  if (type === 'entry') {
    o.dir = d.dir === 'lady' ? 'lady' : 'show'; o.ntype = ENT[d.ntype] ? d.ntype : null;
    if (!o.ntype) return send(res, 400, { error: 'Выберите номинацию' });
    if (o.dir === 'lady' && o.ntype === 'duet') return send(res, 400, { error: 'В LADY\'S нет номинации DUET' });
    o.age = ['kids', 'juniors', 'adults'].includes(d.age) ? d.age : ''; o.level = ['beginners', 'pro'].includes(d.level) ? d.level : '';
    o.team = clean(d.team, 100); o.members = cleanML(d.members, 3000); o.coach = clean(d.coach, 120); o.track = clean(d.track, 160);
    o.count = o.ntype === 'solo' ? 1 : o.ntype === 'duet' ? 2 : Math.floor(+d.count);
    if (o.ntype === 'crew' && !(o.count >= C.entry.crewMin && o.count <= 60)) return send(res, 400, { error: 'В команде должно быть не менее ' + C.entry.crewMin + ' участников' });
    if (o.ntype !== 'solo' && lines(o.members).length < o.count) return send(res, 400, { error: 'Укажите ФИО всех участников' });
    if (o.coach.length < 3) return send(res, 400, { error: 'Укажите руководителя' });
    o.amount = C.entryPrice(o.ntype, o.count);
    desc = (o.dir === 'lady' ? "LADY'S" : 'SHOW') + ' ' + ENT[o.ntype] + (o.age ? ' ' + o.age : '') + (o.level ? ' ' + o.level : '') + ', участников: ' + o.count;
  } else if (type === 'master') {
    const valid = C.masters.list.map(m => m.id);
    o.masters = [...new Set(Array.isArray(d.masters) ? d.masters : [])].filter(x => valid.includes(x));
    if (!o.masters.length) return send(res, 400, { error: 'Выберите мастер-класс' });
    o.repost = !!d.repost; o.repostLink = clean(d.repostLink, 300);
    if (o.repost && o.repostLink.length < 6) return send(res, 400, { error: 'Укажите ссылку на репост' });
    o.prepay = !!d.prepay; o.total = C.mastersPrice(o.masters, o.repost);
    o.amount = o.prepay ? Math.round(o.total * C.masters.prepayPercent / 100) : o.total;
    desc = 'Мастер-классы: ' + o.masters.join(', ') + (o.prepay ? ' (предоплата)' : '');
  } else {
    o.qty = Math.floor(+d.qty); if (!(o.qty >= 1 && o.qty <= C.tickets.maxPerOrder)) return send(res, 400, { error: 'Некорректное количество' });
    o.guests = cleanML(d.guests, 2000);
    if (o.qty > 1 && lines(o.guests).length < o.qty) return send(res, 400, { error: 'Укажите ФИО всех зрителей' });
    o.amount = C.tickets.presale * o.qty; desc = 'Зрительские билеты × ' + o.qty;
  }
  o.num = 'S1-' + String(++orders.seq).padStart(4, '0');
  orders.items[o.id] = o; save('orders.json', orders);
  notify('🆕 <b>Новая заявка ' + o.num + '</b>\n' + esc(desc) + ' — ~' + o.amount + ' ₽\n' + esc(o.fio) + '\n' + esc(o.tg) + ' · ' + esc(o.phone) + ' · ' + esc(o.email) + '\nСвяжитесь для оплаты.');
  send(res, 200, { id: o.id, num: o.num });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress, u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  try {
    if (p.startsWith('/api/') || p.startsWith('/admin/')) {
      const cors = process.env.CORS_ORIGIN;
      if (cors) { res.setHeader('Access-Control-Allow-Origin', cors); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); } }
      if (limited(ip, 40)) return send(res, 429, { error: 'Слишком много запросов, подождите минуту' });
      if (req.method === 'POST' && p === '/api/order') return createOrder(req, res, await body(req));
      if (p.startsWith('/admin/')) {
        const k = u.searchParams.get('key') || '';
        if (!ADMIN_KEY || k.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY))) return send(res, 403, { error: 'forbidden' });
        if (p === '/admin/orders') return send(res, 200, Object.values(orders.items));
      }
      return send(res, 404, { error: 'not found' });
    }
    let f = path.normalize(path.join(ROOT, p === '/' ? 'index.html' : p));
    if (!f.startsWith(ROOT) || f.startsWith(path.join(ROOT, 'server')) || path.basename(f).startsWith('.')) { res.writeHead(404); return res.end('Not found'); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e.message); if (!res.headersSent) send(res, 400, { error: 'Некорректный запрос' }); }
}).listen(PORT, () => console.log('S1 CONTEST: http://localhost:' + PORT));
