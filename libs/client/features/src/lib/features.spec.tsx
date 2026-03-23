import { render } from '@testing-library/react';

import OrgFeatures from './features';

describe('OrgFeatures', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OrgFeatures />);
    expect(baseElement).toBeTruthy();
  });
});
