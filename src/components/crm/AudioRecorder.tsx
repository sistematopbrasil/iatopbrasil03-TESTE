import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, Square, Send, Trash2, Loader2, Play, Pause, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Generate waveform animation while recording
  useEffect(() => {
    if (isRecording) {
      const generateBars = () => {
        setWaveformBars(prev => {
          const newBars = [...prev, Math.random() * 100];
          if (newBars.length > 40) newBars.shift();
          return newBars;
        });
      };
      const interval = setInterval(generateBars, 100);
      return () => clearInterval(interval);
    } else {
      setWaveformBars([]);
    }
  }, [isRecording]);

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
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Get duration
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          setAudioDuration(audio.duration);
        };
        
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

  const handlePlayPause = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl!);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setPlaybackProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('Arquivo muito grande! Máximo 16MB');
      return;
    }

    const blob = file;
    const url = URL.createObjectURL(file);
    setAudioBlob(blob);
    setAudioUrl(url);

    // Get duration
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration);
      setRecordingTime(Math.floor(audio.duration));
    };
  };

  const handleSend = async () => {
    if (!audioBlob || isUploading || isSending) return;
    
    setIsUploading(true);
    
    try {
      const extension = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp3') || audioBlob.type.includes('mpeg') ? 'mp3' : 'webm';
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
    onCancel();
  };

  const handleReset = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="glass p-4 border-primary/20 animate-in slide-in-from-bottom-2 duration-300">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="audio/*"
        onChange={handleFileSelect}
      />

      {/* Recording State */}
      {isRecording && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            {/* Pulsing red dot */}
            <div className="relative">
              <div className="w-4 h-4 rounded-full bg-destructive animate-pulse" />
              <div className="absolute inset-0 w-4 h-4 rounded-full bg-destructive animate-ping opacity-50" />
            </div>
            
            <span className="text-sm font-medium text-foreground">
              {formatTime(recordingTime)}
            </span>
            
            {/* Waveform animation */}
            <div className="flex-1 h-10 flex items-center gap-0.5 overflow-hidden">
              {waveformBars.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full transition-all duration-100"
                  style={{ 
                    height: `${Math.max(10, height * 0.4)}%`,
                    opacity: 0.3 + (i / waveformBars.length) * 0.7
                  }}
                />
              ))}
            </div>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            className="gap-2 animate-pulse"
          >
            <Square className="w-4 h-4" />
            Parar
          </Button>
        </div>
      )}

      {/* Preview State */}
      {audioUrl && !isRecording && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            {/* Play/Pause button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-full p-0 hover:bg-primary/20"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-primary" />
              ) : (
                <Play className="w-5 h-5 text-primary ml-0.5" />
              )}
            </Button>

            {/* Progress bar */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-100"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground min-w-[45px]">
                {formatTime(audioDuration || recordingTime)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
              title="Gravar outro"
            >
              <Mic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              className="text-destructive hover:bg-destructive/10"
              title="Descartar"
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
          </div>
        </div>
      )}

      {/* Initial State - Not recording, no audio */}
      {!isRecording && !audioUrl && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            Grave um áudio ou selecione um arquivo
          </span>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Arquivo
            </Button>
            <Button
              size="sm"
              onClick={startRecording}
              className={cn(
                "gap-2 relative overflow-hidden",
                "bg-gradient-to-r from-primary to-primary-light"
              )}
            >
              <Mic className="w-4 h-4" />
              Gravar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
