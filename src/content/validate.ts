/**
 * 問題データの「ファイルをまたいだ」検査。
 * スキーマ（schema.ts）で表せない整合性（参照先の存在・時刻の順序など）を確かめる。
 */
import { POSITION_SCENE3D_IDS, type Categories, type Glossary, type Question, type Sources, type Stages } from './schema.ts';

export interface ContentBundle {
  questions: Question[];
  sources: Sources;
  glossary: Glossary;
  categories: Categories;
  stages: Stages;
}

export interface ContentIssue {
  /** 問題 ID またはファイル名 */
  where: string;
  message: string;
}

const TERM_RE = /\{\{(.+?)\}\}/g;

/** 問題の中で表示されるすべての文章 */
export function textsOf(q: Question): string[] {
  const out: string[] = [q.title, q.explain.summary];
  if (q.hint) out.push(q.hint);
  if (q.explain.detail) out.push(q.explain.detail);
  for (const s of q.steps) {
    out.push(s.question);
    if (s.type === 'choice') for (const c of s.choices) out.push(c.text, c.feedback ?? '', c.note ?? '');
    else if (s.type === 'position') for (const c of s.candidates) out.push(c.text, c.feedback ?? '');
    else for (const z of s.placement.zones) out.push(z.text);
  }
  return out;
}

export function termsIn(text: string): string[] {
  return [...text.matchAll(TERM_RE)].map((m) => m[1] ?? '');
}

export function validateContent(bundle: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Set<string>();
  issues.push(...validateStages(bundle));

  for (const q of bundle.questions) {
    const add = (message: string) => issues.push({ where: q.id, message });

    if (seen.has(q.id)) add('ID が重複しています');
    seen.add(q.id);

    if (!bundle.categories[q.category]) add(`分野「${q.category}」の表示名が categories.yaml にありません`);

    // 出典
    for (const r of q.refs) if (!bundle.sources[r.src]) add(`出典「${r.src}」が sources.yaml にありません`);

    // 用語
    for (const t of textsOf(q))
      for (const term of termsIn(t)) if (!bundle.glossary[term]) add(`用語「${term}」が glossary.yaml にありません`);

    // 手順
    q.steps.forEach((s, i) => {
      const at = `steps[${i}]`;
      if (s.type === 'choice') {
        const ids = s.choices.map((c) => c.id);
        if (new Set(ids).size !== ids.length) add(`${at}: 選択肢の id が重複しています`);
        if (!ids.includes(s.answer)) add(`${at}: 正解「${s.answer}」が選択肢にありません`);
      } else if (s.type === 'position') {
        const ids = s.candidates.map((c) => c.id);
        if (new Set(ids).size !== ids.length) add(`${at}: 候補の id が重複しています`);
        if (ids.join('') !== 'ABCDEF'.slice(0, ids.length)) add(`${at}: 候補の id は A から順に付けてください`);
        if (!ids.includes(s.answer)) add(`${at}: 正解「${s.answer}」が候補にありません`);
        if (q.kind !== '3d' || !POSITION_SCENE3D_IDS.includes(q.scene3d.id))
          add(`${at}: 立ち位置の問題は、立ち位置に対応した3Dシーン（${POSITION_SCENE3D_IDS.join(', ')}）でのみ使えます`);
        if (i !== 0) add(`${at}: 立ち位置の問題は最初の手順にしてください`);
        for (const c of s.candidates) {
          const [x, y] = c.at;
          if (x < 0 || x > 68 || y < -3 || y > 53) add(`${at}: 候補 ${c.id} の位置がフィールドの外です`);
        }
      } else {
        const p = s.placement;
        if (q.kind !== '2d') add(`${at}: 配置問題は 2D の問題でのみ使えます`);
        if (p.mode === 'line') {
          if (p.min >= p.max) add(`${at}: min は max より小さくしてください`);
          if (p.target[0] < p.min || p.target[0] > p.max) add(`${at}: 正解の位置が動かせる範囲（min〜max）の外です`);
          if (q.kind === '2d' && !q.scene.actors.some((a) => a.id === p.actor))
            add(`${at}: 動かす登場人物「${p.actor}」が actors にありません`);
        }
      }
    });

    if (q.kind === '2d') {
      const sc = q.scene;
      const actorIds = new Set(sc.actors.map((a) => a.id));
      if (actorIds.size !== sc.actors.length) add('scene.actors: id が重複しています');
      const placed = new Set<string>();
      let prevT = -Infinity;
      sc.timeline.forEach((kf, i) => {
        const at = `scene.timeline[${i}]`;
        if (kf.t < prevT) add(`${at}: 時刻 t=${kf.t} が前のキーフレーム（t=${prevT}）より前です`);
        prevT = kf.t;
        for (const id of Object.keys(kf.positions)) {
          if (!actorIds.has(id)) add(`${at}: 登場人物「${id}」が actors にありません`);
          placed.add(id);
        }
        for (const ev of kf.events ?? []) {
          const ref = ev.type === 'highlight' ? ev.actor : ev.type === 'countdown' || ev.type === 'flag' || ev.type === 'coin' ? ev.by : null;
          if (ref && !actorIds.has(ref)) add(`${at}: イベント「${ev.type}」の登場人物「${ref}」が actors にありません`);
        }
      });
      for (const id of actorIds) if (!placed.has(id)) add(`scene.actors: 「${id}」の位置が timeline に一度も出てきません`);
      const duration = sc.timeline[sc.timeline.length - 1]?.t ?? 0;
      if (sc.pauseAt > duration) add(`scene.pauseAt（${sc.pauseAt}）が timeline の最後（${duration}）より後です`);
      if (sc.endAt !== undefined) {
        if (sc.endAt < sc.pauseAt) add('scene.endAt は pauseAt 以上にしてください');
        if (sc.endAt > duration) add(`scene.endAt（${sc.endAt}）が timeline の最後（${duration}）より後です`);
      }
      if (sc.spotlight && !actorIds.has(sc.spotlight)) add(`scene.spotlight「${sc.spotlight}」が actors にありません`);
      q.explain.overlays.forEach((o, i) => {
        const refs: string[] = [];
        if (o.type === 'offsideLine') refs.push(o.actor);
        if (o.type === 'sightLine') refs.push(o.from, o.to);
        if (o.type === 'distanceCircle' && typeof o.center === 'string') refs.push(o.center);
        for (const r of refs) if (!actorIds.has(r)) add(`explain.overlays[${i}]: 登場人物「${r}」が actors にありません`);
      });
    } else if (q.kind === '3d') {
      const s3 = q.scene3d;
      if (s3.pauseAt > s3.endAt) add('scene3d.pauseAt は endAt 以下にしてください');
      if (s3.contactAt > s3.endAt) add('scene3d.contactAt は endAt 以下にしてください');
      if (q.explain.overlays.length) add('3D の問題では explain.overlays は使えません');
    } else {
      if (q.explain.overlays.length) add('図のない問題（kind: text）では explain.overlays は使えません');
    }
  }
  return issues;
}

/** どの問題も、ちょうど1つのステージに入っていること */
function validateStages(bundle: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (message: string) => issues.push({ where: 'stages.yaml', message });
  const qids = new Set(bundle.questions.map((q) => q.id));
  const stageIds = new Set<string>();
  const placed = new Map<string, string>();
  for (const st of bundle.stages) {
    if (stageIds.has(st.id)) add(`ステージ「${st.id}」の id が重複しています`);
    stageIds.add(st.id);
    for (const id of st.questions) {
      if (!qids.has(id)) add(`ステージ「${st.id}」の問題「${id}」がありません`);
      const prev = placed.get(id);
      if (prev) add(`問題「${id}」が、ステージ「${prev}」と「${st.id}」の両方に入っています`);
      placed.set(id, st.id);
    }
  }
  for (const id of qids) if (!placed.has(id)) add(`問題「${id}」が、どのステージにも入っていません`);
  return issues;
}
