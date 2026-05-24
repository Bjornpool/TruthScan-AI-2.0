/**
 * Mały komponent prezentacyjny wyświetlający wskaźnik ładowania
 * wraz z krótkim komunikatem tekstowym.
 */

"use client";

interface Props {
  text: string;
}

export default function MiniSpinner({ text }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      {text}
    </div>
  );
}