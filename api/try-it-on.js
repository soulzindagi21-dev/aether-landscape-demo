/* Serverless function (Vercel) — receives a live camera photo from the browser,
   sends it to the Gemini image-generation API alongside a lifestyle prompt, and
   returns the composited preview image. The API key lives only in the Vercel
   project's environment variables (GEMINI_API_KEY) — it is never sent to the
   browser or committed to this repo. */

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
    return;
  }

  const { image } = req.body || {};
  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    res.status(400).json({ error: "Missing or invalid image" });
    return;
  }

  const [, mimeType, base64Data] = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/) || [];
  if (!base64Data) {
    res.status(400).json({ error: "Could not parse image data" });
    return;
  }

  const prompt = "Using the exact person in this reference photo — preserve their true likeness, face, and identity exactly as shown — create a cinematic, editorial-quality lifestyle photograph of them wearing the AURA ONE wireless over-ear headphones (matte gunmetal gray finish, blue LED ring accent on each ear cup). Show them seated at a clean modern desk, mid-work-session, laptop open, soft natural window light, shallow depth of field, warm and aspirational mood, photorealistic, high-end commercial photography quality.";

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }]
        })
      }
    );

    const result = await apiRes.json();

    if (!apiRes.ok) {
      console.error("Gemini API error:", JSON.stringify(result));
      res.status(502).json({ error: "Generation failed" });
      return;
    }

    const parts = result?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inline_data || p.inlineData);
    const inline = imagePart && (imagePart.inline_data || imagePart.inlineData);

    if (!inline) {
      console.error("No image in Gemini response:", JSON.stringify(result));
      res.status(502).json({ error: "No image returned" });
      return;
    }

    const outMime = inline.mime_type || inline.mimeType || "image/png";
    res.status(200).json({ image: `data:${outMime};base64,${inline.data}` });
  } catch (err) {
    console.error("try-it-on error:", err);
    res.status(500).json({ error: "Internal error" });
  }
};
