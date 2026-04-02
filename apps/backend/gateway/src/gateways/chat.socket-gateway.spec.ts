import type { ClientProxy } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { CHAT_CLIENT_TOKEN, TokenService } from '@org/core';
import type { Socket } from 'socket.io';

import { ChatSocketGateway } from './chat.socket-gateway';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeMockSocket(cookieHeader = ''): jest.Mocked<Socket> {
  return {
    handshake: { headers: { cookie: cookieHeader } },
    data: {} as Record<string, unknown>,
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Socket>;
}

function cookieWith(token: string) {
  return `other=stuff; access_token=${token}; third=value`;
}

// ── setup ─────────────────────────────────────────────────────────────────────

const mockTokenService = { verifyAccessToken: jest.fn() };
const mockChatClient = { send: jest.fn(), emit: jest.fn() };

const validPayload = { sub: 'user-id-123', role: 'USER' as const, isVerified: true };

describe('ChatSocketGateway', () => {
  let gateway: ChatSocketGateway;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ChatSocketGateway,
        { provide: TokenService, useValue: mockTokenService },
        { provide: CHAT_CLIENT_TOKEN, useValue: mockChatClient as unknown as ClientProxy },
      ],
    }).compile();

    gateway = module.get(ChatSocketGateway);
  });

  // ── handleConnection ──────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('sets userId and stays connected when access_token cookie is valid', () => {
      mockTokenService.verifyAccessToken.mockReturnValue(validPayload);
      const socket = makeMockSocket(cookieWith('valid-token'));

      gateway.handleConnection(socket);

      expect(socket.data['userId']).toBe(validPayload.sub);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects when cookie header is absent', () => {
      const socket = makeMockSocket('');

      gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.data['userId']).toBeUndefined();
    });

    it('disconnects when access_token cookie is not present among other cookies', () => {
      const socket = makeMockSocket('session=abc; theme=dark');

      gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token fails verification (invalid signature)', () => {
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const socket = makeMockSocket(cookieWith('tampered-token'));

      gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.data['userId']).toBeUndefined();
    });

    it('disconnects when token is expired', () => {
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const socket = makeMockSocket(cookieWith('expired-token'));

      gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('reads access_token correctly regardless of cookie order', () => {
      mockTokenService.verifyAccessToken.mockReturnValue(validPayload);
      const socket = makeMockSocket('access_token=my-token; other=value');

      gateway.handleConnection(socket);

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('my-token');
    });
  });

  // ── mid-session token expiry — документирует отсутствующий middleware ──────

  describe('token re-validation after connection', () => {
    /**
     * [TODO MIDDLEWARE] Сокет-соединение НЕ проверяет токен повторно после подключения.
     *
     * Сейчас: сервер валидирует access_token только в handleConnection.
     * Если токен протухает пока сокет висит — соединение остаётся живым,
     * userId сохранён в socket.data, и пользователь продолжает получать/отправлять
     * события как будто авторизован.
     *
     * Что нужно сделать:
     *   Добавить socket middleware (io.use(...)) который перехватывает каждый
     *   входящий ивент, читает access_token из cookie, верифицирует — и если токен
     *   протух, делает socket.disconnect().
     *
     * Когда middleware будет добавлен — этот тест нужно обновить:
     *   expect(socket.disconnect).toHaveBeenCalled()  // после первого события с протухшим токеном
     */
    it('[TODO MIDDLEWARE] connected socket is not kicked when token expires mid-session', () => {
      // Подключились с валидным токеном
      mockTokenService.verifyAccessToken.mockReturnValue(validPayload);
      const socket = makeMockSocket(cookieWith('valid-token'));
      gateway.handleConnection(socket);

      expect(socket.data['userId']).toBe(validPayload.sub); // ✓ подключён

      // Симулируем: токен протух — verifyAccessToken теперь бросает
      mockTokenService.verifyAccessToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      // Без middleware — сервер не знает что токен протух.
      // Следующий ивент (например chat:join) пройдёт нормально, userId всё ещё в socket.data.
      // Тест ЗЕЛЁНЫЙ сейчас. Станет КРАСНЫМ когда добавим middleware (disconnect будет вызван).
      expect(socket.disconnect).toHaveBeenCalledTimes(0);
      expect(socket.data['userId']).toBe(validPayload.sub); // userId не сброшен
    });
  });
});
