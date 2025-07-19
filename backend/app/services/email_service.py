"""
Email service for handling email notifications
Supports both MailHog (development) and Resend (production)
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email service with support for SMTP and Resend API"""
    
    def __init__(self):
        self.backend = settings.EMAIL_BACKEND
        
    async def send_email(
        self,
        to_email: str | List[str],
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """
        Send email using configured backend
        
        Args:
            to_email: Recipient email(s)
            subject: Email subject
            body: Plain text body
            html_body: HTML body (optional)
            from_email: Sender email (defaults to settings.FROM_EMAIL)
            from_name: Sender name (defaults to settings.FROM_NAME)
            
        Returns:
            bool: True if sent successfully, False otherwise
        """
        try:
            if self.backend == "resend":
                return await self._send_via_resend(
                    to_email, subject, body, html_body, from_email, from_name
                )
            elif self.backend == "mailhog":
                return await self._send_via_smtp(
                    to_email, subject, body, html_body, from_email, from_name
                )
            else:
                logger.error(f"Unknown email backend: {self.backend}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
    
    async def _send_via_smtp(
        self,
        to_email: str | List[str],
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """Send email via SMTP (MailHog for development)"""
        try:
            # Prepare recipient list
            recipients = [to_email] if isinstance(to_email, str) else to_email
            
            # Setup sender info
            sender_email = from_email or settings.FROM_EMAIL
            sender_name = from_name or settings.FROM_NAME
            from_address = f"{sender_name} <{sender_email}>"
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = from_address
            msg['To'] = ', '.join(recipients)
            
            # Add plain text part
            text_part = MIMEText(body, 'plain')
            msg.attach(text_part)
            
            # Add HTML part if provided
            if html_body:
                html_part = MIMEText(html_body, 'html')
                msg.attach(html_part)
            
            # Send via SMTP
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                
                server.sendmail(sender_email, recipients, msg.as_string())
            
            logger.info(f"Email sent via SMTP to {recipients}")
            return True
            
        except Exception as e:
            logger.error(f"SMTP email failed: {str(e)}")
            return False
    
    async def _send_via_resend(
        self,
        to_email: str | List[str],
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """Send email via Resend API (production)"""
        try:
            if not settings.RESEND_API_KEY:
                logger.error("Resend API key not configured")
                return False
            
            # Import resend here to avoid dependency issues in dev
            import resend
            
            # Configure Resend
            resend.api_key = settings.RESEND_API_KEY
            
            # Prepare recipient list
            recipients = [to_email] if isinstance(to_email, str) else to_email
            
            # Setup sender info
            sender_email = from_email or settings.FROM_EMAIL
            sender_name = from_name or settings.FROM_NAME
            from_address = f"{sender_name} <{sender_email}>"
            
            # Prepare email data
            email_data = {
                "from": from_address,
                "to": recipients,
                "subject": subject,
                "text": body,
            }
            
            # Add HTML if provided
            if html_body:
                email_data["html"] = html_body
            
            # Send email
            response = resend.Emails.send(email_data)
            
            if response.get("id"):
                logger.info(f"Email sent via Resend to {recipients}, ID: {response['id']}")
                return True
            else:
                logger.error(f"Resend API error: {response}")
                return False
                
        except ImportError:
            logger.error("Resend package not installed. Install with: pip install resend")
            return False
        except Exception as e:
            logger.error(f"Resend email failed: {str(e)}")
            return False
    
    async def send_admin_invitation(
        self,
        admin_email: str,
        invite_token: str,
        invited_by: str
    ) -> bool:
        """Send admin invitation email"""
        subject = "Admin Invitation - Tunarasa"
        
        # Create invitation URL (adjust base URL as needed)
        base_url = "https://your-domain.com"  # Replace with actual domain
        invite_url = f"{base_url}/admin/accept-invitation?token={invite_token}"
        
        # Plain text body
        body = f"""
        You've been invited to join Tunarasa as an administrator.
        
        Invited by: {invited_by}
        
        Click the link below to accept your invitation:
        {invite_url}
        
        This invitation will expire in 7 days.
        
        Best regards,
        Tunarasa Team
        """
        
        # HTML body
        html_body = f"""
        <html>
        <body>
            <h2>Admin Invitation - Tunarasa</h2>
            <p>You've been invited to join Tunarasa as an administrator.</p>
            
            <p><strong>Invited by:</strong> {invited_by}</p>
            
            <p>Click the button below to accept your invitation:</p>
            
            <div style="margin: 20px 0;">
                <a href="{invite_url}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 4px; display: inline-block;">
                    Accept Invitation
                </a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="{invite_url}">{invite_url}</a></p>
            
            <p><em>This invitation will expire in 7 days.</em></p>
            
            <hr>
            <p>Best regards,<br>Tunarasa Team</p>
        </body>
        </html>
        """
        
        return await self.send_email(
            to_email=admin_email,
            subject=subject,
            body=body.strip(),
            html_body=html_body
        )
    
    async def send_notification(
        self,
        admin_email: str,
        notification_type: str,
        message: str,
        details: Optional[dict] = None
    ) -> bool:
        """Send system notification to admin"""
        subject = f"Tunarasa Notification - {notification_type}"
        
        body = f"""
        System Notification: {notification_type}
        
        {message}
        """
        
        if details:
            body += "\n\nDetails:\n"
            for key, value in details.items():
                body += f"- {key}: {value}\n"
        
        body += f"""
        
        Time: {__import__('datetime').datetime.now().isoformat()}
        
        Best regards,
        Tunarasa System
        """
        
        return await self.send_email(
            to_email=admin_email,
            subject=subject,
            body=body.strip()
        )


# Global email service instance
email_service = EmailService()