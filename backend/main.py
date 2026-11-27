"""REST API for the TouristStar bus ticket booking application."""

from datetime import date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError

from database import get_supabase

app = FastAPI(title="TouristStar Bus Booking API", version="1.0.0")
INDIA_TZ = ZoneInfo("Asia/Kolkata")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class BookingRequest(BaseModel):
    trip_id: str
    seat_numbers: list[int] = Field(min_length=1, max_length=8)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)


def _db(*, access_token: str | None = None):
    try:
        return get_supabase(access_token=access_token)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _api_error(exc: APIError) -> HTTPException:
    message = getattr(exc, "message", None) or "The request could not be completed."
    return HTTPException(status_code=400, detail=message)


def current_user(authorization: Annotated[str | None, Header()] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    client = _db(access_token=token)
    try:
        result = client.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.") from exc
    if not result or not result.user:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return {"client": client, "user": result.user}


@app.get("/")
def home():
    return {"name": "TouristStar Bus Booking API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register", status_code=201)
def register(data: RegisterRequest):
    client = _db()
    try:
        result = client.auth.sign_up(
            {
                "email": str(data.email),
                "password": data.password,
                "options": {"data": {"full_name": data.name.strip()}},
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not create the account. Check the email and try again.") from exc
    return {
        "message": "Account created. Check your email to confirm it if confirmation is enabled.",
        "user_id": result.user.id if result.user else None,
        "signed_in": result.session is not None,
    }


@app.get("/trips/search")
def search_trips(
    origin: Annotated[str, Query(min_length=1, max_length=100)],
    destination: Annotated[str, Query(min_length=1, max_length=100)],
    travel_date: date,
):
    if origin.strip().casefold() == destination.strip().casefold():
        raise HTTPException(status_code=422, detail="Origin and destination must be different.")
    start = datetime.combine(travel_date, time.min, tzinfo=INDIA_TZ)
    end = start + timedelta(days=1)
    try:
        result = (
            _db()
            .from_("trip_availability")
            .select("id,origin,destination,departure_at,arrival_at,fare,available_seats,bus_name,operator,bus_type")
            .ilike("origin", origin.strip())
            .ilike("destination", destination.strip())
            .gte("departure_at", start.isoformat())
            .lt("departure_at", end.isoformat())
            .eq("status", "scheduled")
            .order("departure_at")
            .execute()
        )
    except APIError as exc:
        raise _api_error(exc) from exc
    return {"trips": result.data or []}


@app.post("/bookings", status_code=201)
def create_booking(data: BookingRequest, auth=Depends(current_user)):
    if len(set(data.seat_numbers)) != len(data.seat_numbers):
        raise HTTPException(status_code=422, detail="Choose each seat only once.")
    try:
        result = auth["client"].rpc(
            "create_booking",
            {"p_trip_id": data.trip_id, "p_seat_numbers": data.seat_numbers},
        ).execute()
    except APIError as exc:
        raise _api_error(exc) from exc
    return {"booking_code": result.data}


@app.get("/bookings")
def list_bookings(auth=Depends(current_user)):
    try:
        result = (
            auth["client"]
            .from_("bookings")
            .select("id,booking_code,status,total_amount,created_at,trips(origin,destination,departure_at,buses(name,operator)),booking_seats(seat_number)")
            .order("created_at", desc=True)
            .execute()
        )
    except APIError as exc:
        raise _api_error(exc) from exc
    return {"bookings": result.data or []}


@app.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, auth=Depends(current_user)):
    try:
        result = auth["client"].rpc("cancel_booking", {"p_booking_id": booking_id}).execute()
    except APIError as exc:
        raise _api_error(exc) from exc
    return {"cancelled": True}


@app.get("/profile")
def get_profile(auth=Depends(current_user)):
    try:
        result = auth["client"].from_("profiles").select("full_name,phone").eq("id", auth["user"].id).single().execute()
    except APIError as exc:
        raise _api_error(exc) from exc
    return {**(result.data or {}), "email": auth["user"].email}


@app.patch("/profile")
def update_profile(data: ProfileUpdate, auth=Depends(current_user)):
    try:
        result = (
            auth["client"]
            .from_("profiles")
            .update({"full_name": data.full_name.strip(), "phone": data.phone.strip() if data.phone else None})
            .eq("id", auth["user"].id)
            .select("full_name,phone")
            .single()
            .execute()
        )
    except APIError as exc:
        raise _api_error(exc) from exc
    return result.data
