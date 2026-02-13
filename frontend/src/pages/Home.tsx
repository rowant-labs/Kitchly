import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import ChatView from "@/components/chat/ChatView";
import Button from "@/components/ui/Button";
import { getAgents, type Agent } from "@/lib/api";
import kitIcon from "@/assets/images/k.svg";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const {
    data: agentsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
    retry: 2,
    retryDelay: 1000,
  });

  // Auto-select Kit (first active agent)
  useEffect(() => {
    if (agentsData?.agents && agentsData.agents.length > 0 && !selectedAgentId) {
      const activeAgent = agentsData.agents.find((a) => a.status === "active") || agentsData.agents[0];
      setSelectedAgentId(activeAgent.id);
    }
  }, [agentsData, selectedAgentId]);

  // If we have no agent yet but don't want to block the UI,
  // use a fallback agent ID
  const agentId = selectedAgentId || "default";

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-warm-200 flex items-center justify-center shadow-soft mx-auto mb-4 animate-pulse">
              <img src={kitIcon} alt="Kit" className="w-9 h-9" />
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-kitchly-orange mx-auto mb-3" />
            <p className="text-warm-500 text-sm">Warming up the kitchen...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !selectedAgentId) {
    return (
      <div className="h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto px-6">
            <div className="w-14 h-14 rounded-2xl bg-warm-200 flex items-center justify-center mx-auto mb-4 opacity-50">
              <img src={kitIcon} alt="Kit" className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-semibold text-warm-700 mb-2">
              Kitchen's Closed
            </h2>
            <p className="text-warm-500 text-sm mb-6 leading-relaxed">
              Can't connect to the kitchen right now. Make sure the ElizaOS
              backend is running and try again.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <p className="mt-4 text-xs text-warm-400 font-mono">
              Expected: {import.meta.env.VITE_API_URL || "http://localhost:3000"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-cream-100 relative">
      <Header />
      <main className="flex-1 min-h-0">
        <ChatView agentId={agentId} />
      </main>
    </div>
  );
}
