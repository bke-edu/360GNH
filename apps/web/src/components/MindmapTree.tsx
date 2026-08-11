import type { MindmapNode } from '@360gnh/core';

export function MindmapTree({ node, depth = 0 }: { node: MindmapNode; depth?: number }) {
  return (
    <div className="relative min-w-0" data-depth={depth}>
      <div
        className={`grid gap-2 border-l bg-accent-soft px-4 py-3 ${depth === 0 ? 'border-l-4 border-accent font-display text-lg shadow-[2px_2px_0_var(--color-line)]' : 'border-l-3 border-accent'}`}
      >
        <strong className="text-sm font-semibold">{node.label}</strong>
        {node.sourceExcerpt ? (
          <small className="font-body text-xs leading-relaxed text-ink-faint">
            {node.sourceExcerpt}
          </small>
        ) : null}
      </div>
      {node.children?.length ? (
        <div className="my-3 ml-4 grid gap-3 border-l border-dashed border-line-strong pl-4">
          {node.children.map((child) => (
            <MindmapTree depth={depth + 1} key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
