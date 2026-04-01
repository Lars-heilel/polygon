import { Input } from '@org/shared';

interface ChatSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ChatSearch({ value, onChange, placeholder }: ChatSearchProps) {
  return (
    <div className="px-3 py-2 border-b border-border shrink-0">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search chats...'}
        size="sm"
        leftIcon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        }
      />
    </div>
  );
}
