import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

type Payload = {
  san: string;
  severity: "best" | "inaccuracy" | "mistake" | "blunder";
  bestMove: string;
  evaluation: number;
  delta: number;
  positionContext: string;
};

function fallbackExplanation(payload: Payload) {
  const severityCopy = {
    best: "This move lines up with the engine's top choice and keeps the plan efficient.",
    inaccuracy:
      "This move is playable, but it misses a more precise continuation that would improve your position.",
    mistake:
      "This move gives away meaningful value, usually by loosening your structure or missing a cleaner tactical idea.",
    blunder:
      "This move changes the evaluation sharply and likely overlooks a direct tactical punishment.",
  };

  return `${severityCopy[payload.severity]} Stockfish preferred ${payload.bestMove}.`;
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as Payload;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      explanation: fallbackExplanation(payload),
    });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "minimal" },
      max_output_tokens: 160,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a warm chess coach. Explain the move in under 90 words, with plain language and one practical lesson.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Played move: ${payload.san}`,
                `Severity: ${payload.severity}`,
                `Engine best move: ${payload.bestMove}`,
                `Evaluation: ${payload.evaluation}`,
                `Centipawn swing: ${payload.delta}`,
                `Context: ${payload.positionContext}`,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      explanation: response.output_text || fallbackExplanation(payload),
    });
  } catch {
    return NextResponse.json({
      explanation: fallbackExplanation(payload),
    });
  }
}

