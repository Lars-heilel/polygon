import { getMessagePreview } from '@org/entities-chat';

describe('getMessagePreview', () => {
  it('uses attachment category when message media is absent', () => {
    expect(getMessagePreview({
      text: null,
      media: null,
      attachments: [{ category: 'VOICE', fileNameSnapshot: 'voice.webm' }],
    })).toBe('🎤 Голосовое сообщение');

    expect(getMessagePreview({
      text: null,
      media: null,
      attachments: [{ category: 'VIDEO', fileNameSnapshot: 'clip.mp4' }],
    })).toBe('🎬 Видео');
  });

  it('keeps file names for generic file attachments', () => {
    expect(getMessagePreview({
      text: null,
      media: null,
      attachments: [{ category: 'FILE', fileNameSnapshot: 'report.pdf' }],
    })).toBe('📄 report.pdf');
  });
});
