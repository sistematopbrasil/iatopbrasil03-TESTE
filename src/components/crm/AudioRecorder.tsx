import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, Square, Send, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AudioRecorderProps {
  conversationId: string;
  onSend: (type: 'audio', content: string, mediaUrl: string, fileName: string) => Promise<boolean | { success: boolean; needsReconnect?: boolean }>;
  onCancel: () => void;
  isSending: boolean;
}

export function AudioRecorder({ conversationId, onSend, onCancel, isSending }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // Tentar usar formato compatível com WhatsApp
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Parar todas as tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100); // Chunks a cada 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer para mostrar duração
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error: any) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao acessar microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
  };

  const handleSend = async () => {
    if (!audioBlob || isUploading || isSending) return;
    
    setIsUploading(true);
    
    try {
      const extension = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `audio_${Date.now()}.${extension}`;
      const filePath = `${conversationId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('crm-media')
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type,
          upsert: false,
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('crm-media')
        .getPublicUrl(filePath);
      
      const success = await onSend('audio', '', urlData.publicUrl, fileName);
      
      if (success) {
        toast.success('Áudio enviado!');
        onCancel(); // Fecha o recorder
      }
    } catch (error: any) {
      console.error('Error sending audio:', error);
      toast.error(error.message || 'Erro ao enviar áudio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDiscard = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    onCancel();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="glass p-4 border-primary/20 animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-4">
        {/* Recording indicator or audio preview */}
        <div className="flex-1 flex items-center gap-3">
          {isRecording ? (
            <>
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                Gravando... {formatTime(recordingTime)}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary animate-pulse" 
                  style={{ width: `${Math.min(recordingTime * 2, 100)}%` }}
                />
              </div>
            </>
          ) : audioUrl ? (
            <>
              <audio src={audioUrl} controls className="flex-1 h-10" />
              <span className="text-xs text-muted-foreground">
                {formatTime(recordingTime)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Clique no microfone para gravar
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              Parar
            </Button>
          ) : audioUrl ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isUploading || isSending}
                className="gap-2 bg-gradient-to-r from-primary to-primary-light"
              >
                {isUploading || isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={startRecording}
                className="gap-2"
              >
                <Mic className="w-4 h-4" />
                Gravar
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}