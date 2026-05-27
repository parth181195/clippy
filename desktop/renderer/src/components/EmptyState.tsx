export function EmptyState({
  variant,
  search = '',
}: {
  variant: 'no-history' | 'no-results' | 'no-filter';
  search?: string;
}) {
  const titles: Record<typeof variant, string> = {
    'no-history': 'Nothing here yet',
    'no-results': `No matches for "${search || 'query'}"`,
    'no-filter': 'No clips of this type yet',
  };
  const hints: Record<typeof variant, string> = {
    'no-history': "Copy anything — text, an image, a file — and it'll show up here.",
    'no-results': 'Try a shorter term or a different filter.',
    'no-filter': 'Copy something matching this type to populate this filter.',
  };
  return (
    <div className="empty">
      <div className="title">{titles[variant]}</div>
      <div className="hint">{hints[variant]}</div>
      <style>{`
        .empty {
          height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; padding: 20px;
        }
        .empty .title { font-size: 14px; font-weight: 500; color: var(--cm-text); }
        .empty .hint { font-size: 12px; color: var(--cm-text-secondary); text-align: center; max-width: 360px; line-height: 1.5; }
      `}</style>
    </div>
  );
}
