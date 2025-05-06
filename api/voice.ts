// api/voice.ts
// Full script using Gemini and ElevenLabs convert() method

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
    GoogleGenerativeAI,
    Content,
    Part,
    GenerateContentStreamResult,
    HarmCategory,
    HarmBlockThreshold
} from "@google/generative-ai";
import { ElevenLabsClient } from "elevenlabs";
import { Buffer } from 'node:buffer'; // Explicit import for clarity

// Interface for expected request body from frontend
interface VoiceRequestBody {
    audioData: string;  // Base64 string (data only)
    mimeType: string;   // e.g., "audio/webm;codecs=opus"
    context?: string;   // Optional JSON string for chat history
    model?: string;     // Optional Gemini model name
}

// --- Helper Function to get full text from Gemini stream ---
async function getFullTextFromStream(streamResult: GenerateContentStreamResult): Promise<string> {
    let fullText = "";
    // Check if stream is available and iterable
    if (streamResult?.stream && typeof streamResult.stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text && typeof chunk.text === 'function' ? chunk.text() : '';
            fullText += chunkText;
        }
    } else {
        console.warn("Backend: Stream result or stream property not available/iterable for Gemini.");
        try {
            // Fallback attempt
            const response = await streamResult.response;
            fullText = response.text();
        } catch (e) {
             console.error("Backend: Could not extract text from Gemini stream or response.", e);
        }
    }
    return fullText;
}

// --- Helper to convert AsyncIterableIterator<Buffer> (like from ElevenLabs convert) to Base64 ---
async function asyncIteratorToAudioBase64(audioIterator: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    try {
        for await (const chunk of audioIterator) {
            if (Buffer.isBuffer(chunk)) {
                chunks.push(chunk);
            } else {
                // Should not happen based on expected type, but handle defensively
                chunks.push(Buffer.from(chunk));
            }
        }
        // Concatenate all collected chunks into a single Buffer
        const audioBuffer = Buffer.concat(chunks);
        // Convert the final Buffer to a Base64 string
        return audioBuffer.toString('base64');
    } catch (error) {
        console.error("Error processing audio iterator:", error);
        throw error; // Re-throw to be caught by the main handler
    }
}

// --- Main Serverless Function Handler ---
export default async function handler(
    req: VercelRequest,
    res: VercelResponse,
) {
    // 1. Check Request Method
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    // 2. Get API Keys from Environment Variables
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!geminiApiKey) {
        console.error("GEMINI_API_KEY not set in environment variables.");
        return res.status(500).json({ error: 'API key configuration error on server (Gemini).' });
    }
    if (!elevenLabsApiKey) {
        console.error("ELEVENLABS_API_KEY not set in environment variables.");
        return res.status(500).json({ error: 'API key configuration error on server (ElevenLabs).' });
    }

    try {
        // 3. Parse Request Body
        const {
            audioData,
            mimeType,
            context,
            model: modelName = "Gemini 2.0 Flash-Lite" // Default Gemini model
        } = req.body as VoiceRequestBody;

        if (!audioData || !mimeType) {
            return res.status(400).json({ error: 'Missing required audioData or mimeType in request body.' });
        }

        console.log(`API Route: Received mimeType: ${mimeType}, Model: ${modelName}`);

        // 4. Prepare data for Gemini SDK Call
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        let history: Content[] = [];
        if (context) {
            try {
                history = JSON.parse(context) as Content[];
                if (!Array.isArray(history)) history = [];
            } catch (e) {
                console.warn("API Route: Invalid context JSON, using empty history.");
                history = [];
            }
        }
        const userAudioPart: Part = { inlineData: { mimeType: mimeType, data: audioData } };
        const contents: Content[] = [...history, { role: "user", parts: [userAudioPart] }];
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            // Add others if needed
        ];
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings });

        // 5. Call Gemini API and get full text
        console.log("API Route: Calling Gemini...");
        const geminiStreamResult = await model.generateContentStream({ contents });
        console.log("API Route: Received stream from Gemini.");
        const geminiResponseText = await getFullTextFromStream(geminiStreamResult);
        console.log("API Route: Full text from Gemini:", geminiResponseText);

        if (!geminiResponseText || geminiResponseText.trim() === "") {
            console.log("API Route: Gemini returned empty text.");
            return res.status(200).json({ responseText: "(No text response from Gemini)", audioBase64: null, audioMimeType: null });
        }

        // 6. Call ElevenLabs TTS using convert()
        console.log("API Route: Calling ElevenLabs TTS using convert()...");
        const elevenClient = new ElevenLabsClient({ apiKey: elevenLabsApiKey });
        const voiceId = "CaJslL1xziwefCeTNzHv"; // Example Voice ID - CHANGE AS NEEDED
        const ttsModelId = "eleven_multilingual_v2";
        const outputFormat = "mp3_44100_128";
        const audioMimeType = "audio/mpeg"; // Corresponds to mp3 output

        let audioBase64: string | null = null;
        try {
            // Call convert() - it returns an AsyncIterableIterator<Buffer>
            const audioIterator = await elevenClient.textToSpeech.convert(voiceId, {
                text: geminiResponseText,
                model_id: ttsModelId,
                output_format: outputFormat,
                // voice_settings: { stability: 0.5, similarity_boost: 0.75 } // Optional settings
            });

            // Process the iterator to get the full audio data as Base64
            audioBase64 = await asyncIteratorToAudioBase64(audioIterator);
            console.log("API Route: ElevenLabs audio processed to Base64.");

        } catch (ttsError) {
            console.error("API Route: Error during ElevenLabs TTS or Base64 conversion:", ttsError);
            // If TTS fails, we'll still send the text response, but audioBase64 will be null
            audioBase64 = null;
            // Optionally add more specific error reporting back to the client if needed
        }

        // 7. Send Combined JSON Response to Frontend
        console.log("API Route: Sending combined response (Text + Audio Base64) to frontend.");
        return res.status(200).json({
            responseText: geminiResponseText,
            audioBase64: audioBase64, // This will be the base64 string or null
            audioMimeType: audioBase64 ? audioMimeType : null // Send mimeType only if audio exists
        });

    } catch (error) {
        console.error("API Route General Error:", error);
        const message = error instanceof Error ? error.message : 'Unknown server error occurred.';
        return res.status(500).json({ error: `Failed to process request: ${message}` });
    }
}