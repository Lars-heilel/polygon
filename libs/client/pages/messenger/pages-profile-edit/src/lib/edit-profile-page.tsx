import { useState } from 'react';

import { authApi, useMeQuery } from '@org/entities-user';
import { AvatarUploader } from '@org/features-upload-avatar';
import { Avatar, Button, Heading, Input, Textarea, queryClient } from '@org/shared';
import { useNavigate } from 'react-router';

export function EditProfilePage() {
  const { data: me } = useMeQuery();
  const navigate = useNavigate();
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
      navigate('/chats/profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <header className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/chats/profile')}
          aria-label="Back"
          className="p-2 hover:bg-surface-elevated rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <Heading
          level={5}
          as="h2"
        >
          Edit Profile
        </Heading>
      </header>

      <div className="flex-1 overflow-y-auto p-6 ">
        <div className="space-y-6 max-w-sm mx-auto ">
          <div className="flex flex-col items-center pt-40 gap-3">
            <Avatar
              src={me.avatarUrl ?? undefined}
              name={displayNameLabel}
              size="xl"
            />
            <div className="w-full">
              <AvatarUploader onDone={() => queryClient.invalidateQueries({ queryKey: ['me'] })} />
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

          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => navigate('/chats/profile')}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              loading={saving}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
