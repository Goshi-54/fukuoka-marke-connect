// 福岡マーケコネクト 申込フォーム
// 送信先は form の data-endpoint に入れる（Google Apps Script のウェブアプリURLを想定）。
// 空のあいだはテスト表示だけで、入力内容はどこにも送らない。
(()=>{
 'use strict';
 const form=document.getElementById('entryForm');if(!form)return;
 const error=document.getElementById('formError'),status=document.getElementById('formStatus'),done=document.getElementById('entryDone'),doneText=document.getElementById('entryDoneText'),button=form.querySelector('.submit-button');
 const labels={name:'お名前',email:'メールアドレス',company:'会社名',industry:'業種',plan:'参加内容',payment:'お支払い方法',agree:'同意'};
 function missing(){
  const out=[];
  for(const key of Object.keys(labels)){
   const els=[...form.elements].filter(el=>el.name===key);
   const ok=els.some(el=>(el.type==='radio'||el.type==='checkbox')?el.checked:el.value.trim()!=='');
   if(!ok)out.push(key);
  }
  const email=form.elements.email.value.trim();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!out.includes('email'))out.push('email-format');
  return out;
 }
 function mark(list){
  form.querySelectorAll('.is-invalid').forEach(el=>el.classList.remove('is-invalid'));
  for(const key of list){const el=form.elements[key==='email-format'?'email':key];const box=(el instanceof RadioNodeList?el[0]:el)?.closest('.field,.check-row');box?.classList.add('is-invalid');}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();error.hidden=true;status.textContent='';
  const list=missing();mark(list);
  if(list.length){
   const msg={industry:'業種を選択してください',plan:'参加内容を選択してください',payment:'お支払い方法を選択してください',agree:'同意の欄にチェックしてください','email-format':'メールアドレスの形式をご確認ください'};
   error.textContent=list.map(k=>msg[k]||labels[k]+'をご入力ください').join('／');
   error.hidden=false;form.querySelector('.is-invalid input,.is-invalid select,.is-invalid textarea')?.focus();return;
  }
  if(form.elements.website.value)return; // 自動送信の対策
  const data=Object.fromEntries(new FormData(form));delete data.website;
  data.receipt=data.receipt||'希望しない';data.submittedAt=new Date().toISOString();data.page=location.href.split('#')[0];
  const endpoint=form.dataset.endpoint.trim();
  button.disabled=true;status.textContent='送信しています…';
  try{
   doneText.replaceChildren();
   if(endpoint){
    const res=await fetch(endpoint,{method:'POST',body:JSON.stringify(data)}); // text/plain で送り、事前確認の通信を避ける
    const body=await res.json().catch(()=>({}));
    if(!res.ok||body.ok!==true)throw Error(body.error||'送信に失敗しました');
    renderGuide(body.guide);
   }else{
    renderGuide({blocks:[{h:'お申し込み内容',text:data.plan+'\nお支払い方法：'+data.payment}]});
    const note=document.createElement('p');note.className='test-note';
    note.textContent='【テスト表示】送信先がまだ設定されていないため、入力内容はどこにも送られていません。送信先につなぐと、参加内容とお支払い方法に合わせた案内（会場・お支払い・今後のご連絡）がここに表示され、同じ内容がメールで届きます。';
    doneText.append(note);
   }
   form.hidden=true;done.hidden=false;done.focus({preventScroll:true});
   scrollTo({top:done.getBoundingClientRect().top+scrollY-90,behavior:'instant'}); // サイト側のスクロール制御があるため instant で移動
  }catch(e){
   error.textContent='送信できませんでした。時間をおいてもう一度お試しください。';error.hidden=false;status.textContent='';
  }finally{button.disabled=false;}
 });
 function renderGuide(guide){
  if(!guide||!Array.isArray(guide.blocks)){const p=document.createElement('p');p.textContent='ご入力のメールアドレスに、あらためてご案内をお送りします。';doneText.append(p);return;}
  for(const b of guide.blocks){
   const box=document.createElement('div');box.className='guide-block'+(b.notice?' guide-notice':'');
   const h=document.createElement('h4');h.textContent=String(b.h||'');
   box.append(h);
   if(b.text){const p=document.createElement('p');p.textContent=String(b.text);box.append(p);}
   if(Array.isArray(b.items)&&b.items.length){const dl=document.createElement('dl');dl.className='guide-items';for(const [k,v] of b.items){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=String(k);dd.textContent=String(v);dl.append(dt,dd);}box.append(dl);}
   if(b.link&&/^https:\/\//.test(b.link.url)){const a=document.createElement('a');a.className='map-link';a.href=b.link.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=String(b.link.label||'開く');if(/maps\.app\.goo\.gl|google\.[a-z.]+\/maps/.test(b.link.url))a.prepend(pin());box.append(a);}
   if(b.image&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.image.src)){const img=document.createElement('img');img.className='guide-qr';img.src=b.image.src;img.alt=String(b.image.alt||'');img.width=150;img.height=150;box.append(img);}
   doneText.append(box);
  }
 }
 function pin(){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d','M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z');path.setAttribute('fill','currentColor');svg.append(path);return svg;}
 // 締切後（日本時間で締切日の翌日以降）はフォームの上にお知らせを出す。受付は止めない
 const late=document.getElementById('lateNote'),deadline=form.dataset.deadline||'';
 if(late&&/^\d{4}-\d{2}-\d{2}$/.test(deadline)&&new Date(Date.now()+9*3600e3).toISOString().slice(0,10)>deadline)late.hidden=false;
 form.addEventListener('input',e=>e.target.closest('.is-invalid')?.classList.remove('is-invalid'));
})();
