import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BioRenderer } from '@/components/bio/BioRenderer';
import type { BioBlock, BioHeader, BioTheme } from '@/lib/bio-themes';
import { THEME_PRESETS } from '@/lib/bio-themes';

interface BioRow {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  profile_photo: string | null;
  is_published: boolean;
  theme: BioTheme;
  header: BioHeader;
  blocks: BioBlock[];
  seo: { title?: string; description?: string };
}

export default function BioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<BioRow | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found'>('loading');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!slug) { setStatus('not_found'); return; }
      const { data: rows, error } = await (supabase.rpc as any)('get_bio_by_slug', { p_slug: slug });
      if (!active) return;
      if (error || !rows || !rows.length) { setStatus('not_found'); return; }
      setData(rows[0] as BioRow);
      setStatus('ready');
    }
    void load();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    const title = data.seo?.title || `${data.full_name} | Top Brasil`;
    const desc = data.seo?.description || data.header?.bio || '';
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc.slice(0, 160));
  }, [data]);

  if (status === 'loading') {
    return <div className="min-h-screen w-full bg-[#0D0D0D]" />;
  }
  if (status === 'not_found' || !data) {
    return (
      <div className="min-h-screen w-full bg-[#0D0D0D] text-white flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Página não encontrada</h1>
          <p className="text-sm text-zinc-400 mt-2">Verifique o link ou peça um novo ao consultor.</p>
        </div>
      </div>
    );
  }

  const theme = (data.theme && (data.theme as any).preset) ? data.theme : THEME_PRESETS[0].theme;
  const header: BioHeader = {
    ...data.header,
    name: data.header?.name || data.full_name,
    avatar_url: data.header?.avatar_url || data.profile_photo,
  };

  return (
    <BioRenderer
      theme={theme}
      header={header}
      blocks={data.blocks || []}
      bioPageId={data.id}
      fallbackName={data.full_name}
      fallbackAvatar={data.profile_photo}
    />
  );
}
