from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Endgame API"
    app_env: str = "development"
    jwt_secret: str = "replace-me"
    openai_api_key: str = ""
    cors_origins: str = "http://localhost:3000"
    

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

