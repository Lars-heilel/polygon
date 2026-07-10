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

    this.logger.error({
      eventType: 'frontend_error',
      ...result.data,
    });

    return { accepted: true };
  }
}
