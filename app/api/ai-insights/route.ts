import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: { apiVersion: 'v1beta' },
});

// Helper function to retry async calls with exponential backoff for 503 spikes
async function generateWithRetry(prompt: string, retries = 3, delay = 1000): Promise<any> {
  try {
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pillar_type: {
                type: Type.STRING,
                enum: ['pricing_advisor', 'inventory_alert', 'churn_alert', 'queue_forecast'],
              },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ['pillar_type', 'title', 'summary'],
          },
        },
      },
    });
  } catch (error: any) {
    // Check if error is a 503 Unavailable or overloaded status
    const isOverloaded = error?.status === 'UNAVAILABLE' || error?.code === 503 || error?.message?.includes('503');
    if (retries > 0 && isOverloaded) {
      console.warn(`Gemini API overloaded (503). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateWithRetry(prompt, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { shopId } = await request.json();
    if (!shopId) {
      return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch live orders, inventory, customers, expenses, and shop metadata in parallel
    const [ordersRes, expensesRes, inventoryRes, customersRes, shopRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('expenses')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('inventory')
        .select('item_name, category, current_stock, unit, min_threshold, consumption_per_load')
        .eq('shop_id', shopId),
      supabase
        .from('customers')
        .select('nickname, total_visits, avg_interval_days')
        .eq('shop_id', shopId)
        .order('total_visits', { ascending: false })
        .limit(30),
      supabase
        .from('shops')
        .select('name, location')
        .eq('id', shopId)
        .single(),
    ]);

    const orders = ordersRes.data ?? [];
    const expenses = expensesRes.data ?? [];
    const inventory = inventoryRes.data ?? [];
    const customers = customersRes.data ?? [];
    const shop = shopRes.data ?? { name: 'My Laundry Shop', location: 'Baguio City' };

    // 2. Call Gemini 2.5 Flash with Structured JSON Output & automatic retry wrapper
    const prompt = `
      You are an expert small business operational copilot for "${shop.name}", a student laundry shop in ${shop.location}.
      Analyze this live store data and provide 4 actionable, concise business insights (1-2 sentences each, citing actual numbers from the data) corresponding to our 4 AI pillars:
1. pricing_advisor: Analyze service breakdown, revenue vs. expenses, and suggest a profitable pricing or bundling tip.
2. inventory_alert: Analyze current stock levels against consumption_per_load and recent load volume to warn about low supplies or restock timing.
3. churn_alert: Identify regular customer visit patterns or unpaid/uncollected orders that need follow-up.
4. queue_forecast: Give a practical operational tip on peak load management or turnaround speed.

      Recent Orders: ${JSON.stringify(orders)}
      Inventory Ledger: ${JSON.stringify(inventory)}
      Regular Customers (CRM): ${JSON.stringify(customers)}
      Recent Expenses: ${JSON.stringify(expenses)}
    `;

    const response = await generateWithRetry(prompt);

    // Safely extract and sanitize raw text response
    const rawText = response.text ? response.text.trim() : '';

    let insights = [];
    if (rawText) {
      try {
        const cleanedText = rawText.replace(/^```json\s*|\s*```$/g, '');
        insights = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse Gemini JSON response:', rawText);
        insights = [];
      }
    }

    // 3. Clear old insights and save fresh ones to Supabase
    await supabase.from('ai_insights').delete().eq('shop_id', shopId);

    if (insights.length > 0) {
      const rowsToInsert = insights.map((item: { pillar_type: string; title: string; summary: string }) => ({
        shop_id: shopId,
        pillar_type: item.pillar_type,
        title: item.title,
        summary: item.summary,
      }));
      const { error: insertError } = await supabase.from('ai_insights').insert(rowsToInsert);
      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, insights });
  } catch (error: unknown) {
    console.error('AI Insights Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}