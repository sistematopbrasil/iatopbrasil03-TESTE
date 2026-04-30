// Presets visuais para a página "Top Bio"
export type BioBlockType =
  | 'link'
  | 'whatsapp'
  | 'video'
  | 'gallery'
  | 'map'
  | 'social'
  | 'divider';

export interface BioBlock {
  id: string;
  type: BioBlockType;
  enabled: boolean;
  data: any;
}

export type BioFont =
  | 'inter'
  | 'playfair'
  | 'space-grotesk'
  | 'dm-serif'
  | 'bebas'
  | 'poppins'
  | 'lora'
  | 'manrope'
  | 'archivo-black'
  | 'instrument-serif';

export interface BioTheme {
  preset: string;
  background: { type: 'solid' | 'gradient'; color: string; color2?: string; pattern?: 'none' | 'dots' | 'grid' };
  card_color: string;
  text_color: string;
  muted_color: string;
  accent_color: string;
  button_style: 'square' | 'soft' | 'pill';
  button_fill: 'solid' | 'outline' | 'glass';
  button_shadow: 'none' | 'soft' | 'glow';
  font: BioFont;
}

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded' | 'square';
export type AvatarPosition = 'center' | 'left';
export type AvatarBorder = 'none' | 'thin' | 'thick' | 'glow';

export interface BioHeader {
  logo_url: string | null;
  avatar_url: string | null;
  name: string;
  name_accent_word_index: number;
  bio: string;
  show_socials_inline: boolean;
  avatar_size?: AvatarSize;
  avatar_shape?: AvatarShape;
  avatar_position?: AvatarPosition;
  avatar_border?: AvatarBorder;
  avatar_border_color?: string | null;
}

export const THEME_PRESETS: { id: string; label: string; theme: BioTheme }[] = [
  {
    id: 'topbrasil',
    label: 'Top Brasil',
    theme: {
      preset: 'topbrasil',
      background: { type: 'solid', color: '#0D0D0D', pattern: 'dots' },
      card_color: '#161616', text_color: '#FFFFFF', muted_color: '#A1A1AA', accent_color: '#EB6608',
      button_style: 'soft', button_fill: 'solid', button_shadow: 'soft', font: 'inter',
    },
  },
  {
    id: 'dark-minimal', label: 'Dark Minimal',
    theme: {
      preset: 'dark-minimal',
      background: { type: 'solid', color: '#000000', pattern: 'none' },
      card_color: '#0F0F0F', text_color: '#F5F5F5', muted_color: '#71717A', accent_color: '#FFFFFF',
      button_style: 'pill', button_fill: 'outline', button_shadow: 'none', font: 'space-grotesk',
    },
  },
  {
    id: 'editorial', label: 'Editorial',
    theme: {
      preset: 'editorial',
      background: { type: 'solid', color: '#0A0A0A', pattern: 'none' },
      card_color: '#141414', text_color: '#F5F0E6', muted_color: '#9CA3AF', accent_color: '#D4A24C',
      button_style: 'square', button_fill: 'solid', button_shadow: 'soft', font: 'playfair',
    },
  },
  {
    id: 'light', label: 'Claro',
    theme: {
      preset: 'light',
      background: { type: 'solid', color: '#F8F8F5', pattern: 'dots' },
      card_color: '#FFFFFF', text_color: '#0D0D0D', muted_color: '#52525B', accent_color: '#EB6608',
      button_style: 'soft', button_fill: 'solid', button_shadow: 'soft', font: 'inter',
    },
  },
  {
    id: 'sunset', label: 'Sunset',
    theme: {
      preset: 'sunset',
      background: { type: 'gradient', color: '#1a0a05', color2: '#3a1810', pattern: 'none' },
      card_color: 'rgba(255,255,255,0.05)', text_color: '#FFFFFF', muted_color: '#D4B5A0', accent_color: '#FF8540',
      button_style: 'pill', button_fill: 'glass', button_shadow: 'glow', font: 'space-grotesk',
    },
  },
  {
    id: 'ocean', label: 'Ocean',
    theme: {
      preset: 'ocean',
      background: { type: 'gradient', color: '#06121F', color2: '#0F2A4A', pattern: 'dots' },
      card_color: 'rgba(255,255,255,0.06)', text_color: '#F0F8FF', muted_color: '#90B5D4', accent_color: '#3EA5FF',
      button_style: 'soft', button_fill: 'glass', button_shadow: 'glow', font: 'inter',
    },
  },
];

export const FONT_FAMILIES: Record<BioFont, string> = {
  inter: "'Inter', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  'space-grotesk': "'Space Grotesk', system-ui, sans-serif",
  'dm-serif': "'DM Serif Display', Georgia, serif",
  bebas: "'Bebas Neue', Impact, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  lora: "'Lora', Georgia, serif",
  manrope: "'Manrope', system-ui, sans-serif",
  'archivo-black': "'Archivo Black', Impact, sans-serif",
  'instrument-serif': "'Instrument Serif', Georgia, serif",
};

export const FONT_OPTIONS: { id: BioFont; label: string; sample: string }[] = [
  { id: 'inter', label: 'Inter', sample: 'Moderno' },
  { id: 'manrope', label: 'Manrope', sample: 'Limpo' },
  { id: 'poppins', label: 'Poppins', sample: 'Amigável' },
  { id: 'space-grotesk', label: 'Space Grotesk', sample: 'Tech' },
  { id: 'playfair', label: 'Playfair', sample: 'Elegante' },
  { id: 'dm-serif', label: 'DM Serif', sample: 'Display' },
  { id: 'instrument-serif', label: 'Instrument', sample: 'Editorial' },
  { id: 'lora', label: 'Lora', sample: 'Clássico' },
  { id: 'bebas', label: 'Bebas Neue', sample: 'IMPACTO' },
  { id: 'archivo-black', label: 'Archivo Black', sample: 'BOLD' },
];

// Catálogo de ícones disponíveis (mapeados em BioRenderer)
export const ICON_KEYS = [
  'star', 'heart', 'sparkles', 'crown', 'flame', 'zap',
  'link', 'globe', 'external', 'rocket',
  'briefcase', 'award', 'trophy', 'target', 'trending',
  'users', 'user', 'phone', 'mail', 'message',
  'calendar', 'clock', 'map', 'home', 'shield',
  'shopping', 'gift', 'dollar', 'credit',
  'instagram', 'youtube', 'music', 'video', 'camera',
  'book', 'graduation', 'play', 'download', 'check',
] as const;

export type BioIconKey = typeof ICON_KEYS[number];

export function suggestIcon(title: string): BioIconKey {
  const t = (title || '').toLowerCase();
  if (/whats|wpp|chat|mensagem|conversa/.test(t)) return 'message';
  if (/insta/.test(t)) return 'instagram';
  if (/you ?tube|video|vlog/.test(t)) return 'youtube';
  if (/curso|aula|treinamento|escola/.test(t)) return 'graduation';
  if (/agend|calend|consult|reuni/.test(t)) return 'calendar';
  if (/loja|comprar|compra|produto|carrinho/.test(t)) return 'shopping';
  if (/pres|brinde|bonus|gift|oferta/.test(t)) return 'gift';
  if (/cot|or[çc]amento|simul/.test(t)) return 'dollar';
  if (/segur|prote[cç]/.test(t)) return 'shield';
  if (/livro|ebook|pdf/.test(t)) return 'book';
  if (/email|e-mail/.test(t)) return 'mail';
  if (/site|website|web|page|p[aá]gina/.test(t)) return 'globe';
  if (/local|endere|mapa/.test(t)) return 'map';
  if (/foto/.test(t)) return 'camera';
  if (/musica|spotify|playlist/.test(t)) return 'music';
  if (/baixar|download|app/.test(t)) return 'download';
  if (/consultor|time|equipe|trabalh/.test(t)) return 'briefcase';
  if (/premio|trofeu|conquista|award/.test(t)) return 'trophy';
  if (/destaque|favor|melhor/.test(t)) return 'star';
  return 'star';
}

export const DEFAULT_BLOCKS: BioBlock[] = [
  {
    id: 'b-link-1', type: 'link', enabled: true,
    data: { title: 'Quero ser consultor da Top Brasil!', subtitle: 'Entre para o time que mais cresce', url: '', icon: 'star' },
  },
  {
    id: 'b-wpp-1', type: 'whatsapp', enabled: true,
    data: { title: 'Falar no WhatsApp', subtitle: 'Atendimento rápido', phone: '', message: 'Olá! Vim pelo seu link na bio.' },
  },
];

export function newBlock(type: BioBlockType): BioBlock {
  const id = `b-${type}-${Math.random().toString(36).slice(2, 8)}`;
  switch (type) {
    case 'link':
      return { id, type, enabled: true, data: { title: 'Novo link', subtitle: '', url: '', icon: 'link' } };
    case 'whatsapp':
      return { id, type, enabled: true, data: { title: 'WhatsApp', subtitle: '', phone: '', message: 'Olá!' } };
    case 'video':
      return { id, type, enabled: true, data: { title: 'Vídeo', url: '' } };
    case 'gallery':
      return { id, type, enabled: true, data: { title: '', images: [] } };
    case 'map':
      return { id, type, enabled: true, data: { title: 'Endereço', address: '', map_url: '' } };
    case 'social':
      return { id, type, enabled: true, data: { instagram: '', tiktok: '', youtube: '', threads: '', facebook: '' } };
    case 'divider':
      return { id, type, enabled: true, data: { title: 'Seção' } };
  }
}
