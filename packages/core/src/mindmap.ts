import { compactExcerpt } from './citations.js';
import type { MindmapNodeDraft } from './model.js';
import type { MindmapNode } from './types.js';

const MAX_DEPTH = 4;
const MAX_CHILDREN = 8;

export function normalizeMindmap(root: MindmapNodeDraft): MindmapNode {
  return normalizeNode(root, 1, 'root');
}

export function mindmapToMarkdown(root: MindmapNode): string {
  const lines: string[] = [];
  const walk = (node: MindmapNode, depth: number): void => {
    lines.push(`${'#'.repeat(Math.min(depth, 6))} ${node.label}`);
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(root, 1);
  return lines.join('\n');
}

function normalizeNode(input: MindmapNodeDraft, depth: number, path: string): MindmapNode {
  const label = compactExcerpt(input.label, 80);
  if (!label) throw new Error('Mindmap nodes must have a non-empty label');

  const children =
    depth >= MAX_DEPTH
      ? []
      : (input.children ?? [])
          .slice(0, MAX_CHILDREN)
          .map((child, index) => normalizeNode(child, depth + 1, `${path}.${index + 1}`));

  return {
    id: path,
    label,
    ...(input.sourceExcerpt ? { sourceExcerpt: compactExcerpt(input.sourceExcerpt, 240) } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}
