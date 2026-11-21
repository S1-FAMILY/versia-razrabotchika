(function(){
var C=window.S1_CONFIG,box=document.getElementById('poll-box');if(!box)return;var P=C.poll,api=function(p){return (C.apiBase||'')+p};
var voted=false;try{voted=!!localStorage.getItem('s1poll')}catch(e){}
function results(data){var tot=0,m={};(data.counts||[]).forEach(function(c){m[c.id]=c.n;tot+=c.n});
  box.innerHTML='<h3>'+P.question+'</h3>'+P.options.map(function(o){var n=m[o.id]||0,pc=tot?Math.round(n*100/tot):0;return '<div class="poll-bar"><i data-w="'+pc+'"></i><span><b>'+o.label+'</b><b>'+pc+'%</b></span></div>'}).join('')+'<p class="note">Всего голосов: '+(data.voters||0)+'. Спасибо за участие!</p><p class="note">'+P.note+'</p>';
  setTimeout(function(){[].forEach.call(box.querySelectorAll('i[data-w]'),function(i){i.style.width=i.dataset.w+'%'})},60)}
function form(){
  box.innerHTML='<h3>'+P.question+'</h3><p class="note" style="margin-top:-8px">Можно выбрать до '+P.maxChoices+' вариантов.</p>'+P.options.map(function(o){return '<label class="opt"><input type="checkbox" value="'+o.id+'"><div><b>'+o.label+'</b></div></label>'}).join('')+
   '<label class="fld" style="margin-top:14px"><span>Свой вариант (необязательно)</span><input id="p-own" maxlength="80" placeholder="Например: Кавер-дэнс"></label><p class="note" id="p-msg" style="color:#ffb4b4;display:none"></p><button type="button" class="btn-pay" id="p-go" style="margin-top:6px">Проголосовать</button><p class="note">'+P.note+'</p>';
  var ins=[].slice.call(box.querySelectorAll('.opt input'));
  ins.forEach(function(i){i.onchange=function(){var n=ins.filter(function(x){return x.checked}).length;if(n>P.maxChoices){i.checked=false}ins.forEach(function(x){x.closest('.opt').classList.toggle('sel',x.checked)})}});
  document.getElementById('p-go').onclick=function(){var ch=ins.filter(function(x){return x.checked}).map(function(x){return x.value}),own=document.getElementById('p-own').value.trim(),msg=document.getElementById('p-msg');
    if(!ch.length&&!own){msg.textContent='Выберите хотя бы один вариант';msg.style.display='block';return}
    this.disabled=true;
    fetch(api('/api/poll'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({choices:ch,own:own})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'');return j})})
     .then(function(j){try{localStorage.setItem('s1poll','1')}catch(e){}results(j)})
     .catch(function(e){document.getElementById('p-go').disabled=false;msg.textContent=e.message||'Не удалось отправить голос — сервер недоступен.';msg.style.display='block'})}}
if(voted)fetch(api('/api/poll')).then(function(r){return r.json()}).then(results).catch(form);else form();
})();
