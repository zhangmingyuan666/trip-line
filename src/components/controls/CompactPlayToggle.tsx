import { Pause, Play } from 'lucide-react';

type CompactPlayToggleProps = {
  isPlaying: boolean;
  disabled: boolean;
  onToggle: () => void;
};

export function CompactPlayToggle({ isPlaying, disabled, onToggle }: CompactPlayToggleProps) {
  return (
    <div className="play-toggle-shell">
      <button
        className="play-toggle-button"
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={isPlaying ? '暂停播放' : '开始播放'}
        title={isPlaying ? '暂停播放' : '开始播放'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </div>
  );
}
