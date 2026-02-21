import { useState, useRef, useEffect, useCallback } from "react";
import { Campaign } from "@/hooks/useAccountCampaigns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-traffic-chat`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_SUGGESTIONS = [
  "Analise a campanha com melhor CTR",
  "Qual campanha está com CPC muito alto?",
  "Sugira um novo público para tráfego",
  "Crie um briefing de campanha de conversão",
];

interface TrafficAIChatProps {
  accountName: string;
  adAccountId: string;
  campaigns: Campaign[];
  metricsSummary?: Record<string, number>;
  organizationId?: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 rounded text-xs'>$1</code>")
    .replace(/^### (.*)/gm, "<h3 class='font-semibold text-sm mt-2 mb-1'>$1</h3>")
    .replace(/^## (.*)/gm, "<h2 class='font-bold text-sm mt-3 mb-1'>$1</h2>")
    .replace(/^# (.*)/gm, "<h1 class='font-bold mt-3 mb-1'>$1</h1>")
    .replace(/^- (.*)/gm, "<li class='ml-4 list-disc text-sm'>$1</li>")
    .replace(/^\d+\. (.*)/gm, "<li class='ml-4 list-decimal text-sm'>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

export function TrafficAIChat({ accountName, adAccountId, campaigns, metricsSummary, organizationId }: TrafficAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load persisted messages from DB
  const { data: savedConv } = useQuery({
    queryKey: ["traffic-ai-conv", organizationId, adAccountId],
    queryFn: async () => {
      if (!organizationId || !adAccountId) return null;
      const { data } = await supabase
        .from("traffic_ai_conversations" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .eq("ad_account_id", adAccountId)
        .maybeSingle();
      return data;
    },
    enabled: !!organizationId && !!adAccountId,
  });

  // Initialize messages from DB once
  useEffect(() => {
    if (savedConv && !initialized) {
      const saved = (savedConv as any)?.messages;
      if (Array.isArray(saved) && saved.length > 0) {
        setMessages(saved as Message[]);
      }
      setInitialized(true);
    } else if (!savedConv && !initialized && organizationId && adAccountId) {
      setInitialized(true);
    }
  }, [savedConv, initialized, organizationId, adAccountId]);

  // Reset when account changes
  useEffect(() => {
    setInitialized(false);
    setMessages([]);
  }, [adAccountId]);

  // Save messages to DB
  const persistMessages = useCallback(async (msgs: Message[]) => {
    if (!organizationId || !adAccountId) return;
    try {
      await supabase
        .from("traffic_ai_conversations" as any)
        .upsert({
          organization_id: organizationId,
          ad_account_id: adAccountId,
          messages: msgs as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,ad_account_id" } as any);
    } catch (e) {
      console.error("Failed to persist AI conversation:", e);
    }
  }, [organizationId, adAccountId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantText = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          account_name: accountName,
          ad_account_id: adAccountId,
          campaigns_data: campaigns,
          metrics_summary: metricsSummary,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          toast({ title: "Limite atingido", description: errData.error || "Tente novamente em instantes.", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "Créditos insuficientes", description: errData.error || "Adicione créditos ao workspace.", variant: "destructive" });
        } else {
          toast({ title: "Erro na IA", description: errData.error || "Erro ao conectar.", variant: "destructive" });
        }
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantText += content;
              const snapshot = assistantText;
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 && m.role === "assistant" ? { ...m, content: snapshot } : m
              ));
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Persist complete conversation
      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantText }];
      setMessages(finalMessages);
      await persistMessages(finalMessages);
    } catch (e) {
      console.error("AI chat error:", e);
      toast({ title: "Erro", description: "Falha na comunicação com a IA.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, accountName, adAccountId, campaigns, metricsSummary, toast, persistMessages]);

  const clearConversation = useCallback(async () => {
    setMessages([]);
    if (organizationId && adAccountId) {
      await supabase
        .from("traffic_ai_conversations" as any)
        .delete()
        .eq("organization_id", organizationId)
        .eq("ad_account_id", adAccountId);
      queryClient.invalidateQueries({ queryKey: ["traffic-ai-conv", organizationId, adAccountId] });
    }
  }, [organizationId, adAccountId, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full border border-border/60 rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/60 bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-tight">Assistente IA</p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{accountName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5 border-primary/20 text-primary">
            <Sparkles className="h-2.5 w-2.5 mr-1" />
            Especialista em Ads
          </Badge>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearConversation} title="Limpar conversa">
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Olá! Sou seu especialista em Meta Ads. Tenho acesso a todos os dados desta conta. Como posso ajudar?
            </p>
            <div className="space-y-1.5">
              {QUICK_SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:bg-muted/50 hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground border border-border/40"}`}>
                  {msg.role === "assistant" ? (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || "…") }} />
                  ) : msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-start gap-1.5">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted/60 rounded-lg px-3 py-2 border border-border/40">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t border-border/60 bg-background flex-shrink-0">
        <div className="flex items-end gap-2">
          <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Pergunte sobre campanhas, métricas ou peça análises..." className="min-h-[60px] max-h-[120px] text-xs resize-none" disabled={isLoading} />
          <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
