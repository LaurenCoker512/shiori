interface OverflowMenuProps {
  children?: React.ReactNode;
}

export function OverflowMenu({ children }: OverflowMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More options"
        className="p-2 rounded hover:bg-gray-100 text-xl leading-none"
      >
        ⋮
      </button>
      {children}
    </div>
  );
}
