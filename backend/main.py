from fastapi import FastAPI
from database import supabase

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Python Backend Connected"}

@app.post("/register")
def register(data: dict):

    response = supabase.auth.sign_up({
        "email": data["email"],
        "password": data["password"],
        "options": {
            "data": {
                "full_name": data["name"]
            }
        }
    })

    return {"message": "Registration request processed"}