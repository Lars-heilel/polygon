import type { ClientProxy } from '@nestjs/microservices';
import type { IStorageProvider } from '@org/core';

import { MediaGatewayController } from './media.controller';

describe('MediaGatewayController link previews', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the YouTube fallback without fetching the page', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch should not run'));
    const controller = new MediaGatewayController(
      {} as ClientProxy,
      {} as ClientProxy,
      {} as IStorageProvider,
      {} as ClientProxy,
    );

    const preview = await controller.getLinkPreview('https://www.youtube.com/watch?v=dKmPEhJ4wjY');

    expect(preview).toMatchObject({
      imageUrl: 'https://i.ytimg.com/vi/dKmPEhJ4wjY/hqdefault.jpg',
      siteName: 'YouTube',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
