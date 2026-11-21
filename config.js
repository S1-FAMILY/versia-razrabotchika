/* ============================================================
   S1 CONTEST — единый файл настроек (сайт + сервер).
   Меняйте только значения; цены по датам считаются автоматически.
   ============================================================ */
(function (root, factory) {
  var cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  else root.S1_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this, function () {
  var C = {
    /* Адрес сервера заявок. '' = тот же домен, что и сайт. */
    apiBase: 'https://s1-orders.casperser636.workers.dev',

    event: { name: 'S1 CONTEST', dates: '23–24 января 2027', city: 'Ставрополь' },

    /* ВАЖНО: подставьте реквизиты организатора — они выводятся в оферте и политике. */
    organizer: {
      name:  '[НАИМЕНОВАНИЕ ОРГАНИЗАТОРА / ФИО ИП]',
      inn:   '[ИНН]',
      ogrn:  '[ОГРН / ОГРНИП]',
      address: '[ЮРИДИЧЕСКИЙ АДРЕС]',
      email: 's1.contest.stav@gmail.com',
      phone: '+7 (962) 454-22-21',
      tg:    '@s1_contest'
    },

    /* ---------- Зрительские билеты ---------- */
    tickets: { presale: 700, onDay: 1000, maxPerOrder: 10 },

    /* ---------- Взносы за участие (по Положению) ----------
       Тариф 1 — до 31.12.2026 включительно, тариф 2 — с 01.01.2027.
       DUET и CREW — цена С ЧЕЛОВЕКА. */
    entry: {
      tiers: [
        { until: '2026-12-31T23:59:59+03:00', solo: 2000, duet: 1800, crew: 1700 },
        { until: null,                         solo: 2400, duet: 2100, crew: 1900 }
      ],
      crewMin: 5
    },

    /* ---------- Мастер-классы ---------- */
    masters: {
      date: '23 января 2027',
      place: 'г. Ставрополь, ул. Перспективная, 1 Г',
      list: [
        { id: 'alinychu', name: 'ALINYCHU',      style: 'HIP-HOP', time: '15:00' },
        { id: 'gufranov', name: 'EGOR GUFRANOV', style: 'HIP-HOP', time: '17:00' }
      ],
      /* Тариф 1: до 01.12.2026 включительно; тариф 2: с 02.12.2026 */
      tiers: [
        { until: '2026-12-01T23:59:59+03:00', onePrice: { repost: 2800, noRepost: 3100 }, fullPrice: { repost: 5300, noRepost: 5500 } },
        { until: null,                         onePrice: { repost: 3300, noRepost: 3600 }, fullPrice: { repost: 5800, noRepost: 6000 } }
      ],
      prepayPercent: 50,
      prepayNote: 'Остаток необходимо внести не позднее 5 декабря.'
    }
  };

  function tierOf(list, now) {
    var t = (now || new Date()).getTime();
    for (var i = 0; i < list.length; i++) if (!list[i].until || t <= new Date(list[i].until).getTime()) return list[i];
    return list[list.length - 1];
  }
  C.entryTier = function (now) { return tierOf(C.entry.tiers, now); };
  /* type: solo | duet | crew; n — число участников (для duet всегда 2). Возвращает итог. */
  C.entryPrice = function (type, n, now) {
    var t = C.entryTier(now);
    if (type === 'solo') return t.solo;
    if (type === 'duet') return t.duet * 2;
    return t.crew * Math.max(0, n || 0);
  };
  C.mastersTier = function (now) { return tierOf(C.masters.tiers, now); };
  C.mastersPrice = function (ids, repost, now) {
    var n = ids.length; if (!n) return 0;
    var k = repost ? 'repost' : 'noRepost', tr = C.mastersTier(now);
    return n >= C.masters.list.length ? tr.fullPrice[k] : tr.onePrice[k] * n;
  };
  return C;
});
