'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUserName } from '@/components/ui/UserNameContext';

function BookmarkRibbon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.27}
      viewBox="0 0 22 28"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <path
        d="M2 2 L20 2 L20 26 L11 21 L2 26 Z"
        fill="var(--yg-coral)"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="0.5"
      />
      <line x1="6" y1="9"  x2="16" y2="9"  stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      <line x1="6" y1="13" x2="13" y2="13" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'library',    href: '/',           label: 'Library',    jp: '本棚',    match: (p: string) => p === '/' },
  { id: 'vocabulary', href: '/vocabulary', label: 'Vocabulary', jp: '語彙',    match: (p: string) => p === '/vocabulary' },
  { id: 'grammar',    href: '/grammar',    label: 'Grammar',    jp: '文法',    match: (p: string) => p === '/grammar' },
  { id: 'import',     href: '/import',     label: 'Import',     jp: '取り込み', match: (p: string) => p === '/import' },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { userName, setUserName } = useUserName();
  const [editingName, setEditingName] = useState(false);
  const [editValue, setEditValue] = useState(userName);
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const firstLetter = userName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('shiori-theme', next ? 'dark' : 'light'); } catch { /* */ }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function saveName() {
    const trimmed = editValue.trim();
    if (trimmed === '' || trimmed === userName) {
      setEditValue(userName);
      setEditingName(false);
      return;
    }
    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setUserName(trimmed);
    } else {
      setEditValue(userName);
    }
    setEditingName(false);
  }

  return (
    <nav
      aria-label="Site navigation"
      className="fixed top-0 left-0 right-0 z-20 h-16 flex items-center px-8"
      style={{
        background: 'var(--yg-nav-bg)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--yg-rule)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <BookmarkRibbon size={22} />
        <span
          className="font-jp text-[22px] font-medium tracking-tight"
          style={{ color: 'var(--yg-ink)' }}
        >
          shiori
        </span>
      </div>

      {/* Pill tabs */}
      <div className="flex-1 flex justify-center">
        <div
          className="flex gap-1 p-1 rounded-full"
          style={{ background: 'rgba(42, 36, 28, 0.05)' }}
        >
          {NAV_ITEMS.map(item => {
            const active = item.match(pathname);
            const baseStyle: React.CSSProperties = {
              padding: '7px 18px',
              borderRadius: '999px',
              border: 'none',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              color: active ? '#2c2a28' : 'var(--yg-ink-soft)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              fontFamily: 'inherit',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.15s',
            };

            return (
              <Link
                key={item.id}
                href={item.href}
                style={baseStyle}
                aria-current={active ? 'page' : undefined}
              >
                <span>{item.label}</span>
                <span
                  className="font-jp text-[11px] opacity-85"
                >
                  {item.jp}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right side: user avatar + logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        {editingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => { void saveName(); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { void saveName(); }
              if (e.key === 'Escape') { setEditValue(userName); setEditingName(false); }
            }}
            aria-label="Edit your name"
            className="font-en text-[13px] rounded px-1.5 py-0.5 border outline-none w-28"
            style={{ borderColor: 'var(--yg-coral)', background: 'var(--yg-paper)', color: 'var(--yg-ink)' }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => { setEditValue(userName); setEditingName(true); }}
            className="font-en text-[13px] rounded px-1 py-0.5 transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--yg-ink-soft)' }}
            title="Click to edit name"
          >
            {userName}
          </button>
        )}
        <button
          type="button"
          onClick={toggleDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-[34px] h-[34px] flex items-center justify-center rounded-full border transition-colors shrink-0"
          style={{
            borderColor: 'var(--yg-rule)',
            color: 'var(--yg-ink-soft)',
            background: 'transparent',
            fontSize: 15,
          }}
        >
          {isDark ? '日' : '月'}
        </button>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label="Open user menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-en text-[14px] font-semibold transition-opacity hover:opacity-80"
            style={{
              background: 'linear-gradient(135deg, var(--yg-coral), var(--yg-coral-dark))',
              color: '#faf3df',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {firstLetter}
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 top-full mt-2 w-40 rounded-xl border py-1 z-30"
              style={{
                background: 'var(--yg-paper-hi)',
                borderColor: 'var(--yg-rule)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
            >
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block font-en text-[13px] px-4 py-2.5 transition-colors"
                style={{ color: 'var(--yg-ink-soft)', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(42,36,28,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'none'; }}
              >
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); void handleLogout(); }}
                className="w-full text-left font-en text-[13px] px-4 py-2.5 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--yg-ink-soft)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(42,36,28,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
