# Диаграммы StockFlow

Схемы встроены в соответствующие документы как PNG. Для крупного просмотра есть SVG, для редактирования — исходники PlantUML и BPMN. Для моделей данных также доступны DBML-файлы для импорта в dbdiagram.io. Архитектура показывает обязанности компонентов; реляционные модели раскрывают таблицы и связи PostgreSQL.

| Схема и документ | PNG | SVG | Исходник |
| --- | --- | --- | --- |
| [C4 Context — уровень 1](06-ARCHITECTURE.md) | [PNG](../assets/diagrams/01-context.png) | [SVG](../assets/diagrams/01-context.svg) | [C4-PlantUML](../assets/diagrams/01-context.puml) |
| [Варианты использования](04-USE-CASE.md) | [PNG](../assets/diagrams/02-use-cases.png) | [SVG](../assets/diagrams/02-use-cases.svg) | [PlantUML](../assets/diagrams/02-use-cases.puml) |
| [C4 Container — уровень 2](06-ARCHITECTURE.md) | [PNG](../assets/diagrams/03-c4-containers.png) | [SVG](../assets/diagrams/03-c4-containers.svg) | [C4-PlantUML](../assets/diagrams/03-c4-containers.puml) |
| [C4 Component — данные и расчёт](06-ARCHITECTURE.md) | [PNG](../assets/diagrams/03-c4-components-data.png) | [SVG](../assets/diagrams/03-c4-components-data.svg) | [C4-PlantUML](../assets/diagrams/03-c4-components-data.puml) |
| [C4 Component — решение менеджера](06-ARCHITECTURE.md) | [PNG](../assets/diagrams/03-c4-components-decision.png) | [SVG](../assets/diagrams/03-c4-components-decision.svg) | [C4-PlantUML](../assets/diagrams/03-c4-components-decision.puml) |
| [Последовательность: получение данных](08-API-CONTRACT.md) | [PNG](../assets/diagrams/04-sequence-sync.png) | [SVG](../assets/diagrams/04-sequence-sync.svg) | [PlantUML](../assets/diagrams/04-sequence-sync.puml) |
| [Последовательность: решение менеджера](08-API-CONTRACT.md) | [PNG](../assets/diagrams/05-sequence-decision.png) | [SVG](../assets/diagrams/05-sequence-decision.svg) | [PlantUML](../assets/diagrams/05-sequence-decision.puml) |
| [UML Activity — обработка рекомендации](04-USE-CASE.md) | [PNG](../assets/diagrams/06-recommendation-activity.png) | [SVG](../assets/diagrams/06-recommendation-activity.svg) | [PlantUML](../assets/diagrams/06-recommendation-activity.puml) |
| [Master ERD: общая модель PostgreSQL](07-DATA-MODEL.md) | [PNG — полная схема](../assets/diagrams/00-master-erd.png) | [SVG — обзор](../assets/diagrams/00-master-erd.svg) | [PlantUML — обзор](../assets/diagrams/00-master-erd.puml) · [master DBML](../assets/diagrams/00-master-erd.dbml) |
| [Модель данных: источники и расчёт](07-DATA-MODEL.md) | [PNG](../assets/diagrams/07-data-inputs.png) | [SVG](../assets/diagrams/07-data-inputs.svg) | [PlantUML](../assets/diagrams/07-data-inputs.puml) · [DBML](../assets/diagrams/07-data-inputs.dbml) |
| [Модель данных: решение и планы](07-DATA-MODEL.md) | [PNG](../assets/diagrams/08-data-decisions.png) | [SVG](../assets/diagrams/08-data-decisions.svg) | [PlantUML](../assets/diagrams/08-data-decisions.puml) · [DBML](../assets/diagrams/08-data-decisions.dbml) |
| [BPMN AS-IS: рабочая книга](01-PROCESS-AS-IS-TO-BE.md) | [PNG](../assets/diagrams/09-bpmn-as-is.png) | [SVG](../assets/diagrams/09-bpmn-as-is.svg) | [BPMN](../assets/diagrams/09-bpmn-as-is.bpmn) |
| [BPMN TO-BE: решение менеджера](01-PROCESS-AS-IS-TO-BE.md) | [PNG](../assets/diagrams/10-bpmn-to-be.png) | [SVG](../assets/diagrams/10-bpmn-to-be.svg) | [BPMN](../assets/diagrams/10-bpmn-to-be.bpmn) |

Модели данных показывают нормализованное хранение PostgreSQL: общие данные рекомендации, предложения и планов отделены от позиций в таблицах `…Line`. В ответе API каждый документ возвращается вместе с позициями в списке `lines`.

Маршрут по данным: **Master ERD → источники и расчёт → предложение, решение и планы**. Полные определения таблиц собраны в master DBML.

Основной маршрут: **контекст → Use Case → BPMN TO-BE → последовательность решения → модель данных**. Остальные схемы раскрывают источники данных, ошибки и историю решения.

Архитектурный маршрут: **C4 Context → C4 Container → два вида C4 Component одного серверного приложения**.

## Диаграммы в едином кейсе и PDF

В PDF три готовые схемы из документации вынесены на отдельные страницы с пояснениями. Эти же изображения доступны в [едином кейсе](case-stockflow.md):

- [BPMN TO BE](../assets/diagrams/10-bpmn-to-be.png) — задачи, развилки и возврат к подтверждению.
- [C4 Containers](../assets/diagrams/03-c4-containers.png) — пользователь, контейнеры StockFlow и API Ozon / WB.
- [ERD «Предложение, решение и планы»](../assets/diagrams/08-data-decisions.png) — готовая подробная схема с отдельными таблицами заголовков и позиций.

Сборка использует существующие PNG без перерисовки и обрезки. Соотношение сторон сохраняется; для широких BPMN и ERD выбраны увеличенные форматы страниц. Исходники и полная модель PostgreSQL доступны в основном каталоге выше.

На всех схемах сохранены ключевые границы: API площадок обновляются автоматически; свой остаток менеджер подтверждает заново перед каждым утверждением; менеджер может принять или изменить начальное распределение; закупка показана отдельно от отгрузки; отказ не создаёт планов. Фактическая закупка и поставка выполняются у селлера.

