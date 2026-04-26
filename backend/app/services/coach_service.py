from __future__ import annotations

import httpx

from ..config import settings
from ..schemas import CoachExplanationRequest


def fallback_explanation(request: CoachExplanationRequest) -> str:
    severity_copy = {
        "blunder": "This move swings the game sharply because it misses a tactical threat or drops key material.",
        "mistake": "This move is playable, but it gives away important initiative or a cleaner plan.",
        "inaccuracy": "This move is close to fine, but there was a more precise way to improve the position.",
        "best": "This is the engine's preferred move and fits the demands of the position well.",
    }
    return (
        f"{severity_copy[request.severity]} "
        f"Stockfish preferred {request.best_move} with an evaluation of {request.evaluation} centipawns."
    )


async def explain_move(request: CoachExplanationRequest) -> str:
    if not settings.openai_api_key:
        return fallback_explanation(request)

    payload = {
        "model": "gpt-5-mini",
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": "You are a friendly chess coach. Explain positions in under 90 words.",
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            f"Move played: {request.san}\n"
                            f"Severity: {request.severity}\n"
                            f"Best move: {request.best_move}\n"
                            f"Evaluation: {request.evaluation}\n"
                            f"Centipawn swing: {request.delta}\n"
                            f"Position notes: {request.position_context}"
                        ),
                    }
                ],
            },
        ],
        "reasoning": {"effort": "minimal"},
        "max_output_tokens": 180,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("output_text") or fallback_explanation(request)

