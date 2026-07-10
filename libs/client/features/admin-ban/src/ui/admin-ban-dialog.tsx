import { type FormEvent, useEffect, useState } from 'react';

import {
  adminBanRequestSchema,
  type AdminBanDuration,
  type AdminBanReason,
  type AdminBanRequest,
} from '@org/common';
import { Button, FormAlert, Modal, Textarea } from '@org/shared';

import { useAdminBan } from '../model/use-admin-ban';

const DURATIONS: AdminBanDuration[] = [
  'ONE_HOUR',
  'ONE_DAY',
  'SEVEN_DAYS',
  'THIRTY_DAYS',
  'PERMANENT',
];

const REASONS: AdminBanReason[] = [
  'SPAM',
  'BULLYING',
  'UNACCEPTABLE_CONTENT',
  'SUSPICIOUS_ACTIVITY',
  'CUSTOM',
];

interface AdminBanDialogProps {
  isBanned: boolean;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function AdminBanDialog({ isBanned, isOpen, onClose, userId }: AdminBanDialogProps) {
  const [duration, setDuration] = useState<AdminBanDuration>('ONE_HOUR');
  const [reason, setReason] = useState<AdminBanReason>('SPAM');
  const [customReason, setCustomReason] = useState('');
  const [customReasonError, setCustomReasonError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const adminBan = useAdminBan(userId, { onSuccess: onClose });
  const isPending = adminBan.isPending;

  useEffect(() => {
    if (!isOpen) {
      setApiError(null);
      setCustomReasonError(null);
    }
  }, [isOpen]);

  const submitBan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    setCustomReasonError(null);

    const payload = buildPayload(duration, reason, customReason);
    const parsed = adminBanRequestSchema.safeParse(payload);

    if (!parsed.success) {
      const customIssue = parsed.error.issues.find((issue) => issue.path.includes('customReason'));
      setCustomReasonError(
        customIssue?.code === 'too_big'
          ? 'Custom reason must contain at most 500 characters'
          : 'Custom reason must contain at least 5 characters',
      );
      return;
    }

    try {
      await adminBan.ban.mutateAsync(parsed.data);
    } catch {
      setApiError('Could not update ban');
    }
  };

  const submitUnban = async () => {
    setApiError(null);

    try {
      await adminBan.unban.mutateAsync();
    } catch {
      setApiError('Could not update ban');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <Modal.Header title={isBanned ? 'Unban user' : 'Ban user'} />
      <Modal.Body>
        <FormAlert message={apiError} />
        {isBanned ? (
          <p className="text-sm text-text-muted">Remove the active ban and allow this user back in.</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submitBan}>
            <label className="flex flex-col gap-1 text-sm">
              Duration
              <select
                disabled={isPending}
                onChange={(event) => setDuration(event.target.value as AdminBanDuration)}
                value={duration}
              >
                {DURATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Reason
              <select
                disabled={isPending}
                onChange={(event) => setReason(event.target.value as AdminBanReason)}
                value={reason}
              >
                {REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            {reason === 'CUSTOM' && (
              <Textarea
                disabled={isPending}
                error={customReasonError ?? undefined}
                label="Custom reason"
                maxChars={500}
                onChange={(event) => setCustomReason(event.target.value)}
                value={customReason}
              />
            )}

            <Button loading={isPending} type="submit" variant="danger">
              Ban user
            </Button>
          </form>
        )}
      </Modal.Body>
      {isBanned && (
        <Modal.Footer>
          <Button loading={isPending} onClick={() => void submitUnban()} type="button" variant="danger">
            Unban user
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

function buildPayload(
  duration: AdminBanDuration,
  reason: AdminBanReason,
  customReason: string,
): AdminBanRequest {
  if (reason === 'CUSTOM') {
    return {
      customReason: customReason.trim(),
      duration,
      reason,
    };
  }

  return {
    duration,
    reason,
  };
}
