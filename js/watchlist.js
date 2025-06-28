async function loadWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    grid.innerHTML = '<div class="loading">Loading your watchlist...</div>';
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            grid.innerHTML = '<div class="error">Please login to view your watchlist.</div>';
            return;
        }
        
        const { data: watchlist, error } = await supabase
            .from('user_watchlist')
            .select('*')
            .eq('user_id', user.id)
            .order('added_at', { ascending: false });
        
        if (error) throw error;
        
        if (watchlist.length === 0) {
            grid.innerHTML = '<div class="no-items">Your watchlist is empty. Add items to track them here.</div>';
            return;
        }
        
        // Fetch details for each item in watchlist
        const watchlistItems = await Promise.all(watchlist.map(async (item) => {
            try {
                if (item.media_type === 'movie' || item.media_type === 'tv') {
                    const details = await fetchMediaDetails(item.media_id, item.media_type);
                    return { ...details, media_type: item.media_type, watchlist_id: item.id };
                } else if (item.media_type === 'anime') {
                    const details = await fetchAnimeDetails(item.media_id);
                    return { ...details, type: 'anime', media_type: 'anime', watchlist_id: item.id };
                }
            } catch (error) {
                console.error(`Error fetching details for ${item.media_type} ${item.media_id}:`, error);
                return null;
            }
        }));
        
        // Filter out any failed fetches
        const validItems = watchlistItems.filter(item => item !== null);
        renderMediaGrid(validItems, grid);
    } catch (error) {
        console.error('Error loading watchlist:', error);
        grid.innerHTML = '<div class="error">Failed to load watchlist. Please try again.</div>';
    }
}

async function toggleWatchlist(mediaId, mediaType, button) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('Please login to add items to your watchlist.');
        return;
    }
    
    try {
        // Check if already in watchlist
        const { data: existing, error: checkError } = await supabase
            .from('user_watchlist')
            .select('id')
            .eq('user_id', user.id)
            .eq('media_id', mediaId)
            .eq('media_type', mediaType)
            .maybeSingle();
        
        if (checkError) throw checkError;
        
        if (existing) {
            // Remove from watchlist
            const { error: deleteError } = await supabase
                .from('user_watchlist')
                .delete()
                .eq('id', existing.id);
            
            if (deleteError) throw deleteError;
            
            button.innerHTML = `<i class="fas fa-plus"></i> Add to Watchlist`;
            if (document.getElementById('watchlist-grid')) {
                loadWatchlist();
            }
        } else {
            // Add to watchlist
            const { error: insertError } = await supabase
                .from('user_watchlist')
                .insert({
                    user_id: user.id,
                    media_id: mediaId,
                    media_type: mediaType,
                    added_at: new Date().toISOString()
                });
            
            if (insertError) throw insertError;
            
            button.innerHTML = `<i class="fas fa-check"></i> In Watchlist`;
        }
    } catch (error) {
        console.error('Error toggling watchlist:', error);
        alert('Failed to update watchlist. Please try again.');
    }
}