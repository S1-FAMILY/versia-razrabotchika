/* S1 CONTEST — приём заявок через Cloudflare Workers (бесплатно) → Telegram администратору.
   Переменные (Settings → Variables): TG_BOT_TOKEN (secret), TG_CHAT_ID, ALLOWED_ORIGIN (например https://s1-family.github.io) */
const ENT = { solo: 'SOLO', duet: 'DUET', crew: 'CREW' };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const cleanML = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, n);
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const hits = new Map();
export async function handle(req, env, fetchFn = fetch) {
  const origin = env.ALLOWED_ORIGIN || '*';
  const H = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json; charset=utf-8' };
  const out = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: H });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  const ip = req.headers.get('CF-Connecting-IP') || 'x', now = Date.now();
  const a = (hits.get(ip) || []).filter(t => now - t < 60000); a.push(now); hits.set(ip, a);
  if (a.length > 8) return out(429, { error: 'Слишком много запросов, подождите минуту' });
  let d; try { d = await req.json(); } catch (e) { return out(400, { error: 'Некорректный запрос' }); }
  if (d.hp) return out(200, { num: 'S1-0000' });            // «ловушка» для ботов
  if (!d.agree) return out(400, { error: 'Необходимо согласие с политикой и офертой' });
  const fio = clean(d.fio, 120), email = clean(d.email, 120), phone = clean(d.phone, 30), tg = clean(d.tg, 80);
  if (fio.split(/\s+/).length < 2) return out(400, { error: 'Укажите ФИО' });
  if (!emailOk(email)) return out(400, { error: 'Некорректная почта' });
  if (phone.replace(/\D/g, '').length < 10) return out(400, { error: 'Некорректный телефон' });
  if (tg.length < 3) return out(400, { error: 'Укажите Telegram' });
  const amount = Math.max(0, Math.floor(+d.amount) || 0);
  let title, lines = [];
  if (d.type === 'entry') {
    if (!ENT[d.ntype]) return out(400, { error: 'Выберите номинацию' });
    const dir = d.dir === 'lady' ? "LADY'S" : 'SHOW';
    title = '🏆 Заявка на участие';
    lines.push(`Номинация: ${dir} ${ENT[d.ntype]} ${clean(d.age, 10)} ${clean(d.level, 10)}`.trim());
    lines.push('Участников: ' + (Math.floor(+d.count) || 1));
    if (d.team) lines.push('Название: ' + esc(clean(d.team, 100)));
    lines.push('Участники:\n' + esc(cleanML(d.members, 3000)));
    lines.push('Руководитель: ' + esc(clean(d.coach, 120)));
    if (d.track) lines.push('Композиция: ' + esc(clean(d.track, 160)));
    lines.push('Взнос (по расчёту сайта): ' + amount + ' ₽');
  } else if (d.type === 'master') {
    title = '🎓 Мастер-классы';
    lines.push('Классы: ' + esc((Array.isArray(d.masters) ? d.masters : []).map(x => clean(x, 20)).join(', ')));
    lines.push('Репост: ' + (d.repost ? 'да ' + esc(clean(d.repostLink, 300)) : 'нет'));
    lines.push('Стоимость: ' + amount + ' ₽' + (d.prepay ? ' · предоплата 50%: ' + (Math.floor(+d.pay) || 0) + ' ₽' : ''));
  } else if (d.type === 'ticket') {
    const q = Math.floor(+d.qty); if (!(q >= 1 && q <= 10)) return out(400, { error: 'Некорректное количество' });
    title = '🎟 Зрительские билеты';
    lines.push('Билетов: ' + q + ' · ' + amount + ' ₽');
    if (d.guests) lines.push('Зрители:\n' + esc(cleanML(d.guests, 2000)));
  } else return out(400, { error: 'Неизвестный тип заявки' });
  const num = 'S1-' + now.toString(36).toUpperCase().slice(-5);
  const text = `<b>${title} ${num}</b>\n` + lines.join('\n') + `\n\n👤 ${esc(fio)}\n📞 ${esc(phone)}\n✉️ ${esc(email)}\n💬 ${esc(tg)}\n\nСвяжитесь для оплаты.`;
  try {
    const r = await fetchFn('https://api.telegram.org/bot' + env.TG_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }) });
    if (!r.ok) throw new Error('tg ' + r.status);
  } catch (e) { return out(502, { error: 'Не удалось передать заявку администратору' }); }
  return out(200, { num });
}
export default { fetch: (req, env) => handle(req, env) };
