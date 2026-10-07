"""Readable PDF explanation and Markdown report from a completed migration run."""
import json
import re
import sys
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

root = Path(__file__).resolve().parent.parent
run = Path(sys.argv[1]).resolve()
calc = json.loads((run / 'calculation.json').read_text(encoding='utf-8'))
deped = json.loads((run / 'deped-source.json').read_text(encoding='utf-8'))
report = (run / 'report.md').read_text(encoding='utf-8')
output = root / 'output' / 'pdf' / 'ATLAS-learner-migration-2027-2035.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Atlas', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('AtlasBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Atlas', normal='Atlas', bold='AtlasBold', italic='Atlas', boldItalic='AtlasBold')
styles = getSampleStyleSheet()
for name in ['Normal', 'BodyText', 'Title', 'Heading1', 'Heading2', 'Heading3']:
    styles[name].fontName = 'AtlasBold' if name.startswith('Heading') or name == 'Title' else 'Atlas'
styles['BodyText'].fontSize = 10
styles['BodyText'].leading = 15
styles['BodyText'].spaceAfter = 8
styles['Title'].fontSize = 25
styles['Title'].leading = 30
styles['Heading1'].fontSize = 17
styles['Heading1'].leading = 22
styles['Heading1'].spaceBefore = 15
styles['Heading2'].fontSize = 13
styles['Heading2'].leading = 17
styles['Heading2'].spaceBefore = 12
styles.add(ParagraphStyle('Small', fontName='Atlas', fontSize=8, leading=11, spaceAfter=6, wordWrap='CJK'))
styles.add(ParagraphStyle('Formula', fontName='AtlasBold', fontSize=11, leading=17, backColor=colors.HexColor('#edf3fa'), borderPadding=10, spaceBefore=9, spaceAfter=16))
story = []

def clean(text):
    return text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-')

def markup(text):
    value = escape(clean(text))
    value = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', lambda m: f'<link href="{m[2]}" color="#245b8a">{m[1]}</link>', value)
    value = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', value)
    value = re.sub(r'`([^`]+)`', r'<font color="#245b8a">\1</font>', value)
    return value

def p(text, style='BodyText'):
    story.append(Paragraph(markup(text), styles[style]))

def table(rows, widths=None):
    cells = [[Paragraph(markup(str(c)), styles['Small']) for c in row] for row in rows]
    tbl = Table(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3edf7')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f7fa')]),
        ('LINEBELOW', (0, 0), (-1, 0), .6, colors.HexColor('#a4b4c3')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 12))

region = deped['selectedRegion']['region']
base = calc['baseEnrollment']
p('ATLAS / RESEARCH & SCENARIO LAB', 'Small')
p('Learner migration 2027-2035', 'Title')
p(f'{region} | Calculation explanation and readable agent report', 'Heading2')
p(f'Run: {run.name}. Baseline: **{base:,} learners**, SY {calc["baseSchoolYear"]}.', 'BodyText')
p('Ang output ay sensitivity scenario gamit ang observed enrollment baseline. Ang annual migration rates ay assumptions; hindi pa sila fitted o validated learner-migration forecasts.')
p('Paano binabasa ang baseline', 'Heading2')
p('Ang year ay ending year ng school year. Baseline 2026 = SY 2025-2026; output 2027 = SY 2026-2027; output 2035 = SY 2034-2035. Ang index na 100 ay normalization ng actual baseline, hindi 100 learners. [1, 2]')
p('Formula at assumptions', 'Heading2')
p('Learners(y) = round(B x (1 + r / 100)^(y - 2026))', 'Formula')
p(f'B = {base:,}; r = assumed annual net migration contribution; y = school-year ending year. Low: {calc["ratesPercent"][0]:+g}%; base: {calc["ratesPercent"][1]:g}%; high: {calc["ratesPercent"][2]:+g}%. Compounded ang pagbabago taun-taon. [1, 3]')
p('Ang rates ay hindi kinuha sa PSA general-population migration percentages, IMPACT findings, o DepEd enrollment changes. Births, cohort aging, progression, dropout at international migration ay held fixed/excluded para makita ang migration assumption lamang.')
p('Calculation citations: [1] calculation.json; [2] deped-source.json; [3] run-migration-agents.mjs. Full reference details are at the end.', 'Small')
story.append(PageBreak())
p('Calculation: worked examples', 'Heading1')
low, mid, high = calc['ratesPercent']
p(f'2027 low: round({base:,} x (1 + ({low:g} / 100))^1) = **{calc["rows"][0]["lowLearners"]:,} learners**. [1]')
p(f'2035 high: round({base:,} x (1 + ({high:g} / 100))^9) = **{calc["rows"][-1]["highLearners"]:,} learners**. Ito ay {calc["rows"][-1]["highNetChangeFromBaseline"]:+,} kumpara sa baseline, conditional sa fixed assumption. [1]')
table([['School year', f'Low ({low:+g}%)', f'Base ({mid:g}%)', f'High ({high:+g}%)']] + [[r['schoolYear'], f'{r["lowLearners"]:,}', f'{r["baseLearners"]:,}', f'{r["highLearners"]:,}'] for r in calc['rows']], [120, 116, 116, 116])
p('Paano pinapanatili ang domestic total', 'Heading2')
p(f'Other domestic learners = {calc["domesticBaselineTotal"]:,} - modeled regional learners. Halimbawa, kapag nadagdagan ang destination, ibinabawas ang parehong bilang sa pooled counterpart. PSO is excluded. Walang specific origin-region allocation na na-estimate sa model. [1, 2]')
p('Hindi ito full enrollment forecast. Ang stock changes sa observed history ay maaaring mula sa cohort, reporting, o geography changes. Ang residence migration, school transfers, at commuting ay magkakaibang measures. PSA projections may already incorporate migration assumptions; kailangan ang methodological check bago magdagdag ng migration adjustments. [4]')
p('Table and calculations: calculation.json from the identified run. Source citations below; public sources supply context, not the numerical rates.', 'Small')
story.append(PageBreak())
p('Readable research and source report', 'Heading1')
p('Formatted from report.md for the same run. The generated narrative is an analytical interpretation; the calculation and observed baseline above are authoritative for numeric values.', 'Small')
lines = report.splitlines()
i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line or line == '---':
        i += 1
        continue
    if line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].strip().startswith('|'):
            cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                rows.append(cells)
            i += 1
        if rows and all(len(r) == len(rows[0]) for r in rows):
            table(rows, [468 / len(rows[0])] * len(rows[0]))
        continue
    if line.startswith('#'):
        level = len(line) - len(line.lstrip('#'))
        if 'Retrieved source citations' in line:
            break  # Render clickable references once, with readable URLs below.
        p(line.lstrip('#').strip(), 'Heading1' if level == 1 else 'Heading2')
    elif line.startswith('```'):
        i += 1
        while i < len(lines) and not lines[i].strip().startswith('```'):
            p(lines[i], 'Small')
            i += 1
    else:
        p(re.sub(r'^[-*]\s+', '- ', line))
    i += 1
story.append(PageBreak())
p('Citations and provenance', 'Heading1')
for text in [
    '[1] ATLAS calculation.json. Scenario parameters, formulas and 2027-2035 values; same run shown on page 1. Numerical rates are illustrative defaults, not source estimates.',
    '[2] ATLAS deped-source.json. Read-only snapshot of depedprototype/depedprot: regional_profiles, selected-region kes_historical, national_kpi_timeline, raw_catalog and mv_catalog. Baseline field: regional_profiles/Region IV-A/enrollment_total_2526 (for this run).',
    '[3] ATLAS scripts/run-migration-agents.mjs. Deterministic regionalScenario calculation, rounding and pooled domestic conservation checks.',
    '[4] ATLAS public-sources.json and report.md. Public web retrieval and agent interpretation. Underlying public-source links appear below.',
]:
    p(text, 'Small')
evidence = json.loads((run / 'research-evidence.json').read_text(encoding='utf-8'))['evidence']
p('Research study', 'Heading2')
p('Ayeb-Karlsson, S. and Uy, N. Internal Migration in the Philippines: Adaptation to Climate Change (IMPACT), final report. Local source: IMPACT-Study-Final-web-page-2.pdf. Evidence pages/chunks used in this run:', 'Small')
p('; '.join(f'PDF page {f["pdf_page"]}, {f["chunk_id"]}' for f in evidence['findings']), 'Small')
p('Retrieved public references', 'Heading2')
sources = json.loads((run / 'public-sources.json').read_text(encoding='utf-8'))['sources']
seen = set()
for source in sources:
    for citation in source['citations']:
        url = citation['url']
        if url in seen:
            continue
        seen.add(url)
        p(f'{source["agency"]}: **{citation["title"]}**', 'Small')
        p(f'[{url}]({url})', 'Small')

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#d5dfe9'))
    canvas.line(42, 40, A4[0] - 42, 40)
    canvas.setFont('Atlas', 8)
    canvas.setFillColor(colors.HexColor('#576779'))
    canvas.drawString(42, 26, 'ATLAS | Observed baseline + assumed migration scenario')
    canvas.drawRightString(A4[0] - 42, 26, f'{doc.page}')
    canvas.restoreState()

doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=42, rightMargin=42, topMargin=40, bottomMargin=54,
    title='ATLAS learner migration calculation and report 2027-2035', author='Project ATLAS')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(output)
