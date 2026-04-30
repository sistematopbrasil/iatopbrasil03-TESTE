import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_BLOCKS, THEME_PRESETS, type BioBlock, type BioHeader, type BioTheme } from '@/lib/bio-themes';

export interface BioPage {
  id: string;
  user_id: string;
  organization_id: string;
  is_published: boolean;
  theme: BioTheme;
  header: BioHeader;
  blocks: BioBlock[];
  seo: { title?: string; description?: string };
}

export function useBioPage(userId: string | undefined, organizationId: string | undefined, fullName: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['bio-page', userId],
    enabled: !!userId,
    queryFn: async (): Promise<BioPage | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('bio_pages' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) || null;
    },
  });

  const ensureMutation = useMutation({
    mutationFn: async (): Promise<BioPage> => {
      if (!userId || !organizationId) throw new Error('Sessão inválida');
      const defaultTheme = THEME_PRESETS[0].theme;
      const defaultHeader: BioHeader = {
        logo_url: null,
        avatar_url: null,
        name: fullName || '',
        name_accent_word_index: fullName?.split(' ').length > 1 ? 1 : 0,
        bio: 'Já são milhares de vidas transformadas. A próxima pode ser a sua.',
        show_socials_inline: false,
      };
      const { data, error } = await supabase
        .from('bio_pages' as any)
        .insert({
          user_id: userId,
          organization_id: organizationId,
          is_published: true,
          theme: defaultTheme,
          header: defaultHeader,
          blocks: DEFAULT_BLOCKS,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bio-page', userId] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<BioPage>) => {
      if (!query.data?.id) throw new Error('Página não inicializada');
      const { error } = await supabase
        .from('bio_pages' as any)
        .update(patch as any)
        .eq('id', query.data.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bio-page', userId] }),
  });

  return { query, ensureMutation, saveMutation };
}

export async function uploadBioAsset(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('bio-assets').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('bio-assets').getPublicUrl(path);
  return data.publicUrl;
}
