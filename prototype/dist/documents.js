(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const dialog=$('image-dialog');
  if(!dialog)return;
  const img=$('image-full'),viewport=$('image-viewport'),canvas=$('image-canvas');
  let scale=1,fitMode=true,drag=null;
  function fitScale(){return Math.min((viewport.clientWidth-24)/img.naturalWidth,(viewport.clientHeight-24)/img.naturalHeight,1);}
  function paint(){
    const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
    img.style.width=`${width}px`;img.style.height=`${height}px`;
    canvas.style.width=`${Math.max(viewport.clientWidth,width+24)}px`;
    canvas.style.height=`${Math.max(viewport.clientHeight,height+24)}px`;
    $('image-scale').textContent=`${Math.round(scale*100)}%`;
    $('image-zoom-out').disabled=scale<=Math.max(.02,fitScale()/2)+.001;
    $('image-zoom-in').disabled=scale>=3;
    viewport.classList.toggle('can-pan',width>viewport.clientWidth||height>viewport.clientHeight);
  }
  function zoom(next,fit=false){
    if(!img.naturalWidth)return;
    const centerX=(viewport.scrollLeft+viewport.clientWidth/2)/canvas.offsetWidth;
    const centerY=(viewport.scrollTop+viewport.clientHeight/2)/canvas.offsetHeight;
    scale=Math.max(Math.max(.02,fitScale()/2),Math.min(3,next));fitMode=fit;
    paint();
    viewport.scrollLeft=fit?0:centerX*canvas.offsetWidth-viewport.clientWidth/2;
    viewport.scrollTop=fit?0:centerY*canvas.offsetHeight-viewport.clientHeight/2;
  }
  function fit(){if(img.naturalWidth)zoom(fitScale(),true);}
  img.addEventListener('load',()=>{fit();$('image-help').textContent='Увеличьте схему и перемещайте её мышью или прокруткой. Клавиши + / − меняют масштаб.';});
  img.addEventListener('error',()=>{$('image-help').textContent='Не удалось загрузить схему. Откройте исходное изображение по ссылке выше.';});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-image]');if(!button)return;
    $('image-title').textContent=button.dataset.title||'Диаграмма';img.alt=button.dataset.title||'Диаграмма';
    $('image-original').href=button.dataset.image;
    img.style.width='0px';img.style.height='0px';
    dialog.showModal();img.src=button.dataset.image;
    if(img.complete&&img.naturalWidth)fit();
    $('image-fit').focus();
  });
  $('image-zoom-in').addEventListener('click',()=>zoom(scale*1.25));
  $('image-zoom-out').addEventListener('click',()=>zoom(scale/1.25));
  $('image-fit').addEventListener('click',fit);
  $('image-actual').addEventListener('click',()=>zoom(1));
  $('image-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{
    if(event.key==='+'||event.key==='='){event.preventDefault();zoom(scale*1.25);}
    if(event.key==='-'){event.preventDefault();zoom(scale/1.25);}
    if(event.key==='0'){event.preventDefault();fit();}
  });
  viewport.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==0||!viewport.classList.contains('can-pan'))return;
    drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');event.preventDefault();
  });
  viewport.addEventListener('pointermove',event=>{if(drag){viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY;}});
  function release(){drag=null;viewport.classList.remove('dragging');}
  viewport.addEventListener('pointerup',release);viewport.addEventListener('pointercancel',release);viewport.addEventListener('lostpointercapture',release);
  window.addEventListener('resize',()=>{if(dialog.open&&img.naturalWidth){if(fitMode)fit();else paint();}});
  dialog.addEventListener('close',release);
  dialog.addEventListener('click',event=>{
    const r=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();
  });
})();
