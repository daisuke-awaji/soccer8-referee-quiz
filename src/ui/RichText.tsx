/** 文中の {{用語}} を、タップすると説明が出るボタンにする */
import { Fragment } from 'react';
import { useUi } from '../app/context';

export function RichText({ text }: { text: string | undefined }) {
  const { showGloss } = useUi();
  const parts = String(text ?? '').split(/(\{\{.+?\}\})/);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{\{(.+)\}\}$/);
        if (m) {
          const term = m[1]!;
          return (
            <button key={i} type="button" className="term" onClick={() => showGloss(term)}>
              {term}
            </button>
          );
        }
        return part ? <Fragment key={i}>{part}</Fragment> : null;
      })}
    </>
  );
}
