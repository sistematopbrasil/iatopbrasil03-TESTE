import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Copy, ExternalLink, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBioPage, uploadBioAsset } from '@/hooks/useBioPage';
import { THEME_PRESETS, newBlock, type BioBlock, type BioBlockType, type BioHeader, type BioTheme } from '@/lib/bio-themes';
import { BioRenderer } from '@/components/bio/BioRenderer';

const BLOCK_LABELS: Record<BioBlockType, string> = {
  link: 'Botão de link', whatsapp: 'WhatsApp', video: 'Vídeo (YouTube)',
  gallery: 'Galeria de fotos', map: 'Endereço / Mapa', social: 'Redes sociais', divider: 'Divisor de seção',
};

interface Props {
  userId: string;
  organizationId: string;
  fullName: string;
  username: string | null;
}

export function BioEditor({ userId, organizationId, fullName, username }: Props) {
  const { query, ensureMutation, saveMutation } = useBioPage(userId, organizationId, fullName);
  const [theme, setTheme] = useState<BioTheme>(THEME_PRESETS[0].theme);
  const [header, setHeader] = useState<BioHeader>({ logo_url: null, avatar_url: null, name: fullName, name_accent_word_index: 1, bio: '', show_socials_inline: false });
  const [blocks, setBlocks] = useState<BioBlock[]>([]);
  const [published, setPublished] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (query.data) {
      setTheme(query.data.theme || THEME_PRESETS[0].theme);
      setHeader(query.data.header);
      setBlocks(query.data.blocks || []);
      setPublished(query.data.is_published);
    }
  }, [query.data]);

  const bioUrl = useMemo(() => username ? `${window.location.origin}/bio/${username}` : null, [username]);

  if (query.isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!query.data) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Você ainda não tem uma página de Link na Bio.</p>
        <Button onClick={() => ensureMutation.mutate()} disabled={ensureMutation.isPending}>
          {ensureMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Criar minha página
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    saveMutation.mutate({ theme, header, blocks, is_published: published }, {
      onSuccess: () => toast.success('Página salva!'),
      onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...blocks]; const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };
  const remove = (i: number) => setBlocks(blocks.filter((_, idx) => idx !== i));
  const add = (type: BioBlockType) => setBlocks([...blocks, newBlock(type)]);
  const patch = (i: number, data: any) => setBlocks(blocks.map((b, idx) => idx === i ? { ...b, data: { ...b.data, ...data } } : b));
  const toggle = (i: number) => setBlocks(blocks.map((b, idx) => idx === i ? { ...b, enabled: !b.enabled } : b));

  const onAvatarUpload = async (file: File) => {
    try {
      setUploadingAvatar(true);
      const url = await uploadBioAsset(userId, file);
      setHeader({ ...header, avatar_url: url });
      toast.success('Foto atualizada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar imagem');
    } finally { setUploadingAvatar(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
      {/* Editor */}
      <div className="space-y-6 min-w-0">
        {/* URL + ações */}
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Link na Bio</CardTitle>
              <CardDescription>Sua página pessoal estilo linktree</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={published} onCheckedChange={setPublished} />
              <Label className="text-xs">{published ? 'Publicada' : 'Rascunho'}</Label>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {bioUrl && (
              <div className="flex items-center gap-2">
                <Input readOnly value={bioUrl} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(bioUrl); toast.success('Copiado!'); }}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => window.open(bioUrl, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            )}
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>

        {/* Tema */}
        <Card>
          <CardHeader><CardTitle className="text-base">Aparência</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-2 block">Paleta</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => setTheme(p.theme)}
                    className={`rounded-lg p-3 text-xs font-semibold border transition ${theme.preset === p.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                    style={{ background: p.theme.background.color, color: p.theme.text_color }}>
                    <div className="flex gap-1 mb-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: p.theme.accent_color }} />
                      <span className="w-3 h-3 rounded-full" style={{ background: p.theme.card_color }} />
                      <span className="w-3 h-3 rounded-full" style={{ background: p.theme.text_color }} />
                    </div>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cor de destaque</Label>
                <Input type="color" value={theme.accent_color} onChange={(e) => setTheme({ ...theme, accent_color: e.target.value })} className="h-10" />
              </div>
              <div>
                <Label className="text-xs">Cor de fundo</Label>
                <Input type="color" value={theme.background.color} onChange={(e) => setTheme({ ...theme, background: { ...theme.background, color: e.target.value } })} className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Cantos</Label>
                <Select value={theme.button_style} onValueChange={(v: any) => setTheme({ ...theme, button_style: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">Reto</SelectItem>
                    <SelectItem value="soft">Suave</SelectItem>
                    <SelectItem value="pill">Pílula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estilo</Label>
                <Select value={theme.button_fill} onValueChange={(v: any) => setTheme({ ...theme, button_fill: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Sólido</SelectItem>
                    <SelectItem value="outline">Contorno</SelectItem>
                    <SelectItem value="glass">Vidro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fonte</Label>
                <Select value={theme.font} onValueChange={(v: any) => setTheme({ ...theme, font: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter</SelectItem>
                    <SelectItem value="playfair">Playfair</SelectItem>
                    <SelectItem value="space-grotesk">Space Grotesk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Padrão de fundo</Label>
              <Select value={theme.background.pattern || 'none'} onValueChange={(v: any) => setTheme({ ...theme, background: { ...theme.background, pattern: v } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="dots">Pontos</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cabeçalho */}
        <Card>
          <CardHeader><CardTitle className="text-base">Cabeçalho</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {header.avatar_url && <img src={header.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAvatarUpload(f); }} />
                <Button type="button" variant="outline" disabled={uploadingAvatar} asChild>
                  <span>{uploadingAvatar ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Foto</span>
                </Button>
              </label>
              {header.avatar_url && (
                <Button variant="ghost" size="sm" onClick={() => setHeader({ ...header, avatar_url: null })}>Remover</Button>
              )}
            </div>
            <div>
              <Label className="text-xs">Nome em destaque</Label>
              <Input value={header.name} onChange={(e) => setHeader({ ...header, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Qual palavra do nome ganha cor de destaque?</Label>
              <Input type="number" min={0} value={header.name_accent_word_index}
                onChange={(e) => setHeader({ ...header, name_accent_word_index: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Bio curta</Label>
              <Textarea value={header.bio} onChange={(e) => setHeader({ ...header, bio: e.target.value })} rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Blocos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blocos</CardTitle>
            <CardDescription>Reordene, ative ou desative cada bloco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blocks.map((b, i) => (
              <div key={b.id} className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{BLOCK_LABELS[b.type]}</div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => toggle(i)}>{b.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-40" />}</Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>

                {(b.type === 'link' || b.type === 'whatsapp' || b.type === 'video' || b.type === 'map') && (
                  <Input placeholder="Título" value={b.data.title || ''} onChange={(e) => patch(i, { title: e.target.value })} />
                )}
                {(b.type === 'link' || b.type === 'whatsapp' || b.type === 'map') && (
                  <Input placeholder="Subtítulo (opcional)" value={b.data.subtitle || ''} onChange={(e) => patch(i, { subtitle: e.target.value })} />
                )}
                {b.type === 'link' && (
                  <Input placeholder="URL (https://...)" value={b.data.url || ''} onChange={(e) => patch(i, { url: e.target.value })} />
                )}
                {b.type === 'whatsapp' && (
                  <>
                    <Input placeholder="Telefone com DDI (ex: 5511999999999)" value={b.data.phone || ''} onChange={(e) => patch(i, { phone: e.target.value })} />
                    <Input placeholder="Mensagem inicial" value={b.data.message || ''} onChange={(e) => patch(i, { message: e.target.value })} />
                  </>
                )}
                {b.type === 'video' && (
                  <Input placeholder="URL do YouTube" value={b.data.url || ''} onChange={(e) => patch(i, { url: e.target.value })} />
                )}
                {b.type === 'map' && (
                  <>
                    <Input placeholder="Endereço" value={b.data.address || ''} onChange={(e) => patch(i, { address: e.target.value })} />
                    <Input placeholder="Link Google Maps (opcional)" value={b.data.map_url || ''} onChange={(e) => patch(i, { map_url: e.target.value })} />
                  </>
                )}
                {b.type === 'social' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Instagram (@)" value={b.data.instagram || ''} onChange={(e) => patch(i, { instagram: e.target.value })} />
                    <Input placeholder="YouTube (URL ou @)" value={b.data.youtube || ''} onChange={(e) => patch(i, { youtube: e.target.value })} />
                  </div>
                )}
                {b.type === 'divider' && (
                  <Input placeholder="Título da seção" value={b.data.title || ''} onChange={(e) => patch(i, { title: e.target.value })} />
                )}
                {b.type === 'gallery' && (
                  <div className="space-y-2">
                    <label className="block">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        try { const url = await uploadBioAsset(userId, f); patch(i, { images: [...(b.data.images || []), url] }); }
                        catch (err: any) { toast.error(err?.message || 'Erro'); }
                      }} />
                      <Button type="button" variant="outline" size="sm" asChild><span><Upload className="w-3 h-3 mr-2" />Adicionar imagem</span></Button>
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(b.data.images || []).map((src: string, idx: number) => (
                        <div key={idx} className="relative">
                          <img src={src} className="w-16 h-16 rounded object-cover" />
                          <button onClick={() => patch(i, { images: b.data.images.filter((_: any, k: number) => k !== idx) })}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {(['link', 'whatsapp', 'video', 'gallery', 'map', 'social', 'divider'] as BioBlockType[]).map((t) => (
                <Button key={t} variant="outline" size="sm" onClick={() => add(t)}>
                  <Plus className="w-3 h-3 mr-1" />{BLOCK_LABELS[t]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-4 h-fit">
        <Card className="overflow-hidden">
          <CardHeader className="py-3"><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[80vh] overflow-y-auto">
              <div className="scale-[0.85] origin-top">
                <BioRenderer theme={theme} header={header} blocks={blocks} fallbackName={fullName} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
