import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  isOutgoing?: boolean;
}

export function AudioPlayer({ src, isOutgoing = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause all other audio elements first
      document.querySelectorAll('audio').forEach((el) => {
        if (el !== audio) {
          el.pause();
        }
      });
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    
    audio.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * duration;
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate waveform bars
  const waveformBars = Array.from({ length: 30 }, (_, i) => ({
    height: 20 + Math.sin(i * 0.5) * 15 + Math.random() * 20,
  }));

  return (
    <div className={`flex items-center gap-3 min-w-[220px] p-2 rounded-lg ${
      isOutgoing ? 'bg-white/10' : 'bg-muted/50'
    }`}>
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlayback}
        className={`h-10 w-10 rounded-full flex-shrink-0 ${
          isOutgoing 
            ? 'bg-white/20 hover:bg-white/30 text-white' 
            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </Button>

      {/* Waveform and Progress */}
      <div className="flex-1 min-w-0">
        <div 
          className="h-8 flex items-center gap-[2px] cursor-pointer"
          onClick={handleSeek}
        >
          {waveformBars.map((bar, i) => {
            const barProgress = (i / waveformBars.length) * 100;
            const isActive = barProgress <= progress;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-100 ${
                  isActive
                    ? isOutgoing ? 'bg-white' : 'bg-primary'
                    : isOutgoing ? 'bg-white/30' : 'bg-muted-foreground/30'
                }`}
                style={{ height: `${bar.height}%` }}
              />
            );
          })}
        </div>
        
        {/* Time Display */}
        <div className={`flex justify-between text-[10px] mt-1 ${
          isOutgoing ? 'text-white/70' : 'text-muted-foreground'
        }`}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed Control */}
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleSpeed}
        className={`text-xs px-2 py-1 h-6 rounded ${
          isOutgoing 
            ? 'text-white/70 hover:text-white hover:bg-white/20' 
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        {playbackSpeed}x
      </Button>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
