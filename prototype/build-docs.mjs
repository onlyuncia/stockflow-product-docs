import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=process.argv[2]?path.resolve(process.argv[2]):path.resolve(here,'..');
const dist=path.join(here,'dist');
const {marked}=process.env.STOCKFLOW_MARKED_PATH?await import(pathToFileURL(process.env.STOCKFLOW_MARKED_PATH).href):await import('marked');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=[
  ['01-PROCESS-AS-IS-TO-BE.md','Процесс до и после','Источники данных, ручная сверка и границы сервиса.'],
  ['02-CALCULATION-RULES.md','Правила расчёта','Темп продаж, целевой запас и распределение дефицита.'],
  ['03-FUNCTIONAL-REQUIREMENTS.md','Функциональные требования','Поведение сервиса и проверяемый результат.'],
  ['04-USE-CASE.md','Сквозной сценарий','Один товар: от рекомендации к решению и планам.'],
  ['05-ACCEPTANCE-CRITERIA.md','Критерии приёмки','Ожидаемое поведение основного пути и исключений.'],
  ['06-ARCHITECTURE.md','Архитектура C4','Контекст, контейнеры и компоненты системы.'],
  ['07-DATA-MODEL.md','Модель PostgreSQL','Master ERD, таблицы, ключи и ограничения.'],
  ['08-API-CONTRACT.md','Контракт взаимодействия','Операции интерфейса и правила сохранения решений.'],
  ['09-OPENAPI.json','OpenAPI 3.1','Машиночитаемый контракт основного сценария.'],
  ['10-DIAGRAMS.md','Каталог диаграмм','Все схемы и редактируемые исходники.'],
  ['11-STAKEHOLDERS.md','Участники процесса','Интересы, обязанности и границы согласования.'],
  ['12-CONSTRAINTS-DEPENDENCIES.md','Ограничения и зависимости','Внешние источники и границы основного сценария.'],
  ['13-RISKS-MITIGATION.md','Риски и меры снижения','Причины неверного решения и способы проверки защиты.'],
  ['14-RESULTS.md','Результаты и наблюдения','Изменения процесса и границы численных заявлений.'],
  ['15-PROJECT-SUCCESS.md','Критерии успеха','Объяснимость, доступный товар и история решения.'],
  ['16-EXPANSION-PLANS.md','Направления расширения','Учет селлера, товар в пути и обратная связь исполнения.'],
  ['17-NON-FUNCTIONAL-REQUIREMENTS.md','Нефункциональные требования','Целостность, доступ и целевые проверки качества.'],
  ['18-BACKEND-LOGIC.md','Backend-логика','Входы, проверки, расчёт, сохранение решения и исключения.'],
  ['case-stockflow.md','Единый кейс','Контекст, мой вклад и связная история аналитических решений.']
];
const fileName=file=>file.replace(/\.(md|json)$/i,'.html').toLowerCase();
const header=prefix=>`<a class="skip" href="#main">К содержанию</a><header class="site-header"><div class="wrap header-row"><a class="brand" href="${prefix}index.html"><svg class="logo" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect x="1" y="1" width="38" height="38" rx="8" fill="var(--raised)" stroke="currentColor" stroke-width="1.2"/><path d="M10 10H30V14H10ZM10 18H22V22H10ZM10 26H26V30H10Z" fill="currentColor"/></svg>StockFlow<span class="brand-sub">/ кейс</span></a><nav aria-label="Основная навигация"><a href="${prefix}index.html#context">Контекст</a><a href="${prefix}documents.html">Документы</a><a href="${prefix}diagrams.html">Схемы</a></nav><div class="header-actions"><button type="button" class="theme-toggle button button--secondary button--sm" data-theme-toggle aria-label="Включить светлую тему"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg><span>Светлая</span></button><a class="button small outline button--secondary button--sm" href="${prefix}index.html#prototype">К прототипу ↗</a></div></div></header>`;
const footer=prefix=>`<footer class="site-footer"><div class="wrap"><a class="brand" href="${prefix}index.html">StockFlow<span class="brand-sub">/ BA · SA</span></a><p>Мой кейс БА/СА. Прототип работает на вымышленных данных.</p><a href="${prefix}index.html#prototype">Попробовать сценарий ↗</a></div></footer>`;
const imageDialog=`<dialog class="image-dialog" id="image-dialog" aria-labelledby="image-title"><div class="dialog-head"><div><h2 id="image-title">Диаграмма</h2><div class="diagram-links"><a id="image-original" target="_blank" rel="noopener">Открыть полный размер ↗</a></div></div><button class="dialog-close" type="button" id="image-close" aria-label="Закрыть">×</button></div><div class="image-toolbar" role="group" aria-label="Масштаб диаграммы"><button type="button" id="image-zoom-out" aria-label="Уменьшить">−</button><output id="image-scale" aria-live="polite">100%</output><button type="button" id="image-zoom-in" aria-label="Увеличить">+</button><button type="button" id="image-fit">Вместить</button><button type="button" id="image-actual">100%</button></div><p class="image-help" id="image-help">Увеличьте схему и перемещайте её мышью или прокруткой. Клавиши + / − меняют масштаб.</p><div class="image-viewport" id="image-viewport" tabindex="0" role="region" aria-label="Область просмотра диаграммы" aria-describedby="image-help"><div class="image-canvas" id="image-canvas"><img id="image-full" alt="" draggable="false"></div></div></dialog>`;
function html(title,body,prefix=''){
  return `<!doctype html><html lang="ru" class="dark" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(title)} — документы и схемы StockFlow."><link rel="icon" href="${prefix}assets/favicon.svg?v=2"><meta name="theme-color" content="#080b12"><title>${esc(title)} · StockFlow</title><script src="${prefix}theme.js?v=1"></script><link rel="stylesheet" href="${prefix}assets/vendor/heroui/heroui.min.css"><link rel="stylesheet" href="${prefix}styles.css?v=8"><link rel="stylesheet" href="${prefix}theme.css?v=2"><script src="${prefix}documents.js?v=2" defer></script></head><body>${header(prefix)}<main id="main">${body}</main>${footer(prefix)}${imageDialog}</body></html>`;
}
fs.mkdirSync(path.join(dist,'documents'),{recursive:true});
fs.mkdirSync(path.join(dist,'source','docs'),{recursive:true});
fs.mkdirSync(path.join(dist,'assets'),{recursive:true});
fs.cpSync(path.join(source,'assets','diagrams'),path.join(dist,'assets','diagrams'),{recursive:true});
const casePdf=path.join(source,'output','pdf','case-stockflow.pdf');
if(!fs.existsSync(casePdf))throw new Error('Build the case PDF before document pages: npm run build:pdf');
fs.copyFileSync(casePdf,path.join(dist,'assets','case-stockflow.pdf'));
for(const [file,title,description] of entries){
  const raw=fs.readFileSync(path.join(source,'docs',file),'utf8');
  fs.writeFileSync(path.join(dist,'source','docs',file),raw);
  let body;
  if(file.endsWith('.json')){
    const api=JSON.parse(raw);
    body=`<h1>OpenAPI 3.1 · внутренний контракт</h1><p>${esc(api.info.description)}</p><h2>Операции основного сценария</h2><div class="doc-table-scroll"><table><thead><tr><th>Метод</th><th>Путь</th><th>Назначение</th></tr></thead><tbody>${Object.entries(api.paths).flatMap(([route,item])=>Object.entries(item).filter(([method])=>['get','post'].includes(method)).map(([method,op])=>`<tr><td><strong>${method.toUpperCase()}</strong></td><td><code>${esc(route)}</code></td><td>${esc(op.summary)}</td></tr>`)).join('')}</tbody></table></div><p><a href="../source/docs/${file}" download>Скачать OpenAPI JSON ↓</a> для импорта в редактор Swagger или Postman.</p><details><summary>Полное содержимое контракта</summary><pre><code>${esc(raw)}</code></pre></details>`;
  }else{
    body=marked.parse(raw,{gfm:true});
    body=body.replace(/href="([^"]+\.md)(#[^"]*)?"/g,(_,url,anchor='')=>`href="${fileName(url)}${anchor}"`);
    body=body.replace(/href="09-OPENAPI.json"/g,'href="09-openapi.html"');
    body=body.replace(/href="\.\.\/output\/pdf\/case-stockflow.pdf"/g,'href="../assets/case-stockflow.pdf"');
    body=body.replace(/<table>/g,'<div class="doc-table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
    const headings=new Map();
    body=body.replace(/<h([1-6])>(.*?)<\/h\1>/g,(_,level,text)=>{
      const base=text.replace(/<[^>]+>/g,'').toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').trim().replace(/\s/g,'-');
      const count=headings.get(base)||0;headings.set(base,count+1);
      return `<h${level} id="${base}${count?'-'+count:''}">${text}</h${level}>`;
    });
    body=body.replace(/<img src="([^"]+)" alt="([^"]*)"[^>]*>/g,(_,url,alt)=>`<button class="diagram-preview doc-image" type="button" data-image="${url}" data-title="${alt}" aria-label="Увеличить: ${alt}" style="height:auto;background:white"><img src="${url}" alt="${alt}" loading="lazy"></button>`);
  }
  // The page hero already provides the document title; retain the old anchor only.
  body=body.replace(/<h1(?: id="([^"]*)")?>([\s\S]*?)<\/h1>/,(_,id)=>id?`<span id="${id}" class="document-title-anchor"></span>`:'');
  const nav=`<aside class="document-nav" aria-label="Документы кейса">${entries.map(([f,t])=>`<a class="${f===file?'active':''}" href="${fileName(f)}" ${f===file?'aria-current="page"':''}>${esc(t)}</a>`).join('')}</aside>`;
  const hero=`<section class="page-hero"><div class="wrap"><a class="back-link" href="../documents.html">← Все документы</a><p class="kicker">Документация StockFlow / ${file.startsWith('case-')?'единый кейс':file.slice(0,2)}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p><div class="document-tools"><a href="../source/docs/${file}" download>Скачать исходник ↓</a>${file.startsWith('case-')?'<a href="../assets/case-stockflow.pdf" download>Скачать PDF ↓</a>':''}<a href="../index.html#prototype">Проверить сценарий в прототипе ↗</a></div></div></section>`;
  fs.writeFileSync(path.join(dist,'documents',fileName(file)),html(title,hero+`<div class="wrap document-layout">${nav}<article class="document-body">${body}</article></div>`,'../'));
}
const indexHero=`<section class="page-hero"><div class="wrap"><a class="back-link" href="index.html">← К кейсу</a><p class="kicker">Документация / StockFlow</p><h1>Логика сервиса.<br>В деталях.</h1><p class="lead">Единый кейс связывает контекст, результаты и аналитические решения. Подробные документы раскрывают требования, риски, архитектуру и контракт.</p><div class="actions"><a class="button primary button--primary button--sm" href="documents/case-stockflow.html">Читать единый кейс ↗</a><a class="text-link" href="assets/case-stockflow.pdf" download>Скачать PDF ↓</a><a class="text-link" href="diagrams.html">Галерея диаграмм ↗</a></div></div></section>`;
const cards=entries.map(([file,title,description],i)=>`<a class="doc-card" href="documents/${fileName(file)}"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${esc(title)}</h3><p>${esc(description)}</p></div><b aria-hidden="true">↗</b></a>`).join('');
fs.writeFileSync(path.join(dist,'documents.html'),html('Документы',indexHero+`<section class="section"><div class="wrap"><div class="document-index">${cards}</div><p class="page-note">Это представление текущих документов кейса. Исходные данные клиентов не публикуются; примеры синтетические.</p></div></section>`));
const diagrams=[
  ['01-context','C4 · контекст системы','Окружение StockFlow и внешние площадки','puml'],
  ['02-use-cases','Варианты использования','Действия менеджера и автоматический обмен','puml'],
  ['03-c4-containers','C4 · контейнеры','Веб-приложение, сервер и PostgreSQL','puml'],
  ['03-c4-components-data','C4 · обновление данных','Синхронизация и расчёт потребности','puml'],
  ['03-c4-components-decision','C4 · решение менеджера','Подтверждение остатка, распределение и планы','puml'],
  ['04-sequence-sync','Последовательность · данные','От автоматического запроса до рекомендации','puml'],
  ['05-sequence-decision','Последовательность · решение','Подтверждение остатка и сохранение решения','puml'],
  ['06-recommendation-activity','Обработка рекомендации','Действия, отказ и ограничения','puml'],
  ['00-master-erd','Master ERD · PostgreSQL','Общая схема из 18 таблиц','dbml'],
  ['07-data-inputs','Источники и расчёт','Подробная модель входных данных','dbml'],
  ['08-data-decisions','Предложение, решение и планы','Подробная модель принятия решения','dbml'],
  ['09-bpmn-as-is','BPMN · до StockFlow','Работа с выгрузками и книгой','bpmn'],
  ['10-bpmn-to-be','BPMN · решение менеджера','От рекомендации к утверждению или отказу','bpmn']
];
const gallery=diagrams.map(([name,title,description,ext])=>`<article class="diagram-card"><button class="diagram-preview" type="button" data-image="assets/diagrams/${name}.png" data-title="${esc(title)}" aria-label="Увеличить: ${esc(title)}"><img src="assets/diagrams/${name}.png" alt="${esc(title)}" loading="lazy"></button><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="diagram-links"><a href="assets/diagrams/${name}.png" target="_blank" rel="noopener">PNG ↗</a><a href="assets/diagrams/${name}.svg" target="_blank" rel="noopener">${name==='00-master-erd'?'SVG · обзор':'SVG'} ↗</a><a href="assets/diagrams/${name}.${ext}" download>${ext.toUpperCase()} ↓</a></div></article>`).join('');
fs.writeFileSync(path.join(dist,'diagrams.html'),html('Диаграммы',`<section class="page-hero"><div class="wrap"><a class="back-link" href="index.html">← К кейсу</a><p class="kicker">Схемы / StockFlow</p><h1>Система на разных<br>уровнях.</h1><p class="lead">Контекст, процессы, последовательности и модель данных. Нажмите на схему, чтобы рассмотреть её крупнее.</p></div></section><section class="section"><div class="wrap"><div class="diagram-grid">${gallery}</div></div></section>`));
fs.writeFileSync(path.join(dist,'.nojekyll'),'');
console.log(`Generated ${entries.length} document pages and ${diagrams.length} diagram previews from canonical sources.`);
