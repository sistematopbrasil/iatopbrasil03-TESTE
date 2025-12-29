import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Tag, Settings as SettingsIcon, X, MessageSquare } from 'lucide-react';
import { QuickRepliesManager } from './QuickRepliesManager';
import { TagsManager } from './TagsManager';
import { WhatsAppConnectionSettings } from './WhatsAppConnectionSettings';

interface CRMSettingsProps {
  onClose: () => void;
  onOpenConversations?: () => void;
}

export function CRMSettings({ onClose, onOpenConversations }: CRMSettingsProps) {
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <Tabs defaultValue="quick-replies" className="w-full max-w-full">
          <TabsList className="glass w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="quick-replies" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Respostas</span>
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2">
              <Tag className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Tags</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick-replies" className="overflow-x-hidden">
            <QuickRepliesManager />
          </TabsContent>

          <TabsContent value="tags" className="overflow-x-hidden">
            <TagsManager />
          </TabsContent>

          <TabsContent value="whatsapp" className="overflow-x-hidden">
            <WhatsAppConnectionSettings onOpenConversations={onOpenConversations} />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
