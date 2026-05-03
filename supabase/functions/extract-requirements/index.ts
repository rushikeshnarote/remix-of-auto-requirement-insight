import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import mammoth from "https://esm.sh/mammoth@1.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAGUE_WORDS = ["fast","slow","easy","simple","often","sometimes","many","few","some","quickly","efficient","user-friendly","robust","scalable","flexible","intuitive","reasonable","appropriate","minimal","maximum"];
const MODAL_VERBS = /\b(shall|must|should|will|can(not)?|may|require[sd]?|need[s]? to)\b/i;

const SYSTEM_PROMPT = `You are a software requirements analyst following IEEE 830. You will receive sentences/fragments from a stakeholder document — these are often informal: meeting notes, emails, user stories, brief project descriptions. Your job is to AGGRESSIVELY extract software requirements even when the source is casual or terse. Infer implied requirements from informal phrasing.

Examples of valid requirements you MUST extract:
- "users login with google" → Functional requirement (system shall allow Google login)
- "should be fast" → NonFunctional/Performance (ambiguous, needs rewrite)
- "weather app shows forecast" → Functional (system shall display weather forecast)
- "must work on mobile" → Constraint or NFR/Usability

Be generous: if a sentence describes ANY system behavior, capability, quality, or constraint — even informally — mark is_requirement=true. Only reject sentences that are pure greetings, signatures, or unrelated chatter.

For each input sentence return an object with: id (integer matching input index), is_requirement (boolean), type (Functional | NonFunctional | Constraint | Unknown), nfr_subtype (Performance | Security | Usability | Reliability | null), confidence (float 0.1–1.0), ambiguity_flags (array of vague words found), actor (string or null — infer "user"/"system"/"admin" if implied), action (string or null), suggested_rewrite (string formatted as "The system shall..." or "The user shall be able to..." — ALWAYS provide one if the original is informal/ambiguous, null only if already perfectly formal), status (Valid | Ambiguous | Incomplete), priority (High | Medium | Low).

Confidence: start 1.0. −0.2 per vague word. −0.3 if actor missing. −0.2 if passive with no subject. Min 0.1. For informal but clear intent, keep confidence ≥0.5.

Return JSON object: { "results": [...] }. No markdown, no preamble.`;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 600);
}

async function parsePdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: Array.isArray(text) ? text.join("\n") : text, pages: totalPages };
}

async function parseDocx(buffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, pages: 1 };
}

async function callLLM(sentences: string[], apiKey: string, attempt = 1): Promise<any[]> {
  const userMsg = sentences.map((s, i) => `${i}: ${s}`).join("\n");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analyze these sentences and return a JSON object with a single key "results" containing the array described:\n\n${userMsg}` },
      ],
    }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limit exceeded");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`LLM error ${resp.status}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.requirements ?? []);
  } catch {
    if (attempt < 2) return callLLM(sentences, apiKey, attempt + 1);
    throw new Error("LLM returned invalid JSON");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supaUrl, supaAnon, { global: { headers: { Authorization: authHeader } } });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let docId: string | null = null;
  try {
    const form = await req.formData();
    const name = (form.get("name") as string) || "Untitled Document";
    const file = form.get("file") as File | null;
    const rawText = form.get("text") as string | null;

    let text = "";
    let pages = 1;
    let filename: string | null = null;

    if (file) {
      if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx");
      if (!isPdf && !isDocx) throw new Error("Only PDF and DOCX files are supported");
      filename = file.name;
      const buffer = await file.arrayBuffer();
      const parsed = isPdf ? await parsePdf(new Uint8Array(buffer)) : await parseDocx(buffer);
      text = parsed.text;
      pages = parsed.pages;
      if (text.length / Math.max(pages, 1) < 100) throw new Error("Scanned PDF detected — text extraction not supported");
    } else if (rawText && rawText.trim().length > 0) {
      text = rawText;
      pages = 1;
    } else {
      throw new Error("No file or text provided");
    }

    // Create document row
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({ user_id: userData.user.id, name, filename, raw_text: text.slice(0, 500000), page_count: pages, status: "processing", stage: "extracting" })
      .select()
      .single();
    if (docErr) throw docErr;
    docId = doc.id;

    // Pre-filter
    const sentences = splitSentences(text);
    const candidates = sentences.filter((s) => MODAL_VERBS.test(s));
    const limited = candidates.slice(0, 200);

    await supabase.from("documents").update({ stage: "extracting" }).eq("id", docId);

    // Batch LLM calls
    const allResults: { sentence: string; r: any }[] = [];
    const BATCH = 50;
    for (let i = 0; i < limited.length; i += BATCH) {
      const batch = limited.slice(i, i + BATCH);
      try {
        const res = await callLLM(batch, lovableKey);
        res.forEach((r: any) => {
          const idx = typeof r.id === "number" ? r.id : 0;
          if (batch[idx]) allResults.push({ sentence: batch[idx], r });
        });
      } catch (e) {
        console.error("Batch failed:", e);
      }
    }

    await supabase.from("documents").update({ stage: "validating" }).eq("id", docId);

    // Insert requirements
    const reqs = allResults
      .filter(({ r }) => r.is_requirement)
      .map(({ sentence, r }, i) => {
        const flags = Array.isArray(r.ambiguity_flags) ? r.ambiguity_flags : [];
        const localFlags = VAGUE_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(sentence));
        const merged = Array.from(new Set([...flags, ...localFlags]));
        return {
          doc_id: docId,
          req_id: `REQ-${String(i + 1).padStart(3, "0")}`,
          req_text: sentence,
          original_text: sentence,
          type: r.type ?? "Unknown",
          nfr_subtype: r.nfr_subtype ?? null,
          confidence: Math.max(0.1, Math.min(1, Number(r.confidence) || 0.5)),
          ambiguity_flags: merged,
          actor: r.actor ?? null,
          action: r.action ?? null,
          status: r.status ?? "Valid",
          priority: r.priority ?? "Medium",
          suggested_rewrite: r.suggested_rewrite ?? null,
        };
      });

    if (reqs.length > 0) {
      const { error: insErr } = await supabase.from("requirements").insert(reqs);
      if (insErr) throw insErr;
    }

    await supabase.from("documents").update({ status: "completed", stage: "done" }).eq("id", docId);

    return new Response(JSON.stringify({ doc_id: docId, count: reqs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("extract error:", e);
    if (docId) {
      await supabase.from("documents").update({ status: "failed", error_message: e.message ?? String(e) }).eq("id", docId);
    }
    return new Response(JSON.stringify({ error: e.message ?? "Unknown error", doc_id: docId }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
