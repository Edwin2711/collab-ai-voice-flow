// src/pages/Meeting.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';

// Interface para la respuesta esperada de tu API
interface ApiResponse {
  responseText?: string;
  audioBase64?: string | null; // Puede ser null si TTS falla
  audioMimeType?: string | null;
  error?: string;
}

const Meeting: React.FC = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('Haz clic en el micrófono para hablar.');
    const [responseText, setResponseText] = useState<string | null>(null);
    const [responseAudioUrl, setResponseAudioUrl] = useState<string | null>(null); // Mantener si tu API devuelve audio

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Limpieza (sin cambios)
    useEffect(() => {
        // ... (código de limpieza igual que antes) ...
        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (responseAudioUrl) {
                URL.revokeObjectURL(responseAudioUrl);
            }
        };
    }, [responseAudioUrl]);

    // --- Funciones de Grabación y Procesamiento ---

    const blobToBase64 = useCallback((blob: Blob): Promise<{dataUrl: string, mimeType: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    // Devolver el Data URL completo y también el mimeType original del Blob
                    resolve({ dataUrl: reader.result, mimeType: blob.type });
                } else {
                    reject(new Error("Error al leer el Blob como Data URL"));
                }
            };
            reader.onerror = (error) => reject(error);
        });
    }, []);

    // MODIFICADO: Función para llamar a tu API Backend
    const handleApiCall = useCallback(async (base64DataUrl: string, mimeType: string) => {
        setIsProcessing(true);
        setResponseText(null);
        // *** Limpiar URL de audio ANTES de la nueva llamada ***
        if (responseAudioUrl) {
          URL.revokeObjectURL(responseAudioUrl);
      }
        setResponseAudioUrl(null);
        setStatusMessage('Enviando audio y esperando respuesta...');

        // *** IMPORTANTE: Extraer solo la parte Base64 ***
        const base64AudioOnly = base64DataUrl.split(',')[1];
        if (!base64AudioOnly) {
             setStatusMessage('Error: No se pudo extraer el contenido Base64 del audio.');
             setIsProcessing(false);
             return;
        }

        console.log(`Enviando MimeType: ${mimeType}`);
        console.log("Enviando Base64 (primeros 100 chars):", base64AudioOnly.substring(0, 100) + "...");

        try {
            const response = await fetch('/api/voice', { // <- TU RUTA DE API
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Los datos que espera tu backend
                    audioData: base64AudioOnly, // <- SOLO el base64
                    mimeType: mimeType,         // <- El mimeType detectado
                    context: JSON.stringify([]), // Pasa el contexto si es necesario
                    model: 'gemini-1.5-flash-latest', // O el modelo deseado
                    // No necesitas 'payload' aquí si ya no lo usas en el backend
                    // payload: { entry_format: 'audio-no-transcription' }
                 }),
            });

            if (!response.ok) {
                // Intentar leer el cuerpo del error si existe
                let errorBody = `Error de API (${response.status})`;
                try {
                    const errorJson = await response.json();
                    errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
                } catch (e) {
                    // Si el cuerpo no es JSON o está vacío
                    errorBody = `${errorBody}: ${response.statusText}`;
                }
                throw new Error(errorBody);
            }

            // *** PROCESAR RESPUESTA CON AUDIO ***
            const result: ApiResponse = await response.json();
            console.log("Respuesta recibida del Backend:", result);

            if (result.error) {
                setStatusMessage(`Error del backend: ${result.error}`);
                setResponseText(null);
                setResponseAudioUrl(null);
            } else {
                // Mostrar texto siempre que exista
                setResponseText(result.responseText || '(No se recibió texto)');

                // Si se recibió audio base64, crear Data URL
                if (result.audioBase64 && result.audioMimeType) {
                    const audioDataUrl = `data:${result.audioMimeType};base64,${result.audioBase64}`;
                    setResponseAudioUrl(audioDataUrl); // <-- Actualizar estado con el Data URL
                    setStatusMessage('Respuesta recibida. Reproduciendo audio...'); // Mensaje actualizado
                } else {
                     // Si no hay audio (o falló TTS), solo mostrar texto
                    setResponseAudioUrl(null);
                    setStatusMessage('Respuesta de texto recibida.');
                }
            }

        } catch (error) {
            console.error("Error en la llamada API desde el frontend:", error);
            setStatusMessage(`Error al procesar: ${error instanceof Error ? error.message : String(error)}`);
            setResponseText(null);
            setResponseAudioUrl(null);
        } finally {
            setIsProcessing(false);
        }
    }, [responseAudioUrl]);

    // MODIFICADO: onstop ahora pasa el mimeType
    const startRecording = useCallback(async () => {
        // ... (inicio de la función igual que antes, solicitando permiso, etc.) ...
        if (isRecording || isProcessing) return;

        setResponseText(null);
        if (responseAudioUrl) { URL.revokeObjectURL(responseAudioUrl); }
        setResponseAudioUrl(null);
        audioChunksRef.current = [];
        setStatusMessage('Solicitando permiso...');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            setStatusMessage('Permiso OK. Grabando...');

             // Intentar especificar un tipo preferido es menos importante ahora que usamos el detectado
             // const options = { mimeType: 'audio/wav' }; // Podrías quitar esto
            let recorder: MediaRecorder;
             try {
                 // Intenta grabar con un tipo específico si quieres, pero lo importante es lo que detecta
                  // recorder = new MediaRecorder(stream, { mimeType: 'audio/ogg;codecs=opus' }); // Ejemplo
                  recorder = new MediaRecorder(stream); // Usar default es más seguro
                  console.log("Usando mimeType (inicial):", recorder.mimeType); // Log inicial
             } catch (e) {
                  console.error("Error creando MediaRecorder:", e);
                  setStatusMessage("Error: No se pudo iniciar el grabador de audio.");
                  stream.getTracks().forEach(track => track.stop());
                  return;
             }

            mediaRecorderRef.current = recorder;

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                streamRef.current?.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                setIsRecording(false);

                if (audioChunksRef.current.length === 0) {
                    console.warn("No se grabaron datos de audio.");
                    setStatusMessage("No se grabó audio. Inténtalo de nuevo.");
                    setIsProcessing(false); // Asegurar que no quede en procesamiento
                    return;
                }

                // *** Clave: Usar el mimeType real del recorder ***
                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'; // Default seguro
                console.log("Grabación detenida. MimeType final detectado:", mimeType);

                setStatusMessage('Procesando audio...');
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                try {
                    // Convertir a Base64 Data URL (incluye mimeType)
                    const { dataUrl } = await blobToBase64(audioBlob);
                    // Llamar a la API con el Data URL completo y el mimeType separado
                    await handleApiCall(dataUrl, mimeType);
                } catch (error) {
                    console.error("Error al convertir/enviar:", error);
                    setStatusMessage('Error al procesar el audio localmente.');
                    setIsProcessing(false);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            // Mensaje se actualiza en onstop/handleApiCall

        } catch (err) {
            // ... (manejo de errores igual que antes) ...
            console.error("Error al iniciar grabación:", err);
            let message = 'Error al iniciar grabación.';
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    message = 'Permiso de micrófono denegado.';
                } else {
                    message = `Error: ${err.message}`;
                }
            }
            setStatusMessage(message);
            setIsRecording(false);
            setIsProcessing(false);
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, [isRecording, isProcessing, blobToBase64, handleApiCall, responseAudioUrl]);

    // stopRecording (sin cambios)
    const stopRecording = useCallback(() => {
        // ... (código igual que antes) ...
         if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
             setStatusMessage('Deteniendo grabación...');
            mediaRecorderRef.current.stop();
        }
    }, []);

    // handleMicClick (sin cambios)
    const handleMicClick = () => {
        // ... (código igual que antes) ...
         if (isProcessing) return;

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Efecto para Autoplay (sin cambios)
    useEffect(() => {
      if (responseAudioUrl && audioPlayerRef.current) {
          console.log("Attempting to play response audio:", responseAudioUrl.substring(0, 60) + "...");
          audioPlayerRef.current.play().catch(error => {
              console.warn("Autoplay del audio de respuesta bloqueado:", error);
              setStatusMessage("Audio de respuesta listo. Haz clic en play."); // Mensaje más claro si falla autoplay
          });
      }
  }, [responseAudioUrl]);

    // --- JSX (sin cambios estructurales, solo texto de statusMessage) ---
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
            {/* Encabezados */}
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                CollabCopilot Voice
            </h1>
            <p className="text-gray-600 mb-12 text-center"> {/* Centrado */}
                {statusMessage} {/* Muestra el estado actual */}
            </p>

             {/* Botón Circular (sin cambios) */}
             <button
                onClick={handleMicClick}
                disabled={isProcessing}
                className={`
                    relative flex items-center justify-center
                    w-48 h-48 rounded-full shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300
                    transition-all duration-300 ease-in-out
                    ${isRecording ? 'bg-gradient-to-br from-red-400 to-pink-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'}
                    ${isProcessing ? 'cursor-wait opacity-70' : 'hover:scale-105'}
                `}
                aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
            >
                {isRecording && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                )}
                <Mic
                    className={`relative z-10 transition-colors duration-300 ${isProcessing ? 'text-gray-300' : 'text-white'}`}
                    size={64}
                    strokeWidth={1.5}
                 />
            </button>

             {/* Área de Respuesta (sin cambios estructurales) */}
              <div className="mt-12 text-center w-full max-w-md">
                 {isProcessing && (
                     <div className="flex justify-center items-center space-x-2 text-gray-500">
                        {/* ... SVG Spinner ... */}
                         <span>Procesando...</span>
                     </div>
                 )}
                 {responseText && !isProcessing && (
                     <p className="text-gray-700 bg-white p-4 rounded-lg shadow border border-gray-200 mb-4">
                        {responseText}
                     </p>
                 )}
                 {responseAudioUrl && !isProcessing && (
                     <audio
                        ref={audioPlayerRef}
                        src={responseAudioUrl}
                        controls
                        className="w-full rounded-md shadow"
                    >
                         Tu navegador no soporta el elemento de audio.
                    </audio>
                )}
            </div>
        </div>
    );
};

export default Meeting;