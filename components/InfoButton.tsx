import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface InfoButtonProps {
  onInfo: () => void;
}

export default function InfoButton({ onInfo }: InfoButtonProps) {
  return (
    <button onClick={onInfo} className="p-2 rounded-md text-slate-700 border border-gray-200 bg-white/90 hover:bg-white active:bg-gray-200 cursor-pointer">
      <InformationCircleIcon className="w-6 h-6" />
    </button>
  );
}
