import { render } from '@testing-library/react';

import OrgPages from './pages';

describe('OrgPages', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OrgPages />);
    expect(baseElement).toBeTruthy();
  });
});
