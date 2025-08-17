
import React from 'react';
import { Step } from './types';
import Stepper from './components/Stepper';
import Step1Configure from './components/Step1_Configure';
import Step2Analyze from './components/Step2_Analyze';
import Step3Generate from './components/Step3_Generate';
import { useAppContext } from './context/AppContext';
import { Button } from './components/common/Button';
import { SparklesIcon } from './components/icons/SparklesIcon';

export default function App(): React.ReactNode {
  const { state, reset } = useAppContext();

  const renderStepContent = () => {
    switch (state.currentStep) {
      case Step.Configure:
        return <Step1Configure />;
      case Step.Analyze:
        return <Step2Analyze />;
      case Step.Generate:
        return <Step3Generate />;
      default:
        return <div>Invalid Step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans antialiased">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-4">
          <div className="flex items-center gap-4">
            <SparklesIcon className="w-12 h-12 text-blue-500" />
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
                ContentForge AI
              </h1>
              <p className="text-md text-slate-600 dark:text-slate-400 hidden sm:block">
                Forge AI-powered interactive tools for your content.
              </p>
            </div>
          </div>
          {state.currentStep !== Step.Configure && (
             <Button onClick={reset} variant="secondary">Start Over</Button>
          )}
        </header>
        
        <main className="max-w-5xl mx-auto">
          <Stepper currentStep={state.currentStep} />
          <div className="mt-8 bg-white/70 dark:bg-slate-800/50 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 p-6 sm:p-10 border border-slate-200/80 dark:border-slate-700/60 backdrop-blur-xl min-h-[500px]">
            {renderStepContent()}
          </div>
        </main>
      </div>
    </div>
  );
}