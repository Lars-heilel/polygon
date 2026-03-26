import type { Preview } from '@storybook/react';
import '../src/styles/global.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global theme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['dark', 'light'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals['theme'] as string;
      document.documentElement.classList.toggle('theme-light', theme === 'light');
      return Story();
    },
  ],
  parameters: {
    backgrounds: { disable: true },
    layout: 'centered',
  },
};

export default preview;
