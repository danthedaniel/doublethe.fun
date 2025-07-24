import { SpeakerXMarkIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline";

interface MuteButtonProps {
  isMuted: boolean;
  onMute: () => void;
}

export default function MuteButton({ isMuted, onMute }: MuteButtonProps) {
  return (
    <button onClick={onMute} className="p-2 rounded-md text-slate-700 border border-gray-200 bg-white/90 hover:bg-white active:bg-gray-200 cursor-pointer">
      {
        isMuted
          ? <SpeakerXMarkIcon className="w-6 h-6" />
          : <SpeakerWaveIcon className="w-6 h-6" />
      }
    </button>
  );
}
