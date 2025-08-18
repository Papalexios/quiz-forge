import React from 'react';
import { Step } from './types';
import Stepper from './components/Stepper';
import Step1Configure from './components/Step1_Configure';
import Step2Analyze from './components/Step2_Analyze';
import Step3Generate from './components/Step3_Generate';
import { useAppContext } from './context/AppContext';
import { Button } from './components/common/Button';
import { SparklesIcon } from './components/icons/SparklesIcon';
import ThemeToggle from './components/ThemeToggle';

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
    <div className="min-h-screen text-slate-800 dark:text-slate-200 font-sans antialiased">
      <div className="container mx-auto px-4 py-6 sm:py-12">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 sm:mb-12 gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <SparklesIcon className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500" />
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
                ContentForge AI
              </h1>
              <p className="text-md text-slate-600 dark:text-slate-400">
                From the creators of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">AffiliateMarketingForSuccess.com</a>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {state.currentStep !== Step.Configure && (
               <Button onClick={reset} variant="secondary">Start Over</Button>
            )}
          </div>
        </header>
        
        <main className="max-w-5xl mx-auto">
          <Stepper currentStep={state.currentStep} />
          <div className="mt-8 bg-white/70 dark:bg-slate-800/50 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-black/20 p-4 sm:p-10 border border-slate-200/80 dark:border-slate-700/60 backdrop-blur-xl min-h-[calc(100vh-240px)] sm:min-h-[500px]">
            {renderStepContent()}
          </div>
        </main>

        <footer className="text-center mt-8 sm:mt-12 py-6 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} ContentForge AI by <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="hover:underline">AffiliateMarketingForSuccess.com</a>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 space-x-2">
            <a href="https://affiliatemarketingforsuccess.com/blog/" target="_blank" rel="noopener noreferrer" className="hover:underline">Blog</a>
            <span>&bull;</span>
            <a href="https://affiliatemarketingforsuccess.com/affiliate-marketing/beginners-guide-to-affiliate-marketing/" target="_blank" rel="noopener noreferrer" className="hover:underline">Learn Affiliate Marketing</a>
            <span>&bull;</span>
            <a href="https://affiliatemarketingforsuccess.com/ai/ai-future-of-seo/" target="_blank" rel="noopener noreferrer" className="hover:underline">AI for SEO</a>
          </p>
        </footer>
      </div>
    </div>
  );
}