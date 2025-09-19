import hashlib
import json
import re

from aci.common.exceptions import MCPToolSanitizationError
from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


def normalize_and_hash_content(content: str | dict) -> str:
    """
    Normalize content and generate a hash to detect meaningful changes while ignoring formatting.

    For strings: keeps only letters and numbers (removes punctuation, whitespace, etc.)
    For objects: converts to normalized JSON with sorted keys
    """
    if isinstance(content, str):
        # Normalize string content:
        # 1. Convert to lowercase for case-insensitive comparison
        # 2. Keep only letters and numbers (remove all punctuation, whitespace, etc.)
        normalized = re.sub(r"[^a-z0-9]", "", content.lower())
    else:
        # For objects (like inputSchema), convert to normalized JSON
        # Sort keys to ensure consistent ordering
        normalized = json.dumps(content, sort_keys=True, separators=(",", ":"))

    # Generate SHA-256 hash of normalized content
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def sanitize_canonical_tool_name(canonical_tool_name: str) -> str:
    """
    Convert MCP tool name to comply with naming rules: uppercase letters, numbers, underscores only,
    no consecutive underscores
    """
    # Convert to uppercase
    sanitized = canonical_tool_name.upper()

    # Replace any non-alphanumeric characters (except underscores) with underscores
    sanitized = re.sub(r"[^A-Z0-9_]", "_", sanitized)

    # Remove consecutive underscores by replacing multiple underscores with single underscore
    sanitized = re.sub(r"_+", "_", sanitized)

    # Remove leading and trailing underscores
    sanitized = sanitized.strip("_")

    if not sanitized:
        raise MCPToolSanitizationError(
            f"Tool name '{canonical_tool_name}' is empty after sanitization."
        )

    return sanitized
