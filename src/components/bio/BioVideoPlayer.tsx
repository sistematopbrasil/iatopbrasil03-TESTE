import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import type { BioTheme } from '@/lib/bio-themes';

interface Props {
  src: string;
  poster?: string;
  theme: BioTheme;
}

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BioVideoPlayer({ src, poster, theme }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [dragging, setDragging] = useState(false);

  const accent = theme.accent_color;

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => {
      setCurrent(v.currentTime);
      setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
      if (v.buffered.length) setBuffered((v.buffered.end(v.buffered.length - 1) / (v.duration || 1)) * 100);
    };
    const onLoaded = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); setShowControls(true); };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnd);
    };
  }, []);

  const scheduleHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { if (playing && !dragging) setShowControls(false); }, 2200);
  };
  const reveal = () => { setShowControls(true); scheduleHide(); };

  useEffect(() => { if (playing) scheduleHide(); else setShowControls(true); /* eslint-disable-next-line */ }, [playing]);

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
    reveal();
  };

  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted); reveal();
  };

  const requestFs = () => {
    const el = wrapRef.current; if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const seekFromEvent = (clientX: number, rect: DOMRect) => {
    const v = videoRef.current; if (!v || !v.duration) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setProgress(ratio * 100);
  };

  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    seekFromEvent(e.clientX, rect);
  };
  const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    seekFromEvent(e.clientX, rect);
  };
  const onBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const radius = theme.button_style === 'pill' ? '24px' : theme.button_style === 'soft' ? '18px' : '8px';

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden group select-none"
      style={{ background: '#000', borderRadius: radius, boxShadow: `0 12px 40px -12px ${accent}55` }}
      onMouseMove={reveal}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        className="w-full aspect-video object-cover bg-black"
        onClick={togglePlay}
      />

      {/* Center play button */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Reproduzir"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span
            className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
            style={{ background: `${accent}E6`, color: '#fff', boxShadow: `0 8px 30px -6px ${accent}99` }}
          >
            <Play className="w-7 h-7 ml-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 px-3 pt-10 pb-2 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)' }}
      >
        {/* Progress bar */}
        <div
          className="relative h-1.5 rounded-full cursor-pointer group/bar"
          style={{ background: 'rgba(255,255,255,0.2)' }}
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
        >
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${buffered}%`, background: 'rgba(255,255,255,0.25)' }} />
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, background: accent }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, background: accent, boxShadow: `0 0 0 4px ${accent}33` }}
          />
        </div>

        <div className="flex items-center gap-3 mt-2 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproduzir'} className="hover:opacity-80">
            {playing ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Silenciar'} className="hover:opacity-80">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <div className="text-[11px] font-mono tabular-nums opacity-90">
            {fmt(current)} <span className="opacity-50">/ {fmt(duration)}</span>
          </div>
          <div className="ml-auto">
            <button type="button" onClick={requestFs} aria-label="Tela cheia" className="hover:opacity-80">
              <Maximize2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
