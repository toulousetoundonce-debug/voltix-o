"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import CostCalculatorModal from "./CostCalculatorModal";
import SosModal from "./SosModal";
import WhatsAppButton from "./WhatsAppButton";

interface SiteActions {
  openSos: () => void;
  openCalculator: () => void;
}

const SiteActionsContext = createContext<SiteActions | null>(null);

export function useSiteActions(): SiteActions {
  const actions = useContext(SiteActionsContext);
  if (!actions) {
    throw new Error("useSiteActions must be used within SiteActionsProvider.");
  }
  return actions;
}

export default function SiteActionsProvider({ children }: { children: ReactNode }) {
  const [sosOpen, setSosOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const actions = {
    openSos: () => setSosOpen(true),
    openCalculator: () => setCalculatorOpen(true),
  };

  return (
    <SiteActionsContext.Provider value={actions}>
      {children}
      <SosModal open={sosOpen} onClose={() => setSosOpen(false)} />
      <CostCalculatorModal open={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
      <WhatsAppButton />
    </SiteActionsContext.Provider>
  );
}
