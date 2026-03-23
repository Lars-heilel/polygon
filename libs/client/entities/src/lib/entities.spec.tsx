import { render } from '@testing-library/react';

import OrgEntities from './entities';

describe('OrgEntities', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<OrgEntities />);
    expect(baseElement).toBeTruthy();
  });
});
