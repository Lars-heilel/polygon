import { setupServer } from 'msw/node';
import { authHandlers } from '../../../entities/src/test/handlers';

export const server = setupServer(...authHandlers);
