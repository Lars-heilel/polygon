import { render } from '@testing-library/react';

import OrgShared from './shared';

describe('OrgShared', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OrgShared />);
    expect(baseElement).toBeTruthy();
  });
});
