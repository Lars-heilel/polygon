import { toast } from 'sonner';

export function showComingSoonToast() {
  toast.custom(
    () => (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-surface-elevated/90 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <span
          className="text-lg shrink-0 mt-0.5"
          role="img"
          aria-label="Warning"
        >
          ⚠️
        </span>
        <div>
          <p className="text-sm font-semibold text-red-500">
            Внимание: Данная функция находится в разработке, приносим извинения за неудобства
          </p>
        </div>
      </div>
    ),
    { duration: 4000 },
  );
}
