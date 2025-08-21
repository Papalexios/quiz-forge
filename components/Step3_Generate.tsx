import React, { useState, useEffect } from 'react';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { CheckIcon } from './icons/CheckIcon';
import { useAppContext } from '../context/AppContext';
import { QuizData, QuizDifficulty, KnowledgeCheckQuestion, PersonalityQuestion, PersonalityOption } from '../types';
import { Input } from './common/Input';
import { Textarea } from './common/Textarea';
import { XCircleIcon } from './icons/XCircleIcon';
import { motion, AnimatePresence } from 'framer-motion';

const ProgressBar: React.FC<{ current: number, total: number }> = ({ current, total }) => {
    const progressPercentage = total > 0 ? ((current + 1) / total) * 100 : 0;
    return (
        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-2.5">
            <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
        </div>
    );
};

// --- Interactive Quiz Preview Component ---
const QuizPreview: React.FC<{ 
    quizData: QuizData, 
    themeColor: string,
    title: string 
}> = ({ quizData, themeColor, title }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [personalityScores, setPersonalityScores] = useState<Record<string, number>>({});
    const [showResults, setShowResults] = useState(false);

    const isKnowledgeCheck = quizData.quizType === 'knowledge-check';
    const currentQuestion = quizData.questions[currentQuestionIndex];

    useEffect(() => {
        setCurrentQuestionIndex(0); setSelectedAnswer(null); setIsAnswered(false);
        setScore(0); setPersonalityScores({}); setShowResults(false);
    }, [quizData]);

    const handleAnswerSelect = (index: number) => {
        if (isAnswered) return;
        setSelectedAnswer(index);
        setIsAnswered(true);

        if (isKnowledgeCheck) {
            const question = currentQuestion as KnowledgeCheckQuestion;
            if (index === question.correctAnswerIndex) setScore(s => s + 1);
        } else {
            const question = currentQuestion as PersonalityQuestion;
            const outcomeId = question.options[index].pointsFor;
            setPersonalityScores(scores => ({...scores, [outcomeId]: (scores[outcomeId] || 0) + 1 }));
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
            setSelectedAnswer(null); setIsAnswered(false);
        } else { setShowResults(true); }
    };
    
    const handleRestart = () => {
        setCurrentQuestionIndex(0); setSelectedAnswer(null); setIsAnswered(false);
        setScore(0); setPersonalityScores({}); setShowResults(false);
    };

    const renderResults = () => {
        let resultTitle = ''; let resultDescription = '';

        if (isKnowledgeCheck && quizData.results) {
            const finalTier = quizData.results.slice().sort((a,b) => b.scoreThreshold - a.scoreThreshold)
                .find(tier => score >= tier.scoreThreshold);
            resultTitle = finalTier?.title || 'Quiz Complete!';
            resultDescription = finalTier?.feedback.replace('{score}', String(score)).replace('{total}', String(quizData.questions.length)) 
                || `You scored ${score} out of ${quizData.questions.length}.`;
        } else if (!isKnowledgeCheck && quizData.outcomes) {
            const winnerId = Object.entries(personalityScores).sort((a, b) => b[1] - a[1])[0]?.[0];
            const finalOutcome = quizData.outcomes.find(o => o.id === winnerId);
            resultTitle = finalOutcome?.title || 'Results Are In!';
            resultDescription = finalOutcome?.description || 'You have a unique personality type.';
        }
        
        return (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-6 flex flex-col items-center justify-center h-full">
                {isKnowledgeCheck && (
                    <div className="relative w-32 h-32 mb-4">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle className="text-slate-200 dark:text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                            <motion.circle
                                className="text-[hsl(var(--accent-color))]"
                                strokeWidth="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"
                                strokeLinecap="round" transform="rotate(-90 50 50)"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * (score / quizData.questions.length)) }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                style={{ strokeDasharray: 283 }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-800 dark:text-slate-100">
                            {Math.round((score / quizData.questions.length) * 100)}%
                        </div>
                    </div>
                )}
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{resultTitle}</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6">{resultDescription}</p>
                <Button onClick={handleRestart}>Restart Quiz</Button>
            </motion.div>
        );
    };

    const renderQuestion = () => {
        const question = currentQuestion;
        return (
            <motion.div key={currentQuestionIndex} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="p-6">
                <ProgressBar current={currentQuestionIndex} total={quizData.questions.length} />
                <div className="text-sm text-slate-500 dark:text-slate-400 my-4 text-center">
                    Question {currentQuestionIndex + 1} of {quizData.questions.length}
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">{question.questionText}</h3>
                <div className="space-y-3">
                    {question.options.map((option, index) => {
                        const optionText = typeof option === 'string' ? option : (option as PersonalityOption).text;
                        let buttonClasses = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 disabled:opacity-90 disabled:cursor-not-allowed font-medium flex items-center justify-between group ';
                        let icon = null;

                        if (isAnswered) {
                            if (isKnowledgeCheck) {
                                if (index === (question as KnowledgeCheckQuestion).correctAnswerIndex) {
                                    buttonClasses += 'bg-green-100 dark:bg-green-900/50 border-green-500 text-green-800 dark:text-green-200 ring-2 ring-green-400';
                                    icon = <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />;
                                } else if (index === selectedAnswer) {
                                    buttonClasses += 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-800 dark:text-red-300';
                                    icon = <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />;
                                } else { buttonClasses += 'bg-slate-100 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-500'; }
                            } else {
                                buttonClasses += (index === selectedAnswer) 
                                    ? `border-[hsl(var(--accent-color))] bg-[hsl(var(--accent-color)_/_0.1)] ring-2 ring-[hsl(var(--accent-color))] text-slate-800 dark:text-slate-100`
                                    : 'bg-slate-100 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300';
                            }
                        } else {
                            buttonClasses += 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color)_/_0.05)]';
                        }
                        
                        return (
                            <motion.button key={index} onClick={() => handleAnswerSelect(index)} disabled={isAnswered} className={buttonClasses} whileHover={{ y: isAnswered ? 0 : -3 }}>
                                <span>{optionText}</span>
                                {icon && <span className="flex-shrink-0">{icon}</span>}
                            </motion.button>
                        );
                    })}
                </div>

                {isAnswered && isKnowledgeCheck && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-slate-100 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-700/50">
                        <p className="font-bold text-slate-800 dark:text-slate-200">Explanation</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{(question as KnowledgeCheckQuestion).explanation}</p>
                    </motion.div>
                )}
                
                {isAnswered && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-right">
                        <Button onClick={handleNext}>
                            {currentQuestionIndex < quizData.questions.length - 1 ? 'Next Question' : 'See Results'}
                        </Button>
                    </motion.div>
                )}
            </motion.div>
        );
    };

    const hsl = { h: themeColor.match(/(\d+)/g)?.[0] || '217', s: themeColor.match(/(\d+)/g)?.[1] || '91', l: themeColor.match(/(\d+)/g)?.[2] || '60' };
    const style = { '--accent-color': `${hsl.h} ${hsl.s}% ${hsl.l}%` } as React.CSSProperties;

    return (
        <div style={style} className="font-sans bg-slate-50 dark:bg-slate-800/80 rounded-lg shadow-inner h-full flex flex-col overflow-hidden backdrop-blur-sm">
             <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 text-center">{title}</h2>
            </div>
             <div className="flex-grow overflow-y-auto">
                <AnimatePresence mode="wait">
                    {showResults ? renderResults() : renderQuestion()}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default function Step3Generate(): React.ReactNode {
  const { state, resetToAnalyze, setThemeColor, setQuizDifficulty, regenerateQuiz, insertSnippet, setEditableQuizTitle, setRegenerationFeedback } = useAppContext();
  const { status, insertingStatus, error, selectedPost, quizData, themeColor, quizDifficulty, editableQuizTitle, regenerationFeedback } = state;

  const isGenerating = status === 'loading';
  const isInserting = insertingStatus === 'loading';
  const isAnythingLoading = isGenerating || isInserting;

  const DifficultyButton: React.FC<{
    label: QuizDifficulty;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900 focus:ring-blue-500 ${
        isActive
          ? 'bg-blue-600 text-white shadow'
          : 'bg-slate-200 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-slate-700'
      }`}
      disabled={isAnythingLoading}
    >
      {label}
    </button>
  );
  
  const FADE_IN_VARIANTS = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  const renderSuccessScreen = () => (
     <motion.div
        initial="hidden"
        animate="visible"
        variants={FADE_IN_VARIANTS}
        className="text-center bg-green-50 dark:bg-green-900/50 border-green-500 rounded-xl flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] p-6"
    >
        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center ring-4 ring-green-200 dark:ring-green-800">
            <CheckIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mt-4 text-2xl font-bold text-green-800 dark:text-green-300">Quiz Inserted Successfully!</h3>
        <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-md">
          Your post <a href={selectedPost!.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"  dangerouslySetInnerHTML={{ __html: `"${selectedPost!.title.rendered}"` }}/> has been updated. The quiz was intelligently placed in the most relevant section.
        </p>
        <Button onClick={resetToAnalyze} className="mt-6">Create Another Quiz</Button>
      </motion.div>
  );
  
   const renderWorkspace = () => (
       <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8 h-full">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
            <Input
              value={editableQuizTitle}
              onChange={(e) => setEditableQuizTitle(e.target.value)}
              disabled={isAnythingLoading}
              className="text-xl sm:text-2xl font-bold !p-0 !bg-transparent !border-0 !ring-0 !shadow-none focus:!ring-0"
              placeholder="Enter Quiz Title"
            />
            
             <Card className="p-4 flex-grow flex flex-col">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Accent Color
                        </label>
                        <div className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-900/50 rounded-md">
                            <input
                                id="theme-color"
                                type="color"
                                value={themeColor}
                                onChange={(e) => setThemeColor(e.target.value)}
                                className="w-10 h-10 p-0 border-none bg-transparent rounded cursor-pointer disabled:opacity-50"
                                aria-label="Select accent color"
                                disabled={isAnythingLoading}
                            />
                            <span className="font-mono text-sm text-slate-500">{themeColor}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Quiz Difficulty
                        </label>
                        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
                            <DifficultyButton label="Easy" isActive={quizDifficulty === 'Easy'} onClick={() => setQuizDifficulty('Easy')} />
                            <DifficultyButton label="Challenging" isActive={quizDifficulty === 'Challenging'} onClick={() => setQuizDifficulty('Challenging')} />
                        </div>
                    </div>
                    <div>
                         <label htmlFor="feedback" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Creative Direction
                        </label>
                         <Textarea
                            id="feedback"
                            value={regenerationFeedback}
                            onChange={(e) => setRegenerationFeedback(e.target.value)}
                            placeholder="e.g., Make the questions funnier, focus more on SEO..."
                            rows={3}
                            disabled={isAnythingLoading}
                         />
                    </div>
                </div>

                 <div className="space-y-3 mt-auto pt-4">
                     <Button onClick={regenerateQuiz} className="w-full" variant="secondary" disabled={isAnythingLoading}>
                        {isGenerating ? <><Spinner /> Regenerating...</> : 'Regenerate Quiz'}
                    </Button>
                     <Button onClick={insertSnippet} disabled={isAnythingLoading} className="w-full" size="large">
                        {isInserting ? <><Spinner /> Inserting...</> : 'Insert into Post'}
                     </Button>
                </div>
            </Card>

             {error && (
               <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm" role="alert">
                <strong className="font-bold">An Error Occurred: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}
        </div>

        {/* Right Panel: Output */}
        <div className="lg:col-span-3 flex flex-col min-h-[45vh] lg:min-h-[600px] bg-slate-100/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
            {isGenerating && !quizData ? (
                 <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <Spinner />
                    <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">Crafting an elite-quality quiz...</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">This may take a moment.</p>
                 </div>
            ) : quizData ? (
                <QuizPreview quizData={quizData} themeColor={themeColor} title={editableQuizTitle} />
            ) : null }
        </div>
      </div>
  );

  if (insertingStatus === 'success') {
      return renderSuccessScreen();
  }

  return (
    <motion.div
        initial="hidden"
        animate="visible"
        variants={FADE_IN_VARIANTS}
        transition={{ duration: 0.5 }}
    >
        <div className="mb-6">
            <p className="text-slate-600 dark:text-slate-400">Quiz for post:</p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100" dangerouslySetInnerHTML={{ __html: `"${selectedPost!.title.rendered}"` }} />
        </div>
        {renderWorkspace()}
    </motion.div>
  );
}