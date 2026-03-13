"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")


class LoginRequest(BaseModel):
    username: str
    password: str

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# Load teacher credentials
teachers_file = Path(__file__).parent / "teachers.json"
with open(teachers_file) as f:
    teachers = json.load(f)

# In-memory session store.
# Sessions may be stored in one of two formats:
#   - Legacy: {token: username}
#   - New:    {token: {"username": str, "created_at": datetime, "expires_at": datetime}}
# This allows us to introduce TTL without breaking existing code that writes plain usernames.
sessions: dict = {}

# Session time-to-live (TTL) in seconds (e.g., 8 hours)
SESSION_TTL_SECONDS = 60 * 60 * 8


def _is_session_expired(session_value) -> bool:
    """Return True if the given session metadata is expired."""
    if not isinstance(session_value, dict):
        # Legacy format has no explicit expiry; treat as not expired here.
        return False
    expires_at = session_value.get("expires_at")
    if not isinstance(expires_at, datetime):
        return False
    now = datetime.now(timezone.utc)
    return now > expires_at


def verify_teacher(authorization: Optional[str]):
    """Validate a Bearer token and return the username."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1]

    # Opportunistically prune expired sessions
    now = datetime.now(timezone.utc)
    expired_tokens = []
    for t, value in list(sessions.items()):
        if _is_session_expired(value):
            expired_tokens.append(t)
    for t in expired_tokens:
        sessions.pop(t, None)

    session_value = sessions.get(token)
    if session_value is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    # If the session is in legacy format (a plain username string), convert it
    # to the new metadata format on first successful verification.
    if isinstance(session_value, str):
        username = session_value
        sessions[token] = {
            "username": username,
            "created_at": now,
            "expires_at": now + timedelta(seconds=SESSION_TTL_SECONDS),
        }
        return username

    # New structured format: enforce expiry.
    if _is_session_expired(session_value):
        # Remove the expired session and reject the request.
        sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    username = session_value.get("username")
    if not isinstance(username, str):
        # Malformed session; remove it and reject.
        sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return username


# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    authorization: Optional[str] = Header(default=None)
):
    """Sign up a student for an activity"""
    verify_teacher(authorization)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    authorization: Optional[str] = Header(default=None)
):
    """Unregister a student from an activity"""
    verify_teacher(authorization)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}


@app.post("/login")
def login(
    credentials: LoginRequest,
    username: Optional[str] = Query(default=None),
    password: Optional[str] = Query(default=None),
):
    """Authenticate a teacher and return a session token"""
    # Disallow credentials in the query string to avoid leaking them via URLs/logs
    if username is not None or password is not None:
        raise HTTPException(
            status_code=400,
            detail="Credentials must be sent in the request body, not the query string",
        )

    teacher = teachers.get(credentials.username)
    if not teacher:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    expected_hash = hashlib.pbkdf2_hmac(
        "sha256", credentials.password.encode(), teacher["salt"].encode(), 100000
    ).hex()
    if not secrets.compare_digest(expected_hash, teacher["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_hex(32)
    sessions[token] = credentials.username
    return {"token": token, "username": credentials.username}


@app.post("/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    """Invalidate the current session token"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        sessions.pop(token, None)
    return {"message": "Logged out"}


@app.get("/auth/status")
def auth_status(authorization: Optional[str] = Header(default=None)):
    """Return current authentication state"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        if token in sessions:
            return {"authenticated": True, "username": sessions[token]}
    return {"authenticated": False}
