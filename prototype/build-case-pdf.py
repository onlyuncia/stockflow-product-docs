"""Build the portable StockFlow case PDF from its canonical Markdown source."""
from pathlib import Path
import html
import re
import shutil
import textwrap

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A2, A3, A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, NextPageTemplate,
    Paragraph, Spacer, PageBreak, Table, TableStyle, Image,
    Flowable, Preformatted, KeepTogether,
)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs' / 'case-stockflow.md'
OUTPUT = ROOT / 'output' / 'pdf' / 'case-stockflow.pdf'
FONT_DIR = ROOT / 'assets' / 'fonts'
for family, name in [('StockFlow', 'Ubuntu-R.ttf'), ('StockFlowBold', 'Ubuntu-B.ttf')]:
    pdfmetrics.registerFont(TTFont(family, str(FONT_DIR / name)))
pdfmetrics.registerFontFamily('StockFlow', normal='StockFlow', bold='StockFlowBold',
                              italic='StockFlow', boldItalic='StockFlowBold')
INK = colors.HexColor('#17202e')
MUTED = colors.HexColor('#526176')
BLUE = colors.HexColor('#2457d6')
SOFT = colors.HexColor('#eef3fb')
WIDTH = A4[0] - 38 * mm
FIGURES = [
    ('09-bpmn-as-is.png', 'bpmn_as_is', landscape(A3), 'Приложение 1. BPMN AS IS',
     'Готовая диаграмма ручного подсорта: данные кабинетов, расчёт в книге, сверка своего склада и согласование.',
     'Схема описывает исходный порядок работы. Источник: 09-bpmn-as-is.bpmn.'),
    ('10-bpmn-to-be.png', 'bpmn', landscape(A3), 'Приложение 2. BPMN TO BE',
     'Готовая диаграмма процесса: рекомендация, подтверждение своего остатка, решение менеджера и планы.',
     'Менеджер может изменить распределение или отказаться. Проверки выполняются перед сохранением; отказ не создаёт планов. Источник: 10-bpmn-to-be.bpmn.'),
    ('03-c4-containers.png', 'c4', A4, 'Приложение 3. C4 Containers',
     'Готовая диаграмма уровня 2: пользователь, контейнеры StockFlow и внешние площадки.',
     'Сервер автоматически запрашивает продажи и остатки; менеджер подтверждает свой склад через интерфейс. Подробности: 06-ARCHITECTURE.md.'),
    ('08-data-decisions.png', 'erd', landscape(A2), 'Приложение 4. ERD: предложение, решение и планы',
     'Готовая реляционная модель PostgreSQL из документации. Таблицы, поля и связи сохранены в исходном виде.',
     'Заголовки и позиции хранятся отдельно. При отказе планов нет; подтверждённый снимок нельзя повторно использовать для следующего утверждения. Полная модель: 07-DATA-MODEL.md.'),
]
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('SFBody', fontName='StockFlow', fontSize=10.2, leading=15,
                         textColor=INK, spaceAfter=8, allowWidows=0, allowOrphans=0,
                         splitLongWords=1))
styles.add(ParagraphStyle('SFH2', parent=styles['SFBody'], fontName='StockFlowBold',
                         fontSize=16, leading=20, spaceBefore=18, spaceAfter=10,
                         keepWithNext=True))
styles.add(ParagraphStyle('SFH3', parent=styles['SFH2'], fontSize=12, leading=16,
                         spaceBefore=12, spaceAfter=7))
styles.add(ParagraphStyle('SFBullet', parent=styles['SFBody'], leftIndent=12,
                         firstLineIndent=0, bulletIndent=0, spaceAfter=6))
styles.add(ParagraphStyle('SFTable', parent=styles['SFBody'], fontSize=9, leading=12,
                         spaceAfter=0))
styles.add(ParagraphStyle('SFTableHead', parent=styles['SFTable'],
                         fontName='StockFlowBold', textColor=colors.white))
styles.add(ParagraphStyle('SFNote', parent=styles['SFBody'], fontSize=9, leading=13,
                         textColor=MUTED, backColor=SOFT, borderPadding=9,
                         spaceBefore=7, spaceAfter=12))
styles.add(ParagraphStyle('SFTitle', fontName='StockFlowBold', fontSize=38,
                         leading=42, textColor=INK, spaceAfter=16))
styles.add(ParagraphStyle('SFSubtitle', parent=styles['SFBody'], fontSize=22,
                         leading=28, spaceAfter=18))
styles.add(ParagraphStyle('SFLead', parent=styles['SFBody'], fontSize=13,
                         leading=19, textColor=MUTED, spaceAfter=18))
styles.add(ParagraphStyle('SFFigureTitle', parent=styles['SFH2'], spaceBefore=0,
                         spaceAfter=8))
styles.add(ParagraphStyle('SFFigureText', parent=styles['SFBody'], fontSize=9,
                         leading=13, spaceAfter=8))


def inline(text):
    text = text.replace('\u2011', '-').replace('—', '-').replace('–', '-')
    text = html.escape(text)
    def link(match):
        label, target = match.groups()
        if target.startswith(('https://', 'http://')):
            return f'<link href="{target}" color="#2457d6">{label}</link>'
        return f'{label} <font size="8" color="#526176">({target})</font>'
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`([^`]+)`', r'<font color="#2457d6">\1</font>', text)
    return text


class ProcessMap(Flowable):
    def __init__(self):
        super().__init__()
        self.width, self.height = WIDTH, 96

    def draw(self):
        c = self.canv
        labels = [('Данные', 'площадок'), ('Потребность', 'по товару'),
                  ('Свой склад', 'подтверждён'), ('Решение', 'менеджера'),
                  ('Два плана', 'количеств')]
        gap = 9
        width = (self.width - 4 * gap) / 5
        for index, pair in enumerate(labels):
            x = index * (width + gap)
            c.setFillColor(SOFT)
            c.roundRect(x, 28, width, 56, 7, stroke=0, fill=1)
            c.setFillColor(BLUE)
            c.setFont('StockFlowBold', 8)
            c.drawString(x + 8, 70, f'0{index + 1}')
            c.setFillColor(INK)
            c.setFont('StockFlow', 9)
            c.drawString(x + 8, 54, pair[0])
            c.drawString(x + 8, 41, pair[1])
            if index < 4:
                c.setStrokeColor(MUTED)
                c.line(x + width + 1, 56, x + width + gap - 1, 56)
                c.line(x + width + gap - 4, 59, x + width + gap - 1, 56)
                c.line(x + width + gap - 4, 53, x + width + gap - 1, 56)
        c.setFillColor(MUTED)
        c.setFont('StockFlow', 9)
        c.drawString(0, 6, 'Рекомендация не запускает закупку или отгрузку автоматически.')


def page_chrome(canvas, doc):
    canvas.saveState()
    page_width, page_height = doc.pageTemplate.pagesize
    canvas.setStrokeColor(colors.HexColor('#dce4ee'))
    canvas.line(19 * mm, page_height - 15 * mm, page_width - 19 * mm, page_height - 15 * mm)
    canvas.setFillColor(BLUE)
    canvas.setFont('StockFlowBold', 9)
    canvas.drawString(19 * mm, page_height - 11 * mm, 'STOCKFLOW')
    canvas.setFillColor(MUTED)
    canvas.setFont('StockFlow', 8)
    canvas.drawRightString(page_width - 19 * mm, page_height - 11 * mm, 'Бизнес- и системный анализ')
    canvas.drawString(19 * mm, 12 * mm, 'Мой кейс БА/СА | демо на вымышленных данных')
    canvas.drawRightString(page_width - 19 * mm, 12 * mm, str(doc.page))
    canvas.restoreState()


def table(rows):
    columns = len(rows[0])
    weights = {2: [0.31, 0.69], 3: [0.25, 0.45, 0.30],
               4: [0.15, 0.35, 0.30, 0.20]}.get(columns, [1 / columns] * columns)
    cells = [[Paragraph(inline(cell), styles['SFTableHead' if index == 0 else 'SFTable'])
              for cell in row] for index, row in enumerate(rows)]
    result = Table(cells, colWidths=[WIDTH * weight for weight in weights],
                   repeatRows=1, hAlign='LEFT')
    result.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, SOFT]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 1), (-1, -1), .4, colors.HexColor('#dce4ee')),
    ]))
    return result


def markdown_flow(text):
    lines = text.splitlines()
    result, pending = [], []
    def flush():
        if pending:
            result.append(Paragraph(inline(' '.join(pending)), styles['SFBody']))
            pending.clear()
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            flush()
        elif line.startswith('# '):
            flush()  # Cover supplies the document title.
        elif line.startswith('!['):
            flush()  # Ready-made diagrams appear on dedicated appendix pages.
        elif line.startswith(('## ', '### ')):
            flush()
            level, title = line.split(' ', 1)
            result.append(Paragraph(inline(title), styles['SFH2' if level == '##' else 'SFH3']))
        elif line.startswith('|'):
            flush()
            rows = []
            while index < len(lines) and lines[index].strip().startswith('|'):
                row = [cell.strip() for cell in lines[index].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', cell) for cell in row):
                    rows.append(row)
                index += 1
            if rows:
                if len(rows) <= 5:
                    lead_in = []
                    if result and isinstance(result[-1], Paragraph):
                        lead_in.insert(0, result.pop())
                        if result and isinstance(result[-1], Paragraph) and result[-1].style.name in ('SFH2', 'SFH3'):
                            lead_in.insert(0, result.pop())
                    result.append(KeepTogether([*lead_in, table(rows), Spacer(1, 10)]))
                else:
                    result.extend([table(rows), Spacer(1, 10)])
            continue
        elif line.startswith('```'):
            flush()
            block = []
            index += 1
            while index < len(lines) and not lines[index].startswith('```'):
                block.extend(textwrap.wrap(lines[index], 80) or [''])
                index += 1
            result.append(Preformatted('\n'.join(block), styles['SFNote']))
        elif line.startswith('> '):
            flush()
            result.append(Paragraph(inline(line[2:]), styles['SFNote']))
        elif re.match(r'^([-*]|\d+\.) ', line):
            flush()
            bullet, content = line.split(' ', 1)
            result.append(Paragraph(inline(content), styles['SFBullet'],
                                    bulletText='•' if bullet in ('-', '*') else bullet))
        else:
            pending.append(line)
        index += 1
    flush()
    return result


def main():
    if not SOURCE.exists():
        raise SystemExit(f'Missing canonical case: {SOURCE}')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    story = [Spacer(1, 36), Paragraph('StockFlow', styles['SFTitle']),
             Paragraph('От потребности площадок<br/>к решению о подсорте', styles['SFSubtitle']),
             Paragraph('Бэкофис-система для согласования отгрузки на маркетплейсы '
                       'и закупки у поставщика.', styles['SFLead']), ProcessMap(), Spacer(1, 20),
             Paragraph('Моя роль: бизнес-аналитик / системный аналитик', styles['SFH3']),
             Paragraph('Разбор ручного процесса, правила расчёта, требования, '
                       'модель PostgreSQL и контракт основного сценария.', styles['SFBody']),
             Spacer(1, 18), Paragraph('Для портфолио я восстановил технические модели и подготовил демо. '
                       'Статус материалов описан в конце кейса.', styles['SFNote']),
             PageBreak()]
    story.extend(markdown_flow(SOURCE.read_text(encoding='utf-8')))
    for filename, template_name, size, title, description, caption in FIGURES:
        story.extend([NextPageTemplate(template_name), PageBreak()])
        image_path = ROOT / 'assets' / 'diagrams' / filename
        image_width, image_height = ImageReader(str(image_path)).getSize()
        max_width = size[0] - 38 * mm
        max_height = size[1] - 45 * mm - 95
        scale = min(max_width / image_width, max_height / image_height)
        diagram = Image(str(image_path), width=image_width * scale,
                        height=image_height * scale, hAlign='CENTER')
        story.extend([Paragraph(inline(title), styles['SFFigureTitle']),
                      Paragraph(inline(description), styles['SFFigureText']),
                      diagram, Spacer(1, 8),
                      Paragraph(inline(caption), styles['SFFigureText'])])
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=19 * mm,
                            rightMargin=19 * mm, topMargin=23 * mm,
                            bottomMargin=22 * mm, title='StockFlow - кейс подсорта',
                            author='onlyuncia', pageCompression=1)
    templates = []
    for name, size in [('portrait', A4), *[(figure[1], figure[2]) for figure in FIGURES]]:
        page_width, page_height = size
        frame = Frame(19 * mm, 22 * mm, page_width - 38 * mm,
                      page_height - 45 * mm, leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0, id=name)
        templates.append(PageTemplate(id=name, frames=[frame], pagesize=size,
                                      onPage=page_chrome))
    doc.addPageTemplates(templates)
    doc.build(story)
    public = ROOT / 'prototype' / 'dist' / 'assets' / 'case-stockflow.pdf'
    public.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUTPUT, public)
    print(f'Built {OUTPUT.relative_to(ROOT)} and public PDF copy')


if __name__ == '__main__':
    main()
