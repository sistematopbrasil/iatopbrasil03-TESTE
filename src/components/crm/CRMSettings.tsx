import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Tag, Settings as SettingsIcon, X, MessageSquare } from 'lucide-react';
import { QuickRepliesManager } from './QuickRepliesManager';
import { TagsManager } from './TagsManager';
import { WhatsAppConnectionSettings } from './WhatsAppConnectionSettings';

interface CRMSettingsProps {
  onClose: () => void;
}

export function CRMSettings({ onClose }: CRMSettingsProps) {
  return (
    <Card className="glass-card h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Configurações do CRM</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="quick-replies">
          <TabsList className="glass w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="quick-replies" className="gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Respostas</span>
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Tags</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick-replies">
            <QuickRepliesManager />
          </TabsContent>

          <TabsContent value="tags">
            <TagsManager />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppConnectionSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
