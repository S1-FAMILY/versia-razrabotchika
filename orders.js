(function(){
var C=window.S1_CONFIG,$=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var rub=function(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ₽'};
var api=function(p){return (C.apiBase||'')+p};
var tab='vip';
function setTab(t){tab=t==='master'?'master':'vip';$$('.tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===tab)});
  $('#form-vip').hidden=tab!=='vip';$('#form-master').hidden=tab!=='master';render();
  try{history.replaceState(null,'','#'+tab)}catch(e){}}
$$('.tabs button').forEach(function(b){b.onclick=function(){setTab(b.dataset.tab)}});

/* ---------- состояние ---------- */
var qty=1;
function vipCalc(){var p=C.vipPrice();return {unit:p.price,old:p.old,promo:p.promo,end:p.end,total:p.price*qty}}
function masterSel(){return $$('#form-master input[name=m]:checked').map(function(i){return i.value})}
function masterCalc(){var ids=masterSel(),rep=$('#form-master input[name=rp]:checked').value==='1';
  var full=C.mastersPrice(ids,rep),pre=$('#form-master input[name=pp]:checked').value==='50';
  return {ids:ids,rep:rep,full:full,pay:pre?Math.round(full*C.masters.prepayPercent/100):full,pre:pre}}

function render(){
  var s=$('#sum'),h='';
  if(tab==='vip'){var c=vipCalc();
    h=(c.promo?'<div class="badge-promo">'+C.vip.promo.title+' · <span class="timer" id="tm"></span></div>':'')+
      '<h3>Ваш заказ</h3><div class="sum-row"><span>VIP-билет</span><span>'+(c.old?'<s>'+rub(c.old)+'</s>':'')+rub(c.unit)+'</span></div>'+
      '<div class="sum-row"><span>Количество</span><span>× '+qty+'</span></div><div class="sum-row total"><span>Итого</span><span>'+rub(c.total)+'</span></div>'+
      '<p class="note">VIP-билет даёт право на участие в розыгрыше мерча S1 CONTEST. Условия розыгрыша — в <a href="offer.html#raffle" target="_blank" style="color:var(--ice-2)">оферте</a>.</p>';
    $('#pay-vip').textContent='Оплатить '+rub(c.total);
  }else{var m=masterCalc();
    h='<h3>Ваш заказ</h3>'+(m.ids.length?m.ids.map(function(id){var x=C.masters.list.filter(function(q){return q.id===id})[0];return '<div class="sum-row"><span>'+x.name+'</span><span>'+x.time+'</span></div>'}).join(''):'<p class="note">Выберите хотя бы один мастер-класс.</p>')+
      (m.ids.length>=C.masters.list.length?'<div class="sum-row"><span>Full pass (2 класса)</span><span></span></div>':'')+
      '<div class="sum-row"><span>Стоимость</span><span>'+rub(m.full)+'</span></div>'+
      '<div class="sum-row total"><span>'+(m.pre?'К оплате сейчас':'Итого')+'</span><span>'+rub(m.pay)+'</span></div>'+
      (m.pre?'<p class="note">Предоплата '+C.masters.prepayPercent+'%. '+C.masters.prepayNote+'</p>':'');
    $('#pay-master').textContent='Оплатить '+rub(m.pay);
  }
  s.innerHTML=h;tick();
  $$('.opt').forEach(function(o){var i=$('input',o);o.classList.toggle('sel',!!(i&&i.checked))});
  $('#guests-wrap').hidden=qty<2;
}
var tmr;function tick(){var el=$('#tm');if(!el)return;var p=C.vipPrice();if(!p.promo)return;var l=Math.max(0,p.end-Date.now()),d=Math.floor(l/864e5),h=Math.floor(l%864e5/36e5),m=Math.floor(l%36e5/6e4),s=Math.floor(l%6e4/1e3);
  el.textContent='до конца '+d+' д '+('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+s).slice(-2)}
setInterval(tick,1000);

$$('.qty button').forEach(function(b){b.onclick=function(){qty=Math.min(C.vip.maxPerOrder,Math.max(1,qty+(+b.dataset.q)));$('#qty').value=qty;render()}});
$$('#form-master input').forEach(function(i){i.addEventListener('change',render)});
$$('#form-vip input[name=method]').forEach(function(i){i.addEventListener('change',render)});

/* ---------- валидация ---------- */
function bad(f,show){var w=f.closest('.fld');if(w)w.classList.toggle('err',show);return show}
function validate(form,type){
  var ok=true,g=function(n){return (form.elements[n]&&form.elements[n].value||'').trim()};
  var chk=function(n,cond){if(bad(form.elements[n],!cond))ok=false};
  chk('fio',g('fio').split(/\s+/).length>=2);
  chk('email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('email')));
  chk('phone',g('phone').replace(/\D/g,'').length>=10);
  chk('tg',g('tg').length>=3);
  if(type==='vip'&&qty>1){var lines=g('guests').split(/\n+/).filter(function(x){return x.trim().length>3});chk('guests',lines.length>=qty)}
  if(type==='master'){if(!masterSel().length){ok=false;$('#m-err').style.display='block'}else $('#m-err').style.display='none';
    if($('#form-master input[name=rp]:checked').value==='1')chk('repost',g('repost').length>5)}
  if(!ok){var e=$('.fld.err',form);if(e)e.scrollIntoView({behavior:'smooth',block:'center'})}
  return ok}

/* ---------- отправка ---------- */
var ov=$('#ov');
function showOv(html){ov.innerHTML='<div class="box">'+html+'</div>';ov.classList.add('on')}
function submit(type){
  var form=$(type==='vip'?'#form-vip':'#form-master');if(!validate(form,type))return;
  var f=function(n){return (form.elements[n]&&form.elements[n].value||'').trim()};
  var d={type:type,fio:f('fio'),email:f('email'),phone:f('phone'),tg:f('tg'),agree:true};
  if(type==='vip'){d.qty=qty;d.guests=f('guests');d.method=form.elements.method.value}
  else{var m=masterCalc();d.masters=m.ids;d.repost=m.rep;d.repostLink=f('repost');d.prepay=m.pre;d.method='sbp'}
  var btn=$(type==='vip'?'#pay-vip':'#pay-master');btn.disabled=true;
  showOv('<div class="spin"></div><h4>Спасибо, заказ оформлен.</h4><p>Пожалуйста, подождите, идёт переход на страницу оплаты…</p>');
  fetch(api('/api/order'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
   .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Ошибка');return j})})
   .then(function(j){setTimeout(function(){location.href=j.next},900)})
   .catch(function(e){btn.disabled=false;showOv('<h4>Не удалось оформить заказ</h4><p>'+(e.message&&e.message!=='Failed to fetch'?e.message:'Сервер приёма заказов недоступен. Попробуйте позже или напишите организаторам: '+C.organizer.phone+', '+C.organizer.tg)+'</p><button type="button" class="btn-pay" id="ov-x">Закрыть</button>');$('#ov-x').onclick=function(){ov.classList.remove('on')}})
}
$('#pay-vip').onclick=function(){submit('vip')};$('#pay-master').onclick=function(){submit('master')};
$$('.fld input,.fld textarea').forEach(function(i){i.addEventListener('input',function(){var w=i.closest('.fld');if(w)w.classList.remove('err')})});
$$('input[name=phone]').forEach(function(i){i.addEventListener('input',function(){var d=i.value.replace(/\D/g,'');if(d[0]==='8')d='7'+d.slice(1);if(d&&d[0]!=='7')d='7'+d;d=d.slice(0,11);
  var o=d?'+7':'';if(d.length>1)o+=' ('+d.slice(1,4);if(d.length>=4)o+=') '+d.slice(4,7);if(d.length>=7)o+='-'+d.slice(7,9);if(d.length>=9)o+='-'+d.slice(9,11);i.value=o})});
$('#rp-link').hidden=true;
$$('#form-master input[name=rp]').forEach(function(i){i.addEventListener('change',function(){$('#rp-link').hidden=$('#form-master input[name=rp]:checked').value!=='1'})});
setTab((location.hash||'').replace('#','')==='master'?'master':'vip');
})();
