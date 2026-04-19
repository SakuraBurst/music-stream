interface LoadMoreButtonProps {
  loading: boolean;
  hasMore: boolean;
  onClick: () => void;
}

export default function LoadMoreButton({ loading, hasMore, onClick }: LoadMoreButtonProps) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center py-8">
      <button
        onClick={onClick}
        disabled={loading}
        className="font-mono-jb text-[10px] tracking-[3px] uppercase
                   px-5 py-2 border border-[var(--line2)] text-[var(--ink2)]
                   hover:text-[var(--sun)] hover:border-[var(--sun)]
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Loading…' : '↓ Load more'}
      </button>
    </div>
  );
}
