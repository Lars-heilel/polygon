import { ThemeProvider } from '@org/shared';
import { DesignSystemPage } from '../pages/design-system';

export function App() {
  return (
    <ThemeProvider>
      <DesignSystemPage />
    </ThemeProvider>
  );
}

export default App;
