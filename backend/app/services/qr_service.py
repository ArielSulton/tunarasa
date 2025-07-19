"""
QR Code generation service for conversation summaries
"""

import qrcode
import qrcode.image.svg
from io import BytesIO
import base64
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import json
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)


class QRCodeService:
    """Service for generating QR codes for conversation summaries"""
    
    def __init__(self):
        self.base_url = "https://tunarasa.app"  # Production URL
        
    def generate_conversation_summary_qr(
        self, 
        conversation_id: int,
        user_id: int,
        summary_data: Dict[str, Any]
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
            
            # Create summary URL
            summary_url = f"{self.base_url}/api/v1/summary/{access_token}"
            
            # Create QR code data
            qr_data = {
                "type": "conversation_summary",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "access_token": access_token,
                "url": summary_url,
                "generated_at": datetime.utcnow().isoformat(),
                "summary": {
                    "title": summary_data.get("title", "Ringkasan Percakapan"),
                    "message_count": summary_data.get("message_count", 0),
                    "duration": summary_data.get("duration", "0 menit"),
                    "topics": summary_data.get("topics", [])
                }
            }
            
            # Generate QR code
            qr_code_base64 = self._create_qr_code(summary_url)
            
            # Store access token and data (in production, store in database/Redis)
            # For now, we'll return the structure
            
            return {
                "qr_code_base64": qr_code_base64,
                "access_token": access_token,
                "download_url": summary_url,
                "qr_data": json.dumps(qr_data, ensure_ascii=False)
            }
            
        except Exception as e:
            logger.error(f"Failed to generate QR code for conversation {conversation_id}: {e}")
            raise
    
    def generate_note_qr(
        self, 
        note_id: int,
        conversation_id: int,
        note_content: str
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
            
            # Create note access URL
            note_url = f"{self.base_url}/api/v1/note/{access_token}"
            
            # Create QR code data
            qr_data = {
                "type": "note_access",
                "note_id": note_id,
                "conversation_id": conversation_id,
                "access_token": access_token,
                "url": note_url,
                "generated_at": datetime.utcnow().isoformat(),
                "preview": note_content[:100] + "..." if len(note_content) > 100 else note_content
            }
            
            # Generate QR code
            qr_code_base64 = self._create_qr_code(note_url)
            
            return {
                "qr_code_base64": qr_code_base64,
                "access_token": access_token,
                "access_url": note_url,
                "qr_data": json.dumps(qr_data, ensure_ascii=False)
            }
            
        except Exception as e:
            logger.error(f"Failed to generate QR code for note {note_id}: {e}")
            raise
    
    def _create_qr_code(self, data: str, size: int = 200) -> str:
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
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            logger.error(f"Failed to create QR code: {e}")
            raise
    
    def create_summary_document(
        self,
        conversation_data: Dict[str, Any],
        messages: list,
        format_type: str = "text"
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
                return self._create_html_summary(conversation_data, messages)
            else:
                return self._create_text_summary(conversation_data, messages)
                
        except Exception as e:
            logger.error(f"Failed to create summary document: {e}")
            raise
    
    def _create_text_summary(self, conversation_data: Dict, messages: list) -> str:
        """Create plain text summary"""
        
        title = conversation_data.get("title", "Ringkasan Percakapan")
        created_at = conversation_data.get("created_at", datetime.utcnow().isoformat())
        
        summary = f"""
RINGKASAN PERCAKAPAN TUNARASA
=============================

Judul: {title}
Tanggal: {created_at}
Total Pesan: {len(messages)}

ISI PERCAKAPAN:
---------------

"""
        
        for i, message in enumerate(messages, 1):
            sender = "👤 Pengguna" if message.get("sender_type") == "user" else "🤖 AI"
            content = message.get("content", "")
            timestamp = message.get("created_at", "")
            
            summary += f"{i}. {sender} ({timestamp}):\n{content}\n\n"
        
        summary += """
---
Dibuat oleh Tunarasa - Platform Bahasa Isyarat Indonesia
https://tunarasa.app
"""
        
        return summary
    
    def _create_json_summary(self, conversation_data: Dict, messages: list) -> str:
        """Create JSON summary"""
        
        summary_data = {
            "conversation": conversation_data,
            "messages": messages,
            "summary": {
                "total_messages": len(messages),
                "user_messages": len([m for m in messages if m.get("sender_type") == "user"]),
                "ai_messages": len([m for m in messages if m.get("sender_type") == "ai"]),
                "generated_at": datetime.utcnow().isoformat()
            },
            "platform": {
                "name": "Tunarasa",
                "description": "Platform Bahasa Isyarat Indonesia",
                "url": "https://tunarasa.app"
            }
        }
        
        return json.dumps(summary_data, indent=2, ensure_ascii=False)
    
    def _create_html_summary(self, conversation_data: Dict, messages: list) -> str:
        """Create HTML summary"""
        
        title = conversation_data.get("title", "Ringkasan Percakapan")
        created_at = conversation_data.get("created_at", datetime.utcnow().isoformat())
        
        html = f"""
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Tunarasa</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #f5f5f5; padding: 20px; border-radius: 10px; margin-bottom: 20px; }}
        .message {{ margin: 15px 0; padding: 15px; border-radius: 8px; }}
        .user {{ background: #e3f2fd; border-left: 4px solid #2196f3; }}
        .ai {{ background: #f3e5f5; border-left: 4px solid #9c27b0; }}
        .timestamp {{ font-size: 12px; color: #666; }}
        .footer {{ margin-top: 30px; text-align: center; color: #666; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🤟 {title}</h1>
        <p><strong>Tanggal:</strong> {created_at}</p>
        <p><strong>Total Pesan:</strong> {len(messages)}</p>
    </div>
    
    <div class="conversation">
"""
        
        for message in messages:
            sender_class = "user" if message.get("sender_type") == "user" else "ai"
            sender_name = "👤 Pengguna" if message.get("sender_type") == "user" else "🤖 AI Assistant"
            content = message.get("content", "")
            timestamp = message.get("created_at", "")
            
            html += f"""
        <div class="message {sender_class}">
            <div class="timestamp">{sender_name} - {timestamp}</div>
            <div class="content">{content}</div>
        </div>
"""
        
        html += """
    </div>
    
    <div class="footer">
        <p>Dibuat oleh <strong>Tunarasa</strong> - Platform Bahasa Isyarat Indonesia</p>
        <p><a href="https://tunarasa.app">https://tunarasa.app</a></p>
    </div>
</body>
</html>
"""
        
        return html


# Global QR service instance
qr_service = QRCodeService()