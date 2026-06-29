from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    full_name: str
    email: str


class TokenData(BaseModel):
    user_id: int | None = None
