import { useState, useRef, useCallback } from "react";
import { textToSpeech, speechToText } from "@/lib/api";

interface UseVoiceOptions {
  agentId: string;
  onTranscript?: (text: string) => void;
}

interface UseVoiceReturn {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<Blob | null>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  error: string | null;
}

export function useVoice({
  agentId,
  onTranscript,
}: UseVoiceOptions): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Determine the best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsListening(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Microphone access denied";
      setError(message);
      console.error("Failed to start recording:", err);
    }
  }, []);

  const stopListening = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        setIsListening(false);
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType;
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType,
        });
        audioChunksRef.current = [];

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        setIsListening(false);

        // If we have a transcript callback, send to STT
        if (onTranscript && audioBlob.size > 0) {
          setIsProcessing(true);
          try {
            const result = await speechToText(agentId, audioBlob);
            if (result.text) {
              onTranscript(result.text);
            }
          } catch (err) {
            console.error("Speech to text failed:", err);
            setError("Failed to transcribe audio");
          } finally {
            setIsProcessing(false);
          }
        }

        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }, [agentId, onTranscript]);

  const speak = useCallback(
    async (text: string) => {
      try {
        setError(null);

        // Stop any currently playing audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }

        setIsSpeaking(true);

        const audioBlob = await textToSpeech(agentId, text);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setError("Failed to play audio");
        };

        await audio.play();
      } catch (err) {
        setIsSpeaking(false);
        const message =
          err instanceof Error ? err.message : "Text to speech failed";
        setError(message);
        console.error("TTS failed:", err);
      }
    },
    [agentId],
  );

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    isProcessing,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    error,
  };
}
