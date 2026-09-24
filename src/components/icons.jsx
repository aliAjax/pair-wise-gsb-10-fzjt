// 设备类型图标（页面展示用）
export function TypeIcon({ type, className = '' }) {
  const glyph =
    type === 'router' ? '◉' : type === 'switch' ? '▦' : type === 'server' ? '▣' : '▱';
  return <i className={className}>{glyph}</i>;
}

export const TYPE_GLYPH = (type) =>
  type === 'router' ? '◉' : type === 'switch' ? '▦' : type === 'server' ? '▣' : '▱';
