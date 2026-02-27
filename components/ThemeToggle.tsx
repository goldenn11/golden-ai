'use client';
import { THEMES } from '@/lib/themes';
import { useTheme } from '@/app/providers';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{ padding: '8px 16px 12px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase' as const,
        marginBottom: '6px',
        paddingLeft: '4px',
      }}>
        THEME
      </div>
      <div className="flex gap-1.5">
        {THEMES.map(t => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-spring)',
                background: isActive ? 'var(--accent-fill)' : 'var(--fill-quaternary)',
                boxShadow: isActive ? '0 0 0 1.5px var(--accent)' : 'none',
              }}
            >
              {t.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
