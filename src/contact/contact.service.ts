import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly CONTACT_EMAIL = 'hina5701@hotmail.com';

  constructor(private readonly mailService: MailService) {}

  async sendContactEmail(contactDto: CreateContactDto): Promise<void> {
    const { name, email, number, enquiry } = contactDto;

    const subject = `New Contact Form Submission from ${name}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0e7490 100%);
            padding: 20px;
            min-height: 100vh;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #0e7490 50%, #0891b2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 3s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          }
          .header p {
            margin-top: 10px;
            font-size: 16px;
            opacity: 0.95;
            position: relative;
            z-index: 1;
          }
          .content {
            padding: 40px 30px;
          }
          .field {
            margin-bottom: 25px;
            padding: 20px;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 12px;
            border-left: 4px solid #0ea5e9;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .field:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
          }
          .field-label {
            font-weight: 600;
            color: #0c4a6e;
            margin-bottom: 10px;
            display: block;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .field-value {
            color: #1e293b;
            font-size: 16px;
            word-wrap: break-word;
            line-height: 1.6;
          }
          .enquiry-field {
            background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
            padding: 25px;
            border-radius: 12px;
            border-left: 4px solid #06b6d4;
            margin-top: 10px;
          }
          .enquiry-field .field-value {
            white-space: pre-wrap;
            font-size: 15px;
            line-height: 1.8;
          }
          .footer {
            margin-top: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-top: 2px solid #e2e8f0;
            text-align: center;
          }
          .footer p {
            color: #64748b;
            font-size: 14px;
            margin: 5px 0;
          }
          .footer a {
            color: #0ea5e9;
            text-decoration: none;
            font-weight: 600;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .logo-text {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-text">FikrLess</div>
            <h1>📧 New Contact Form Submission</h1>
            <p>You have received a new message from your website</p>
          </div>
          
          <div class="content">
            <div class="field">
              <span class="field-label">👤 Name</span>
              <div class="field-value">${this.escapeHtml(name)}</div>
            </div>
            
            <div class="field">
              <span class="field-label">✉️ Email</span>
              <div class="field-value">
                <a href="mailto:${this.escapeHtml(email)}" style="color: #0ea5e9; text-decoration: none;">${this.escapeHtml(email)}</a>
              </div>
            </div>
            
            ${number ? `
            <div class="field">
              <span class="field-label">📱 Phone Number</span>
              <div class="field-value">
                <a href="tel:${this.escapeHtml(number)}" style="color: #0ea5e9; text-decoration: none;">${this.escapeHtml(number)}</a>
              </div>
            </div>
            ` : ''}
            
            <div class="enquiry-field">
              <span class="field-label">💬 Enquiry</span>
              <div class="field-value">${this.escapeHtml(enquiry)}</div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>This email was sent from the FikrLess contact form.</strong></p>
            <p>You can reply directly to: <a href="mailto:${this.escapeHtml(email)}">${this.escapeHtml(email)}</a></p>
            <p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">© ${new Date().getFullYear()} FikrLess - Mental Health & Psychology Training Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendEmail(this.CONTACT_EMAIL, subject, html);
      this.logger.log(`Contact form email sent successfully from ${email} to ${this.CONTACT_EMAIL}`);
    } catch (error) {
      this.logger.error(`Failed to send contact email: ${error.message}`, error.stack);
      throw error;
    }
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
