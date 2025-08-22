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
import { LightbulbIcon } from './icons/LightbulbIcon';
import { motion, AnimatePresence } from 'framer-motion/dist/es/index.js';

const StepIndicator: React.FC<{ current: number, total: number }> = ({ current, total }) => {
    return (
        <div className="flex justify-center items-center gap-2 sm:gap-4 mb-6">
            {Array.from({ length: total }).map((_, index) => {
                const isCompleted = index < current;
                const isCurrent = index === current;
                let classes = 'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-300 ease-in-out';
                if (isCompleted) {
                    classes += ' bg-blue-600 text-white';
                } else if (isCurrent) {
                    classes += ' bg-white dark:bg-slate-700 border-2 border-blue-600 text-blue-600 dark:text-blue-400 scale-110';
                } else {
                    classes += ' bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
                }
                return (
                    <div key={index} className={classes}>
                        {isCompleted ? <CheckIcon className="w-5 h-5"/> : index + 1}
                    </div>
                );
            })}
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

    useEffect(() => {
        // Reset state when a new quiz is loaded
        setCurrentQuestionIndex(0); setSelectedAnswer(null); setIsAnswered(false);
        setScore(0); setPersonalityScores({}); setShowResults(false);
    }, [quizData]);

    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <XCircleIcon className="w-12 h-12 text-yellow-500" />
                <h3 className="mt-4 text-lg font-bold">Quiz Data Invalid</h3>
                <p className="mt-2 text-sm text-slate-500">
                    The generated quiz data is missing questions. Please try regenerating the quiz.
                </p>
            </div>
        );
    }

    const totalQuestions = quizData.questions.length;
    const isKnowledgeCheck = quizData.quizType === 'knowledge-check';
    const currentQuestion = quizData.questions[currentQuestionIndex];
    if (!currentQuestion) return null; // Guard against invalid index

    const handleAnswerSelect = (index: number) => {
        if (isAnswered) return;
        setSelectedAnswer(index);
        setIsAnswered(true);

        if (isKnowledgeCheck) {
            const question = currentQuestion as KnowledgeCheckQuestion;
            // Ensure we are comparing numbers, as AI might return a string index or be null/undefined
            const correctIndexValue = question.correctAnswerIndex;
            const correctIndex = (correctIndexValue === null || correctIndexValue === undefined) ? -1 : parseInt(String(correctIndexValue), 10);
            
            if (index === correctIndex) {
                setScore(s => s + 1);
            }
        } else {
            const question = currentQuestion as PersonalityQuestion;
            const outcomeId = question.options[index].pointsFor;
            setPersonalityScores(scores => ({...scores, [outcomeId]: (scores[outcomeId] || 0) + 1 }));
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
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
            resultDescription = finalTier?.feedback.replace('{score}', String(score)).replace('{total}', String(totalQuestions)) 
                || `You scored ${score} out of ${totalQuestions}.`;
        } else if (!isKnowledgeCheck && quizData.outcomes) {
            const winnerId = Object.entries(personalityScores).sort((a, b) => b[1] - a[1])[0]?.[0];
            const finalOutcome = quizData.outcomes.find(o => o.id === winnerId);
            resultTitle = finalOutcome?.title || 'Results Are In!';
            resultDescription = finalOutcome?.description || 'You have a unique personality type.';
        }
        
        return (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-6 sm:p-10 flex flex-col items-center justify-center h-full">
                {isKnowledgeCheck && (
                    <>
                        <div className="relative w-36 h-36 sm:w-40 sm:h-40 my-4">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                                <circle className="text-slate-200 dark:text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                                <motion.circle
                                    className="text-[hsl(var(--accent-color))]"
                                    strokeWidth="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"
                                    strokeLinecap="round" transform="rotate(-90 50 50)"
                                    initial={{ strokeDashoffset: 283 }}
                                    animate={{ strokeDashoffset: 283 - (283 * (score / totalQuestions)) }}
                                    transition={{ duration: 1.5, ease: 'easeOut' }}
                                    style={{ strokeDasharray: 283 }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-slate-800 dark:text-slate-100">
                                {totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0}<span className="text-2xl">%</span>
                            </div>
                        </div>
                    </>
                )}
                <h3 className="text-4xl sm:text-5xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">{resultTitle}</h3>
                {isKnowledgeCheck && <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{score} / {totalQuestions} Correct</p>}
                <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-prose mx-auto">{resultDescription}</p>
                <Button onClick={handleRestart} className="mt-8" size="large">Take Again</Button>
            </motion.div>
        );
    };

    const renderQuestion = () => {
        const question = currentQuestion;
        return (
            <motion.div key={currentQuestionIndex} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="p-5 sm:p-8">
                <StepIndicator current={currentQuestionIndex} total={totalQuestions} />
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8 text-center">{question.questionText}</h3>
                <div className="space-y-4 max-w-lg mx-auto">
                    {question.options.map((option, index) => {
                        const optionText = typeof option === 'string' ? option : (option as PersonalityOption).text;
                        let buttonClasses = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-200 disabled:cursor-not-allowed font-medium flex items-center justify-between group ';
                        let icon = null;

                        if (isAnswered) {
                            const correctIndexValue = (question as KnowledgeCheckQuestion).correctAnswerIndex;
                            const correctIndex = isKnowledgeCheck && (correctIndexValue !== null && correctIndexValue !== undefined) ? parseInt(String(correctIndexValue), 10) : -1;

                            if (index === correctIndex) {
                                buttonClasses += 'bg-green-50 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-200 ring-2 ring-green-400/50';
                                icon = <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />;
                            } else if (index === selectedAnswer) {
                                buttonClasses += 'bg-red-50 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-300 ring-2 ring-red-400/50';
                                icon = <XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />;
                            } else {
                                buttonClasses += 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 opacity-70';
                            }
                        } else {
                            buttonClasses += 'bg-white dark:bg-slate-700/60 border-slate-300 dark:border-slate-600 hover:border-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color)_/_0.05)]';
                        }
                        
                        return (
                            <motion.button key={index} onClick={() => handleAnswerSelect(index)} disabled={isAnswered} className={buttonClasses} whileHover={{ y: isAnswered ? 0 : -3 }}>
                                <span>{optionText}</span>
                                {icon && <span className="flex-shrink-0">{icon}</span>}
                            </motion.button>
                        );
                    })}
                </div>

                <AnimatePresence>
                {isAnswered && isKnowledgeCheck && (question as KnowledgeCheckQuestion).explanation && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 max-w-lg mx-auto p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-500/30 flex gap-4">
                        <LightbulbIcon className="w-6 h-6 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-1" />
                        <div>
                            <p className="font-bold text-blue-800 dark:text-blue-200">Explanation</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{(question as KnowledgeCheckQuestion).explanation}</p>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
                
                <AnimatePresence>
                {isAnswered && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }} exit={{ opacity: 0 }} className="mt-8 text-center">
                        <Button onClick={handleNext} size="large">
                            {currentQuestionIndex < totalQuestions - 1 ? 'Next Question' : 'See Results'}
                        </Button>
                    </motion.div>
                )}
                </AnimatePresence>
            </motion.div>
        );
    };

    const hsl = themeColor.match(/(\d+)/g);
    const style = hsl ? { '--accent-color': `${hsl[0]} ${hsl[1]}% ${hsl[2]}%` } as React.CSSProperties : {};

    return (
        <div style={style} className="font-sans bg-slate-50 dark:bg-slate-900/50 rounded-lg shadow-inner h-full flex flex-col overflow-hidden">
             <div className="p-6 border-b border-slate-200 dark:border-slate-700/80">
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 text-center">{title}</h2>
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

  // For dynamic loading messages
  const loadingMessages = [
    "Analyzing post content...",
    "Identifying key concepts...",
    "Distilling main arguments...",
    "Crafting insightful questions...",
    "Structuring the quiz...",
    "Adding expert explanations...",
    "Finalizing generation..."
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
      let interval: ReturnType<typeof setInterval> | undefined;
      if (isGenerating && !quizData) {
          setLoadingMessageIndex(0); // Reset on new generation
          interval = setInterval(() => {
              setLoadingMessageIndex(prevIndex => (prevIndex + 1) % loadingMessages.length);
          }, 2000); // Change message every 2 seconds
      }
      return () => {
          if (interval) {
              clearInterval(interval);
          }
      };
  }, [isGenerating, quizData]);


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
       <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
        {/* Left Panel: Controls */}
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="lg:col-span-2 flex flex-col gap-4 sm:gap-6"
        >
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
                            placeholder="e.g., Change to a personality quiz on 'marketing styles'. Make the tone more professional and focus on advanced concepts."
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
        </motion.div>

        {/* Right Panel: Output */}
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            className="lg:col-span-3 flex flex-col min-h-[45vh] lg:min-h-[600px] bg-slate-100/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 backdrop-blur-sm"
        >
            {isGenerating && !quizData ? (
                 <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <Spinner />
                     <div className="mt-4 text-slate-500 dark:text-slate-400 font-medium h-6">
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={loadingMessageIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                {loadingMessages[loadingMessageIndex]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">This may take a moment.</p>
                 </div>
            ) : status === 'error' && !quizData ? (
                 <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8">
                    <XCircleIcon className="w-12 h-12 text-red-500 dark:text-red-400" />
                    <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">Quiz Generation Failed</h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                        {error}
                    </p>
                    <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                        Try using the 'Creative Direction' panel to give the AI more specific instructions.
                    </p>
                </div>
            ) : quizData ? (
                <QuizPreview quizData={quizData} themeColor={themeColor} title={editableQuizTitle} />
            ) : null }
        </motion.div>
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