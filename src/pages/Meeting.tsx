
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getUser } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

const Meeting = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Redirect to home if not logged in
    if (!user) {
      navigate("/");
    }

    // Create audio element for playback
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        setIsPlaying(false);
      };
    }

    return () => {
      // Cleanup
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [user, navigate]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        processAudioInput();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setProcessingMessage("Procesando tu mensaje...");
    }
  };

  const processAudioInput = async () => {
    // Create audio blob from recorded chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    
    // In a real implementation, you would:
    // 1. Convert audio to text (via Speech-to-Text API)
    // 2. Send text to Gemini API
    // 3. Convert Gemini response to audio (via Text-to-Speech API)
    
    // For demo purposes, we'll simulate the process with a timeout
    setTimeout(() => {
      // Simulate receiving audio response
      const dummyResponseUrl = URL.createObjectURL(new Blob([audioBlob], { type: 'audio/wav' }));
      
      if (audioRef.current) {
        audioRef.current.src = dummyResponseUrl;
        audioRef.current.play();
        setIsPlaying(true);
        setProcessingMessage("");
      }
    }, 2000);
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b py-4 px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold">C</span>
            </div>
            <h1 className="text-xl font-bold">CollabCopilot</h1>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Volver al panel
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto py-8 px-4 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2">CollabCopilot Voice</h2>
          <p className="text-gray-600">
            Habla conmigo y te responderé con un mensaje de voz.
          </p>
        </div>

        {/* Voice Interface - Abstract Shape */}
        <div className="relative w-64 h-64 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mb-8 shadow-lg hover-lift">
          <div className="absolute inset-4 bg-gradient-to-br from-blue-300 to-purple-400 rounded-full flex items-center justify-center">
            <div className="w-40 h-40 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              {processingMessage ? (
                <p className="text-white text-center px-4">{processingMessage}</p>
              ) : isRecording ? (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-16 h-16 rounded-full bg-white/30 hover:bg-white/40"
                  onClick={stopRecording}
                >
                  <MicOff className="h-8 w-8 text-white" />
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-16 h-16 rounded-full bg-white/30 hover:bg-white/40"
                  onClick={startRecording}
                >
                  <Mic className="h-8 w-8 text-white" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Audio Controls */}
        {audioRef.current && audioRef.current.src && (
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={toggleAudio}
          >
            {isPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isPlaying ? "Silenciar respuesta" : "Reproducir respuesta"}
          </Button>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 px-4">
        <div className="container mx-auto">
          <div className="text-center text-gray-500">
            <p>© 2025 CollabCopilot. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Meeting;
