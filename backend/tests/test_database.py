#!/usr/bin/env python3
"""
Test database connection for Supabase
"""

import sys
import os
import pytest

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.config import test_database_connection, get_database_url, settings


def test_database_connection_success():
    """Test that database connection works"""
    print(f"🔧 Testing Supabase database connection...")
    print(f"📍 Database URL: {get_database_url()}")
    
    # Test connection
    success = test_database_connection()
    
    assert success, "Database connection should be successful"
    print("✅ Database connection test passed!")


def test_database_url_format():
    """Test that database URL is properly formatted"""
    url = get_database_url()
    
    # Check basic format
    assert url.startswith("postgresql+psycopg2://"), "URL should use psycopg2 driver"
    assert "sslmode=require" in url, "SSL should be required"
    assert "@" in url, "URL should contain credentials"
    
    print(f"✅ Database URL format is correct: {url[:30]}...")


def test_config_parsing():
    """Test that configuration is properly parsed"""
    # Test CORS origins parsing
    from app.core.config import get_cors_origins, get_allowed_hosts
    
    cors_origins = get_cors_origins()
    allowed_hosts = get_allowed_hosts()
    
    assert isinstance(cors_origins, list), "CORS origins should be a list"
    assert isinstance(allowed_hosts, list), "Allowed hosts should be a list"
    
    print(f"✅ CORS origins: {cors_origins}")
    print(f"✅ Allowed hosts: {allowed_hosts}")


if __name__ == "__main__":
    print("🧪 Running database tests...")
    
    try:
        test_database_url_format()
        test_config_parsing()
        test_database_connection_success()
        
        print("\n🎉 All database tests passed!")
        
    except Exception as e:
        print(f"\n💥 Test failed: {e}")
        sys.exit(1)