import React, { useEffect, useRef, useState } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { CheckIcon } from './icons/CheckIcon';
import { CodeBlock } from './common/CodeBlock';
import { useAppContext } from '../context/AppContext';
import { EyeIcon, CodeBracketIcon } from './icons/ToolIcons';

export default function Step3Generate(): React.ReactNode {
  const { state, reset, generateSnippet, setThemeColor, insertSnippet } = useAppContext();
  const { status, error, generatedSnippet, themeColor, selectedPost, selectedIdea } = state;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('code');

  const isGenerating = status === 'loading' && generatedSnippet.length > 0;
  const isInserting = status === 'loading' && generatedSnippet.length === 0;

  useEffect(() => {
    if (!generatedSnippet && status !== 'loading') {
      generateSnippet();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When a new generation starts, switch to the code tab
    if (status === 'loading') {
      setActiveTab('code');
    }
  }, [status]);

  // Effect to update the iframe when the theme color changes
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_THEME',
        color: themeColor
      }, '*');
    }
  }, [themeColor, generatedSnippet]); // Also trigger on new snippet

  if (!selectedPost || !selectedIdea) {
    return (
      <div>
        <p>Missing post or idea selection. Please start over.</p>
        <Button onClick={reset}>Start Over</Button>
      </div>
    );
  }
  
  const handleRegenerate = () => {
    generateSnippet();
  };
  
  const handleInsert = () => {
    insertSnippet();
  };

  const renderSuccessScreen = () => (
     <Card className="text-center bg-green-50 dark:bg-green-900/50 border-green-500 animate-fade-in flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mt-4 text-2xl font-bold text-green-800 dark:text-green-300">Snippet Inserted Successfully!</h3>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
          Your post <a href={selectedPost.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"  dangerouslySetInnerHTML={{ __html: `"${selectedPost.title.rendered}"` }}/> has been updated.
        </p>
        <Button onClick={reset} className="mt-6">Create Another Tool</Button>
      </Card>
  );

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
  }> = ({ label, isActive, onClick, icon, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-md transition-colors border-b-2 ${
        isActive
          ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
          : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-selected={isActive}
    >
      {icon}
      {label}
    </button>
  );

  const renderContent = () => {
    if (status === 'success') {
      return renderSuccessScreen();
    }
    
    return (
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <div>
                <h3 className="text-xl font-bold mb-2">Customize &amp; Insert</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Customize the tool, then insert it into your post.
                </p>
            </div>
            
            <Card className="p-4">
                <label htmlFor="theme-color" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Accent Color
                </label>
                <div className="mt-2 flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md">
                    <input
                        id="theme-color"
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="w-10 h-10 p-0 border-none bg-transparent rounded cursor-pointer"
                        aria-label="Select accent color"
                    />
                    <span className="font-mono text-sm text-slate-500">{themeColor}</span>
                </div>
            </Card>

            <div className="space-y-3 mt-auto">
                 <Button onClick={handleInsert} disabled={status === 'loading' || !generatedSnippet} className="w-full" size="large">
                    {isInserting ? <><Spinner /> Inserting...</> : 'Insert into Post'}
                 </Button>
                 <Button onClick={handleRegenerate} className="w-full" variant="secondary" disabled={status === 'loading'}>
                    Regenerate Tool
                </Button>
            </div>

             {error && (
               <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm" role="alert">
                <strong className="font-bold">An Error Occurred: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-2 flex flex-col min-h-[500px] lg:min-h-0">
            <div className="flex items-center border-b border-slate-200 dark:border-slate-700">
              <TabButton label="Code" isActive={activeTab === 'code'} onClick={() => setActiveTab('code')} icon={<CodeBracketIcon className="w-5 h-5"/>} />
              <TabButton label="Preview" isActive={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<EyeIcon className="w-5 h-5"/>} disabled={status === 'loading'} />
            </div>

            <div className="flex-grow bg-slate-100 dark:bg-slate-900/50 rounded-b-lg p-1 border border-t-0 border-slate-200 dark:border-slate-700">
                {activeTab === 'code' && (
                    <CodeBlock code={generatedSnippet} isStreaming={status === 'loading'} />
                )}
                {activeTab === 'preview' && status !== 'loading' && (
                     <iframe
                        ref={iframeRef}
                        srcDoc={generatedSnippet}
                        title="Generated Snippet Preview"
                        className="w-full h-full border-0 rounded-md bg-white dark:bg-slate-800 shadow-inner"
                        sandbox="allow-scripts allow-forms"
                    />
                )}
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
        <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: `For post: "${selectedPost.title.rendered}"` }} />
            <p className="text-slate-500 dark:text-slate-400">Implementing idea: "{selectedIdea.title}"</p>
        </div>
        {renderContent()}
    </div>
  );
}
