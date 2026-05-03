import type { FacilityDef, TechDef } from '../engine/types';

// =============================================================================
// SIGNAL — Rich text parser
// Supports: **bold**, *italic*, __underline__, {facility:id}, {technology:id}
// No nesting of formatting marks; unknown tokens degrade to plain text.
// =============================================================================

export type RichNode =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'underline'; value: string }
  | { kind: 'facility'; id: string }
  | { kind: 'tech'; id: string };

const TOKEN_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function parseRichText(input: string): RichNode[] {
  if (!input) return [];
  const nodes: RichNode[] = [];
  let i = 0;

  function pushText(s: string) {
    if (!s) return;
    const last = nodes[nodes.length - 1];
    if (last?.kind === 'text') {
      last.value += s;
    } else {
      nodes.push({ kind: 'text', value: s });
    }
  }

  while (i < input.length) {
    if (input[i] === '{') {
      const end = input.indexOf('}', i);
      if (end !== -1) {
        const inner = input.slice(i + 1, end);
        const colon = inner.indexOf(':');
        if (colon !== -1) {
          const prefix = inner.slice(0, colon);
          const id = inner.slice(colon + 1);
          if ((prefix === 'facility' || prefix === 'technology') && TOKEN_ID_RE.test(id)) {
            nodes.push({ kind: prefix === 'facility' ? 'facility' : 'tech', id });
            i = end + 1;
            continue;
          }
        }
      }
      pushText(input[i++]);
      continue;
    }

    if (input.startsWith('**', i)) {
      const close = input.indexOf('**', i + 2);
      if (close !== -1) {
        nodes.push({ kind: 'bold', value: input.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
      pushText(input[i++]);
      continue;
    }

    if (input[i] === '*' && input[i + 1] !== '*') {
      const close = input.indexOf('*', i + 1);
      if (close !== -1 && input[close + 1] !== '*') {
        nodes.push({ kind: 'italic', value: input.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
      pushText(input[i++]);
      continue;
    }

    if (input.startsWith('__', i)) {
      const close = input.indexOf('__', i + 2);
      if (close !== -1) {
        nodes.push({ kind: 'underline', value: input.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
      pushText(input[i++]);
      continue;
    }

    pushText(input[i++]);
  }

  return nodes;
}

export function facilityTooltipText(def: FacilityDef): string {
  return `${def.name} — ${def.description}`;
}

export function techTooltipText(def: TechDef): string {
  return `${def.name} — ${def.rumourText}`;
}
