"""Configuration management using Pydantic Settings."""

import re
from typing import List, Optional
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application settings
    app_name: str = Field(
        default="Nautobot Schema Discovery API", description="Application name"
    )
    app_version: str = Field(default="1.0.0", description="Application version")
    debug: bool = Field(default=False, description="Debug mode")

    # Server settings
    host: str = Field(default="localhost", description="Server host")
    port: int = Field(default=8000, description="Server port")
    reload: bool = Field(default=False, description="Auto-reload on code changes")

    # CORS settings
    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed CORS origins",
    )
    cors_credentials: bool = Field(
        default=True, description="Allow credentials in CORS"
    )
    cors_methods: List[str] = Field(default=["*"], description="Allowed CORS methods")
    cors_headers: List[str] = Field(default=["*"], description="Allowed CORS headers")

    # Nautobot settings
    nautobot_url: str = Field(..., description="Nautobot instance URL")
    nautobot_token: str = Field(..., description="Nautobot API token")
    nautobot_timeout: int = Field(default=30, description="Request timeout in seconds")
    nautobot_retries: int = Field(default=3, description="Number of retry attempts")

    # Logging settings
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Logging format (json or text)")

    # Cache settings
    redis_url: Optional[str] = Field(default=None, description="Redis URL for caching")
    cache_ttl: int = Field(default=3600, description="Cache TTL in seconds")

    # Database settings
    database_url: str = Field(
        default="sqlite:///./nautobot_schema.db",
        description="Database URL for persistent storage",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()

    @field_validator("log_format")
    @classmethod
    def validate_log_format(cls, v):
        """Validate log format."""
        valid_formats = ["json", "text"]
        if v.lower() not in valid_formats:
            raise ValueError(f"Invalid log format. Must be one of: {valid_formats}")
        return v.lower()

    @field_validator("nautobot_url")
    @classmethod
    def validate_nautobot_url(cls, v):
        """Validate Nautobot URL format and security."""
        if not v or not v.strip():
            raise ValueError("Nautobot URL cannot be empty")

        v = v.strip()
        parsed = urlparse(v)

        # Must have scheme (http or https)
        if not parsed.scheme:
            raise ValueError("Nautobot URL must include scheme (http:// or https://)")

        if parsed.scheme not in ["http", "https"]:
            raise ValueError("Nautobot URL scheme must be http or https")

        # Must have hostname
        if not parsed.hostname:
            raise ValueError("Nautobot URL must include a valid hostname")

        # Remove trailing slash for consistency
        return v.rstrip("/")

    @field_validator("nautobot_token")
    @classmethod
    def validate_nautobot_token(cls, v):
        """Validate Nautobot API token format."""
        if not v or not v.strip():
            raise ValueError("Nautobot API token cannot be empty")

        v = v.strip()

        # Basic format validation for Nautobot tokens (40-character hex)
        if not re.match(r"^[a-f0-9]{40}$", v):
            raise ValueError(
                "Nautobot API token must be a 40-character hexadecimal string"
            )

        return v

    @field_validator("redis_url", mode="before")
    @classmethod
    def validate_redis_url(cls, v):
        """Validate Redis URL if provided."""
        if v is None or not v.strip():
            return None

        v = v.strip()
        parsed = urlparse(v)

        if parsed.scheme not in ["redis", "rediss"]:
            raise ValueError("Redis URL must use redis:// or rediss:// scheme")

        if not parsed.hostname:
            raise ValueError("Redis URL must include a valid hostname")

        return v

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v):
        """Validate database URL format."""
        if not v or not v.strip():
            raise ValueError("Database URL cannot be empty")

        v = v.strip()
        parsed = urlparse(v)

        # Accept common database schemes
        valid_schemes = ["sqlite", "postgresql", "mysql", "mariadb"]
        if parsed.scheme not in valid_schemes:
            raise ValueError(f"Database URL scheme must be one of: {valid_schemes}")

        return v

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "env_nested_delimiter": "__",
    }


# Global settings instance
settings = Settings()
