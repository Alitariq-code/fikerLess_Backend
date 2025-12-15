import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('api/v1/contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sendContactEmail(@Body() dto: CreateContactDto) {
    try {
      await this.contactService.sendContactEmail(dto);
      return {
        success: true,
        message: 'Your message has been sent successfully! We will get back to you soon.',
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to send your message. Please try again later.',
        error: error.message,
      });
    }
  }
}

