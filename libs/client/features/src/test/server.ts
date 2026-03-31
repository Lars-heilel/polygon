import { authHandlers } from '@org/entities';
import { setupServer } from 'msw/node';

export const server = setupServer(...authHandlers);
