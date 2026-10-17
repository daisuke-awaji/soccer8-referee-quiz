/** 検査済みの問題データ（ビルド時に content/ から生成される） */
import raw from 'virtual:content';
import type { Question, Stage } from './schema';
import type { ContentBundle } from './validate';

const content = raw as ContentBundle;

export const RULE_VERSION = '2026/27';
export const { questions: QUESTIONS, sources: SOURCES, glossary: GLOSSARY, categories: CATEGORIES, stages: STAGES } = content;

export const QMAP: Readonly<Record<string, Question>> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export const STAGE_MAP: Readonly<Record<string, Stage>> = Object.fromEntries(STAGES.map((s) => [s.id, s]));
