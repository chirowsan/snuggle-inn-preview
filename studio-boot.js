/* Independent, bounded studio credit. No imports, sound, save writes or fake loading. */
(() => {
 const splash=document.getElementById('studio-splash');
 let dismissed=false,timer,stallTimer,resolve,ready=false;
 window.hotelStudioReady=new Promise(done=>{resolve=done;});
 const dismiss=()=>{
  if(dismissed)return;dismissed=true;clearTimeout(timer);clearTimeout(stallTimer);splash.hidden=true;
  document.removeEventListener('keydown',key,true);resolve();
 };
 const key=e=>{if(!dismissed){e.preventDefault();e.stopImmediatePropagation();dismiss();}};
 window.hotelStudioDismiss=dismiss;
 splash.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();dismiss();});
 splash.querySelector('button').onclick=dismiss;
 const img=splash.querySelector('img'),fallback=document.getElementById('studio-fallback');
 const displayReady=()=>{
  if(dismissed||ready)return;
  if(!img.naturalWidth){dismiss();return;}
  ready=true;clearTimeout(stallTimer);if(fallback)fallback.hidden=true;
  // Gentle reveal inside the same dwell; skipped for reduced motion or old browsers.
  try{if(typeof img.animate==='function'&&!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))img.animate([{opacity:0,transform:'scale(.94) translateY(8px)'},{opacity:1,transform:'none'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'});}catch{}
  timer=setTimeout(dismiss,1200);
 };
 const loaded=()=>{
  if(dismissed||ready)return;
  if(typeof img.decode==='function')Promise.resolve().then(()=>img.decode()).then(displayReady,displayReady);
  else displayReady();
 };
 img.onerror=dismiss;img.onload=loaded;
 document.addEventListener('keydown',key,true);
 let reload=false;try{reload=performance.getEntriesByType('navigation')[0]?.type==='reload';}catch{}
 if(reload){dismiss();return;}
 // The approved PNG gets a real visible dwell; stalled loading still fails open.
 stallTimer=setTimeout(dismiss,4000);
 if(img.complete){if(img.naturalWidth)loaded();else dismiss();}
 if(!dismissed)splash.querySelector('button').focus({preventScroll:true});
})();
