async function playMedia(id, type, episodeNumber = null, seasonNumber = null) {
    const playerSection = document.getElementById('player-section');
    const playerContainer = document.getElementById('player-container');
    playerContainer.innerHTML = '<div class="loading">Loading player...</div>';
    showSection('player-section');
    
    try {
        let embedUrl;
        
        if (type === 'movie') {
            embedUrl = `https://vidsrc.cc/embed/${id}`;
        } else if (type === 'tv') {
            if (!seasonNumber || !episodeNumber) {
                // Default to first season and episode if not specified
                const details = await fetchMediaDetails(id, 'tv');
                seasonNumber = 1;
                episodeNumber = 1;
            }
            embedUrl = `https://vidsrc.cc/embed/${id}/${seasonNumber}/${episodeNumber}`;
        } else if (type === 'anime') {
            // For anime, we might need to use a different approach
            // This is a placeholder - you'd need to implement anime streaming logic
            embedUrl = `https://anime-site.com/embed/${id}/${episodeNumber || 1}`;
        }
        
        playerContainer.innerHTML = `
            <iframe src="${embedUrl}" allowfullscreen></iframe>
        `;
        
        // Track progress for the user
        if (type !== 'movie') {
            trackProgress(id, type, episodeNumber, seasonNumber);
        }
    } catch (error) {
        console.error('Error loading player:', error);
        playerContainer.innerHTML = `
            <div class="error">
                <p>Failed to load player. Please try another source.</p>
                <button id="try-again-button">Try Again</button>
            </div>
        `;
        
        document.getElementById('try-again-button')?.addEventListener('click', () => {
            playMedia(id, type, episodeNumber, seasonNumber);
        });
    }
}

async function trackProgress(mediaId, mediaType, episodeNumber, seasonNumber) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase
        .from('user_progress')
        .upsert({
            user_id: user.id,
            media_id: mediaId,
            media_type: mediaType,
            season_number: seasonNumber,
            episode_number: episodeNumber,
            last_watched_at: new Date().toISOString()
        }, { onConflict: ['user_id', 'media_id'] });
    
    if (error) {
        console.error('Error tracking progress:', error);
    }
}