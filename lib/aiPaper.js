// Бодлогын зураг → засварлах боломжтой текст + LaTeX (pages/api/paper-ocr.js, components/PaperEditor.js). Claude Opus 5.5.
// Mathpix-ээс илүү: (1) таних — бодлогыг бүтцээр нь (өгүүлбэр, 5 сонголт, ЭЕШ-ийн нүд [[a]], зургийн хүрээ, тэмдэглэсэн хариу),
// эсвэл ганц томьёо/хэсэг (курсорт оруулна), эсвэл зөвхөн зураг (хавсаргана) гэж ялгана; гараар бичсэнийг ч; (2) LaTeX-ийг
// серверт KaTeX-ээр (lib/mathText.js — сурагчийн дэлгэц, хэвлэлттэй ижил) шалгаж, эвдэрсэн бол загвараар засуулна;
// (3) бодох — зөв хариу, нүдний цифр, агуулгыг санал болгоно (багш баталгаажуулна; багшийн түлхүүртэй зөрвөл анхааруулна).
// Татгалзсан хүсэлтийг сервер өөр загвараар дахин ажиллуулна (fallbacks: 'default'). Зөвхөн сервер.
import Anthropic from '@anthropic-ai/sdk';
import { mathErrors } from './mathText';

const MODEL = 'claude-opus-5-5';
const BETAS = ['server-side-fallback-2026-07-01'];
export class AiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

const ZERO_BOX = { x0: 0, y0: 0, x1: 0, y1: 0 };
const SCAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['kind', 'fragment', 'problems'],
  properties: {
    kind: { type: 'string', enum: ['problems', 'fragment', 'figure'] },
    fragment: { type: 'string' },
    problems: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['number', 'stem', 'choices', 'marked', 'has_figure', 'figure_box'],
        properties: {
          number: { type: 'string' },
          stem: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          marked: { type: 'string', enum: ['', 'A', 'B', 'C', 'D', 'E'] },
          has_figure: { type: 'boolean' },
          figure_box: {
            type: 'object', additionalProperties: false, required: ['x0', 'y0', 'x1', 'y1'],
            properties: { x0: { type: 'number' }, y0: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' } },
          },
        },
      },
    },
  },
};
const LATEX_RULES = `- Write every mathematical expression in LaTeX: inline as $...$, a standalone displayed formula as $$...$$. Use only KaTeX-supported commands: \\frac, \\dfrac, \\sqrt, \\sqrt[n]{}, ^{}, _{}, \\cdot, \\times, \\div, \\pm, \\le, \\ge, \\ne, \\approx, \\infty, \\pi, Greek letters, \\log_{a}, \\lg, \\ln, \\sin, \\cos, \\tg, \\ctg, \\arcsin, \\arccos, \\arctg, \\lim_{x\\to a}, \\int, \\sum, \\vec{}, \\overline{}, \\overrightarrow{}, \\angle, \\triangle, \\parallel, \\perp, ^\\circ, \\in, \\cup, \\cap, \\varnothing, \\mathbb{R}, \\Rightarrow, \\Leftrightarrow, \\begin{cases}...\\end{cases}, \\begin{pmatrix}...\\end{pmatrix}, \\begin{array}{...}...\\end{array}, \\text{}, chemistry as plain LaTeX (e.g. $\\text{H}_2\\text{O}$, $\\rightarrow$).
- Mongolian notation: tangent and cotangent are \\tg and \\ctg (never \\tan, \\cot); keep decimal commas as printed ($2{,}5$). Variables inside formulas are Latin letters (a Cyrillic «х» in a formula is the variable $x$).
- Keep ordinary words outside the $...$ delimiters; units after a number may go inside \\text{} (e.g. $5\\text{ см}$).`;
const SCAN_SYSTEM = `You convert photos, scans and screenshots of exam material (mathematics, physics, chemistry and other school subjects; usually Mongolian Cyrillic, sometimes English; printed or handwritten) into an online exam editor, like Mathpix but with the exam structure understood. A teacher reviews your output.

First decide "kind":
- "problems": the image contains one or more exam problems (a numbered task, a question with answer options, or a fill-in task).
- "fragment": the image is only a formula, an equation, an expression, or a short piece of text without the structure of a problem. Put its transcription in "fragment" (math in $...$) and return an empty "problems" array.
- "figure": the image is only a drawing, diagram, graph, chart or photo with no text to transcribe (labels such as A, B, C on a drawing do not count as text). Return empty "fragment" and "problems".
For "problems", "fragment" is "".

Transcription rules:
- Transcribe every problem in reading order. Keep the original language and wording exactly. Do not translate, solve, simplify, or add answers, hints or explanations. Silently correct obvious recognition slips using the mathematical context (0 vs O, 1 vs l, minus signs, exponents, subscripts), but never change the mathematics.
${LATEX_RULES}
- Plain text only: no Markdown headings, lists or tables. Separate paragraphs with a single line break. Use **...** only for text that is bold in the source.
- Multiple-choice problems: put the answer options in "choices", in order, WITHOUT their labels (drop "A.", "B)", "(C)" and similar). Exams normally have 5 options A–E. If the problem has no options, "choices" is an empty array.
- "marked": if the correct option is visibly marked in the image (circled, ticked, highlighted, or given in an answer key on the page), its letter; otherwise "". Never guess.
- Answer boxes to fill in (small squares, usually labelled a, b, c, ...; a number made of several adjacent boxes like "bc"): write each box group as [[a]], [[bc]] with the printed letters, also inside formulas, e.g. $x=\\frac{[[a]]}{[[bc]]}$. If the boxes are unlabelled, label them a, b, c, ... in reading order within that problem.
- "number": the printed problem number such as "12" or "2.3", or "" if none.
- Figures: if a problem contains a drawing, diagram, graph, chart or picture that cannot be written as text, set "has_figure" to true and "figure_box" to the pixel rectangle of that drawing only (x0,y0 top-left, x1,y1 bottom-right; image coordinates are pixels of the given image size) with a small margin. Otherwise "has_figure" is false and "figure_box" is all zeros. Write small tables of values as a LaTeX array instead of a figure.
- If nothing is readable, use kind "problems" with an empty array.`;

const REPAIR_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string' } } } } },
};
const REPAIR_SYSTEM = `You fix LaTeX in exam text so that it renders with KaTeX. Each item is text with math between $...$ or $$...$$ and a list of KaTeX error messages. Return the same text with the smallest possible changes that make every formula compile: balance braces and delimiters, replace unsupported commands with KaTeX equivalents, escape a literal dollar sign as \\$. Keep the wording, the language, the mathematics and the answer boxes [[a]] unchanged. Return every item with its id.`;

const SOLVE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'answer', 'cells', 'topic', 'confidence', 'check'],
        properties: {
          id: { type: 'string' },
          answer: { type: 'string', enum: ['', 'A', 'B', 'C', 'D', 'E'] },
          cells: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['l', 'v'], properties: { l: { type: 'string' }, v: { type: 'string' } } } },
          topic: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          check: { type: 'string' },
        },
      },
    },
  },
};
const solveSystem = (subject, topics) => `You are an expert ${subject} teacher preparing the answer key of a Mongolian school exam. For every problem work out the correct answer carefully and double-check it.
- Problems are in Mongolian (sometimes English) with LaTeX math; tg and ctg are tangent and cotangent.
- Multiple-choice problems list options A–E: "answer" is the letter of the correct option and "cells" is empty.
- Fill-in problems contain answer boxes written as [[a]], [[bc]], fractions [[a/bc]]: every letter is one cell holding a single digit, "-" or ".". Give "cells" for every listed cell letter so that the boxes spell the correct answer (25 in [[bc]] → b=2, c=5; −3 in [[ab]] → a="-", b=3; ½ in [[a/b]] → a=1, b=2), and "answer" is "".
- "topic": the best matching topic from this list, or "" if none fits: ${topics.length ? topics.join('; ') : '(no list)'}.
- "confidence": "low" if the problem is ambiguous, incomplete, depends on a figure you cannot see, or no option is correct; "medium" if unsure; otherwise "high".
- "check": one short line in Mongolian with the key result only (for example «x₁=2, x₂=3 ⇒ нийлбэр 5»), at most 120 characters.
Return one result per problem id.`;

function client() { return new Anthropic(); }
// Нэг дуудлага → задалсан JSON. Алдааг AiError (статус + монгол мессеж) болгоно.
async function ask({ system, content, schema, effort, maxTokens }) {
  let msg;
  try {
    msg = await client().beta.messages.stream({
      model: MODEL, max_tokens: maxTokens, betas: BETAS, fallbacks: 'default',
      output_config: { effort, format: { type: 'json_schema', schema } },
      system, messages: [{ role: 'user', content }],
    }).finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError(429, 'Үйлчилгээ түр ачаалалтай байна. Хэдэн секундын дараа дахин оролдоно уу.');
    if (e instanceof Anthropic.AuthenticationError) { console.error('[ai] API түлхүүр буруу'); throw new AiError(503, 'Зургаас таних үйлчилгээ одоогоор ажиллахгүй байна.'); }
    if (e instanceof Anthropic.BadRequestError) { console.error('[ai] 400', e.message); throw new AiError(400, 'Зургийг уншиж чадсангүй. Өөр зураг оролдоно уу.'); }
    console.error('[ai]', e instanceof Anthropic.APIError ? e.status : '', e?.message);
    throw new AiError(502, 'Үйлчилгээнд алдаа гарлаа. Дахин оролдоно уу.');
  }
  if (msg.stop_reason === 'refusal') throw new AiError(422, 'Энэ хүсэлтийг гүйцэтгэх боломжгүй байна.');
  if (msg.stop_reason === 'max_tokens') throw new AiError(422, 'Хэт олон бодлого байна — цөөн бодлогоор нь хувааж оруулна уу.');
  try { return JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join('')); }
  catch (e) { console.error('[ai] JSON'); throw new AiError(502, 'Үйлчилгээнд алдаа гарлаа. Дахин оролдоно уу.'); }
}

const str = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').slice(0, max);
const clamp = (v, hi) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));

// Эвдэрсэн LaTeX-тэй мөрүүдийг загвараар засуулна (засварын дараа ч алдаатай бол эхнийх нь үлдэнэ) → засагдсан тоо
async function repairAll(fields) {
  const bad = fields.map((f, i) => ({ id: 'f' + i, f, errs: mathErrors(f.get()) })).filter(x => x.errs.length).slice(0, 40);
  if (!bad.length) return 0;
  let out;
  try {
    out = await ask({ system: REPAIR_SYSTEM, schema: REPAIR_SCHEMA, effort: 'low', maxTokens: 8000,
      content: [{ type: 'text', text: JSON.stringify(bad.map(x => ({ id: x.id, text: x.f.get(), errors: x.errs.map(e => e.msg) }))) }] });
  } catch (e) { console.error('[ai repair]', e.message); return 0; }
  let n = 0;
  for (const it of Array.isArray(out?.items) ? out.items : []) {
    const x = bad.find(b => b.id === it.id), t = str(it.text, 6000);
    if (x && t.trim() && !mathErrors(t).length) { x.f.set(t); n++; }
  }
  return n;
}

// Таних: data → { kind, fragment, problems:[{ number, stem, choices, marked, fill, box }], fixed }
export async function scanImage({ media, data, w, h }) {
  const out = await ask({
    system: SCAN_SYSTEM, schema: SCAN_SCHEMA, effort: 'low', maxTokens: 16000,
    content: [
      { type: 'image', source: { type: 'base64', media_type: media, data } },
      { type: 'text', text: `Image size: ${w}×${h} pixels.` },
    ],
  });
  const kind = ['problems', 'fragment', 'figure'].includes(out?.kind) ? out.kind : 'problems';
  const res = { kind, fragment: kind === 'fragment' ? str(out.fragment, 6000).trim() : '', problems: [] };
  if (kind === 'problems') {
    res.problems = (Array.isArray(out.problems) ? out.problems : []).slice(0, 40).map(p => {
      let box = null;
      if (p.has_figure && p.figure_box) {
        const b = p.figure_box, x0 = clamp(Math.min(b.x0, b.x1), w), x1 = clamp(Math.max(b.x0, b.x1), w), y0 = clamp(Math.min(b.y0, b.y1), h), y1 = clamp(Math.max(b.y0, b.y1), h);
        if ((x1 - x0) * (y1 - y0) >= w * h * 0.004) box = { x0, y0, x1, y1 };
      }
      const choices = (Array.isArray(p.choices) ? p.choices : []).map(c => str(c, 800).trim()).filter(Boolean).slice(0, 5);
      return { number: str(p.number, 12).trim(), stem: str(p.stem, 6000).trim(), choices, marked: /^[A-E]$/.test(p.marked) && choices.length ? p.marked : '', box };
    }).filter(p => p.stem || p.choices.length || p.box);
  }
  if (kind === 'fragment' && !res.fragment) res.kind = 'problems';
  // KaTeX-ээр шалгаж, эвдэрсэн томьёог засуулна
  const fields = [];
  if (res.fragment) fields.push({ get: () => res.fragment, set: v => { res.fragment = v; } });
  res.problems.forEach(p => {
    fields.push({ get: () => p.stem, set: v => { p.stem = v; } });
    p.choices.forEach((c, j) => fields.push({ get: () => p.choices[j], set: v => { p.choices[j] = v; } }));
  });
  res.fixed = await repairAll(fields);
  res.problems.forEach(p => { p.fill = /\[\[[a-h]/.test(p.stem); });
  return res;
}

// Бодох: items [{ id, stem, choices[], letters[], img? }] → [{ id, answer, cells:{a:'3'}, topic, confidence, check }]
export async function solveItems({ subject, topics, items }) {
  const content = [];
  items.forEach(it => {
    content.push({ type: 'text', text: `Problem id ${it.id}:\n${it.stem}${it.choices.length ? '\n' + it.choices.map((c, j) => 'ABCDE'[j] + '. ' + c).join('\n') : ''}${it.letters.length ? '\nCells: ' + it.letters.join(', ') : ''}` });
    if (it.img) content.push({ type: 'image', source: { type: 'base64', media_type: it.img.media, data: it.img.data } });
  });
  const out = await ask({ system: solveSystem(subject, topics), schema: SOLVE_SCHEMA, effort: 'medium', maxTokens: 32000, content });
  const byId = Object.fromEntries(items.map(it => [it.id, it]));
  return (Array.isArray(out?.results) ? out.results : []).filter(r => r && byId[r.id]).map(r => {
    const it = byId[r.id], cells = {};
    if (it.letters.length) (Array.isArray(r.cells) ? r.cells : []).forEach(c => { if (c && it.letters.includes(c.l) && /^[0-9.\-]$/.test(String(c.v).trim())) cells[c.l] = String(c.v).trim(); });
    return { id: r.id, answer: !it.letters.length && /^[A-E]$/.test(r.answer) ? r.answer : '', cells,
      topic: topics.includes(r.topic) ? r.topic : '', confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'low', check: str(r.check, 160).trim() };
  });
}
