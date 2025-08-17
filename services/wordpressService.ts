import { WordPressConfig, WordPressPost } from '../types';

function getApiUrl(config: WordPressConfig, endpoint: string): string {
    const url = config.url.endsWith('/') ? config.url : `${config.url}/`;
    return `${url}wp-json/wp/v2/${endpoint}`;
}

function getAuthHeader(config: WordPressConfig): string {
    return `Basic ${btoa(`${config.username}:${config.appPassword}`)}`;
}

export async function fetchPosts(config: WordPressConfig): Promise<WordPressPost[]> {
    const url = getApiUrl(config, 'posts?_fields=id,title,content,link,_links&per_page=100&status=publish&_embed=wp:featuredmedia');
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': getAuthHeader(config),
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Authentication failed. Please check your username and Application Password.');
            }
            if (response.status === 404) {
                 throw new Error(`Could not find the WordPress REST API endpoint. Ensure your URL is correct and REST API is not disabled.`);
            }
            throw new Error(`Failed to fetch posts. Status: ${response.status}`);
        }

        const postsData: any[] = await response.json();
        
        const posts: WordPressPost[] = postsData.map(post => {
            const featuredMedia = post._embedded?.['wp:featuredmedia'];
            const featuredImageUrl = featuredMedia?.[0]?.source_url || null;

            return {
                id: post.id,
                title: post.title,
                content: post.content,
                link: post.link,
                featuredImageUrl: featuredImageUrl,
                hasOptimizerSnippet: post.content.rendered.includes('data-wp-seo-optimizer-tool="true"'),
            };
        });

        return posts;
    } catch (error) {
        console.error('Fetch posts error:', error);
        if (error instanceof TypeError) { // Often indicates a CORS or network issue
            throw new Error('A network error occurred. This could be a CORS issue on your WordPress server or an incorrect URL. Check the browser console for more details.');
        }
        throw error;
    }
}

export async function updatePost(config: WordPressConfig, postId: number, content: string): Promise<WordPressPost> {
    const url = getApiUrl(config, `posts/${postId}`);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader(config),
            },
            body: JSON.stringify({
                content: content,
            }),
        });

        if (!response.ok) {
             if (response.status === 401 || response.status === 403) {
                throw new Error('Authentication failed. You may not have permission to edit this post.');
            }
            throw new Error(`Failed to update post. Status: ${response.status}`);
        }
        
        const updatedPostData: any = await response.json();

        // We need to re-check for featured image and snippet status, but this is a simple update
        // We can assume they don't change on content update for now to avoid another fetch.
        const updatedPost: WordPressPost = {
            id: updatedPostData.id,
            title: updatedPostData.title,
            content: updatedPostData.content,
            link: updatedPostData.link,
            featuredImageUrl: null, // This info is not in the update response
            hasOptimizerSnippet: updatedPostData.content.rendered.includes('data-wp-seo-optimizer-tool="true"'),
        };

        return updatedPost;

    } catch (error) {
        console.error('Update post error:', error);
         if (error instanceof TypeError) {
            throw new Error('A network error occurred while updating the post. This could be a CORS issue.');
        }
        throw error;
    }
}