/* ============================================================
   S1 CONTEST — единый файл настроек (сайт + сервер).
   Меняйте только значения; цены и даты считаются автоматически.
   ============================================================ */
(function (root, factory) {
  var cfg = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = cfg;
  else root.S1_CONFIG = cfg;
})(typeof self !== 'undefined' ? self : this, function () {
  var C = {
    /* Адрес сервера заказов. '' = тот же домен, что и сайт. */
    apiBase: '',

    event: { name: 'S1 CONTEST', dates: '23–24 января 2027', city: 'Ставрополь' },

    /* ВАЖНО: подставьте реквизиты организатора — они выводятся в оферте и политике. */
    organizer: {
      name:  '[НАИМЕНОВАНИЕ ОРГАНИЗАТОРА / ФИО ИП]',
      inn:   '[ИНН]',
      ogrn:  '[ОГРН / ОГРНИП]',
      address: '[ЮРИДИЧЕСКИЙ АДРЕС]',
      email: 's1contest.stav@gmail.com',
      phone: '+7 (962) 454-22-21',
      tg:    '@s1_contest'
    },

    /* ---------- VIP-билет (участие в розыгрыше мерча) ----------
       regularPrice — обычная цена, planPrice — цена, по которой билет
       должен продаваться по плану. Новогодняя акция: на promo.days дней
       цена = planPrice, до и после — regularPrice.
       Обычная цена должна РЕАЛЬНО действовать (и билеты по ней должны
       продаваться) до акции — иначе «скидка» считается недобросовестной рекламой. */
    vip: {
      title: 'VIP-билет',
      maxPerOrder: 10,
      regularPrice: 2000,   // ← ПОДСТАВЬТЕ (цена до/после акции)
      planPrice: 1500,      // ← ПОДСТАВЬТЕ (цена, которая планировалась изначально)
      promo: {
        title: 'Новогодняя скидка',
        start: '2026-12-28T00:00:00+03:00',
        days: 5,
        force: null           // true — принудительно включить акцию, false — выключить, null — по датам
      }
    },

    /* ---------- Мастер-классы (оплата только по СБП) ---------- */
    masters: {
      date: '20 декабря 2026',
      place: 'г. Ставрополь, ул. Перспективная, 1 Г',
      list: [
        { id: 'alinychu', name: 'ALINYCHU',      style: 'HIP-HOP', time: '15:00' },
        { id: 'gufranov', name: 'EGOR GUFRANOV', style: 'HIP-HOP', time: '17:00' }
      ],
      /* цены: [с репостом, без репоста]. Тариф 1: до 01.12.2026 включительно; тариф 2: с 02.12.2026 */
      tiers: [
        { until: '2026-12-01T23:59:59+03:00', onePrice: { repost: 2800, noRepost: 3100 }, fullPrice: { repost: 5300, noRepost: 5500 } },
        { until: null,                         onePrice: { repost: 3300, noRepost: 3600 }, fullPrice: { repost: 5800, noRepost: 6000 } }
      ],
      prepayPercent: 50,
      prepayNote: 'Остаток необходимо внести не позднее 5 декабря.'
    },

    /* ---------- Платёж (сервер) ---------- */
    pay: { vatCode: 1, currency: 'RUB' },   // 1 = без НДС (для чека 54-ФЗ). Уточните у бухгалтера.

    /* ---------- Волонтёры ---------- */
    volunteers: {
      dobroUrl:   'https://добро.рф/',   // ← вставьте ссылку на страницу события на Добро.рф
      patriotUrl: ''                    // ← ссылка на «Патриот» (если пусто — кнопка скрыта)
    },

    /* ---------- Опрос ---------- */
    poll: {
      question: 'Какую номинацию добавить в контест?',
      maxChoices: 3,
      options: [
        { id: 'freestyle', label: 'Фристайл' },
        { id: 'audience',  label: 'Приз зрительских симпатий' },
        { id: 'styles',    label: 'Разделение по видам танца' }
      ],
      note: 'При недоборе участников для той или иной номинации оргкомитет вправе объединить её со смежной.'
    }
  };

  /* ---------- расчёт цены (одинаково на сайте и на сервере) ---------- */
  function promoState(now) {
    now = now || new Date();
    var p = C.vip.promo, s = new Date(p.start).getTime(), e = s + p.days * 864e5, t = now.getTime();
    var active = p.force === true ? true : p.force === false ? false : (t >= s && t < e);
    return { active: active, start: s, end: e, left: Math.max(0, e - t) };
  }
  C.vipPrice = function (now) {
    var st = promoState(now);
    return st.active
      ? { price: C.vip.planPrice, old: C.vip.regularPrice, promo: true, end: st.end }
      : { price: C.vip.regularPrice, old: null, promo: false, end: null };
  };
  C.mastersTier = function (now) {
    var t = (now || new Date()).getTime(), T = C.masters.tiers;
    for (var i = 0; i < T.length; i++) if (!T[i].until || t <= new Date(T[i].until).getTime()) return T[i];
    return T[T.length - 1];
  };
  C.mastersPrice = function (ids, repost, now) {
    var n = ids.length; if (!n) return 0;
    var k = repost ? 'repost' : 'noRepost', tr = C.mastersTier(now);
    return n >= C.masters.list.length ? tr.fullPrice[k] : tr.onePrice[k] * n;
  };
  return C;
});
