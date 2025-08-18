import React, { useState, useMemo } from 'react';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { WordPressIcon } from './icons/WordPressIcon';
import { Input } from './common/Input';
import { WorldIcon, UserIcon, LockIcon } from './icons/FormIcons';
import { useAppContext } from '../context/AppContext';
import { Step, AiProvider } from '../types';
import ApiConfiguration from './ApiConfiguration';
import { Card } from './common/Card';
import { ArrowRightIcon } from './icons/ArrowRightIcon';

const ResourceLink: React.FC<{ title: string; url: string }> = ({ title, url }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="block text-left no-underline group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-xl">
    <Card className="h-full !p-4 group-hover:shadow-xl group-hover:border-blue-500 dark:group-hover:border-blue-500 transition-all duration-300">
      <div className="flex justify-between items-center gap-4">
        <h4 className="font-bold text-slate-800 dark:text-slate-100">{title}</h4>
        <ArrowRightIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors flex-shrink-0" />
      </div>
    </Card>
  </a>
);

const resources = [
  { title: "Beginner's Guide to Affiliate Marketing", url: "https://affiliatemarketingforsuccess.com/affiliate-marketing/beginners-guide-to-affiliate-marketing/" },
  { title: "Create a Winning Content Strategy", url: "https://affiliatemarketingforsuccess.com/blogging/winning-content-strategy/" },
  { title: "A Complete Guide to SEO Writing", url: "https://affiliatemarketingforsuccess.com/seo/seo-writing-a-complete-guide-to-seo-writing/" },
  { title: "The Future of SEO with AI", url: "https://affiliatemarketingforsuccess.com/ai/ai-future-of-seo/" },
  { title: "How to Choose Your Web Host", url: "https://affiliatemarketingforsuccess.com/how-to-start/how-to-choose-a-web-host/" },
  { title: "Monetize Your Blog: Proven Strategies", url: "https://affiliatemarketingforsuccess.com/blogging/monetize-your-blog-proven-strategies/" }
];

export default function Step1Configure(): React.ReactNode {
  const { state, connectToWordPress } = useAppContext();
  const [url, setUrl] = useState(state.wpConfig?.url || '');
  const [username, setUsername] = useState(state.wpConfig?.username || '');
  const [appPassword, setAppPassword] = useState('');

  const isApiKeyValid = useMemo(() => {
    return state.apiValidationStatuses[state.selectedProvider] === 'valid';
  }, [state.apiValidationStatuses, state.selectedProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiKeyValid) return;
    connectToWordPress({ url, username, appPassword });
  };

  return (
    <div className="animate-fade-in space-y-8 sm:space-y-12">
      {/* API Configuration */}
      <section>
         <h2 className="text-xl sm:text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">1. Configure AI Provider</h2>
         <p className="text-slate-600 dark:text-slate-400 mb-6">
          Select an AI provider and enter your API key to power the content generation.
        </p>
        <ApiConfiguration />
      </section>

      {/* WordPress Configuration */}
      <section>
        <div className="text-center mb-8">
          <WordPressIcon className="w-14 h-14 sm:w-16 sm:h-16 mx-auto text-blue-500 dark:text-blue-400" />
          <h2 className="text-xl sm:text-2xl font-bold mt-4 text-slate-800 dark:text-slate-100">2. Connect to WordPress</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Enter your site details to begin analyzing your content.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
          <div>
            <label htmlFor="wp-url" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              WordPress Site URL
            </label>
            <div className="mt-2">
              <Input
                id="wp-url"
                type="url"
                icon={<WorldIcon className="w-5 h-5" />}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={state.status === 'loading'}
              />
            </div>
          </div>

          <div>
            <label htmlFor="wp-username" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              WordPress Username
            </label>
            <div className="mt-2">
              <Input
                id="wp-username"
                type="text"
                icon={<UserIcon className="w-5 h-5" />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                required
                disabled={state.status === 'loading'}
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="wp-app-password" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              Application Password
            </label>
            <div className="mt-2">
              <Input
                id="wp-app-password"
                type="password"
                icon={<LockIcon className="w-5 h-5" />}
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                required
                disabled={state.status === 'loading'}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Generate this from your WordPress profile page under "Application Passwords". Do not use your main password.
            </p>
          </div>

          {state.error && state.currentStep === Step.Configure && (
            <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{state.error}</span>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={state.status === 'loading' || !isApiKeyValid} className="w-full" size="large">
              {state.status === 'loading' ? <><Spinner /> Connecting...</> : 'Connect & Fetch Posts'}
            </Button>
            {!isApiKeyValid && (
                <p className="mt-2 text-xs text-center text-yellow-600 dark:text-yellow-400">
                    Please save and validate your API key before connecting to WordPress.
                </p>
            )}
          </div>
        </form>
      </section>

      <section className="mt-12 border-t border-slate-200 dark:border-slate-700 pt-8">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
            Resources & Learning Hub
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Supercharge your content strategy with insights from our blog on affiliate marketing, SEO, and AI content creation.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 max-w-5xl mx-auto">
          {resources.map((resource) => (
            <ResourceLink key={resource.url} title={resource.title} url={resource.url} />
          ))}
        </div>
      </section>
    </div>
  );
}