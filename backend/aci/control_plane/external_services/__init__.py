"""
Service layer for control plane business logic.
"""

from aci.control_plane.external_services.email_service import email_service

__all__ = ["email_service"]
