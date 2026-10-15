(function(){
  'use strict';
  const E=window.StockFlowEngine;
  const key='stockflow-demo-v1';
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let storageAvailable=true,stored=null;
  try{stored=localStorage.getItem(key);}catch{storageAvailable=false;}
  let state=E.restore(stored)||E.createDemo();
  let selected='demo01',view='replenishment',filter='all',draft=null,toastTimer;
  const productIcons={"faucet": "<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 20h14M9 20V9h8v5h4v-4a5 5 0 0 0-5-5h-4M12 5V2M8 2h8M5 12h4\"/></svg>", "hose": "<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 3h4v5H5zM7 8v8a5 5 0 0 0 10 0V8M15 3h4v5h-4\"/></svg>", "aerator": "<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 5h12v4H6zM7 9v8h10V9M8 21h8M10 17v4M14 17v4M9 12h6\"/></svg>"};
  const productIcon=id=>productIcons[{demo01:'faucet',demo02:'hose',demo03:'aerator'}[id]]||productIcons.aerator;
  const amount=n=>n===null?'—':`${n} шт.`;
  function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{storageAvailable=false;toast('Браузер не сохраняет историю. Она доступна до закрытия страницы.');}}
  function current(){return selected?E.recommendation(state,selected):null;}
  function prop(){return selected?E.proposal(state,selected):null;}
  function setState(next,message){state=next;draft=null;save();render();if(message)toast(message);}
  function snapshot(){const p=prop();return p?E.productState(state,selected).snapshots.find(s=>s.ownStockSnapshotId===p.ownStockSnapshotId):null;}
  function pill(label,type){return `<span class="pill ${type} chip chip--sm chip--soft">${esc(label)}</span>`;}
  function empty(title,text){return `<div class="empty-state"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h8"/></svg><h4>${title}</h4><p>${text}</p><button type="button" class="button outline button--secondary button--sm" data-action="show-replenishment">К подсорту ↗</button></div>`;}
  function filteredProducts(){const q=$('#search-products').value.trim().toLocaleLowerCase('ru');return state.items.filter(p=>{
    const rec=E.recommendation(state,p.product.id);
    const matches=!q||`${p.product.sku} ${p.product.name}`.toLocaleLowerCase('ru').includes(q);
    return matches&&(filter==='all'||filter==='need'&&rec.totalRecommendedUnits>0||filter==='missing'&&rec.status==='incomplete');
  });}
  function renderCatalog(){
    const visible=filteredProducts();
    if(!visible.some(p=>p.product.id===selected)){selected=visible[0]?.product.id||null;draft=null;}
    $('#catalog-body').innerHTML=visible.length?visible.map(p=>{
      const rec=E.recommendation(state,p.product.id),decision=E.decisionFor(state,rec.recommendationId);
      const badge=decision?pill(decision.status==='approved'?'Утверждено':'Отказ',decision.status==='approved'?'good':'neutral'):rec.status==='incomplete'?pill('Нет расчёта','warn'):rec.totalRecommendedUnits===0?pill('Запаса хватает','neutral'):pill('К рассмотрению','good');
      return `<article class="catalog-card ${selected===p.product.id?'selected':''} card"><div class="catalog-card-head"><span class="product-tile">${productIcon(p.product.id)}</span><div><strong>${esc(p.product.name)}</strong><small>${esc(p.product.sku)}</small></div></div><div class="catalog-quantities"><span>Ozon <b>${amount(rec.lines[0].recommendedUnits)}</b></span><span>WB <b>${amount(rec.lines[1].recommendedUnits)}</b></span></div><div class="catalog-card-bottom">${badge}<button type="button" class="row-open" data-product="${p.product.id}" aria-label="Открыть ${esc(p.product.name)}" aria-pressed="${selected===p.product.id}">${selected===p.product.id?'Открыто':'Рассмотреть'}</button></div></article>`;
    }).join(''):'<p class="empty-row">Товары не найдены. Измените запрос или фильтр.</p>';
    const needed=state.items.filter(p=>E.recommendation(state,p.product.id).totalRecommendedUnits>0).length;
    const missing=state.items.filter(p=>E.recommendation(state,p.product.id).status==='incomplete').length;
    $('#work-overview').innerHTML=`<div class="work-stat"><span>Товаров в демо</span><strong>${state.items.length}</strong></div><div class="work-stat"><span>Нужен подсорт</span><strong>${needed}</strong></div><div class="work-stat"><span>Нет расчёта</span><strong>${missing}</strong></div>`;
  }
  function draftInput(){const rec=current();return {shipmentLines:rec.lines.map(l=>({listingId:l.listingId,units:draft.shipment[l.listingId]})),purchaseUnits:draft.purchase};}
  function panel(){
    if(!selected){$('#decision-panel').innerHTML='';return;}
    const rec=current(),p=E.productState(state,selected),proposal=prop(),decision=E.decisionFor(state,rec.recommendationId);
    const labels=['Потребность','Остаток','Решение',decision&&!decision.shipmentPlan&&!decision.purchasePlan?'Без планов':'Планы'];
    const completed=[true,!!proposal,!!decision,!!decision];
    const top=`<div class="panel-top"><div><h4>${esc(p.product.name)}</h4><p>${esc(p.product.sku)} · рекомендация по одному товару</p></div><div class="steps" aria-label="Этап сценария">${labels.map((label,i)=>`<span class="${completed[i]?'done':''}"><b>${i+1}</b>${label}</span>`).join('')}</div></div>`;
    if(decision){
      const total=decision.shipmentPlan?decision.shipmentPlan.lines.reduce((sum,l)=>sum+l.approvedShipmentUnits,0):0;
      const purchased=decision.purchasePlan?decision.purchasePlan.lines[0].approvedPurchaseUnits:0;
      $('#decision-panel').innerHTML=top+`<div class="saved-note ${decision.status==='rejected'?'rejected':''}"><h4>${decision.status==='approved'?'Решение сохранено':'Рекомендация отклонена'}</h4><p>${decision.status==='approved'?`Отгрузка — ${total} шт., закупка — ${purchased} шт. ${total+purchased===0?'Планы не созданы: оба объёма равны нулю.':'Планы содержат только положительные количества.'}`:`Причина: ${esc(decision.reason)}. Планы не созданы.`}</p><p>Исходные данные и предложение остаются в истории. Новое решение требует нового расчёта и подтверждения своего остатка.</p><div class="actions"><button type="button" class="button primary button--primary button--sm" data-action="show-history">Посмотреть историю ↗</button><button type="button" class="button outline button--secondary button--sm" data-action="new-calculation">Новый расчёт</button></div></div>`;
      return;
    }
    const issues=rec.lines.filter(l=>l.calculationIssue).map(l=>esc(l.calculationIssue));
    const demandBox=`<div class="data-box card"><div class="box-head"><h4>Потребность площадок</h4><small>До учёта своего склада</small></div>${rec.lines.map(l=>`<div class="need-line"><span><span class="market-icon ${l.marketplace==='Ozon'?'oz':'wb'}">${l.marketplace==='Ozon'?'O':'W'}</span>${l.marketplace==='Ozon'?'Ozon':'WB'}</span><small>${l.recommendedUnits===null?'Нет расчёта':l.recommendedUnits===0?'Запаса хватает':'К пополнению'}</small><strong>${l.recommendedUnits===null?'—':l.recommendedUnits}</strong></div>`).join('')}<div class="need-total"><span>Общая потребность</span><strong>${amount(rec.totalRecommendedUnits)}</strong></div><details class="source-details"><summary>Откуда взялось количество</summary>${rec.lines.map(l=>`<div class="data-formula"><strong>${esc(l.marketplace)}</strong><p>${l.salesUnits===null?'Продажи не получены':`${l.salesUnits} продаж за ${l.salesWindowDays} дней`}<br>Остаток площадки: ${l.marketplaceStockUnits} шт.<br>${l.targetCoverageDays===null?'Правило не задано':`Покрытие: ${l.targetCoverageDays} день. Целевой запас: ${l.targetStockUnits===null?'—':l.targetStockUnits} шт.`}<br>${l.recommendedUnits===null?esc(l.calculationIssue):`Потребность: max(0, ${l.targetStockUnits} − ${l.marketplaceStockUnits}) = ${l.recommendedUnits} шт.`}</p></div>`).join('')}<p>Целевой запас округляется вверх до целой штуки. Нулевые продажи дают нулевую потребность.</p></details></div>`;
    const stockBox=proposal?`<div class="action-box card"><div class="box-head"><h4>Свой склад подтверждён</h4>${pill('Новый снимок','good')}</div><div class="stock-number">${proposal.availableUnits}<small> шт.</small></div><p class="stock-label">${esc(snapshot().sourceLabel)}</p><p>Остаток ограничивает текущую отгрузку. Закупка не увеличивает доступное количество.</p><button type="button" class="button outline button--secondary button--sm" data-action="confirm-stock">Подтвердить заново</button></div>`:`<div class="action-box card"><div class="box-head"><h4>Остаток своего склада</h4>${pill('Не подтверждён','neutral')}</div><p>Проверьте доступное количество в учёте селлера. После подтверждения система предложит отгрузку и отдельный объём закупки.</p><p class="box-note" style="margin-top:12px">Утвердить планы без нового подтверждения нельзя.</p></div>`;
    if(proposal&&!draft)draft={shipment:Object.fromEntries(proposal.lines.map(l=>[l.listingId,l.proposedShipmentUnits])),purchase:proposal.proposedPurchaseUnits};
    const distribution=proposal?`<div class="distribution"><div class="distribution-head"><div><h4>Предложение и ваше решение</h4><p>Начальные количества сохранятся. Меняйте итог по своей стратегии.</p></div>${pill('Пропорционально потребности','neutral')}</div><table class="allocation-table"><thead><tr><th>Площадка</th><th>Потребность</th><th>Предложено</th><th>Ваше решение, шт.</th></tr></thead><tbody>${rec.lines.map(l=>`<tr><td>${esc(l.marketplace)}</td><td>${l.recommendedUnits}</td><td>${proposal.lines.find(x=>x.listingId===l.listingId).proposedShipmentUnits}</td><td><input class="input input--sm" type="number" min="0" max="2147483647" step="1" inputmode="numeric" data-shipment="${esc(l.listingId)}" value="${esc(draft.shipment[l.listingId])}" aria-label="Отгрузка ${esc(l.marketplace)}, шт."></td></tr>`).join('')}</tbody></table><div class="decision-bottom"><div class="decision-totals"><div><small>Всего к отгрузке</small><strong id="shipment-total"></strong></div><div><small>Остаток после отгрузки</small><strong id="stock-remaining"></strong></div></div><label class="purchase-control">К закупке, шт. <input type="number" id="purchase-units" class="purchase-input input input--sm" value="${esc(draft.purchase)}" min="0" max="2147483647" step="1" inputmode="numeric"></label></div><p class="box-note" style="margin-top:12px">Предложено к закупке: ${proposal.proposedPurchaseUnits} шт. Количество можно изменить отдельно.</p><p id="approval-error" class="form-error" role="alert" hidden></p></div>`:'';
    const actionBar=`<div class="approval-area">${proposal?'<button type="button" class="button primary button--primary button--sm" id="approve-button" data-action="approve">Утвердить решение</button>':`<button type="button" class="button primary button--primary button--sm" data-action="confirm-stock" ${rec.status==='incomplete'?'disabled':''}>Подтвердить остаток</button>`}<button type="button" class="quiet" data-action="reject">Отклонить</button><span class="approval-hint" id="action-summary">${proposal?'':'Перед утверждением нужен новый снимок остатка.'}</span></div>`;
    $('#decision-panel').innerHTML=top+actionBar+(issues.length?`<div class="blocked-note"><strong>Распределение и утверждение недоступны</strong>${issues.join(' ')} Восстановите данные в переключателе «Ситуация» или отклоните рекомендацию.</div>`:'')+`<div class="panel-grid">${demandBox}${stockBox}</div>`+distribution+`<p class="decision-footnote">Только утверждение создаёт планы. Исполнение остаётся у селлера.</p>`;
    if(proposal)updateTotals();
  }
  function updateTotals(){
    if(!draft||!prop())return;
    let total,valid=true,message='';
    try{const result=E.validateApproval(state,selected,draftInput());total=result.total;}
    catch(error){valid=false;message=error.message;try{total=Object.values(draft.shipment).reduce((sum,v)=>sum+E.units(v),0);}catch{total=null;}}
    $('#shipment-total').textContent=amount(total);
    const remaining=total===null?null:prop().availableUnits-total;
    $('#stock-remaining').textContent=amount(remaining);
    $('#shipment-total').classList.toggle('limit-error',!valid);
    $('#stock-remaining').classList.toggle('limit-error',remaining!==null&&remaining<0);
    $('#approval-error').textContent=message;$('#approval-error').hidden=valid;
    $('#approve-button').disabled=!valid;
    $('#action-summary').textContent=valid?`Отгрузка ${total} · Закупка ${draft.purchase} шт.`:message;
  }
  function history(){
    const n=state.decisions.length,last=n%10,teen=n%100;
    $('#history-total').textContent=`${n} ${teen>=11&&teen<=14?'решений':last===1?'решение':last>=2&&last<=4?'решения':'решений'}`;
    $('#history-list').innerHTML=state.decisions.length?[...state.decisions].reverse().map((d,i)=>{
      const approved=d.status==='approved';
      const rows=d.recommendation.lines.map(l=>({label:l.marketplace,original:d.proposal?.lines.find(x=>x.listingId===l.listingId)?.proposedShipmentUnits??null,result:approved?(d.shipmentPlan?.lines.find(x=>x.listingId===l.listingId)?.approvedShipmentUnits??0):null}));
      rows.push({label:'Закупка',original:d.proposal?.proposedPurchaseUnits??null,result:approved?(d.purchasePlan?.lines[0].approvedPurchaseUnits??0):null});
      const comparison=`<table class="history-table"><caption class="sr-only">Сравнение предложения и решения по ${esc(d.product.name)}, количества в штуках</caption><thead><tr><th scope="col">Назначение</th><th scope="col">Предложено</th><th scope="col">${approved?'Утверждено':'Итог'}</th><th scope="col">Изменение</th></tr></thead><tbody>${rows.map(r=>{const delta=r.original===null||r.result===null?null:r.result-r.original;return `<tr class="${delta?'changed':''}"><th scope="row">${esc(r.label)}</th><td>${r.original??'—'}</td><td><strong>${r.result??'—'}</strong></td><td>${delta===null?'—':delta===0?'Без изменений':`<span class="delta">${delta>0?'+':'−'}${Math.abs(delta)} шт.</span>`}</td></tr>`;}).join('')}</tbody></table>`;
      return `<article class="history-card card"><div class="history-top"><h4>${esc(d.product.name)}</h4>${pill(approved?'Утверждено':'Отказ',approved?'good':'neutral')}</div><p class="sku">${esc(d.product.sku)} · решение №${state.decisions.length-i} · менеджер демо</p>${comparison}${!approved?`<p class="history-note">Планы не созданы.${d.proposal?'':' Отказ до формирования предложения.'}</p>`:''}${d.reason?`<p class="reason">Причина: ${esc(d.reason)}</p>`:''}<details><summary>Основание решения</summary><p>Потребность: ${d.recommendation.totalRecommendedUnits===null?'расчёт неполный':`${d.recommendation.totalRecommendedUnits} шт.`}<br>${d.stock?`Свой остаток: ${d.stock.availableUnits} шт.; источник: ${esc(d.stock.sourceLabel)}.`:'Свой остаток для раннего отказа не требовался.'}<br>Снимки и версия правила сохранены вместе с рекомендацией; обновления не меняют это решение.</p></details></article>`;
    }).join(''):empty('Пока нет решений','Утвердите количества или отклоните рекомендацию. Здесь будут видны исходное предложение и ваш итог.');
  }
  function plans(){
    const entries=state.decisions.flatMap(d=>[['shipment',d.shipmentPlan],['purchase',d.purchasePlan]].filter(([,p])=>p).map(([type,plan])=>({d,type,plan}))).reverse();
    $('#plans-list').innerHTML=entries.length?entries.map(({d,type,plan})=>`<article class="plan-card card"><div class="plan-top"><h4>${type==='shipment'?'План отгрузки':'План закупки'}</h4><button class="button outline button--secondary button--sm" type="button" data-download-plan="${esc(d.decisionId)}" data-plan-type="${type}">Скачать CSV ↓</button></div><div class="plan-lines">${plan.lines.map(l=>`<div><span>${esc(d.product.name)}${type==='shipment'?` · ${esc(d.recommendation.lines.find(x=>x.listingId===l.listingId).marketplace)}`:''}</span><strong>${type==='shipment'?l.approvedShipmentUnits:l.approvedPurchaseUnits} шт.</strong></div>`).join('')}</div><p>Основание: решение менеджера. ${type==='shipment'?'Количество отправки согласовано; фактическая поставка здесь не подтверждается.':'Заказ поставщику выполняется у селлера. Этот товар не прибавлен к доступному остатку.'}</p></article>`).join(''):empty('Планы ещё не созданы','Они появляются только после утверждения положительных количеств. Отказ не создаёт планов.');
    $('#plans-count').textContent=entries.length;
  }
  function showView(next){view=next;render();}
  function render(){
    renderCatalog();panel();history();plans();
    $('#history-count').textContent=state.decisions.length;
    document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
    ['replenishment','history','plans'].forEach(name=>$(`#${name}-view`).hidden=name!==view);
    document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});
    $('#scenario-select').value=state.items[0].scenario;
  }
  function openStock(){
    if(!selected||current().status!=='ready')return;
    const p=E.productState(state,selected),snap=snapshot();
    $('#stock-product').textContent=`${p.product.name} · ${p.product.sku}`;
    $('#stock-units').value=snap?snap.availableUnits:p.scenario==='enough'?50:p.product.ownExample;
    $('#stock-source-label').value=snap?snap.sourceLabel:'Учёт собственного склада';
    $('#stock-source').value=snap?snap.sourceKind:'seller_table';$('#stock-error').hidden=true;
    $('#stock-dialog').showModal();$('#stock-units').focus();$('#stock-units').select();
  }
  function downloadPlan(decisionId,type){
    const d=state.decisions.find(x=>x.decisionId===decisionId);const p=type==='shipment'?d.shipmentPlan:d.purchasePlan;
    const clean=value=>`"${String(value).replace(/"/g,'""')}"`;
    const rows=[['Артикул','Товар','Площадка','Количество, шт.','Тип плана','Основание'],...p.lines.map(l=>[d.product.sku,d.product.name,type==='shipment'?d.recommendation.lines.find(x=>x.listingId===l.listingId).marketplace:'Поставщик',type==='shipment'?l.approvedShipmentUnits:l.approvedPurchaseUnits,type==='shipment'?'Отгрузка':'Закупка',d.decisionId])];
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(clean).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`stockflow-${type}-${d.product.sku}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  $('#workspace').addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.view){showView(b.dataset.view);return;}
    if(b.dataset.filter){filter=b.dataset.filter;render();return;}
    if(b.dataset.product){selected=b.dataset.product;draft=null;render();$('#decision-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return;}
    if(b.dataset.downloadPlan){downloadPlan(b.dataset.downloadPlan,b.dataset.planType);return;}
    switch(b.dataset.action){
      case 'confirm-stock':openStock();break;
      case 'reject':$('#reject-error').hidden=true;$('#reject-reason').value='';$('#reject-dialog').showModal();$('#reject-reason').focus();break;
      case 'approve':try{setState(E.approve(state,selected,draftInput()),'Решение сохранено. Планы доступны в отдельном разделе.');}catch(error){toast(error.message);}break;
      case 'show-history':showView('history');break;
      case 'show-replenishment':showView('replenishment');break;
      case 'new-calculation':setState(E.newRecommendation(state,selected),'Создана новая рекомендация. Перед утверждением подтвердите свой остаток заново.');break;
    }
  });
  $('#workspace').addEventListener('input',event=>{
    if(event.target.dataset.shipment&&draft){draft.shipment[event.target.dataset.shipment]=event.target.value;updateTotals();}
    if(event.target.id==='purchase-units'&&draft){draft.purchase=event.target.value;updateTotals();}
  });
  $('#search-products').addEventListener('input',()=>render());
  $('#scenario-select').addEventListener('change',event=>{
    let next=state;for(const p of state.items)next=E.newRecommendation(next,p.product.id,event.target.value);
    setState(next,'Созданы новые демонстрационные рекомендации. История сохранена.');
  });
  $('#stock-form').addEventListener('submit',event=>{event.preventDefault();try{
    setState(E.confirmStock(state,selected,{availableUnits:$('#stock-units').value,sourceKind:$('#stock-source').value,sourceLabel:$('#stock-source-label').value}),'Остаток подтверждён. Исходное распределение сохранено.');$('#stock-dialog').close();
  }catch(error){$('#stock-error').textContent=error.message;$('#stock-error').hidden=false;}});
  $('#reject-form').addEventListener('submit',event=>{event.preventDefault();try{setState(E.reject(state,selected,$('#reject-reason').value),'Отказ сохранён. Планы не созданы.');$('#reject-dialog').close();}catch(error){$('#reject-error').textContent=error.message;$('#reject-error').hidden=false;}});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}}));
  $('#reset-demo').addEventListener('click',()=>{$('#reset-dialog').showModal();$('#reset-dialog .button.outline').focus();});
  $('#confirm-reset').addEventListener('click',()=>{state=E.createDemo();selected='demo01';view='replenishment';filter='all';draft=null;$('#search-products').value='';save();render();$('#reset-dialog').close();toast('Демо сброшено. Можно пройти сценарий заново.');});
  $('#focus-toggle').addEventListener('click',()=>{
    const focused=$('#workspace').classList.toggle('is-focused');document.body.classList.toggle('focus-open',focused);$('#focus-toggle').setAttribute('aria-pressed',focused);$('#focus-toggle').innerHTML=focused?'Свернуть ↙':'Развернуть ⤢';
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')&&$('#workspace').classList.contains('is-focused'))$('#focus-toggle').click();});
  render();
  if(!storageAvailable)toast('История доступна до закрытия страницы: браузер запретил локальное сохранение.');
})();
