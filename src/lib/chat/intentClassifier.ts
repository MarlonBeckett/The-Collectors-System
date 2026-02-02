import { GoogleGenAI } from '@google/genai';
import { QueryIntent, VehicleContext } from '@/types/research';

const PRODUCT_RESEARCH_INDICATORS = [
  'best',
  'recommend',
  'recommendation',
  'buy',
  'purchase',
  'what.*should.*get',
  'what.*battery',
  'what.*tire',
  'what.*oil',
  'which.*should',
  'where.*buy',
  'where.*find',
  'price',
  'cost',
  'compare',
  'comparison',
  'review',
  'upgrade',
  'replacement',
  'part',
  'parts',
  'accessory',
  'accessories',
  'gear',
  'equipment',
  'tool',
  'tools',
  'product',
  'products',
  'options',
  'vs',
  'versus',
];

// Patterns for follow-up product research (user wants more options)
const FOLLOWUP_RESEARCH_PATTERNS = [
  'other options',
  'more options',
  'any other',
  'what else',
  'alternatives',
  'another',
  'different',
];

const QUICK_QUESTION_INDICATORS = [
  'how many',
  'how much.*have',
  'what is my',
  "what's my",
  'list my',
  'show my',
  'tell me about my',
  'which.*do i have',
  'when.*expire',
  'expired',
  'expiring',
  'maintenance.*needed',
  'needs.*maintenance',
  'status',
  'mileage',
  'plate',
  'vin',
  'registration',
];

export function classifyIntentFast(message: string): QueryIntent {
  const lowerMessage = message.toLowerCase();

  // Check for follow-up research patterns (user wants more product options)
  for (const pattern of FOLLOWUP_RESEARCH_PATTERNS) {
    if (lowerMessage.includes(pattern)) {
      return 'product_research';
    }
  }

  // Check for quick question patterns (collection-specific queries)
  for (const pattern of QUICK_QUESTION_INDICATORS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lowerMessage)) {
      return 'quick_question';
    }
  }

  // Check for product research patterns
  for (const pattern of PRODUCT_RESEARCH_INDICATORS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lowerMessage)) {
      return 'product_research';
    }
  }

  return 'general_chat';
}

export async function classifyIntentWithAI(
  message: string,
  apiKey: string
): Promise<{ intent: QueryIntent; vehicleMentioned?: string }> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Classify this user message into one of three categories:
1. "product_research" - User is asking about products, parts, accessories, gear, or recommendations to buy
2. "quick_question" - User is asking about their specific vehicle collection data (counts, statuses, expirations, etc.)
3. "general_chat" - General conversation or questions not fitting above categories

Also extract the vehicle name or type mentioned if any.

User message: "${message}"

Respond in JSON format:
{"intent": "product_research" | "quick_question" | "general_chat", "vehicleMentioned": "vehicle name or null"}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);
    return {
      intent: parsed.intent as QueryIntent,
      vehicleMentioned: parsed.vehicleMentioned || undefined,
    };
  } catch {
    // Fallback to fast classification on error
    return { intent: classifyIntentFast(message) };
  }
}

export function findVehicleContext(
  vehicleMentioned: string | undefined,
  vehicles: Array<{
    id: string;
    name: string;
    vehicle_type: string;
    year: number | null;
    make: string | null;
    model: string | null;
    nickname: string | null;
  }>
): VehicleContext | undefined {
  if (!vehicleMentioned || !vehicles.length) return undefined;

  const searchTerm = vehicleMentioned.toLowerCase();

  // Try exact name match first
  let match = vehicles.find(
    (v) => v.name.toLowerCase() === searchTerm || v.nickname?.toLowerCase() === searchTerm
  );

  // Try partial match
  if (!match) {
    match = vehicles.find(
      (v) =>
        v.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(v.name.toLowerCase()) ||
        v.nickname?.toLowerCase().includes(searchTerm) ||
        (v.model && searchTerm.includes(v.model.toLowerCase())) ||
        (v.make && searchTerm.includes(v.make.toLowerCase()))
    );
  }

  if (match) {
    return {
      id: match.id,
      name: match.name,
      vehicleType: match.vehicle_type,
      year: match.year,
      make: match.make,
      model: match.model,
      nickname: match.nickname,
    };
  }

  return undefined;
}
