import { useMemo } from 'react';
import { Instagram, Youtube, MessageCircle, MapPin, ExternalLink, Star, Link as LinkIcon, Heart, Sparkles, Briefcase, Award, Users, Phone, Calendar, Play } from 'lucide-react';
import { FONT_FAMILIES, type BioBlock, type BioHeader, type BioTheme } from '@/lib/bio-themes';
import { supabase } from '@/integrations/supabase/client';

const ICONS: Record<string, any> = {
  star: Star, link: LinkIcon, heart: Heart, sparkles: Sparkles,
  briefcase: Briefcase, award: Award, users: Users, phone: Phone,
  calendar: Calendar, instagram: Instagram, youtube: Youtube, map: MapPin,
};

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function ButtonShell({
  theme, onClick, href, children, ariaLabel,
}: { theme: BioTheme; onClick?: () => void; href?: string; children: React.ReactNode; ariaLabel?: string }) {
  const radius = theme.button_style === 'pill' ? '9999px' : theme.button_style === 'soft' ? '14px' : '6px';
  const isOutline = theme.button_fill === 'outline';
  const isGlass = theme.button_fill === 'glass';
  const bg = isOutline ? 'transparent' : isGlass ? 'rgba(255,255,255,0.06)' : theme.card_color;
  const border = isOutline ? `1px solid ${theme.text_color}30` : isGlass ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent';
  const shadow =
    theme.button_shadow === 'glow' ? `0 8px 30px -8px ${theme.accent_color}66`
    : theme.button_shadow === 'soft' ? '0 4px 20px -8px rgba(0,0,0,0.5)'
    : 'none';
  const Comp: any = href ? 'a' : 'button';
  const props: any = href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { type: 'button', onClick };
  return (
    <Comp
      {...props}
      aria-label={ariaLabel}
      className="group block w-full text-left transition-all duration-200 hover:scale-[1.015] active:scale-[0.99] backdrop-blur-md"
      style={{ background: bg, border, borderRadius: radius, boxShadow: shadow, color: theme.text_color }}
    >
      {children}
    </Comp>
  );
}

function LinkBlock({ block, theme, onClick }: { block: BioBlock; theme: BioTheme; onClick: () => void }) {
  const Icon = ICONS[block.data.icon] || LinkIcon;
  return (
    <ButtonShell theme={theme} href={block.data.url || undefined} onClick={onClick} ariaLabel={block.data.title}>
      <div className="flex items-center gap-4 p-4">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: theme.accent_color, color: '#fff' }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: theme.text_color }}>{block.data.title}</div>
          {block.data.subtitle && (
            <div className="text-xs leading-snug mt-0.5 line-clamp-2" style={{ color: theme.muted_color }}>{block.data.subtitle}</div>
          )}
        </div>
        <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: theme.muted_color }} />
      </div>
    </ButtonShell>
  );
}

function WhatsAppBlock({ block, theme, onClick }: { block: BioBlock; theme: BioTheme; onClick: () => void }) {
  const phone = String(block.data.phone || '').replace(/\D/g, '');
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(block.data.message || '')}` : undefined;
  return (
    <ButtonShell theme={theme} href={url} onClick={onClick} ariaLabel="WhatsApp">
      <div className="flex items-center gap-4 p-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#25D366', color: '#fff' }}>
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: theme.text_color }}>{block.data.title || 'WhatsApp'}</div>
          {block.data.subtitle && <div className="text-xs mt-0.5" style={{ color: theme.muted_color }}>{block.data.subtitle}</div>}
        </div>
      </div>
    </ButtonShell>
  );
}

function VideoBlock({ block, theme }: { block: BioBlock; theme: BioTheme }) {
  const yt = block.data.url ? getYouTubeId(block.data.url) : null;
  return (
    <div
      className="w-full overflow-hidden"
      style={{ background: theme.card_color, borderRadius: theme.button_style === 'pill' ? '24px' : '14px' }}
    >
      {block.data.title && (
        <div className="px-4 pt-4 font-bold text-sm" style={{ color: theme.text_color }}>{block.data.title}</div>
      )}
      <div className="aspect-video w-full">
        {yt ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${yt}`}
            title="Vídeo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ color: theme.muted_color }}>
            <Play className="w-10 h-10" />
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryBlock({ block, theme }: { block: BioBlock; theme: BioTheme }) {
  const images: string[] = block.data.images || [];
  if (!images.length) return null;
  return (
    <div className="w-full overflow-hidden" style={{ background: theme.card_color, borderRadius: '14px' }}>
      {block.data.title && <div className="px-4 pt-4 font-bold text-sm" style={{ color: theme.text_color }}>{block.data.title}</div>}
      <div className="flex gap-2 overflow-x-auto p-3 snap-x snap-mandatory">
        {images.map((src, i) => (
          <img key={i} src={src} alt={`g-${i}`} className="h-48 w-auto rounded-lg object-cover snap-start flex-shrink-0" loading="lazy" />
        ))}
      </div>
    </div>
  );
}

function MapBlock({ block, theme, onClick }: { block: BioBlock; theme: BioTheme; onClick: () => void }) {
  const url = block.data.map_url || (block.data.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(block.data.address)}` : undefined);
  return (
    <ButtonShell theme={theme} href={url} onClick={onClick} ariaLabel="Endereço">
      <div className="flex items-center gap-4 p-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: theme.accent_color, color: '#fff' }}>
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: theme.text_color }}>{block.data.title || 'Endereço'}</div>
          {block.data.address && <div className="text-xs mt-0.5 leading-snug" style={{ color: theme.muted_color }}>{block.data.address}</div>}
        </div>
      </div>
    </ButtonShell>
  );
}

function SocialBlock({ block, theme, onClick }: { block: BioBlock; theme: BioTheme; onClick: (k: string) => void }) {
  const items: { key: string; href: string; Icon: any }[] = [];
  if (block.data.instagram) items.push({ key: 'instagram', href: `https://instagram.com/${String(block.data.instagram).replace('@', '')}`, Icon: Instagram });
  if (block.data.youtube) items.push({ key: 'youtube', href: block.data.youtube.startsWith('http') ? block.data.youtube : `https://youtube.com/@${block.data.youtube}`, Icon: Youtube });
  if (!items.length) return null;
  return (
    <div className="flex justify-center gap-3">
      {items.map((it) => (
        <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => onClick(it.key)}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          style={{ background: theme.card_color, color: theme.text_color, border: `1px solid ${theme.text_color}15` }}>
          <it.Icon className="w-5 h-5" />
        </a>
      ))}
    </div>
  );
}

function DividerBlock({ block, theme }: { block: BioBlock; theme: BioTheme }) {
  return (
    <div className="pt-4 pb-1 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: `${theme.text_color}15` }} />
      <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: theme.muted_color }}>{block.data.title}</div>
      <div className="h-px flex-1" style={{ background: `${theme.text_color}15` }} />
    </div>
  );
}

interface Props {
  theme: BioTheme;
  header: BioHeader;
  blocks: BioBlock[];
  bioPageId?: string; // when set, clicks are tracked
  fallbackName?: string;
  fallbackAvatar?: string | null;
}

export function BioRenderer({ theme, header, blocks, bioPageId, fallbackName, fallbackAvatar }: Props) {
  const fontFamily = FONT_FAMILIES[theme.font] || FONT_FAMILIES.inter;

  const bgStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = { fontFamily, color: theme.text_color };
    if (theme.background.type === 'gradient' && theme.background.color2) {
      base.background = `linear-gradient(180deg, ${theme.background.color} 0%, ${theme.background.color2} 100%)`;
    } else {
      base.background = theme.background.color;
    }
    return base;
  }, [theme, fontFamily]);

  const patternStyle = useMemo<React.CSSProperties>(() => {
    if (theme.background.pattern === 'dots') {
      return {
        backgroundImage: `radial-gradient(${theme.text_color}20 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
      };
    }
    if (theme.background.pattern === 'grid') {
      return {
        backgroundImage: `linear-gradient(${theme.text_color}10 1px, transparent 1px), linear-gradient(90deg, ${theme.text_color}10 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
      };
    }
    return {};
  }, [theme]);

  const trackClick = (blockId: string) => {
    if (!bioPageId) return;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const hash = btoa(unescape(encodeURIComponent(ua))).slice(0, 32);
    void (supabase.rpc as any)('track_bio_click', { p_bio_page_id: bioPageId, p_block_id: blockId, p_ua_hash: hash }).then(() => {}, () => {});
  };

  const name = header.name || fallbackName || '';
  const words = name.split(' ').filter(Boolean);
  const accentIdx = Math.min(Math.max(header.name_accent_word_index ?? 1, 0), Math.max(words.length - 1, 0));
  const avatar = header.avatar_url || fallbackAvatar || null;

  return (
    <div className="min-h-screen w-full relative" style={bgStyle}>
      <div className="absolute inset-0 pointer-events-none" style={patternStyle} />
      <div className="relative max-w-[480px] mx-auto px-4 pt-10 pb-16 flex flex-col items-center gap-6">
        {header.logo_url && (
          <img src={header.logo_url} alt="logo" className="h-8 w-auto object-contain" />
        )}
        {avatar && (
          <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover ring-2"
            style={{ boxShadow: `0 0 0 3px ${theme.accent_color}40, 0 10px 30px -10px ${theme.accent_color}80` }} />
        )}
        {name && (
          <h1 className="text-3xl font-extrabold text-center leading-tight" style={{ color: theme.text_color }}>
            {words.map((w, i) => (
              <span key={i} style={{ color: i === accentIdx ? theme.accent_color : theme.text_color }}>
                {w}{i < words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
        )}
        {header.bio && (
          <p className="text-center text-sm leading-relaxed max-w-xs" style={{ color: theme.muted_color }}>
            {header.bio}
          </p>
        )}

        <div className="w-full flex flex-col gap-3 mt-2">
          {blocks.filter((b) => b.enabled).map((b) => {
            switch (b.type) {
              case 'link': return <LinkBlock key={b.id} block={b} theme={theme} onClick={() => trackClick(b.id)} />;
              case 'whatsapp': return <WhatsAppBlock key={b.id} block={b} theme={theme} onClick={() => trackClick(b.id)} />;
              case 'video': return <VideoBlock key={b.id} block={b} theme={theme} />;
              case 'gallery': return <GalleryBlock key={b.id} block={b} theme={theme} />;
              case 'map': return <MapBlock key={b.id} block={b} theme={theme} onClick={() => trackClick(b.id)} />;
              case 'social': return <SocialBlock key={b.id} block={b} theme={theme} onClick={(k) => trackClick(`${b.id}:${k}`)} />;
              case 'divider': return <DividerBlock key={b.id} block={b} theme={theme} />;
              default: return null;
            }
          })}
        </div>

        <div className="mt-10 text-[11px]" style={{ color: theme.muted_color }}>
          © Top Brasil. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
