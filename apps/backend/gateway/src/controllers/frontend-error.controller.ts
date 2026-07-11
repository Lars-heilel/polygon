import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { frontendErrorSchema, type FrontendErrorPayload } from '@org/common';

@Controller('observability/frontend-errors')
export class FrontendErrorController {
  private readonly logger = new Logger(FrontendErrorController.name);

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  capture(@Body() body: FrontendErrorPayload): { accepted: true } {
    const result = frontendErrorSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException('Invalid frontend error payload');
    }

    const { app, route, timestamp, message, stack, componentStack, userAgent } = result.data;

    this.logger.error({
      eventType: 'frontend_error',
      app,
      route: route.split(/[?#]/, 1)[0],
      timestamp,
      messageLength: message.length,
      stackLength: stack?.length ?? 0,
      componentStackLength: componentStack?.length ?? 0,
      userAgentLength: userAgent?.length ?? 0,
      hasStack: !!stack,
      hasComponentStack: !!componentStack,
      hasUserAgent: !!userAgent,
    });

    return { accepted: true };
  }
}
