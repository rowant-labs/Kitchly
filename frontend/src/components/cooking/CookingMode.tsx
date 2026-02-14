import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Timer,
  CheckCircle2,
  ChefHat,
  Pause,
  Play,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { ParsedRecipe } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface CookingModeProps {
  recipe: ParsedRecipe;
  agentId: string;
  onClose: () => void;
}

export default function CookingMode({
  recipe,
  agentId,
  onClose,
}: CookingModeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInitial, setTimerInitial] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TODO: Re-enable voice when ElevenLabs integration is fixed
  // const { isSpeaking, speak, stopSpeaking } = useVoice({ agentId });

  const totalSteps = recipe.instructions.length;
  const step = recipe.instructions[currentStep] || "";
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Extract timer duration from step text
  const extractTimer = useCallback((text: string): number | null => {
    // Match patterns like "5 minutes", "10-15 minutes", "30 seconds", "1 hour"
    const minuteMatch = text.match(
      /(\d+)(?:\s*[-to]+\s*\d+)?\s*min(?:ute)?s?/i,
    );
    const secondMatch = text.match(
      /(\d+)(?:\s*[-to]+\s*\d+)?\s*seconds?/i,
    );
    const hourMatch = text.match(
      /(\d+)(?:\s*[-to]+\s*\d+)?\s*hours?/i,
    );

    if (hourMatch) return parseInt(hourMatch[1]) * 3600;
    if (minuteMatch) return parseInt(minuteMatch[1]) * 60;
    if (secondMatch) return parseInt(secondMatch[1]);
    return null;
  }, []);

  const currentTimerDuration = extractTimer(step);

  // Timer logic
  useEffect(() => {
    if (timerRunning && timerSeconds !== null && timerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            setTimerRunning(false);
            // Play a notification sound or vibrate
            if ("vibrate" in navigator) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning, timerSeconds]);

  const handleStartTimer = () => {
    if (currentTimerDuration) {
      setTimerSeconds(currentTimerDuration);
      setTimerInitial(currentTimerDuration);
      setTimerRunning(true);
    }
  };

  const handleToggleTimer = () => {
    setTimerRunning(!timerRunning);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(null);
    setTimerInitial(0);
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      handleResetTimer();
    }
  };

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      handleResetTimer();
    } else {
      setShowComplete(true);
    }
  };

  // TODO: Re-enable voice when ElevenLabs integration is fixed
  // const handleReadAloud = () => {
  //   if (isSpeaking) {
  //     stopSpeaking();
  //   } else {
  //     speak(`Step ${currentStep + 1}. ${step}`);
  //   }
  // };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handleNextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevStep();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, totalSteps]);

  // Prevent body scroll when cooking mode is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (showComplete) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-b from-kitchly-emerald to-emerald-700 flex items-center justify-center animate-fade-in">
        <div className="text-center px-8 max-w-md">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Cooking Complete!
          </h2>
          <p className="text-emerald-100 text-lg mb-8">
            Enjoy your{" "}
            <span className="font-semibold text-white">{recipe.title}</span>!
          </p>
          <Button
            variant="secondary"
            size="lg"
            onClick={onClose}
            className="bg-white text-kitchly-emerald-dark hover:bg-emerald-50 font-semibold px-8"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-warm-900 flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-warm-800/50">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-warm-400 hover:text-white hover:bg-warm-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-warm-400 text-xs uppercase tracking-wider font-medium">
            {recipe.title}
          </p>
          <p className="text-warm-200 text-sm font-semibold">
            Step {currentStep + 1} of {totalSteps}
          </p>
        </div>

        {/* TODO: Re-enable read aloud button when ElevenLabs integration is fixed */}
        <div className="w-9 h-9" />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-warm-700">
        <div
          className="h-full bg-kitchly-orange transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main step content */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-8 overflow-y-auto">
        <div className="max-w-2xl text-center">
          {/* Step number */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-kitchly-orange/20 text-kitchly-orange rounded-full text-sm font-semibold mb-6">
            <ChefHat className="w-4 h-4" />
            Step {currentStep + 1}
          </div>

          {/* Step text - large and readable */}
          <p className="text-2xl sm:text-3xl md:text-4xl text-white font-medium leading-relaxed text-balance">
            {step}
          </p>
        </div>
      </div>

      {/* Timer section */}
      {(currentTimerDuration || timerSeconds !== null) && (
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          {timerSeconds !== null ? (
            <div className="flex items-center gap-3 bg-warm-800 rounded-2xl px-5 py-3">
              <Timer
                className={cn(
                  "w-5 h-5",
                  timerSeconds === 0 ? "text-kitchly-orange" : "text-warm-400",
                )}
              />
              <span
                className={cn(
                  "text-2xl font-mono font-bold tabular-nums",
                  timerSeconds === 0
                    ? "text-kitchly-orange animate-pulse"
                    : "text-white",
                )}
              >
                {formatTime(timerSeconds)}
              </span>
              <button
                onClick={handleToggleTimer}
                className="p-2 rounded-xl text-warm-400 hover:text-white hover:bg-warm-700 transition-colors"
              >
                {timerRunning ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleResetTimer}
                className="p-2 rounded-xl text-warm-400 hover:text-white hover:bg-warm-700 transition-colors text-xs font-medium"
              >
                <X className="w-4 h-4" />
              </button>
              {timerSeconds === 0 && (
                <span className="text-kitchly-orange text-sm font-semibold ml-1">
                  Time's up!
                </span>
              )}
            </div>
          ) : (
            currentTimerDuration && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleStartTimer}
                className="bg-warm-800 text-warm-200 hover:bg-warm-700 border-warm-600 gap-2"
              >
                <Timer className="w-4 h-4" />
                Set Timer ({formatTime(currentTimerDuration)})
              </Button>
            )
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-3 px-4 py-4 pb-safe bg-warm-800/30">
        <Button
          variant="secondary"
          size="lg"
          onClick={handlePrevStep}
          disabled={currentStep === 0}
          className={cn(
            "flex-1 bg-warm-700 text-warm-200 hover:bg-warm-600 border-none gap-2",
            "disabled:bg-warm-800 disabled:text-warm-600",
          )}
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={handleNextStep}
          className="flex-[2] gap-2 text-base font-semibold"
        >
          {currentStep === totalSteps - 1 ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Done Cooking
            </>
          ) : (
            <>
              Next Step
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
