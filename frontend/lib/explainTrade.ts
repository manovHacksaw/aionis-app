import { prisma } from './prisma';

export async function explainTrade(
  attempt: any,
  riskLevel: number,
  maxPerTradePct: number
): Promise<string> {
  const requestId = attempt.requestId;

  // 1. Check database cache first
  try {
    const cached = await prisma.tradeExplanation.findUnique({
      where: { requestId },
    });
    if (cached) {
      return cached.explanation;
    }
  } catch (err) {
    console.error('[explainTrade] Database cache fetch error:', err);
  }

  // 2. Fallback check for API keys
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    const fallback = getDefaultExplanation(attempt, riskLevel);
    await saveCache(requestId, fallback);
    return fallback;
  }

  // 3. Construct the prompt
  const prompt = `You are the AI trading agent for Aionis, an on-chain copy-trading platform.
Explain in exactly one plain-English sentence why a trade was copied or skipped based on these parameters:
- Leader Trade: ${attempt.side ?? (attempt.status === 'opened' ? 'BUY' : 'Trade')} of token ${attempt.token ?? 'unknown'} (value: $${attempt.usdValue !== null ? attempt.usdValue.toFixed(2) : 'unknown'})
- Action: ${attempt.status === 'opened' ? 'COPIED' : 'SKIPPED'}
- Score: ${attempt.score ?? 'unknown'}/100
- Allocated Capital: ${attempt.ausdAllocated !== null ? `${attempt.ausdAllocated.toFixed(2)} aUSD` : 'none'}
- Entry Price: ${attempt.entryPrice !== null ? `$${attempt.entryPrice.toFixed(4)}` : 'none'}
- Resolution/Skip Reason: ${attempt.reason ?? 'none'}
- Follower Settings: Risk Level ${riskLevel}/5, Max Allocation ${maxPerTradePct}% per trade

Examples of tone and copy style:
- "The agent copy-traded $45.00 aUSD of WSOMI (score 85/100) — the leader committed 25% of their portfolio to this entry, aligning with your moderate risk settings."
- "Skipped: slippage limit exceeded — price moved 2.4% past your 1% threshold."
- "Skipped: token not in allowlist — the leader bought NIA, which is currently deselected in your agent's settings."
- "Skipped: insufficient balance — the calculated minimum allocation was $15.00, but your agent only has $4.20 in free capital."

Write only the final sentence. Do not include any quotes, formatting, prefix, or explanation.`;

  let explanation = '';

  try {
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 120 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        explanation =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      } else {
        console.error(
          `[explainTrade] Gemini API returned error status: ${res.status}`
        );
      }
    } else if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 120,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        explanation = data.choices?.[0]?.message?.content?.trim() ?? '';
      } else {
        console.error(
          `[explainTrade] OpenAI API returned error status: ${res.status}`
        );
      }
    }
  } catch (err) {
    console.error('[explainTrade] LLM API fetch error:', err);
  }

  // Fallback if LLM invocation fails or returns empty
  if (!explanation) {
    explanation = getDefaultExplanation(attempt, riskLevel);
  }

  // Clean raw quote wrappers if any
  explanation = explanation.replace(/^["']|["']$/g, '').trim();

  // Save to database cache
  await saveCache(requestId, explanation);

  return explanation;
}

async function saveCache(requestId: string, explanation: string): Promise<void> {
  try {
    await prisma.tradeExplanation.upsert({
      where: { requestId },
      create: { requestId, explanation },
      update: { explanation },
    });
  } catch (err) {
    console.error('[explainTrade] Database cache save error:', err);
  }
}

function getDefaultExplanation(attempt: any, riskLevel: number): string {
  const token = attempt.token ?? 'token';
  const scoreText = attempt.score !== null ? ` (score ${attempt.score}/100)` : '';
  
  if (attempt.status === 'opened') {
    const allocated = attempt.ausdAllocated !== null ? `$${attempt.ausdAllocated.toFixed(2)} aUSD` : 'funds';
    const price = attempt.entryPrice !== null ? ` at $${attempt.entryPrice.toFixed(4)}` : '';
    return `Copied: the agent allocated ${allocated} of ${token}${price}${scoreText} — aligning with your risk level ${riskLevel} settings.`;
  }
  
  if (attempt.status === 'skipped') {
    const reasonText = attempt.reason ? `: ${attempt.reason.toLowerCase()}` : '';
    return `Skipped${reasonText}${scoreText} — criteria not met.`;
  }
  
  return `Pending evaluation for ${token} trade${scoreText}.`;
}
