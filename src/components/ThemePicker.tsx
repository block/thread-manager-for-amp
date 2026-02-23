import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check } from 'lucide-react';
import {
  THEME_PRESETS,
  getThemeForPreset,
  applyTheme,
  saveTheme,
  type ThemePreset,
} from '../lib/theme';
import { apiGet } from '../api/client';

interface CustomThemeData {
  name: string;
  bg: string;
  fg: string;
  accent: string;
}

interface ThemePickerProps {
  currentTheme: string;
  onThemeChange: (themeName: string) => void;
}

export function ThemePicker({ currentTheme, onThemeChange }: ThemePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [customThemes, setCustomThemes] = useState<ThemePreset[]>([]);

  useEffect(() => {
    void apiGet<CustomThemeData[]>('/api/custom-themes')
      .then((data) =>
        setCustomThemes(data.map((t) => ({ name: t.name, bg: t.bg, fg: t.fg, accent: t.accent }))),
      )
      .catch(() => setCustomThemes([]));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  const handleSelect = (preset: ThemePreset) => {
    const theme = getThemeForPreset(preset);
    applyTheme(theme);
    saveTheme(preset.name);
    onThemeChange(preset.name);
    setIsOpen(false);
  };

  const darkThemes = THEME_PRESETS.filter((p) => getLuminance(p.bg) < 0.5);
  const lightThemes = THEME_PRESETS.filter((p) => getLuminance(p.bg) >= 0.5);

  const dropdown =
    isOpen &&
    createPortal(
      <div
        className="theme-picker-dropdown"
        ref={dropdownRef}
        style={{ top: dropdownPos.top, right: dropdownPos.right }}
      >
        <div className="theme-picker-header">Choose Theme</div>

        <div className="theme-picker-section">
          <div className="theme-picker-section-label">Dark</div>
          <div className="theme-picker-grid">
            {darkThemes.map((preset) => (
              <button
                key={preset.name}
                className={`theme-picker-item ${currentTheme === preset.name ? 'active' : ''}`}
                onClick={() => handleSelect(preset)}
                title={preset.name}
              >
                <div className="theme-preview">
                  <div className="theme-preview-bg" style={{ background: preset.bg }} />
                  <div className="theme-preview-accent" style={{ background: preset.accent }} />
                </div>
                <span className="theme-name">{preset.name}</span>
                {currentTheme === preset.name && <Check size={14} className="theme-check" />}
              </button>
            ))}
          </div>
        </div>

        <div className="theme-picker-section">
          <div className="theme-picker-section-label">Light</div>
          <div className="theme-picker-grid">
            {lightThemes.map((preset) => (
              <button
                key={preset.name}
                className={`theme-picker-item ${currentTheme === preset.name ? 'active' : ''}`}
                onClick={() => handleSelect(preset)}
                title={preset.name}
              >
                <div className="theme-preview">
                  <div className="theme-preview-bg" style={{ background: preset.bg }} />
                  <div className="theme-preview-accent" style={{ background: preset.accent }} />
                </div>
                <span className="theme-name">{preset.name}</span>
                {currentTheme === preset.name && <Check size={14} className="theme-check" />}
              </button>
            ))}
          </div>
        </div>

        {customThemes.length > 0 && (
          <div className="theme-picker-section">
            <div className="theme-picker-section-label">Custom</div>
            <div className="theme-picker-grid">
              {customThemes.map((preset) => (
                <button
                  key={preset.name}
                  className={`theme-picker-item ${currentTheme === preset.name ? 'active' : ''}`}
                  onClick={() => handleSelect(preset)}
                  title={preset.name}
                >
                  <div className="theme-preview">
                    <div className="theme-preview-bg" style={{ background: preset.bg }} />
                    <div className="theme-preview-accent" style={{ background: preset.accent }} />
                  </div>
                  <span className="theme-name">{preset.name}</span>
                  {currentTheme === preset.name && <Check size={14} className="theme-check" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <div className="theme-picker">
      <button
        ref={buttonRef}
        className="theme-picker-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Palette size={16} />
      </button>
      {dropdown}
    </div>
  );
}

function getLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0.5;
  const r = parseInt(result[1] ?? '0', 16) / 255;
  const g = parseInt(result[2] ?? '0', 16) / 255;
  const b = parseInt(result[3] ?? '0', 16) / 255;
  const linearized = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return (
    0.2126 * (linearized[0] ?? 0) + 0.7152 * (linearized[1] ?? 0) + 0.0722 * (linearized[2] ?? 0)
  );
}
