"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Stepper, cn } from "./components/ui";
import { STEPS } from "./components/constants";
import { LanguageStep } from "./components/steps/LanguageStep";
import { ModulesStep } from "./components/steps/ModulesStep";
import { IntegrationsStep } from "./components/steps/IntegrationsStep";
import { AuthStep } from "./components/steps/AuthStep";
import { DemoDataStep } from "./components/steps/DemoDataStep";
import { DeployStep } from "./components/steps/DeployStep";
import { useSetupState } from "./hooks/useSetupState";

export default function SetupWizard() {
  const {
    step, setStep,
    config, setConfig,
    deploying, deployLog, deployDone,
    toggleModule, setIntegrationField,
    handleDeploy, canNext,
  } = useSetupState();

  const renderStep = () => {
    switch (step) {
      case 0:
        return <LanguageStep config={config} setConfig={setConfig} />;
      case 1:
        return <ModulesStep config={config} toggleModule={toggleModule} />;
      case 2:
        return <IntegrationsStep config={config} setIntegrationField={setIntegrationField} />;
      case 3:
        return <AuthStep config={config} setConfig={setConfig} />;
      case 4:
        return <DemoDataStep config={config} setConfig={setConfig} />;
      case 5:
        return (
          <DeployStep
            config={config}
            deploying={deploying}
            deployLog={deployLog}
            deployDone={deployDone}
            onDeploy={handleDeploy}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-bg text-sm">PD</div>
            <span className="font-semibold text-sm hidden sm:block">Setup Wizard</span>
          </div>
          <span className="text-xs text-text-muted">Step {step + 1} of {STEPS.length}</span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Stepper step={step} total={STEPS.length} />
          {renderStep()}
        </div>
      </main>

      {!deploying && !deployDone && (
        <footer className="border-t border-border px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                step === 0 ? "text-text-muted cursor-not-allowed" : "text-text hover:bg-bg-card"
              )}
            >
              <ChevronLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className={cn(
                  "flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
                  canNext()
                    ? "bg-accent hover:bg-accent-hover text-bg"
                    : "bg-border text-text-muted cursor-not-allowed"
                )}
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
