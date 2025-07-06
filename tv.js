async function loadTVShows() {
    showLoading();
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/popular?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        
        // Filter out anime TV shows
        const filteredTVShows = data.results.filter(tv => {
            // Exclude Japanese animation shows
            if (tv.original_language === 'ja' && tv.genre_ids?.includes(16)) {
                return false;
            }
            return true;
        });
        
        displayContent(filteredTVShows, 'tv');
    } catch (error) {
        console.error('Error loading TV shows:', error);
        showError('Failed to load TV shows');
    }
}

async function fetchTVShowDetails(tvId) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/${tvId}?api_key=${CONFIG.TMDB_API_KEY}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching TV show details:', error);
        return null;
    }
}

async function loadTVSeasons(tvId) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/${tvId}?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        
        if (!data.seasons || data.seasons.length === 0) {
            return '<p>No seasons available</p>';
        }
        
        let html = '<h4>Seasons</h4><div class="season-selector">';
        
        data.seasons.forEach((season, index) => {
            if (season.season_number > 0) {
                html += `<button class="season-btn ${index === 0 ? 'active' : ''}" onclick="loadSeason(${tvId}, ${season.season_number}, event)">
                    Season ${season.season_number}
                </button>`;
            }
        });
        
        html += '</div><div id="episodesContainer"></div>';
        
        // Load first season by default
        setTimeout(() => {
            if (data.seasons.length > 0) {
                const firstSeason = data.seasons.find(s => s.season_number > 0);
                if (firstSeason) {
                    loadSeason(tvId, firstSeason.season_number, null);
                }
            }
        }, 100);
        
        return html;
    } catch (error) {
        console.error('Error loading seasons:', error);
        return '<p>Failed to load seasons</p>';
    }
}

async function loadSeason(tvId, seasonNumber, event) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        
        // Update active season button
        document.querySelectorAll('.season-btn').forEach(btn => btn.classList.remove('active'));
        if (event) {
            event.target.classList.add('active');
        }
        
        let html = '<div class="episodes-grid">';
        
        data.episodes.forEach(episode => {
            const thumbnail = episode.still_path ? `${CONFIG.TMDB_IMAGE_BASE_URL}${episode.still_path}` : '';
            html += `
                <div class="episode-card" onclick="playContent('${tvId}', 'tv', ${seasonNumber}, ${episode.episode_number})">
                    ${thumbnail ? `<img src="${thumbnail}" alt="Episode ${episode.episode_number}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 0.25rem; margin-bottom: 0.5rem;">` : ''}
                    <h5>Episode ${episode.episode_number}: ${episode.name}</h5>
                    <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.5rem;">${episode.overview || 'No description available'}</p>
                    <div style="margin-top: 0.5rem; color: #64748b; font-size: 0.8rem;">
                        ${episode.air_date ? `📅 ${episode.air_date}` : ''} 
                        ${episode.runtime ? `⏱️ ${episode.runtime}min` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        document.getElementById('episodesContainer').innerHTML = html;
    } catch (error) {
        console.error('Error loading season:', error);
        document.getElementById('episodesContainer').innerHTML = '<p>Failed to load episodes</p>';
    }
}