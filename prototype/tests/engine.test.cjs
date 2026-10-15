const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const item='demo01';
const snapshot={availableUnits:30,sourceKind:'seller_table',sourceLabel:'Учёт селлера'};
const confirmed=(n=30)=>E.confirmStock(E.createDemo(),item,{...snapshot,availableUnits:n});
const approval=(state,a=9,b=21,p=13)=>({shipmentLines:E.recommendation(state,item).lines.map((l,i)=>({listingId:l.listingId,units:i?b:a})),purchaseUnits:p});
const throwsCode=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('UC-01: needs 9/34, proposal 6/24 and purchase 13',()=>{
  const s=confirmed();const rec=E.recommendation(s,item),p=E.proposal(s,item);
  assert.deepEqual(rec.lines.map(l=>l.recommendedUnits),[9,34]);assert.equal(rec.totalRecommendedUnits,43);
  assert.deepEqual(p.lines.map(l=>l.proposedShipmentUnits),[6,24]);assert.equal(p.proposedPurchaseUnits,13);
});
test('approval 9/21 preserves original proposal 6/24 and creates separate plans',()=>{
  const s=confirmed();const before=JSON.stringify(s);const next=E.approve(s,item,approval(s));
  assert.equal(JSON.stringify(s),before);const d=next.decisions[0];
  assert.deepEqual(d.proposal.lines.map(l=>l.proposedShipmentUnits),[6,24]);
  assert.deepEqual(d.shipmentPlan.lines.map(l=>l.approvedShipmentUnits),[9,21]);
  assert.equal(d.purchasePlan.lines[0].approvedPurchaseUnits,13);
});
test('approval without own stock is blocked',()=>{
  const s=E.createDemo();throwsCode(()=>E.approve(s,item,approval(s)),'OWN_STOCK_RECONFIRMATION_REQUIRED');
});
test('shipping more than confirmed stock is blocked atomically',()=>{
  const s=confirmed();const before=JSON.stringify(s);
  throwsCode(()=>E.approve(s,item,approval(s,10,21)),'STOCK_LIMIT_EXCEEDED');assert.equal(JSON.stringify(s),before);
});
test('negative, fraction, null, blank and invalid quantities are rejected',()=>{
  for(const value of [-1,1.5,null,true,'',' ','1.5','abc',2147483648])throwsCode(()=>E.units(value),'INVALID_QUANTITY');
  assert.equal(E.units('0'),0);assert.equal(E.units('30'),30);
});
test('early rejection needs no stock and creates no plans',()=>{
  const s=E.reject(E.createDemo(),item,'Другая стратегия');const d=s.decisions[0];
  assert.equal(d.proposal,null);assert.equal(d.stock,null);assert.equal(d.shipmentPlan,null);assert.equal(d.purchasePlan,null);
});
test('late rejection retains considered proposal and input snapshot',()=>{
  const s=confirmed();const d=E.reject(s,item,'Отложить пополнение').decisions[0];
  assert.equal(d.allocationProposalId,E.proposal(s,item).allocationProposalId);assert.equal(d.stock.availableUnits,30);assert.equal(d.shipmentPlan,null);
});
test('blank rejection reason is blocked',()=>throwsCode(()=>E.reject(E.createDemo(),item,'  '),'REASON_REQUIRED'));
test('missing sales is not zero and prevents proposal; rejection remains available',()=>{
  const s=E.newRecommendation(E.createDemo(),item,'missing_sales');const rec=E.recommendation(s,item);
  assert.equal(rec.status,'incomplete');assert.equal(rec.totalRecommendedUnits,null);assert.equal(rec.lines[1].salesUnits,null);
  throwsCode(()=>E.confirmStock(s,item,snapshot),'DATA_UNAVAILABLE');assert.equal(E.reject(s,item,'Нет данных').decisions[0].status,'rejected');
});
test('missing rule prevents calculation despite ready snapshots',()=>{
  const s=E.newRecommendation(E.createDemo(),item,'missing_rule');const l=E.recommendation(s,item).lines[1];
  assert.equal(l.dataState,'ready');assert.equal(l.recommendedUnits,null);assert.equal(l.ruleVersionId,null);assert.ok(l.calculationIssue);
});
test('zero sales has ready calculation, zero demand and no division by zero',()=>{
  const s=E.newRecommendation(E.createDemo(),item,'zero_sales');const rec=E.recommendation(s,item);
  assert.equal(rec.status,'ready');assert.equal(rec.totalRecommendedUnits,0);assert.ok(rec.lines.every(l=>l.targetStockUnits===0));
});
test('50 stock leaves 7 units at own warehouse and zero purchase',()=>{
  const p=E.proposal(confirmed(50),item);assert.deepEqual(p.lines.map(l=>l.proposedShipmentUnits),[9,34]);assert.equal(p.proposedPurchaseUnits,0);assert.equal(p.availableUnits-43,7);
});
test('zero own stock proposes purchase of all 43 and zero shipments',()=>{
  const p=E.proposal(confirmed(0),item);assert.deepEqual(p.lines.map(l=>l.proposedShipmentUnits),[0,0]);assert.equal(p.proposedPurchaseUnits,43);
});
test('equal remainders are deterministic regardless of line order',()=>{
  for(const lines of [[{listingId:'b',recommendedUnits:1},{listingId:'a',recommendedUnits:1}],[{listingId:'a',recommendedUnits:1},{listingId:'b',recommendedUnits:1}]]){
    const result=E.allocate(lines,1);assert.equal(result.lines.find(l=>l.listingId==='a').proposedShipmentUnits,1);
  }
});
test('large integer allocation stays within budget without float rounding',()=>{
  const r=E.allocate([{listingId:'b',recommendedUnits:2147483647},{listingId:'a',recommendedUnits:2147483647}],2147483647);
  assert.equal(r.lines.reduce((sum,l)=>sum+l.proposedShipmentUnits,0),2147483647);assert.equal(r.lines.find(l=>l.listingId==='a').proposedShipmentUnits,1073741824);
});
test('purchase-only, shipment-only and zero/zero do not create empty plans',()=>{
  let s=confirmed();let d=E.approve(s,item,{shipmentLines:[],purchaseUnits:13}).decisions[0];assert.equal(d.shipmentPlan,null);assert.equal(d.purchasePlan.lines[0].approvedPurchaseUnits,13);
  s=confirmed();d=E.approve(s,item,approval(s,9,21,0)).decisions[0];assert.ok(d.shipmentPlan);assert.equal(d.purchasePlan,null);
  s=confirmed();d=E.approve(s,item,approval(s,0,0,0)).decisions[0];assert.equal(d.shipmentPlan,null);assert.equal(d.purchasePlan,null);
});
test('one recommendation has only one final decision',()=>{
  const s=confirmed();const next=E.approve(s,item,approval(s));throwsCode(()=>E.approve(next,item,approval(next)),'DECISION_ALREADY_EXISTS');throwsCode(()=>E.reject(next,item,'Передумал'),'DECISION_ALREADY_EXISTS');
});
test('new recommendation needs fresh confirmation and leaves history untouched',()=>{
  const s=confirmed();const done=E.approve(s,item,approval(s));const history=JSON.stringify(done.decisions);
  const next=E.newRecommendation(done,item,'normal');assert.equal(JSON.stringify(next.decisions),history);assert.equal(E.proposal(next,item),null);
  throwsCode(()=>E.approve(next,item,approval(next)),'OWN_STOCK_RECONFIRMATION_REQUIRED');
});
test('reused confirmed snapshot for next approval is rejected',()=>{
  const s=confirmed();const done=E.approve(s,item,approval(s));const next=E.newRecommendation(done,item);
  // Model a stale client attempting to reuse the former confirmation.
  const p=E.productState(next,item);const old=p.proposals[0];p.proposals.push({...old,allocationProposalId:'stale-proposal',recommendationId:p.currentRecommendationId});p.currentProposalId='stale-proposal';
  throwsCode(()=>E.approve(next,item,approval(next)),'OWN_STOCK_RECONFIRMATION_REQUIRED');
});
test('foreign listing and duplicate shipment line are rejected',()=>{
  const s=confirmed(),input=approval(s);input.shipmentLines.push({...input.shipmentLines[0]});throwsCode(()=>E.approve(s,item,input),'DUPLICATE_LISTING');
  input.shipmentLines=[{listingId:'ozon-demo02',units:1}];throwsCode(()=>E.approve(s,item,input),'RESOURCE_NOT_FOUND');
});
test('local saved demo restores and malformed payload falls back',()=>{
  const s=confirmed();const done=E.approve(s,item,approval(s));assert.deepEqual(E.restore(JSON.stringify(done)),done);
  assert.equal(E.restore('{'),null);assert.equal(E.restore('{}'),null);assert.equal(E.restore(JSON.stringify({version:1,serial:0,items:[],decisions:[]})),null);
});
