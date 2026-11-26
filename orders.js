(function(){
var C=window.S1_CONFIG,$=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var rub=function(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ₽'};
var api=function(p){return (C.apiBase||'')+p};
var TABS=['entry','master','ticket'],tab='entry',qty=1;
var NAMES={solo:'SOLO',duet:'DUET',gen:'DUET GEN & GEN (Учитель / Ученик)',crew:'CREW'},AGES={kids:'Kids',juniors:'Juniors',adults:'Adults'},LEVELS={beginners:'Beginners',pro:'Pro'};

function setTab(t){tab=TABS.indexOf(t)>-1?t:'entry';
  $$('.tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===tab)});
  TABS.forEach(function(x){$('#form-'+x).hidden=x!==tab});
  render();try{history.replaceState(null,'','#'+tab)}catch(e){}}
$$('.tabs button').forEach(function(b){b.onclick=function(){setTab(b.dataset.tab)}});

/* ---------- мастер-классы: список ---------- */
(function(){var t=C.mastersTier(),h='';C.masters.list.forEach(function(m){
  h+='<label class="opt"><input type="checkbox" name="m" value="'+m.id+'"><div><b>'+m.name+'</b><small>'+m.style+' · '+m.time+'</small></div><em data-one></em></label>'});
  $('#m-list').innerHTML=h})();

/* ---------- заявка ---------- */
var fe=$('#form-entry'),E=function(n){return fe.elements[n]};
function entryState(){
  var dir=E('dir').value,nt=E('ntype').value;
  if(dir==='lady'&&nt==='gen'){E('ntype').value='solo';nt='solo'}
  $$('option',E('ntype')).forEach(function(o){if(o.value==='gen')o.disabled=dir==='lady'});
  var dd=nt==='duet'||nt==='gen',showAge=dir==='show'&&!dd&&!(nt==='crew'&&E('age').value==='adults'&&0),showLevel=!dd&&!(dir==='lady'&&nt==='crew');
  $('#w-age').hidden=!showAge;$('#w-level').hidden=!showLevel;
  $('#w-team').hidden=nt==='solo';$('#w-count').hidden=nt!=='crew';
  $('#l-team').textContent=dd?'Название дуэта (необязательно)':'Название команды';
  $('#l-members').textContent=nt==='solo'?'ФИО участника':dd?'ФИО обоих участников':'ФИО всех участников';
  $('#s-members').textContent=nt==='solo'?'':'Укажите ФИО по одному в строке.';
  $('#t-members').rows=nt==='solo'?1:5;
  var n=nt==='solo'?1:dd?2:Math.max(0,Math.floor(+E('count').value)||0);
  return {dir:dir,nt:nt,age:showAge?E('age').value:'',level:showLevel?E('level').value:'',n:n};
}
function entryTitle(s){var p=[s.dir==='lady'?"LADY'S":'SHOW',NAMES[s.nt]];if(s.age)p.push(AGES[s.age]);if(s.level)p.push(LEVELS[s.level]);return p.join(' · ')}

function render(){
  var s=$('#sum'),h='',now=new Date();
  if(tab==='entry'){var st=entryState(),t=C.entryTier(),unit=t[st.nt],total=C.entryPrice(st.nt,st.n);
    h='<h3>Ваша заявка</h3><div class="sum-row"><span>'+entryTitle(st)+'</span><span></span></div>'+
      '<div class="sum-row"><span>Взнос'+(st.nt==='solo'?'':' (с человека)')+'</span><span>'+rub(unit)+'</span></div>'+
      (st.nt==='solo'?'':'<div class="sum-row"><span>Участников</span><span>× '+st.n+'</span></div>')+
      '<div class="sum-row total"><span>Итого</span><span>'+rub(total)+'</span></div>'+
      '<p class="note">Взнос до 31.12.2026: SOLO 2 000 ₽, DUET 1 800 ₽ и CREW 1 700 ₽ с человека. С 01.01.2027: 2 400 / 2 100 / 1 900 ₽. Взнос нужно оплатить до 15 января включительно.</p>'+
      '<p class="note">Онлайн-оплаты на сайте нет: после заявки наш администратор свяжется с вами и подскажет, как оплатить. Регистрация завершена только после оплаты.</p>';
    $('#go-entry').textContent='Подать заявку';
  }else if(tab==='master'){var m=masterCalc(),tr=C.mastersTier();
    $$('[data-one]').forEach(function(e){e.textContent=rub(tr.onePrice[m.rep?'repost':'noRepost'])});
    h='<h3>Ваш заказ</h3>'+(m.ids.length?m.ids.map(function(id){var x=C.masters.list.filter(function(q){return q.id===id})[0];return '<div class="sum-row"><span>'+x.name+'</span><span>'+x.time+'</span></div>'}).join(''):'<p class="note">Выберите хотя бы один мастер-класс.</p>')+
      (m.ids.length>=C.masters.list.length?'<div class="sum-row"><span>Full pass (все классы)</span><span></span></div>':'')+
      '<div class="sum-row"><span>Стоимость</span><span>'+rub(m.full)+'</span></div>'+
      '<div class="sum-row total"><span>'+(m.pre?'Предоплата сейчас':'Итого')+'</span><span>'+rub(m.pay)+'</span></div>'+
      (m.pre?'<p class="note">Предоплата '+C.masters.prepayPercent+'%. '+C.masters.prepayNote+'</p>':'')+
      '<p class="note">Цены: до 01.12 включительно и с 02.12 — по тарифу Положения. Оплату согласует администратор.</p>';
    $('#go-master').textContent='Подать заявку';
  }else{
    h='<h3>Ваш заказ</h3><div class="sum-row"><span>Зрительский билет</span><span>'+rub(C.tickets.presale)+'</span></div>'+
      '<div class="sum-row"><span>Количество</span><span>× '+qty+'</span></div><div class="sum-row total"><span>Итого</span><span>'+rub(C.tickets.presale*qty)+'</span></div>'+
      '<p class="note">Предпродажа — '+rub(C.tickets.presale)+', в день соревнований (24 января) — '+rub(C.tickets.onDay)+'. Окончательную сумму и способ оплаты подтвердит администратор.</p>';
    $('#go-ticket').textContent='Купить';
    $('#guests-wrap').hidden=qty<2;
  }
  s.innerHTML=h;
  $$('.opt').forEach(function(o){var i=$('input',o);o.classList.toggle('sel',!!(i&&i.checked))});
}
function masterSel(){return $$('#form-master input[name=m]:checked').map(function(i){return i.value})}
function masterCalc(){var ids=masterSel(),f=$('#form-master'),rep=f.elements.rp.value==='1',full=C.mastersPrice(ids,rep),pre=f.elements.pp.value==='50';
  return {ids:ids,rep:rep,full:full,pre:pre,pay:pre?Math.round(full*C.masters.prepayPercent/100):full}}

$$('#form-entry select,#form-entry input[name=count]').forEach(function(i){i.addEventListener('change',render);i.addEventListener('input',render)});
$$('#form-master input').forEach(function(i){i.addEventListener('change',render)});
$$('.qty button').forEach(function(b){b.onclick=function(){qty=Math.min(C.tickets.maxPerOrder,Math.max(1,qty+(+b.dataset.q)));$('#qty').value=qty;render()}});
$$('#form-master input[name=rp]').forEach(function(i){i.addEventListener('change',function(){$('#rp-link').hidden=$('#form-master').elements.rp.value!=='1'})});

/* ---------- проверка ---------- */
function bad(el,show){var w=el&&el.closest('.fld');if(w)w.classList.toggle('err',show);return show}
function lines(v){return (v||'').split(/\n+/).filter(function(x){return x.trim().length>3})}
function validate(form,type){
  var ok=true,g=function(n){return (form.elements[n]&&form.elements[n].value||'').trim()};
  var chk=function(n,c){if(bad(form.elements[n],!c))ok=false};
  chk('fio',g('fio').split(/\s+/).length>=2);
  chk('email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('email')));
  chk('phone',g('phone').replace(/\D/g,'').length>=10);
  chk('tg',g('tg').length>=3);
  if(type==='ticket'&&qty>1)chk('guests',lines(g('guests')).length>=qty);
  if(type==='master'){if(!masterSel().length){ok=false;$('#m-err').style.display='block'}else $('#m-err').style.display='none';
    if(form.elements.rp.value==='1')chk('repost',g('repost').length>5)}
  if(type==='entry'){var s=entryState();
    chk('members',lines(g('members')).length>=s.n||(s.n===1&&g('members').length>3));
    chk('coach',g('coach').length>3);
    if(s.nt==='crew'){chk('team',g('team').length>1);chk('count',s.n>=C.entry.crewMin)}}
  if(!ok){var e=$('.fld.err',form);if(e)e.scrollIntoView({behavior:'smooth',block:'center'})}
  return ok}

/* ---------- отправка ---------- */
var ov=$('#ov');
function showOv(html){ov.innerHTML='<div class="box">'+html+'</div>';ov.classList.add('on')}
ov.addEventListener('click',function(e){if(e.target.id==='ov'||e.target.closest('[data-close]'))ov.classList.remove('on')});
function submit(type){
  var form=$('#form-'+type),btn=$('#go-'+type);if(!validate(form,type))return;
  var f=function(n){return (form.elements[n]&&form.elements[n].value||'').trim()};
  var d={type:type,fio:f('fio'),email:f('email'),phone:f('phone'),tg:f('tg'),agree:true};
  if(type==='entry'){var s=entryState();d.dir=s.dir;d.ntype=s.nt;d.age=s.age;d.level=s.level;d.count=s.n;d.team=f('team');d.members=f('members');d.coach=f('coach');d.track=f('track');d.amount=C.entryPrice(s.nt,s.n)}
  else if(type==='master'){var m=masterCalc();d.masters=m.ids;d.repost=m.rep;d.repostLink=f('repost');d.prepay=m.pre;d.amount=m.full;d.pay=m.pay}
  else{d.qty=qty;d.guests=f('guests');d.amount=C.tickets.presale*qty}
  d.hp=f('hp');
  btn.disabled=true;
  showOv('<div class="spin"></div><h4>Отправляем…</h4>');
  fetch(api('/api/order'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
   .then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok||!j.num)throw new Error(j.error||('сервер ответил '+r.status));return j})})
   .then(function(j){btn.disabled=false;
     showOv('<h4>Спасибо, '+(type==='ticket'?'заказ':'заявка')+' принят'+(type==='ticket'?'':'а')+'!</h4><p>№ '+j.num+'. Наш администратор скоро свяжется с вами для оплаты.</p><button type="button" class="btn-pay" data-close>Хорошо</button>');
     form.reset();qty=1;$('#qty').value=1;$('#rp-link').hidden=true;render()})
   .catch(function(e){btn.disabled=false;var m=String(e&&e.message||'');fallback(d,type,/fetch|load failed|network/i.test(m)?'нет связи с сервером заявок (проверьте адрес в config.js и ALLOWED_ORIGIN)':m)});
}
/* Запасной путь: если сервер заявок не подключён (например, сайт на GitHub Pages) —
   заявка не теряется: готовое письмо администратору + текст для копирования. */
function summary(d,type){
  var L=['S1 CONTEST 2027 — '+({entry:'заявка на участие',master:'запись на мастер-классы',ticket:'зрительские билеты'})[type],''];
  if(type==='entry'){var st=entryState();L.push('Номинация: '+entryTitle(st));L.push('Участников: '+d.count);if(d.team)L.push('Название: '+d.team);L.push('Участники:\n'+d.members);L.push('Руководитель/хореограф: '+d.coach);if(d.track)L.push('Композиция: '+d.track);L.push('Взнос: '+rub(C.entryPrice(st.nt,st.n)))}
  else if(type==='master'){var m=masterCalc();L.push('Мастер-классы: '+m.ids.map(function(id){return C.masters.list.filter(function(q){return q.id===id})[0].name}).join(', '));L.push('Репост: '+(m.rep?'да — '+d.repostLink:'нет'));L.push('Стоимость: '+rub(m.full)+(m.pre?', предоплата 50% ('+rub(m.pay)+')':''))}
  else{L.push('Билетов: '+d.qty+' (предпродажа '+rub(C.tickets.presale*d.qty)+')');if(d.guests)L.push('Зрители:\n'+d.guests)}
  L.push('','Контакт: '+d.fio,'Телефон: '+d.phone,'E-mail: '+d.email,'Telegram: '+d.tg,'','Согласен с политикой конфиденциальности и офертой.');
  return L.join('\n')}
function fallback(d,type,why){
  var t=summary(d,type),mail=C.organizer.email,sub='S1 CONTEST 2027 — '+({entry:'заявка на участие',master:'мастер-классы',ticket:'зрительские билеты'})[type];
  var href='mailto:'+mail+'?subject='+encodeURIComponent(sub)+'&body='+encodeURIComponent(t);
  showOv('<h4>Почти готово</h4><p>Автоматическая отправка сейчас недоступна, но заявка не потеряется: нажмите кнопку — откроется готовое письмо администратору, останется нажать «Отправить». Наш администратор свяжется с вами для оплаты.</p>'+
    '<textarea readonly id="fb-t" style="width:100%;height:120px;margin-top:12px;background:rgba(3,9,17,.7);color:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;font:13px/1.4 Roboto,sans-serif">'+t.replace(/</g,'&lt;')+'</textarea>'+
    '<a class="btn-pay" style="display:block;text-decoration:none;margin-top:14px" href="'+href+'">Отправить письмом</a>'+
    '<button type="button" class="btn-pay" id="fb-copy" style="margin-top:10px;background:transparent;color:#fff;border:1px solid var(--line-strong);box-shadow:none">Скопировать текст</button>'+
    (why?'<p class="note" style="color:#ffb4b4">Причина: '+String(why).replace(/</g,'&lt;')+'</p>':'')+'<p class="note">Или напишите нам: '+C.organizer.tg+', '+C.organizer.phone+', '+mail+'</p><button type="button" class="btn-pay" data-close style="background:transparent;color:var(--muted);box-shadow:none">Закрыть</button>');
  var c=$('#fb-copy');if(c)c.onclick=function(){var t2=$('#fb-t');t2.select();try{navigator.clipboard.writeText(t2.value)}catch(e){document.execCommand('copy')}c.textContent='Скопировано ✓'}}
['entry','master','ticket'].forEach(function(t){$('#go-'+t).onclick=function(){submit(t)}});
$$('.fld input,.fld textarea,.fld select').forEach(function(i){i.addEventListener('input',function(){var w=i.closest('.fld');if(w)w.classList.remove('err')})});
$$('input[name=phone]').forEach(function(i){i.addEventListener('input',function(){var d=i.value.replace(/\D/g,'');if(d[0]==='8')d='7'+d.slice(1);if(d&&d[0]!=='7')d='7'+d;d=d.slice(0,11);
  var o=d?'+7':'';if(d.length>1)o+=' ('+d.slice(1,4);if(d.length>=4)o+=') '+d.slice(4,7);if(d.length>=7)o+='-'+d.slice(7,9);if(d.length>=9)o+='-'+d.slice(9,11);i.value=o})});

$$('form.form-card').forEach(function(fm){var i=document.createElement('input');i.name='hp';i.tabIndex=-1;i.autocomplete='off';i.setAttribute('aria-hidden','true');i.style.cssText='position:absolute;left:-9999px;opacity:0';fm.appendChild(i)});
var q=new URLSearchParams(location.search).get('n');if(q&&NAMES[q])E('ntype').value=q;
setTab((location.hash||'').replace('#',''));
})();
