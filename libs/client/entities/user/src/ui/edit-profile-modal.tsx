import { useState } from 'react';
import { Avatar, Button, Input, Modal, Textarea } from '@org/shared';
import { queryClient } from '@org/shared';
import { AvatarUploader } from '@org/features-upload-avatar';

import { useMeQuery } from '../api/user.api';
import { authApi } from '../api/user.api';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditProfileModal({ isOpen, onClose, onSaved }: EditProfileModalProps) {
  const { data: me } = useMeQuery();
  const [displayName, setDisplayName] = useState(me?.displayName ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  const displayNameLabel = me.displayName ?? me.name ?? me.email.slice(0, 8);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await authApi.updateProfile({ displayName: displayName || undefined, bio: bio || undefined });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <Modal.Header>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">Edit Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Avatar src={me.avatarUrl ?? undefined} name={displayNameLabel} size="xl" />
            <div className="w-full">
              <AvatarUploader onDone={() => {
                queryClient.invalidateQueries({ queryKey: ['me'] });
              }} />
            </div>
          </div>

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
          />

          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            maxChars={500}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
