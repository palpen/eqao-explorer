'use strict';
(() => {
  const byId=id=>document.getElementById(id);
  if(new URLSearchParams(location.search).get('phone')==='1'){document.body.classList.add('phone-frame');return;}
  let phone=false,keyboard=false,loaded=false;const frame=byId('phone-preview-frame');
  function sendKeyboardState(){if(loaded)frame.contentWindow.postMessage({type:'school-mock-keyboard',open:keyboard},location.origin);}
  function render() {
    document.body.classList.toggle('show-phone-preview',phone);byId('phone-preview-stage').hidden=!phone;byId('preview-keyboard').hidden=!keyboard;byId('preview-keyboard-toggle').hidden=!phone;
    byId('preview-desktop').setAttribute('aria-pressed',String(!phone));byId('preview-phone').setAttribute('aria-pressed',String(phone));byId('preview-keyboard-toggle').setAttribute('aria-pressed',String(keyboard));byId('preview-keyboard-toggle').textContent=keyboard?'Hide keyboard':'Show keyboard';byId('phone-preview-stage').classList.toggle('with-keyboard',keyboard);sendKeyboardState();
  }
  byId('preview-phone').addEventListener('click',()=>{phone=true;if(!frame.getAttribute('src')){const url=new URL(location.href);url.search='?phone=1';url.hash='';frame.src=url.href;}render();});
  byId('preview-desktop').addEventListener('click',()=>{phone=false;keyboard=false;render();});byId('preview-keyboard-toggle').addEventListener('click',()=>{keyboard=!keyboard;render();});
  frame.addEventListener('load',()=>{loaded=true;sendKeyboardState();});
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='school-mock-keyboard-close'){keyboard=false;render();}});
  byId('preview-keyboard-keys').innerHTML=['qwertyuiop','asdfghjkl','zxcvbnm'].map(row=>`<div class="keyboard-row">${[...row].map(key=>`<button data-preview-key="${key}" aria-label="Type ${key}">${key}</button>`).join('')}</div>`).join('');
  byId('preview-keyboard').addEventListener('pointerdown',event=>{if(event.target.closest('[data-preview-key]'))event.preventDefault();});
  byId('preview-keyboard').addEventListener('click',event=>{const key=event.target.closest('[data-preview-key]')?.dataset.previewKey;if(key&&loaded)frame.contentWindow.postMessage({type:'school-mock-key',key},location.origin);});
})();
