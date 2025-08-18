"""
QR Code generation service for conversation summaries
"""

import base64
import json
import logging
import textwrap
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict

import qrcode
import qrcode.image.svg
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)


class QRCodeService:
    """Service for generating QR codes for conversation summaries"""

    def __init__(self):
        from app.core.config import settings

        # Use frontend URL for QR codes, not backend URL
        # QR codes should redirect to frontend which will proxy to backend
        self.base_url = settings.NEXT_PUBLIC_APP_URL or "http://localhost:3000"

    def generate_conversation_summary_qr(
        self, conversation_id: int, user_id: int, summary_data: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate QR code for conversation summary download

        Args:
            conversation_id: ID of the conversation
            user_id: ID of the user
            summary_data: Summary data to include in QR

        Returns:
            Dict with QR code data and download URL
        """
        try:
            # Generate unique access token for this summary
            access_token = str(uuid.uuid4())

            # Create summary URL pointing to frontend route
            summary_url = f"{self.base_url}/summary/{access_token}"

            # Create QR code data
            qr_data = {
                "type": "conversation_summary",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "access_token": access_token,
                "url": summary_url,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "summary": {
                    "title": summary_data.get("title", "Ringkasan Percakapan"),
                    "message_count": summary_data.get("message_count", 0),
                    "duration": summary_data.get("duration", "0 menit"),
                    "topics": summary_data.get("topics", []),
                },
            }

            # Generate QR code
            qr_code_base64 = self._create_qr_code(summary_url)

            # Store access token and data (in production, store in database/Redis)
            # For now, we'll return the structure

            return {
                "qr_code_base64": qr_code_base64,
                "access_token": access_token,
                "download_url": summary_url,
                "qr_data": json.dumps(qr_data, ensure_ascii=False),
            }

        except Exception as e:
            logger.error(
                f"Failed to generate QR code for conversation {conversation_id}: {e}"
            )
            raise

    def generate_note_qr(
        self, note_id: int, conversation_id: int, note_content: str
    ) -> Dict[str, str]:
        """
        Generate QR code for individual note access

        Args:
            note_id: ID of the note
            conversation_id: ID of the conversation
            note_content: Content of the note

        Returns:
            Dict with QR code data and access URL
        """
        try:
            # Generate unique access token
            access_token = str(uuid.uuid4())

            # Create note access URL pointing to frontend route
            note_url = f"{self.base_url}/note/{access_token}"

            # Create QR code data
            qr_data = {
                "type": "note_access",
                "note_id": note_id,
                "conversation_id": conversation_id,
                "access_token": access_token,
                "url": note_url,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "preview": (
                    note_content[:100] + "..."
                    if len(note_content) > 100
                    else note_content
                ),
            }

            # Generate QR code
            qr_code_base64 = self._create_qr_code(note_url)

            return {
                "qr_code_base64": qr_code_base64,
                "access_token": access_token,
                "access_url": note_url,
                "qr_data": json.dumps(qr_data, ensure_ascii=False),
            }

        except Exception as e:
            logger.error(f"Failed to generate QR code for note {note_id}: {e}")
            raise

    def _create_qr_code(self, data: str, size: int = 300) -> str:
        """
        Create QR code image and return as base64 string

        Args:
            data: Data to encode in QR code
            size: Size of QR code image

        Returns:
            Base64 encoded QR code image
        """
        try:
            # Create QR code instance
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )

            # Add data and create QR code
            qr.add_data(data)
            qr.make(fit=True)

            # Create image
            img = qr.make_image(fill_color="black", back_color="white")

            # Resize image
            img = img.resize((size, size))

            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            img_base64 = base64.b64encode(buffer.getvalue()).decode()

            return img_base64  # Return just the base64 string, frontend will add the data URL prefix

        except Exception as e:
            logger.error(f"Failed to create QR code: {e}")
            raise

    def create_summary_document(
        self,
        title: str,
        summary_text: str,
        conversation_data: Dict[str, Any],
        messages: list,
        format_type: str = "text",
    ) -> str:
        """
        Create downloadable summary document

        Args:
            conversation_data: Conversation metadata
            messages: List of messages in conversation
            format_type: Format for summary (text, json, html)

        Returns:
            Formatted summary content
        """
        try:
            if format_type == "json":
                return self._create_json_summary(conversation_data, messages)
            elif format_type == "html":
                return self._create_html_summary(
                    conversation_data, messages, summary_text, title
                )
            else:
                return self._create_text_summary(
                    conversation_data, messages, summary_text, title
                )

        except Exception as e:
            logger.error(f"Failed to create summary document: {e}")
            raise

    def _create_text_summary(
        self, conversation_data: Dict, messages: list, summary: str, title_text: str
    ) -> str:
        """Create plain text summary"""

        created_at = conversation_data.get(
            "created_at", datetime.now(timezone.utc).isoformat()
        )

        text_summary = f"""
RINGKASAN PERCAKAPAN TUNARASA
=============================

Judul: {title_text}
Tanggal: {created_at}
Total Pesan: {len(messages)}

{summary}

---
Dibuat oleh Tunarasa - Platform Bahasa Isyarat Indonesia
https://tunarasa.my.id
"""

        return text_summary

    def _create_json_summary(self, conversation_data: Dict, messages: list) -> str:
        """Create JSON summary"""

        summary_data = {
            "conversation": conversation_data,
            "messages": messages,
            "summary": {
                "total_messages": len(messages),
                "user_messages": len(
                    [m for m in messages if m.get("sender_type") == "user"]
                ),
                "ai_messages": len(
                    [m for m in messages if m.get("sender_type") == "ai"]
                ),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            "platform": {
                "name": "Tunarasa",
                "description": "Platform Bahasa Isyarat Indonesia",
                "url": "https://tunarasa.my.id",
            },
        }

        return json.dumps(summary_data, indent=2, ensure_ascii=False)

    def _create_html_summary(
        self, conversation_data: Dict, messages: list, summary: str, title_text: str
    ) -> str:
        """Create HTML summary"""

        # Extract title and created_at from the conversation_data
        title = conversation_data.get("title", "Ringkasan Percakapan")
        created_at = conversation_data.get(
            "created_at", datetime.now(timezone.utc).isoformat()
        )

        # Format summary string into paragraphs by splitting at double newlines \n\n
        formatted_messages = summary.split("\n\n")
        formatted_content = "".join(
            [f"<p>{message.strip()}</p>" for message in formatted_messages]
        )

        # Prepare the HTML structure with dynamic content
        html = f"""
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title} - Tunarasa</title>
        <style>
            /* General styles */
            body {{
                font-family: Arial, sans-serif;
                background-color: #f4f7fa;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                color: #333;
            }}

            h1 {{
                font-size: 28px;
                color: #333;
            }}

            p {{
                line-height: 1.6;
            }}

            /* Header Styles */
            .header {{
                background-color: #ffffff;
                padding: 25px;
                border-radius: 12px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                text-align: center;
            }}

            .header h1 {{
                font-size: 32px;
                margin: 0;
                color: #007bff;
            }}

            .header p {{
                font-size: 14px;
                color: #666;
            }}

            /* Summary Styles */
            .summary {{
                background-color: #ffffff;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
            }}

            .summary p {{
                font-size: 16px;
                color: #333;
                margin-bottom: 20px;
            }}

            /* Footer Styles */
            .footer {{
                margin-top: 40px;
                text-align: center;
                font-size: 14px;
                color: #888;
            }}

            .footer a {{
                color: #007bff;
                text-decoration: none;
            }}

            .footer a:hover {{
                text-decoration: underline;
            }}
        </style>
    </head>
    <body>
        <!-- Header -->
        <div class="header">
            <h1>{title_text}</h1>
            <p><strong>Tanggal:</strong> {created_at}</p>
            <p><strong>Total Pesan:</strong> {len(messages)}</p>
        </div>

        <!-- Summary Content -->
        <div class="summary" id="summaryContent">
            {formatted_content}
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Dibuat oleh <strong>Tunarasa</strong> - Platform Bahasa Isyarat Indonesia</p>
            <p><a href="https://tunarasa.my.id" target="_blank">https://tunarasa.my.id</a></p>
        </div>
    </body>
    </html>
        """
        return html

    def create_note_pdf(self, filename, title, note_content, url_access, created_at):
        c = canvas.Canvas(filename, pagesize=A4)
        width, height = A4
        margin = 2 * cm
        content_width = width - 2 * margin

        # Current Y position (starting from top)
        y_position = height - 2 * cm

        # Header section with metadata
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.grey)
        c.drawRightString(width - margin, y_position, f"ID: {url_access}")
        y_position -= 0.4 * cm
        c.drawRightString(width - margin, y_position, f"Created: {created_at}")

        # Move down for title
        y_position -= 1.5 * cm

        # Title (centered, bold, with some styling)
        c.setFont("Helvetica-Bold", 16)
        c.setFillColor(colors.black)
        # Wrap title if too long
        title_wrapped = textwrap.fill(title, width=60)
        title_lines = title_wrapped.split("\n")

        for line in title_lines:
            c.drawCentredString(width / 2, y_position, line)
            y_position -= 0.6 * cm

        # Add separator line
        y_position -= 0.5 * cm
        c.setStrokeColor(colors.grey)
        c.setLineWidth(0.5)
        c.line(margin, y_position, width - margin, y_position)
        y_position -= 1 * cm

        # Content section with justified text
        c.setFont("Helvetica", 11)
        c.setFillColor(colors.black)

        # Wrap content text with better parameters for justification
        max_chars_per_line = 75  # Slightly reduced for better word distribution
        content_lines = wrap_text_for_justify(note_content, max_chars_per_line)

        line_height = 0.5 * cm

        for i, line in enumerate(content_lines):
            # Check if we need a new page
            if y_position < 3 * cm:  # Leave margin at bottom
                c.showPage()
                y_position = height - 2 * cm

            if line.strip():  # Only justify non-empty lines
                # Don't justify the last line of a paragraph or very short lines
                is_last_line_of_paragraph = (
                    i == len(content_lines) - 1 or content_lines[i + 1].strip() == ""
                )
                is_short_line = len(line.split()) <= 3

                if is_last_line_of_paragraph or is_short_line:
                    # Draw normally (left-aligned) for last lines and short lines
                    c.drawString(margin, y_position, line)
                else:
                    # Draw justified
                    justify_text(c, line, margin, y_position, content_width)

            y_position -= line_height

        c.save()


def justify_text(c, text, x, y, max_width, font_name="Helvetica", font_size=11):
    """
    Draw justified text on canvas
    """
    c.setFont(font_name, font_size)

    # Split text into words
    words = text.split()
    if len(words) <= 1:
        # If only one word or empty, just draw normally
        c.drawString(x, y, text)
        return

    # Calculate total width of all words without spaces
    total_word_width = sum(c.stringWidth(word, font_name, font_size) for word in words)

    # Calculate available space for gaps between words
    available_space = max_width - total_word_width

    # Number of gaps between words
    num_gaps = len(words) - 1

    if num_gaps > 0 and available_space > 0:
        # Calculate space between each word
        space_per_gap = available_space / num_gaps

        # Draw each word with calculated spacing
        current_x = x
        for i, word in enumerate(words):
            c.drawString(current_x, y, word)
            if i < len(words) - 1:  # Not the last word
                word_width = c.stringWidth(word, font_name, font_size)
                current_x += word_width + space_per_gap
    else:
        # Fallback to normal left-aligned text
        c.drawString(x, y, text)


def wrap_text_for_justify(text, max_chars_per_line):
    """
    Custom text wrapping that's better suited for justification
    """
    paragraphs = text.split("\n\n")
    wrapped_lines = []

    for paragraph in paragraphs:
        if paragraph.strip():
            # Use textwrap but with more conservative line length for better justification
            lines = textwrap.wrap(
                paragraph.strip(), width=max_chars_per_line, break_long_words=False
            )
            wrapped_lines.extend(lines)
        wrapped_lines.append("")  # Empty line between paragraphs

    return wrapped_lines


# Global QR service instance
qr_service = QRCodeService()
