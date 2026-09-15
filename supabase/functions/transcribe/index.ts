import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { transcriptionId, audioPath, userId } = await req.json();

    if (!transcriptionId || !audioPath || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: transcriptionId, audioPath, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Mark as processing
    await supabase
      .from("transcriptions")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", transcriptionId);

    try {
      // Download the audio file from storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from("audio_files")
        .download(audioPath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download audio: ${downloadError?.message ?? "unknown"}`);
      }

      const audioBlob = fileData as Blob;
      const fileSize = audioBlob.size;
      const audioFileName = audioPath.split("/").pop() ?? "audio";

      let transcribedText: string;
      let audioDuration: number | null = null;

      if (groqApiKey) {
        // Send audio to Groq Whisper API for transcription
        const formData = new FormData();
        formData.append("file", audioBlob, audioFileName);
        formData.append("model", GROQ_MODEL);
        formData.append("response_format", "verbose_json");
        formData.append("language", "fr");

        const apiResponse = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
          },
          body: formData,
        });

        if (!apiResponse.ok) {
          const errBody = await apiResponse.text();
          throw new Error(`Groq API error (${apiResponse.status}): ${errBody}`);
        }

        const apiResult = await apiResponse.json();
        transcribedText = apiResult.text ?? "";
        if (apiResult.duration) {
          audioDuration = Math.round(apiResult.duration);
        }
      } else {
        // No API key configured — placeholder so user can enter text manually
        const estimatedDuration = Math.round(fileSize / 16000);
        audioDuration = estimatedDuration;
        const mins = Math.floor(estimatedDuration / 60);
        const secs = estimatedDuration % 60;

        transcribedText = `[Transcription automatique non disponible — clé API non configurée]\n\n` +
          `Fichier audio: ${audioFileName}\n` +
          `Durée estimée: ${mins}m ${secs}s\n` +
          `Taille: ${(fileSize / 1024 / 1024).toFixed(2)} Mo\n\n` +
          `Veuillez saisir ou coller le texte de la transcription manuellement en cliquant sur "Saisir le texte".`;
      }

      // Update transcription with text and mark as completed
      const { error: updateError } = await supabase
        .from("transcriptions")
        .update({
          status: "completed",
          raw_text: transcribedText,
          audio_duration: audioDuration,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transcriptionId);

      if (updateError) {
        throw new Error(`Failed to update transcription: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, transcriptionId, status: "completed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (processingError) {
      // Mark as failed
      await supabase
        .from("transcriptions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", transcriptionId);

      const message = processingError instanceof Error ? processingError.message : "Unknown processing error";
      return new Response(
        JSON.stringify({ error: message, transcriptionId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
