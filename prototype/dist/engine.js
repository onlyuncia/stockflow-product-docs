(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StockFlowEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const products = [
    {id:'demo01',sku:'SKU-DEMO-01',name:'Смеситель для кухни',symbol:'⌁',sales:[28,56],stock:[12,8],ownExample:30},
    {id:'demo02',sku:'SKU-DEMO-02',name:'Душевой шланг',symbol:'∿',sales:[56,28],stock:[15,10],ownExample:25},
    {id:'demo03',sku:'SKU-DEMO-03',name:'Аэратор для смесителя',symbol:'⊙',sales:[28,28],stock:[25,25],ownExample:12}
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function fail(code,message){ const e=new Error(message); e.code=code; throw e; }
  function units(value){
    if(typeof value==='string'&&!/^\d+$/.test(value.trim())) fail('INVALID_QUANTITY','Введите целое неотрицательное количество.');
    const n=Number(value);
    if(!Number.isInteger(n)||n<0||n>2147483647||value===null||typeof value==='boolean') fail('INVALID_QUANTITY','Введите целое неотрицательное количество.');
    return n;
  }
  function allocate(lines,available){
    available=units(available);
    const seen=new Set();
    const totals=lines.map(line=>{
      if(!line.listingId||seen.has(line.listingId)) fail('DUPLICATE_LISTING','Товар площадки не должен повторяться.');
      seen.add(line.listingId);
      return {listingId:line.listingId,demand:units(line.recommendedUnits)};
    });
    const total=totals.reduce((sum,l)=>sum+l.demand,0);
    const budget=Math.min(available,total);
    if(total===0) return {lines:totals.map(l=>({listingId:l.listingId,proposedShipmentUnits:0})),proposedPurchaseUnits:0};
    // Integer remainders avoid floating-point ties in the largest remainder method.
    if(!Number.isSafeInteger(total)) fail('INVALID_QUANTITY','Суммарная потребность слишком велика.');
    const divisor=BigInt(total);
    const distributed=totals.map(l=>{const numerator=BigInt(budget)*BigInt(l.demand);return {...l,count:Number(numerator/divisor),remainder:numerator%divisor};});
    let left=budget-distributed.reduce((sum,l)=>sum+l.count,0);
    const ranked=[...distributed].sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:a.listingId<b.listingId?-1:a.listingId>b.listingId?1:0);
    for(let i=0;i<left;i++) ranked[i].count++;
    return {lines:distributed.map(l=>({listingId:l.listingId,proposedShipmentUnits:l.count})),proposedPurchaseUnits:total-budget};
  }
  function id(state,prefix){return `${prefix}-demo-${++state.serial}`;}
  function productState(state,productId){
    const p=state.items.find(x=>x.product.id===productId);
    if(!p) fail('RESOURCE_NOT_FOUND','Товар недоступен в этой демонстрации.');
    return p;
  }
  function recommendation(state,productId){
    const p=productState(state,productId);
    return p.recommendations.find(x=>x.recommendationId===p.currentRecommendationId);
  }
  function proposal(state,productId){
    const p=productState(state,productId);
    return p.proposals.find(x=>x.allocationProposalId===p.currentProposalId)||null;
  }
  function decisionFor(state,recId){ return state.decisions.find(x=>x.recommendationId===recId)||null; }
  function assertOpen(state,rec){if(decisionFor(state,rec.recommendationId)) fail('DECISION_ALREADY_EXISTS','По этой рекомендации уже принято решение. Начните новый расчёт.');}
  function makeRecommendation(state,p,scenario){
    if(!['normal','missing_sales','missing_rule','zero_sales','enough'].includes(scenario)) fail('INVALID_SCENARIO','Неизвестная ситуация.');
    const recId=id(state,'rec');
    const lines=['Ozon','Wildberries'].map((marketplace,i)=>{
      const salesMissing=scenario==='missing_sales'&&i===1;
      const ruleMissing=scenario==='missing_rule'&&i===1;
      const sales=salesMissing?null:scenario==='zero_sales'?0:p.product.sales[i];
      const stock=p.product.stock[i];
      const target=ruleMissing||salesMissing?null:Math.ceil(sales/28*21);
      const demand=target===null?null:Math.max(0,target-stock);
      return {listingId:`${marketplace==='Ozon'?'ozon':'wb'}-${p.product.id}`,marketplace,salesUnits:sales,salesWindowDays:salesMissing?null:28,marketplaceStockUnits:stock,targetCoverageDays:ruleMissing?null:21,roundingPolicy:ruleMissing?null:'ceil',targetStockUnits:target,recommendedUnits:demand,dataState:salesMissing?'missing_sales':'ready',calculationIssue:salesMissing?'Продажи Wildberries не получены.':ruleMissing?'Для Wildberries не определена версия правила.':null,sourceSalesSnapshotId:salesMissing?null:`sales-${recId}-${i}`,sourceStockSnapshotId:`stock-${recId}-${i}`,ruleVersionId:ruleMissing?null:`rule-${marketplace.toLowerCase()}-demo`};
    });
    const complete=lines.every(l=>l.recommendedUnits!==null);
    const rec={recommendationId:recId,productId:p.product.id,status:complete?'ready':'incomplete',totalRecommendedUnits:complete?lines.reduce((sum,l)=>sum+l.recommendedUnits,0):null,lines};
    p.recommendations.push(rec);p.currentRecommendationId=recId;p.currentProposalId=null;p.scenario=scenario;
    return rec;
  }
  function createDemo(){
    const state={version:VERSION,serial:0,items:products.map(p=>({product:clone(p),recommendations:[],proposals:[],snapshots:[],currentRecommendationId:null,currentProposalId:null,scenario:'normal'})),decisions:[]};
    state.items.forEach(p=>makeRecommendation(state,p,'normal'));
    return state;
  }
  function newRecommendation(state,productId,scenario){
    const next=clone(state);const p=productState(next,productId);
    makeRecommendation(next,p,scenario||p.scenario);return next;
  }
  function confirmStock(state,productId,input){
    const next=clone(state);const p=productState(next,productId);const rec=recommendation(next,productId);
    assertOpen(next,rec);
    if(rec.status!=='ready') fail('DATA_UNAVAILABLE','Сначала восстановите данные или задайте правило. Распределение пока недоступно.');
    const available=units(input.availableUnits);
    if(!['seller_table','accounting_system'].includes(input.sourceKind)) fail('INVALID_SOURCE','Выберите источник учёта своего склада.');
    if(typeof input.sourceLabel!=='string'||!input.sourceLabel.trim()) fail('INVALID_SOURCE','Укажите название источника остатка.');
    const stamp=new Date().toISOString();
    const snapshot={ownStockSnapshotId:id(next,'own-stock'),productId,availableUnits:available,sourceKind:input.sourceKind,sourceLabel:input.sourceLabel.trim(),sourceObservedAt:stamp,confirmedAt:stamp,confirmedBy:'demo-manager'};
    p.snapshots.push(snapshot);
    const distribution=allocate(rec.lines,available);
    const prop={allocationProposalId:id(next,'alloc'),recommendationId:rec.recommendationId,ownStockSnapshotId:snapshot.ownStockSnapshotId,allocationMethod:'proportional_largest_remainder_v1',availableUnits:available,...distribution};
    p.proposals.push(prop);p.currentProposalId=prop.allocationProposalId;
    return next;
  }
  function validateApproval(state,productId,input){
    const rec=recommendation(state,productId);assertOpen(state,rec);
    if(rec.status!=='ready') fail('DATA_UNAVAILABLE','Для утверждения нужен полный расчёт по обеим площадкам.');
    const prop=proposal(state,productId);
    if(!prop||prop.recommendationId!==rec.recommendationId) fail('OWN_STOCK_RECONFIRMATION_REQUIRED','Заново подтвердите доступный остаток собственного склада.');
    if(state.decisions.some(d=>d.status==='approved'&&d.ownStockSnapshotId===prop.ownStockSnapshotId)) fail('OWN_STOCK_RECONFIRMATION_REQUIRED','Этот снимок уже использован. Заново подтвердите остаток.');
    if(!Array.isArray(input.shipmentLines)) fail('INVALID_QUANTITY','Укажите количества по площадкам.');
    const allowed=new Set(rec.lines.map(l=>l.listingId));const seen=new Set();
    const lines=input.shipmentLines.map(line=>{
      if(!allowed.has(line.listingId)) fail('RESOURCE_NOT_FOUND','Товар площадки не относится к этой рекомендации.');
      if(seen.has(line.listingId)) fail('DUPLICATE_LISTING','Товар площадки повторён в отгрузке.');
      seen.add(line.listingId);return {listingId:line.listingId,units:units(line.units)};
    });
    const total=lines.reduce((sum,l)=>sum+l.units,0);
    if(total>prop.availableUnits) fail('STOCK_LIMIT_EXCEEDED',`Отгрузка ${total} шт. превышает подтверждённый остаток ${prop.availableUnits} шт.`);
    return {lines,total,purchaseUnits:units(input.purchaseUnits),prop};
  }
  function approve(state,productId,input){
    const validated=validateApproval(state,productId,input);
    const next=clone(state);const rec=recommendation(next,productId);const p=productState(next,productId);
    const decisionId=id(next,'decision');const stamp=new Date().toISOString();
    const positive=validated.lines.filter(l=>l.units>0);
    const record={decisionId,recommendationId:rec.recommendationId,productId,allocationProposalId:validated.prop.allocationProposalId,ownStockSnapshotId:validated.prop.ownStockSnapshotId,status:'approved',decidedBy:'demo-manager',decidedAt:stamp,reason:input.reason&&input.reason.trim()?input.reason.trim():null,
      shipmentPlan:positive.length?{shipmentPlanId:`shipment-${decisionId}`,decisionId,createdAt:stamp,lines:positive.map(l=>({listingId:l.listingId,approvedShipmentUnits:l.units}))}:null,
      purchasePlan:validated.purchaseUnits>0?{purchasePlanId:`purchase-${decisionId}`,decisionId,createdAt:stamp,lines:[{productId,approvedPurchaseUnits:validated.purchaseUnits}]}:null,
      // Readable snapshots of demo history; these are not additional PostgreSQL tables.
      product:clone(p.product),recommendation:clone(rec),proposal:clone(validated.prop),stock:clone(p.snapshots.find(s=>s.ownStockSnapshotId===validated.prop.ownStockSnapshotId))};
    next.decisions.push(record);return next;
  }
  function reject(state,productId,reason){
    const next=clone(state);const rec=recommendation(next,productId);assertOpen(next,rec);
    if(typeof reason!=='string'||!reason.trim()) fail('REASON_REQUIRED','Укажите причину отказа.');
    const p=productState(next,productId);const prop=proposal(next,productId);
    const record={decisionId:id(next,'decision'),recommendationId:rec.recommendationId,productId,status:'rejected',allocationProposalId:prop?prop.allocationProposalId:null,ownStockSnapshotId:prop?prop.ownStockSnapshotId:null,decidedBy:'demo-manager',decidedAt:new Date().toISOString(),reason:reason.trim(),shipmentPlan:null,purchasePlan:null,product:clone(p.product),recommendation:clone(rec),proposal:clone(prop),stock:prop?clone(p.snapshots.find(s=>s.ownStockSnapshotId===prop.ownStockSnapshotId)):null};
    next.decisions.push(record);return next;
  }
  function restore(text){
    try{
      const s=JSON.parse(text);
      if(!s||s.version!==VERSION||!Number.isInteger(s.serial)||!Array.isArray(s.items)||s.items.length!==products.length||!Array.isArray(s.decisions)) return null;
      for(const def of products){
        const p=productState(s,def.id);const rec=recommendation(s,def.id);
        if(p.product.sku!==def.sku||!rec||!Array.isArray(p.snapshots)||!Array.isArray(p.proposals)||!Array.isArray(rec.lines)||rec.lines.length!==2) return null;
      }
      if(s.decisions.some(d=>!d.product||!d.recommendation||!['approved','rejected'].includes(d.status))) return null;
      return s;
    }catch{return null;}
  }
  return {VERSION,createDemo,newRecommendation,confirmStock,approve,reject,allocate,units,validateApproval,recommendation,proposal,productState,decisionFor,restore};
});
