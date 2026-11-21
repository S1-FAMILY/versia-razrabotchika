(function(){var C=window.S1_CONFIG;if(!C)return;var p=C.vipPrice(),rub=function(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ₽'};
document.querySelectorAll('[data-vip-price]').forEach(function(e){e.textContent=rub(p.price)});
document.querySelectorAll('[data-vip-old]').forEach(function(e){if(p.old){e.textContent=rub(p.old);e.hidden=false}else e.hidden=true});
var band=document.getElementById('promo');if(!band||!p.promo)return;band.hidden=false;
function t(){var l=Math.max(0,p.end-Date.now()),d=Math.floor(l/864e5),h=Math.floor(l%864e5/36e5),m=Math.floor(l%36e5/6e4);document.getElementById('promo-t').textContent=d+' д '+('0'+h).slice(-2)+' ч '+('0'+m).slice(-2)+' мин'}
t();setInterval(t,30000);
var s=Math.round((1-p.price/p.old)*100);document.getElementById('promo-p').textContent='−'+s+'%';
})();
