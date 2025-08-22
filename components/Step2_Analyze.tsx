import React, { useState } from 'react';
import { WordPressPost } from '../types';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { DynamicIcon } from './icons/DynamicIcon';
import { useAppContext } from '../context/AppContext';
import { Input } from './common/Input';
import { SearchIcon } from './icons/SearchIcon';
import { CheckIcon } from './icons/CheckIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { WorldIcon } from './icons/FormIcons';
import { Spinner } from './common/Spinner';
import { ConfirmationModal } from './common/ConfirmationModal';
import { motion } from 'framer-motion/dist/es/index.js';

const PostCard: React.FC<{ 
  post: WordPressPost, 
  onSelect: () => void,
  onDeleteRequest: () => void,
  isDeleting: boolean
}> = ({ post, onSelect, onDeleteRequest, isDeleting }) => {
  const statusBadge = post.hasOptimizerSnippet ? (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-100 dark:bg-green-900/70 text-green-700 dark:text-green-300 text-xs font-semibold px-2 py-1 rounded-full border border-green-200 dark:border-green-700">
      <CheckIcon className="w-4 h-4" />
      <span>Quiz Injected</span>
    </div>
  ) : (
     <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">
      <LightbulbIcon className="w-4 h-4" />
      <span>No Quiz</span>
    </div>
  );

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent post selection
    onDeleteRequest();
  };

  return (
     <motion.button 
        onClick={onSelect} 
        className="w-full text-left rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/50" 
        disabled={isDeleting}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300 }}
     >
        <Card className={`h-full flex flex-col relative overflow-hidden transition-all !p-0 ${isDeleting ? 'opacity-60' : ''}`}>
             <div className="p-4">
                 {statusBadge}
             </div>
            {isDeleting && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10 rounded-xl">
                    <Spinner/>
                    <span className="ml-2">Deleting...</span>
                </div>
            )}
            <div className="aspect-video bg-slate-100 dark:bg-slate-700 overflow-hidden">
                {post.featuredImageUrl ? (
                    <img src={post.featuredImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <DynamicIcon name="idea" className="w-12 h-12" />
                    </div>
                )}
            </div>
            <div className="flex-grow p-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
            </div>
            <div className="mt-2 p-4 pt-0 flex items-center justify-between gap-2">
                <a href={post.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                    <WorldIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{post.link.replace(/^https?:\/\//, '')}</span>
                </a>
                {post.hasOptimizerSnippet && !isDeleting && (
                    <Button
                        onClick={handleDeleteClick}
                        variant="secondary"
                        size="normal"
                        className="!text-sm !py-1.5 !px-3 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 focus:ring-red-500"
                    >
                        Delete Quiz
                    </Button>
                )}
            </div>
        </Card>
     </motion.button>
  );
};

export default function Step2Analyze(): React.ReactNode {
  const { state, selectPost, setPostSearchQuery, deleteSnippet } = useAppContext();
  const { filteredPosts, status, postSearchQuery, deletingPostId } = state;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<WordPressPost | null>(null);
  
  const FADE_IN_VARIANTS = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  const handleDeleteRequest = (post: WordPressPost) => {
    setPostToDelete(post);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (postToDelete) {
      deleteSnippet(postToDelete.id, postToDelete.toolId).finally(() => {
        setIsModalOpen(false);
        setPostToDelete(null);
      });
    }
  };
  
  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={FADE_IN_VARIANTS}
        transition={{ duration: 0.5 }}
        className="space-y-8 sm:space-y-12"
       >
        <section>
          <h2 className="text-xl sm:text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">Select a Post</h2>
           <p className="text-slate-600 dark:text-slate-400 mb-6">
            Choose a blog post to automatically generate a quiz for.
          </p>
          <div className="mb-6">
              <Input 
                  type="search"
                  icon={<SearchIcon className="w-5 h-5" />}
                  placeholder="Search posts by title..."
                  value={postSearchQuery}
                  onChange={(e) => setPostSearchQuery(e.target.value)}
                  disabled={status === 'loading'}
              />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <PostCard 
                    key={post.id} 
                    post={post}
                    onSelect={() => selectPost(post)}
                    onDeleteRequest={() => handleDeleteRequest(post)}
                    isDeleting={deletingPostId === post.id}
                />
              ))
            ) : (
               <div className="text-center py-8 text-slate-500 dark:text-slate-400 md:col-span-2 lg:col-span-3">
                  <p>No posts found for your search query.</p>
               </div>
            )}
          </div>
        </section>
      </motion.div>
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Quiz Deletion"
        confirmText="Delete Quiz"
        isConfirming={deletingPostId !== null}
      >
        <p>
          Are you sure you want to permanently delete the quiz from the post:
          <strong className="block mt-2" dangerouslySetInnerHTML={{ __html: postToDelete?.title.rendered || '' }} />
        </p>
        <p className="mt-2 text-sm text-slate-500">
          This will remove the shortcode from the post and delete the quiz's data from WordPress. This action cannot be undone.
        </p>
    </ConfirmationModal>
  </>
  );
}