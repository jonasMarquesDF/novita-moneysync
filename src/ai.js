// =============================================================================
// Novitá MoneySync - Serviço de Inteligência Artificial (Google Gemini)
// =============================================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

export const isAiConfigured = Boolean(
  GEMINI_API_KEY && 
  !GEMINI_API_KEY.includes('your-key') && 
  GEMINI_API_KEY.length > 10
);

/**
 * Envia uma mensagem ou comando para o Gemini e retorna a resposta textual.
 */
export async function askGemini(prompt, systemInstruction = '') {
  if (!isAiConfigured) {
    throw new Error('Chave do Google Gemini não configurada no arquivo .env.');
  }

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro Gemini HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

/**
 * Analisa as despesas do mês e devolve insights e recomendações de economia.
 */
export async function analyzeFinancesWithAi(entries, userProfile = {}) {
  const simplifiedEntries = entries.map(e => ({
    desc: e.description,
    valor: (e.amount_cents / 100).toFixed(2),
    tipo: e.kind,
    pago: e.paid,
    vencimento: e.dueDay ? `dia ${e.dueDay}` : 'não informado'
  }));

  const systemPrompt = `Você é o Consultor Financeiro Inteligente do Novitá MoneySync.
Analise a lista de despesas e receitas enviada em JSON.
Devolva uma resposta em texto amigável e encorajadora em Português do Brasil com:
1. Resumo da saúde financeira deste mês (se sobrou ou faltou margem).
2. Onde está o maior peso dos gastos.
3. 2 dicas práticas de economia ou prevenção de atrasos.
4. Alerta caso haja contas vencidas ou próximas do vencimento sem pagamento.`;

  const userPrompt = `Minhas movimentações financeiras do mês:
${JSON.stringify(simplifiedEntries, null, 2)}
Usuário: ${userProfile.name || 'Usuário'}`;

  return await askGemini(userPrompt, systemPrompt);
}

/**
 * Categoriza automaticamente uma despesa a partir da sua descrição.
 */
export async function categorizeExpenseWithAi(description) {
  const prompt = `Classifique a despesa "${description}" em UMA única categoria entre:
[Moradia, Alimentação, Transporte, Lazer, Saúde, Educação, Assinaturas, Outros].
Responda APENAS o nome da categoria, sem explicações.`;

  try {
    const result = await askGemini(prompt);
    return result.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
  } catch (e) {
    return 'Outros';
  }
}
