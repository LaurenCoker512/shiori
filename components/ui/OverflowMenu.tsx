'use client';

import { useState } from 'react';

interface OverflowMenuProps {
  onRename: () => void;
  onDelete: () => void;
}

export function OverflowMenu({ onRename, onDelete }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More options"
        aria-expanded={open}
        className="p-2 rounded hover:bg-gray-100 text-xl leading-none"
        onClick={() => setOpen(prev => !prev)}
      >
        ⋮
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Text options"
          className="absolute right-0 top-full mt-1 w-36 bg-white border rounded shadow-md z-20"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            onClick={() => { setOpen(false); onRename(); }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
