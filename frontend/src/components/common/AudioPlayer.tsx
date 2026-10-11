import { useEffect, useRef, useState } from 'react'
import { Download, Pause, Play, Volume2 } from 'lucide-react'
import { Button } from '../ui/button'
import { formatSeconds } from '../../lib/utils'

interface AudioPlayerProps {
  src: string
  filename?: string
  className?: string
}

export function AudioPlayer({ src, filename = 'recording', className }: AudioPlayerProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
  }, [src])

  const toggle = (): void => {
    const el = audioRef.current
    if (!el) return
    if (playing) void el.pause()
    else void el.play()
  }

  return (
    <div className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${className ?? ''}`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <Button variant="secondary" size="icon" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <Volume2 className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        aria-label="Seek"
        onChange={(e) => {
          const el = audioRef.current
          if (!el) return
          el.currentTime = Number(e.target.value)
          setCurrent(Number(e.target.value))
        }}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatSeconds(current)} / {formatSeconds(duration)}
      </span>
      <a
        href={src}
        download={filename}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
        aria-label="Download recording"
      >
        <Download className="size-4" />
      </a>
    </div>
  )
}
