import { useState } from 'react';
import { Eye, EyeOff, Save, Trash2, Loader2, Database, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  IntegrationCategory,
  IntegrationMetadata,
  revealIntegrationValue,
  useClearIntegrationValue,
  useSaveIntegrationValue,
} from '@/hooks/useIntegrationSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  definition: {
    key: string;
    category: IntegrationCategory;
    label: string;
    description: string;
    is_secret: boolean;
    placeholder?: string;
  };
  metadata?: IntegrationMetadata;
}

export const IntegrationField = ({ definition, metadata }: Props) => {
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const saveMut = useSaveIntegrationValue();
  const clearMut = useClearIntegrationValue();

  const hasValue = metadata?.has_value === true;
  const isDirty = value.length > 0;

  const handleReveal = async () => {
    if (revealed) {
      setRevealed(false);
      setValue('');
      return;
    }
    setRevealing(true);
    try {
      const v = await revealIntegrationValue(definition.key);
      if (v === null) {
        toast.info('Sem valor salvo no banco — em uso o valor de ambiente.');
        setRevealing(false);
        return;
      }
      setValue(v);
      setRevealed(true);
    } catch (e: any) {
      toast.error(`Não foi possível revelar: ${e.message}`);
    } finally {
      setRevealing(false);
    }
  };

  const handleSave = () => {
    if (!value.trim()) {
      toast.error('Digite um valor antes de salvar.');
      return;
    }
    saveMut.mutate(
      {
        key: definition.key,
        value: value.trim(),
        category: definition.category,
        is_secret: definition.is_secret,
        description: definition.description,
      },
      {
        onSuccess: () => {
          setValue('');
          setRevealed(false);
        },
      },
    );
  };

  const handleClear = () => {
    clearMut.mutate(definition.key, {
      onSuccess: () => {
        setValue('');
        setRevealed(false);
      },
    });
  };

  const updatedAtLabel = metadata?.updated_at
    ? format(new Date(metadata.updated_at), "dd/MM/yyyy 'às' HH:mm", {
        locale: ptBR,
      })
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-sm font-semibold text-foreground">
              {definition.label}
            </Label>
            <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
              {definition.key}
            </code>
            {hasValue ? (
              <Badge variant="default" className="gap-1 text-xs">
                <Database className="h-3 w-3" /> Banco
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Server className="h-3 w-3" /> Padrão (env)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{definition.description}</p>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input
          type={definition.is_secret && !revealed ? 'password' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            hasValue
              ? '•••••••• (clique em revelar para editar)'
              : definition.placeholder ?? 'Digite o valor...'
          }
          className="flex-1 min-w-[200px] font-mono text-xs"
        />
        {definition.is_secret && hasValue && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleReveal}
            disabled={revealing}
            title={revealed ? 'Ocultar valor' : 'Revelar valor (gera log de auditoria)'}
          >
            {revealing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : revealed ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saveMut.isPending}
          size="sm"
          className="gap-1"
        >
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar
        </Button>
        {hasValue && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={clearMut.isPending}
                title="Remover valor do banco (volta para variável de ambiente)"
              >
                {clearMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover valor de {definition.label}?</AlertDialogTitle>
                <AlertDialogDescription>
                  O valor será apagado do banco. O sistema voltará a usar a variável
                  de ambiente (se configurada). Caso contrário, integrações que
                  dependem desta chave deixarão de funcionar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {updatedAtLabel && (
        <p className="text-[11px] text-muted-foreground">
          Atualizado em {updatedAtLabel}
          {metadata?.updated_by_name ? ` por ${metadata.updated_by_name}` : ''}
        </p>
      )}
    </div>
  );
};
