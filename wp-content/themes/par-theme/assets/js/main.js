document.addEventListener('DOMContentLoaded',function(){
var t=document.querySelector('.hdr__toggle'),n=document.querySelector('.hdr__nav');
if(t&&n)t.addEventListener('click',function(){var o=n.classList.toggle('active');t.setAttribute('aria-expanded',o);t.querySelector('.hdr__toggle-open').style.display=o?'none':'block';t.querySelector('.hdr__toggle-close').style.display=o?'block':'none'});
document.querySelectorAll('.faq-row__q').forEach(function(b){b.addEventListener('click',function(){var r=b.closest('.faq-row'),w=r.classList.contains('open');document.querySelectorAll('.faq-row').forEach(function(x){x.classList.remove('open');x.querySelector('.faq-row__q').setAttribute('aria-expanded','false')});if(!w){r.classList.add('open');b.setAttribute('aria-expanded','true')}})});
document.querySelectorAll('[data-par-outbound]').forEach(function(button){button.addEventListener('click',function(){
  var tab=window.open('about:blank','_blank');
  var network=button.getAttribute('data-par-outbound')==='network';
  var destination=network?new URL('https://askafreepsychicquestion.com/'):new URL('https://asknebula.com/flow/lp/simple-simple-registration/quiz/gender');
  if(network){
    destination.searchParams.set('utm_source','psychic-advisor-ratings.com');
    destination.searchParams.set('utm_medium','referral');
    destination.searchParams.set('utm_campaign','network-priority');
  }else{
    destination.searchParams.set('utm_source','aff');
    destination.searchParams.set('utm_medium','google');
    destination.searchParams.set('utm_campaign','google_net__psychic-advisor-ratings.com');
  }
  button.disabled=true;
  button.setAttribute('aria-busy','true');
  var previous=button.textContent;
  var portuguese=document.documentElement.lang.toLowerCase().indexOf('pt')===0;
  button.textContent=network?(portuguese?'Abrindo recurso…':'Opening resource…'):(portuguese?'Abrindo AskNebula…':'Opening AskNebula…');
  window.setTimeout(function(){
    if(tab){tab.opener=null;tab.location.replace(destination.href)}else{window.location.assign(destination.href)}
    button.disabled=false;
    button.removeAttribute('aria-busy');
    button.textContent=previous;
  },180);
})});
document.querySelectorAll('[data-par-number-tool]').forEach(function(tool){
  var action=tool.querySelector('[data-par-calculate]'),date=tool.querySelector('[data-par-date]'),result=tool.querySelector('[data-par-number-result]'),pt=tool.dataset.locale==='pt';
  function reduce(value){while(value>9&&value!==11&&value!==22&&value!==33){value=String(value).split('').reduce(function(sum,digit){return sum+Number(digit)},0)}return value}
  action.addEventListener('click',function(){
    var parts=date.value.split('-');
    if(parts.length!==3){result.textContent=pt?'Informe uma data válida.':'Enter a valid date.';return}
    var year=Number(parts[0]),month=Number(parts[1]),day=Number(parts[2]);
    var check=new Date(year,month-1,day);
    if(check.getFullYear()!==year||check.getMonth()+1!==month||check.getDate()!==day){result.textContent=pt?'Informe uma data válida.':'Enter a valid date.';return}
    var monthNumber=reduce(month),dayNumber=reduce(day),yearNumber=reduce(String(year).split('').reduce(function(sum,digit){return sum+Number(digit)},0));
    var finalNumber=reduce(monthNumber+dayNumber+yearNumber);
    result.textContent=(pt?'Mês ':'Month ')+monthNumber+' + '+(pt?'dia ':'day ')+dayNumber+' + '+(pt?'ano ':'year ')+yearNumber+' = '+(monthNumber+dayNumber+yearNumber)+' → '+(pt?'seu número é ':'your number is ')+finalNumber+'.';
  });
});
document.querySelectorAll('[data-par-style-quiz]').forEach(function(quiz){
  var answers={},result=quiz.querySelector('[data-par-style-result]'),pt=quiz.dataset.locale==='pt';
  quiz.querySelectorAll('[data-par-choice]').forEach(function(button){button.addEventListener('click',function(){
    var group=button.closest('[data-par-question]'),number=Number(group.dataset.parQuestion);
    group.querySelectorAll('[data-par-choice]').forEach(function(item){item.setAttribute('aria-pressed','false')});
    button.setAttribute('aria-pressed','true');answers[number]=Number(button.dataset.parChoice);
    if(Object.keys(answers).length===3){
      var style=answers[1],labels=pt?['tarô','astrologia','leitura intuitiva','guia de perguntas']:['tarot','astrology','an intuitive reading','question guide'];
      var paths=['ask-psychic-question','vedic-astrology','ask-psychic-question','ask-psychic-question'];
      var link=document.createElement('a');link.href=(pt?'/pt/':'/')+paths[style]+'/';link.textContent=pt?'Leia o guia relacionado →':'Read a related guide →';
      result.textContent=(pt?'Seu ponto de partida: ':'Your starting point: ')+labels[style]+'. ';
      result.appendChild(link);
    }
  })});
});
});
