import { render } from '@testing-library/react';

import OrgWidgets from './widgets';

describe('OrgWidgets', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OrgWidgets />);
    expect(baseElement).toBeTruthy();
  });
});
