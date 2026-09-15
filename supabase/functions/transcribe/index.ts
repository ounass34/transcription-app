import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

      // Get file metadata for duration estimation
      const audioBlob = fileData as Blob;
      const fileSize = audioBlob.size;

      // Send to transcription API
      // Using a configurable API endpoint - falls back to a simple duration-based estimate
      const transcriptionApiUrl = Deno.env.get("TRANSCRIPTION_API_URL");
      const transcriptionApiKey = Deno.env.get("TRANSCRIPTION_API_KEY");

      let transcribedText: string | null = null;

      if (transcriptionApiUrl && transcriptionApiKey) {
        // Send audio to external transcription service
        const formData = new FormData();
        formData.append("audio", audioBlob, audioPath.split("/").pop() ?? "audio");
        formData.append("language", "fr");

        const apiResponse = await fetch(transcriptionApiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${transcriptionApiKey}`,
          },
          body: formData,
        });

        if (!apiResponse.ok) {
          throw new Error(`Transcription API error: ${apiResponse.status}`);
        }

        const apiResult = await apiResponse.json();
        transcribedText = apiResult.text ?? apiResult.transcript ?? null;
      }

      // If no external API configured, try to use the audio metadata
      // to create a placeholder that indicates manual review is needed
      if (!transcribedText) {
        // Estimate duration from file size (rough approximation for compressed audio)
        // Average bitrate ~128kbps = 16KB/s for MP3, ~20KB/s for WebM
        const estimatedDuration = Math.round(fileSize / 16000);
        const mins = Math.floor(estimatedDuration / 60);
        const secs = estimatedDuration % 60;

        transcribedText = `[Transcription automatique non disponible]\n\n` +
          `Fichier audio: ${audioPath.split("/").pop()}\n` +
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
          audio_duration: Math.round(fileSize / 16000),
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
