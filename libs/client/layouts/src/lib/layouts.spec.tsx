import { render } from '@testing-library/react';

import OrgLayouts from './layouts';

describe('OrgLayouts', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OrgLayouts />);
    expect(baseElement).toBeTruthy();
  });
});
