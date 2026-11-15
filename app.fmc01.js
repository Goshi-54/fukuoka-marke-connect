(async()=>{
'use strict';
const $=id=>document.getElementById(id),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const p=clamp((v-a)/(b-a));return p*p*(3-2*p)};
const sectionNodes=[...document.querySelectorAll('section[data-chapter]')];
const chapterTitles=['ファーストビュー','福岡の俯瞰','講師1','講師2','日程・会場','お申し込み'];
// The speakers stand on opposite sides of their landscape source frames.
const mobileFocalPoints={'lecturer-1':.10,'lecturer-2':.92};
const systemMotion=matchMedia('(prefers-reduced-motion:reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
let width=innerWidth,height=innerHeight,small=width<=880,lowMotion=systemMotion.matches,isHidden=document.hidden;
let bounds=[],frame=0,last=0,time=0,active=-1,y=scrollY,phase='',mobileFocalPoint=.5,pointer={x:0,y:0},surfaceTarget={x:0,y:0},surfaceCurrent={x:0,y:0};
let arrivalKey='',arrivalSince=0,settleTimer=0,settleFrame=0,pointerHeld=false,scrollDirection=1,observedY=scrollY;
let plan;try{const r=await fetch('journey-manifest.fmc01.json',{cache:'no-cache'});if(!r.ok)throw Error('Journey unavailable');plan=await r.json();}catch(e){console.error(e);return;}
const safe=p=>typeof p==='string'&&/^(media|journey-media)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..');
if(!(plan.services?.length>=1)||!safe(plan.roof.poster)||!safe(plan.roof.video)||!plan.descent.frames.every(safe))throw Error('Invalid journey settings');
const canvas=$('journeyCanvas'),ctx=canvas.getContext('2d'),images=new Map(),queue=[],queued=new Set();let busy=0;
function asset(path){if(images.has(path))return images.get(path);if(!safe(path))throw Error('Invalid media path');if(!queued.has(path)){queued.add(path);queue.push(path);pump();}return null;}
function pump(){while(queue.length&&busy<(small?4:6)){const path=queue.shift(),im=new Image();busy++;im.onload=()=>{images.set(path,im);busy--;pump();schedule();};im.onerror=()=>{busy--;canvas.dataset.mediaError=path;pump();};im.src=path;}}
asset(plan.roof.poster);plan.services.forEach(s=>(plan.mode==='temporary-motion'?['outside']:['outside','close','boundary','inside']).forEach(k=>asset(s[k].image)));plan.descent.frames.forEach(asset);plan.services.forEach(s=>(s.travel?.frames||[]).forEach(asset));
const roofVideo=document.createElement('video');roofVideo.muted=true;roofVideo.playsInline=true;roofVideo.preload='metadata';roofVideo.src=plan.roof.video;roofVideo.poster=plan.roof.poster;roofVideo.setAttribute('aria-hidden','true');roofVideo.loop=!!plan.roof.loop;roofVideo.style.display='none';$('loops').append(roofVideo);
roofVideo.addEventListener('loadeddata',()=>{if(phase==='roof-hold'&&!lowMotion&&!isHidden)roofVideo.play().catch(()=>{});schedule();});roofVideo.addEventListener('timeupdate',()=>{if(roofVideo.currentTime>=plan.roof.endTime){roofVideo.pause();roofVideo.dataset.playback='hold';}});
roofVideo.addEventListener('ended',()=>roofVideo.dataset.playback='hold');
const dwellVideos=plan.services.map(s=>{const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.dataset.service=s.id;v.style.display='none';if(safe(s.outside.video))v.src=s.outside.video;v.poster=s.outside.image;$('loops').append(v);v.addEventListener('loadeddata',schedule);return v;});
function stopVideos(except){[roofVideo,...dwellVideos].forEach(v=>{if(v!==except&&!v.paused)v.pause();});}
function dwell(i,alpha=1,play=true){const v=dwellVideos[i],s=plan.services[i],allowed=play&&!lowMotion&&!isHidden&&!document.querySelector('dialog[open]');if(allowed){stopVideos(v);if(v.paused&&!v.dataset.playPending&&!v.dataset.playFailed){v.dataset.playPending='true';v.play().then(()=>{delete v.dataset.playPending;}).catch(error=>{delete v.dataset.playPending;if(error.name!=='AbortError')v.dataset.playFailed='true';});}}else v.pause();return drawSource(!lowMotion&&v.readyState>=2?v:asset(s.outside.image),null,alpha);}
function travel(i,p){const paths=plan.services[i].travel.frames,n=Math.round(clamp(p)* (paths.length-1));let at=n;while(at>0&&!images.has(paths[at]))at--;const source=images.get(paths[at]);dwell(i,1,false);if(source)drawSource(source,null,smooth(0,.2,p));if(i<plan.services.length-1&&p>.8)still(plan.services[i+1].outside,smooth(.8,1,p));canvas.dataset.renderedFrame=String(at);}

function cancelSettle(){clearTimeout(settleTimer);cancelAnimationFrame(settleFrame);settleTimer=settleFrame=0;delete document.body.dataset.settling;}
function cancelPassageBridge(){}
function arrivedOpacity(key,now){if(arrivalKey!==key){arrivalKey=key;arrivalSince=now;}return lowMotion?1:smooth(0,420,now-arrivalSince);}
function setMotion(value){cancelSettle();lowMotion=value;document.documentElement.style.scrollBehavior=value?'auto':'smooth';document.body.classList.toggle('low-motion',value);$('motionToggle').textContent=value?'動きを戻す':'動きを弱める';$('motionToggle').setAttribute('aria-pressed',String(value));stopVideos();phase='';schedule();}
$('motionToggle').addEventListener('click',()=>setMotion(!lowMotion));systemMotion.addEventListener('change',e=>setMotion(e.matches));
function measure(){const t=plan.timing;const roof=$('rooftop');roof.style.height=height*(t.roofReadScreens+t.descentScreens)+'px';const span=t.outerScreens+t.entryScreens+t.innerScreens+t.exitScreens+t.transferScreens;plan.services.forEach(s=>{$(s.id).style.height=height*span+'px';$(s.id+'-inside').style.top=height*(t.outerScreens+t.entryScreens)+'px';});bounds=sectionNodes.map(n=>({id:n.id,name:n.dataset.chapter,top:n.offsetTop,height:n.offsetHeight}));}
function drawSource(source,quad,alpha=1){if(!source)return false;const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(!sw||!sh)return false;let sx=0,sy=0,cw=sw,ch=sh;if(Number.isInteger(quad)){cw=sw/2-5;ch=sh/2-5;sx=(quad%2)*sw/2+2.5;sy=Math.floor(quad/2)*sh/2+2.5;}
 const scale=Math.max(width/cw,height/ch),dw=cw*scale,dh=ch*scale;
 const focus=small?mobileFocalPoint:.5;
 ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(source,sx,sy,cw,ch,(width-dw)*focus,(height-dh)/2,dw,dh);ctx.restore();return true;}
function beginCanvas(){const dpr=canvas.width/width;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.fillStyle=small?'#0c0c0e':'#171b1c';ctx.fillRect(0,0,width,height);}
function still(m,alpha=1){return drawSource(asset(m.image),m.quad,alpha);}
function blend(a,b,p){still(a);still(b,smooth(0,1,p));}
function sequence(list,p){const q=clamp(p)*(list.length-1),n=Math.min(list.length-2,Math.floor(q));blend(list[n],list[n+1],q-n);}
function notice(_text){}
function panel(node,opacity,now){const el=node.querySelector('.scene');el.style.visibility=opacity>0?'visible':'hidden';el.style.opacity=String(opacity*arrivedOpacity(node.id,now));el.style.pointerEvents=opacity>.8?'auto':'none';el.dataset.arrived=String(opacity>0);}
function servicePhase(bound){if(plan.mode==='temporary-motion'){const u=(y-bound.top)/height,t=plan.timing;return u<t.outerScreens?{key:'outside',p:u/t.outerScreens}:{key:'transfer',p:clamp((u-t.outerScreens)/t.transferScreens)};}const s=(y-bound.top)/height,t=plan.timing;const a=t.outerScreens,b=a+t.entryScreens,c=b+t.innerScreens,d=c+t.exitScreens;return s<a?{key:'outside',p:s/a}:s<b?{key:'entry',p:(s-a)/(b-a)}:s<c?{key:'inside',p:(s-b)/(c-b)}:s<d?{key:'exit',p:(s-c)/(d-c)}:{key:'transfer',p:(s-d)/t.transferScreens};}
function passageAt(position){const roof=bounds[1],t=plan.timing;if(position>=roof.top+t.roofReadScreens*height&&position<roof.top+roof.height)return {start:roof.top+t.roofReadScreens*height,end:roof.top+roof.height};for(let i=0;i<plan.services.length;i++){const b=bounds[i+2],a=b.top+t.outerScreens*height,inside=a+t.entryScreens*height,exit=inside+t.innerScreens*height,end=b.top+b.height;if(position>a&&position<inside)return {start:a,end:inside};if(position>exit&&position<end)return {start:exit,end};}return null;}
function queueSettle(){clearTimeout(settleTimer);if(lowMotion||isHidden||pointerHeld||document.querySelector('dialog[open]'))return;settleTimer=setTimeout(()=>{const p=passageAt(scrollY);if(!p)return;const from=scrollY,q=(from-p.start)/(p.end-p.start),back=Math.max(0,p.start-1),to=scrollDirection>0?(q>.12?p.end:back):(q<.88?back:p.end),distance=to-from;if(Math.abs(distance)<1)return;let start;document.body.dataset.settling=scrollDirection>0?'forward':'backward';const step=now=>{start??=now;const v=clamp((now-start)/650),e=v*v*(3-2*v);scrollTo({top:from+distance*e,behavior:'instant'});schedule();if(v<1)settleFrame=requestAnimationFrame(step);else{settleFrame=0;delete document.body.dataset.settling;}};settleFrame=requestAnimationFrame(step);},160);}
const chapterMenu=$('chapterMenu');sectionNodes.forEach((node,i)=>{const link=document.createElement('a');link.href='#'+node.id;const number=document.createElement('span');number.textContent=String(i).padStart(2,'0');const text=document.createElement('div');const title=document.createElement('b');title.textContent=chapterTitles[i];const name=document.createElement('small');name.textContent=node.dataset.chapter;text.append(title,name);link.append(number,text);chapterMenu.append(link)});
let priorFocus=null,priorOverflow='';
function openDialog(dialog){stopVideos();cancelSettle();cancelPassageBridge();priorFocus=document.activeElement;priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();dialog.querySelector('.close')?.focus()}
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{document.body.style.overflow=priorOverflow;priorFocus?.focus();schedule()});dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close()})});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));$('menuOpen').addEventListener('click',()=>openDialog($('menu')));chapterMenu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>$('menu').close()));
document.querySelectorAll('.surface').forEach(surface=>{surface.addEventListener('pointermove',event=>{if(small||lowMotion||!fine.matches)return;const r=surface.getBoundingClientRect();surfaceTarget={x:-(event.clientY-r.top-r.height/2)/r.height*4,y:(event.clientX-r.left-r.width/2)/r.width*4}});surface.addEventListener('pointerleave',()=>surfaceTarget={x:0,y:0})});

function updateScene(now){
 y=scrollY;document.body.dataset.visualScrollY=y.toFixed(2);if(!bounds.length)return;
 sectionNodes.filter(n=>n.classList.contains('film-chapter')).forEach(n=>{const p=n.querySelector('.scene');p.style.visibility='hidden';p.style.opacity=0;p.style.pointerEvents='none';});
 const roof=bounds[1],roofExit=roof.top+roof.height,filmEnd=bounds[plan.services.length+1].top+bounds[plan.services.length+1].height,arrival=roof.top-height*.32,intro=clamp(y/roof.top);
 const introVisible=1-smooth(.015,.07,intro);$('introCopy').style.opacity=introVisible;$('introCopy').style.transform='translateY('+(-18*(1-introVisible))+'px)';document.querySelector('.intro-bottom').style.opacity=introVisible;
 const opening=$('firstView');opening.style.opacity=y<roof.top?'1':'0';opening.contentWindow?.postMessage({type:'sample-fv',active:y<=roof.top&&!isHidden,reduced:lowMotion,progress:intro,pointer},location.origin);
 $('prism').style.opacity=0;$('fallback').style.opacity=0;$('flash').style.opacity=0;$('dust').style.opacity=0;$('travel').style.opacity=0;
 let light=false,chapter=0;const reference=y+height*.25;bounds.forEach((b,i)=>{if(reference>=b.top)chapter=i;});
 canvas.style.opacity=y>=roof.top&&y<filmEnd?'1':'0';$('mediaDeck').style.opacity=y>=roof.top&&y<filmEnd?'1':'0';$('blackTide').style.transform=y>=filmEnd?'translateY(0%)':'translateY(110%)';notice('');
 if(y<roof.top){stopVideos();document.body.dataset.mediaState=intro<.035?'waiting-particles':intro<1?'existing-video':'arrival-hold';if(y>=arrival){chapter=1;panel($('rooftop'),1,now);light=true;}else arrivalKey='';phase='opening';}
 else if(y<roofExit){
  chapter=1;mobileFocalPoint=.10;beginCanvas();const t=plan.timing,p=clamp((y-roof.top-t.roofReadScreens*height)/(t.descentScreens*height));
  if(p===0){stopVideos(roofVideo);if(phase!=='roof-hold'){roofVideo.currentTime=plan.roof.startTime||0;roofVideo.dataset.playback='playing';if(!lowMotion&&!isHidden)roofVideo.play().catch(()=>{});}if(lowMotion||document.querySelector('dialog[open]'))roofVideo.pause();else if(roofVideo.paused&&roofVideo.currentTime<plan.roof.endTime)roofVideo.play().catch(()=>{});drawSource(roofVideo.readyState>1?roofVideo:asset(plan.roof.poster));panel($('rooftop'),1,now);phase='roof-hold';}
  else{stopVideos();arrivalKey='';const paths=plan.descent.frames,fp=Math.min(p/.84,1),cut=plan.descent.firstPartFraction,wanted=fp<cut?Math.round(fp/cut*60):61+Math.round((fp-cut)/(1-cut)*60);let found=wanted;while(found>0&&!images.has(paths[found]))found--;const im=images.get(paths[found]);drawSource(im||asset(plan.roof.poster));if(p>.84){still(plan.services[0].outside,smooth(.84,1,p));notice('接続映像準備中');}canvas.dataset.renderedFrame=String(found);phase='roof-descent';}
  light=true;document.body.dataset.mediaState=phase;document.body.dataset.mediaKind='existing-video';
 }
 else if(y<filmEnd){
  roofVideo.pause();beginCanvas();let i=0;for(let j=0;j<plan.services.length;j++)if(y>=bounds[j+2].top)i=j;chapter=i+2;const s=plan.services[i],state=servicePhase(bounds[i+2]);
  mobileFocalPoint=mobileFocalPoints[s.id]??.5;
  const nextService=plan.services[i+1];
  if(state.key==='transfer'&&nextService){const target=mobileFocalPoints[nextService.id]??.5;mobileFocalPoint+=(target-mobileFocalPoint)*smooth(0,1,state.p);}
  if(plan.mode==='temporary-motion'){
   if(state.key==='outside'){dwell(i);panel($(s.id),1,now);}
   else{stopVideos();arrivalKey='';if(i<plan.services.length-1)travel(i,state.p);else{dwell(i,1,false);$('mediaDeck').style.opacity=1-smooth(.08,.9,state.p);$('blackTide').style.transform='translateY('+(110*(1-smooth(.08,.9,state.p)))+'%)';}}
   phase=s.id+':'+state.key;document.body.dataset.mediaState=phase;document.body.dataset.mediaKind=state.key==='outside'?'temporary-video-loop':'scroll-video-frames';canvas.dataset.service=s.id;canvas.dataset.phase=state.key;canvas.dataset.progress=state.p.toFixed(3);canvas.dataset.playback=dwellVideos[i].paused?'paused':'playing';canvas.dataset.videoTime=dwellVideos[i].currentTime.toFixed(3);light=state.key==='outside';
  }else{
  if(state.key==='outside'){still(s.outside);panel($(s.id),1,now);notice('構図サンプル ／ 動画準備中');}
  else if(state.key==='inside'){still(s.inside);notice('構図サンプル ／ '+s.innerLabel);}
  else{arrivalKey='';if(state.key==='entry'){sequence([s.outside,s.close,s.boundary,s.inside],state.p);notice('進入映像準備中');}
   else if(state.key==='exit'){blend(s.inside,s.outside,state.p);notice('退出映像準備中');}
   else if(i<plan.services.length-1){blend(s.outside,plan.services[i+1].outside,state.p);notice('場所間の移動映像準備中');}
   else{still(s.outside);$('mediaDeck').style.opacity=1-smooth(.25,1,state.p);$('blackTide').style.transform='translateY('+(110*(1-smooth(.25,1,state.p)))+'%)';notice(state.p<.7?'退出映像準備中':'');}
  }
  phase=s.id+':'+state.key;document.body.dataset.mediaState=phase;document.body.dataset.mediaKind='still-preview';canvas.dataset.service=s.id;canvas.dataset.phase=state.key;canvas.dataset.progress=state.p.toFixed(3);light=state.key==='outside';
  }
 }else{stopVideos();phase='dark';document.body.dataset.mediaState='dark';delete document.body.dataset.mediaKind;}
 if(chapter!==active){active=chapter;document.body.dataset.chapter=bounds[chapter].id;$('railNumber').textContent='CH.'+String(chapter).padStart(2,'0');$('railName').textContent=bounds[chapter].name;chapterMenu.querySelectorAll('a').forEach((link,i)=>{if(i===chapter)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});const id=sectionNodes[chapter].dataset.nav||bounds[chapter].id;document.querySelectorAll('.top-nav a').forEach(link=>{if(link.hash==='#'+id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});}
 const b=bounds[chapter],progress=clamp((y-b.top)/b.height);$('railFill').style.height=(chapter+progress)/bounds.length*100+'%';$('header').classList.toggle('is-light',light);document.querySelector('.rail').classList.toggle('is-light',light);$('header').classList.toggle('scrolled',y>35);
}
function resize(){cancelSettle();width=innerWidth;height=innerHeight;small=width<=880;const ratio=Math.min(devicePixelRatio||1,small?1.3:1.6);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);measure();phase='';schedule();}
function render(now){frame=0;if(isHidden)return;const dt=last?Math.min((now-last)/1000,.08):0;last=now;if(!lowMotion)time+=dt;updateScene(now);if(!small&&fine.matches&&!lowMotion){surfaceCurrent.x+=(surfaceTarget.x-surfaceCurrent.x)*.12;surfaceCurrent.y+=(surfaceTarget.y-surfaceCurrent.y)*.12;document.querySelectorAll('.surface').forEach(s=>s.style.transform='rotateX('+surfaceCurrent.x+'deg) rotateY('+surfaceCurrent.y+'deg)');}else document.querySelectorAll('.surface').forEach(s=>s.style.transform='none');if(!lowMotion)schedule();}
function schedule(){if(!frame&&!isHidden)frame=requestAnimationFrame(render);}
addEventListener('pointermove',e=>{pointer={x:(e.clientX/width-.5)*2,y:(e.clientY/height-.5)*2};schedule();},{passive:true});
addEventListener('scroll',()=>{if(Math.abs(scrollY-observedY)>.5)scrollDirection=scrollY>observedY?1:-1;observedY=scrollY;schedule();if(!settleFrame)queueSettle();},{passive:true});
addEventListener('resize',resize,{passive:true});for(const type of ['wheel','touchstart'])addEventListener(type,cancelSettle,{passive:true});
addEventListener('pointerdown',()=>{pointerHeld=true;dwellVideos.forEach(v=>delete v.dataset.playFailed);cancelSettle();},{passive:true});for(const type of ['pointerup','pointercancel'])addEventListener(type,()=>{pointerHeld=false;queueSettle();},{passive:true});
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))cancelSettle();});
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',cancelSettle));
new ResizeObserver(()=>{measure();schedule();}).observe($('entry'));
document.addEventListener('visibilitychange',()=>{isHidden=document.hidden;if(isHidden){cancelSettle();cancelAnimationFrame(frame);frame=0;stopVideos();}else{last=0;phase='';schedule();}});
setMotion(lowMotion);resize();
// Resolve deep links after the asynchronous settings load has established chapter heights.
requestAnimationFrame(()=>requestAnimationFrame(()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{}const target=id&&document.getElementById(id);if(target){cancelSettle();scrollTo({top:target.getBoundingClientRect().top+scrollY,behavior:'instant'});}schedule();}));
})();
