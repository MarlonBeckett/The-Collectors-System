import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { daysUntilExpiration } from '@/lib/dateUtils';
import { Motorcycle } from '@/types/database';

interface SuggestionContext {
  vehicles: Motorcycle[];
  needsMaintenance: Motorcycle[];
  expiringTabs: Motorcycle[];
  expiredTabs: Motorcycle[];
  recentVehicle: Motorcycle | null;
}

function generateSuggestions(context: SuggestionContext): string[] {
  const { vehicles, needsMaintenance, expiringTabs, expiredTabs, recentVehicle } = context;
  const suggestions: string[] = [];

  // No vehicles - return onboarding prompts
  if (vehicles.length === 0) {
    return [
      "What can you help me with?",
      "How do I add my first vehicle?",
      "What features does this app have?",
      "Tell me about vehicle maintenance schedules",
    ];
  }

  // Priority 1: Urgent attention items
  if (expiredTabs.length > 0) {
    const vehicle = expiredTabs[0];
    suggestions.push(`My ${vehicle.name} tabs are expired - what should I do?`);
  }

  if (needsMaintenance.length > 0) {
    const vehicle = needsMaintenance[0];
    if (vehicle.maintenance_notes) {
      suggestions.push(`Help me fix the ${vehicle.name}: ${vehicle.maintenance_notes}`);
    } else {
      suggestions.push(`What maintenance does my ${vehicle.name} need?`);
    }
  }

  // Priority 2: Upcoming items
  if (expiringTabs.length > 0 && suggestions.length < 2) {
    const vehicle = expiringTabs[0];
    const days = daysUntilExpiration(vehicle.tab_expiration);
    suggestions.push(`My ${vehicle.name} tabs expire in ${days} days - remind me what I need`);
  }

  // Priority 3: Vehicle-specific helpful suggestions
  if (suggestions.length < 3) {
    // Pick a random active vehicle for product suggestions
    const activeVehicles = vehicles.filter(v => v.status === 'active');
    if (activeVehicles.length > 0) {
      const randomVehicle = activeVehicles[Math.floor(Math.random() * activeVehicles.length)];
      const vehicleType = randomVehicle.vehicle_type || 'motorcycle';

      // Generate contextual product questions based on vehicle type
      const productQuestions: Record<string, string[]> = {
        motorcycle: [
          `What battery should I get for my ${randomVehicle.name}?`,
          `What are the best tires for my ${randomVehicle.name}?`,
          `What oil should I use in my ${randomVehicle.name}?`,
        ],
        car: [
          `What are the best tires for my ${randomVehicle.name}?`,
          `What oil should I use in my ${randomVehicle.name}?`,
          `What battery fits my ${randomVehicle.name}?`,
        ],
        boat: [
          `What maintenance does my ${randomVehicle.name} need before the season?`,
          `What battery should I get for my ${randomVehicle.name}?`,
        ],
        trailer: [
          `What tires should I get for my ${randomVehicle.name}?`,
          `What maintenance does my ${randomVehicle.name} need?`,
        ],
        other: [
          `What maintenance does my ${randomVehicle.name} need?`,
        ],
      };

      const typeQuestions = productQuestions[vehicleType] || productQuestions.other;
      const randomQuestion = typeQuestions[Math.floor(Math.random() * typeQuestions.length)];
      suggestions.push(randomQuestion);
    }
  }

  // Priority 4: Collection overview (always include if space)
  if (suggestions.length < 4) {
    suggestions.push("Give me an overview of my collection");
  }

  // Priority 5: General helpful prompts
  const generalPrompts = [
    "Which vehicles need attention right now?",
    "What maintenance should I do before riding season?",
    "Show me my collection's total value",
    "What's the status of all my tabs?",
  ];

  while (suggestions.length < 4) {
    const available = generalPrompts.filter(p => !suggestions.includes(p));
    if (available.length === 0) break;
    suggestions.push(available[Math.floor(Math.random() * available.length)]);
  }

  return suggestions.slice(0, 4);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Return default suggestions for unauthenticated users
      return NextResponse.json({
        suggestions: [
          "What can you help me with?",
          "How do I manage my vehicle collection?",
          "What features does this app have?",
          "Tell me about vehicle maintenance",
        ],
      });
    }

    // Get user's vehicles (filtered by collection if provided)
    let vehicleQuery = supabase
      .from('motorcycles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (collectionId) {
      vehicleQuery = vehicleQuery.eq('collection_id', collectionId);
    }

    const { data: vehicles } = await vehicleQuery;

    const allVehicles = (vehicles || []) as Motorcycle[];
    const activeVehicles = allVehicles.filter(v => v.status === 'active' || v.status === 'maintenance');

    // Find vehicles needing attention
    const needsMaintenance = allVehicles.filter(v => v.status === 'maintenance');
    const expiringTabs = activeVehicles.filter(v => {
      const days = daysUntilExpiration(v.tab_expiration);
      return days !== null && days > 0 && days <= 30;
    });
    const expiredTabs = activeVehicles.filter(v => {
      const days = daysUntilExpiration(v.tab_expiration);
      return days !== null && days < 0;
    });

    // Most recently updated vehicle
    const recentVehicle = allVehicles.length > 0 ? allVehicles[0] : null;

    const context: SuggestionContext = {
      vehicles: allVehicles,
      needsMaintenance,
      expiringTabs,
      expiredTabs,
      recentVehicle,
    };

    const suggestions = generateSuggestions(context);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestions API error:', error);
    // Return default suggestions on error
    return NextResponse.json({
      suggestions: [
        "Give me an overview of my collection",
        "Which vehicles need attention right now?",
        "What maintenance should I do before riding season?",
        "What features does this app have?",
      ],
    });
  }
}
