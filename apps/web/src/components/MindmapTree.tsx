import type { MindmapNode } from '@360gnh/core';

export function MindmapTree({ node, depth = 0 }: { node: MindmapNode; depth?: number }) {
  return (
    <div className="relative min-w-0" data-depth={depth}>
      <div
        className={`grid gap-2 border-l bg-amber-300/10 px-4 py-3 ${depth === 0 ? 'border-l-4 border-amber-300 font-display text-lg' : 'border-l-3 border-amber-300'}`}
      >
        <strong className="text-sm font-semibold">{node.label}</strong>
        {node.sourceExcerpt ? (
          <small className="text-xs leading-relaxed text-linen-500">{node.sourceExcerpt}</small>
        ) : null}
      </div>
      {node.children?.length ? (
        <div className="my-3 ml-4 grid gap-3 border-l border-dashed border-studio-500 pl-4">
          {node.children.map((child) => (
            <MindmapTree depth={depth + 1} key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
