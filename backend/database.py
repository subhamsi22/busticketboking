"""Supabase client helpers shared by the API routes."""

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).with_name(".env"))


def get_supabase(*, access_token: str | None = None) -> Client:
    """Create a Supabase client, optionally scoped to a signed-in user."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in backend/.env")

    client = create_client(url, key)
    if access_token:
        client.postgrest.auth(access_token)
    return client
