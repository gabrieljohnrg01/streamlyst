async function loadAnime() {
    showLoading();
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/discover/tv?api_key=${CONFIG.TMDB_API_KEY}&with_genres=16&with_original_language=ja`);
        const data = await response.json();
        displayAnimeContent(data.results);
    } catch (error) {
        console.error('Error loading anime:', error);
        showError('Failed to load anime');
    }
}

function displayAnimeContent(content) {
    const grid = document.getElementById('contentGrid');
    const loading = document.getElementById('loadingSpinner');
    
    loading.style.display = 'none';
    grid.innerHTML = '';
    
    content.forEach(item => {
        const card = createAnimeCard(item);
        grid.appendChild(card);
    });
}

function createAnimeCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    
    const title = item.name || item.original_name;
    const poster = item.poster_path ? `${CONFIG.TMDB_IMAGE_BASE_URL}${item.poster_path}` : '';
    const year = item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    
    card.innerHTML = `
        ${poster ? 
            `<img src="${poster}" alt="${title}" class="card-image">` : 
            `<div class="card-image">No Image Available</div>`
        }
        <div class="card-content">
            <div class="card-title">${title}</div>
            <div class="card-info">${year} • ⭐ ${rating}</div>
        </div>
    `;
    
    card.onclick = () => showAnimeDetail(item);
    return card;
}

async function showAnimeDetail(anime) {
    currentContent = { ...anime, type: 'anime' };
    const modal = document.getElementById('contentModal');
    const title = document.getElementById('modalTitle');
    
    title.textContent = anime.name || anime.original_name;
    modal.classList.add('active');
    
    await displayAnimeDetail(anime);
}

async function displayAnimeDetail(anime) {
    const modalContent = document.getElementById('modalContent');
    const isInWatchlist = watchlist.some(item => item.content_id === anime.id.toString() && item.content_type === 'anime');
    
    const details = await fetchTVShowDetails(anime.id);
    
    modalContent.innerHTML = `
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            <img src="${anime.poster_path ? CONFIG.TMDB_IMAGE_BASE_URL + anime.poster_path : ''}" 
                 alt="${anime.name}" 
                 style="width: 200px; height: 300px; object-fit: cover; border-radius: 0.5rem;">
            <div style="flex: 1;">
                <h3>${anime.name}</h3>
                <p style="color: #94a3b8; margin: 1rem 0;">${anime.overview || 'No description available'}</p>
                <div style="display: flex; gap: 1rem; margin: 1rem 0;">
                    <span>⭐ ${anime.vote_average ? anime.vote_average.toFixed(1) : 'N/A'}</span>
                    <span>📅 ${anime.first_air_date || 'N/A'}</span>
                    <span>📊 ${details.status || 'N/A'}</span>
                </div>
                <div style="margin: 1rem 0;">
                    <button class="btn btn-primary" onclick="playAnime('${anime.id}', 1)" style="margin-right: 1rem;">
                        ▶️ Play Episode 1
                    </button>
                    <button class="watchlist-btn ${isInWatchlist ? 'added' : ''}" onclick="toggleWatchlist(${anime.id}, 'anime')">
                        ${isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist'}
                    </button>
                </div>
            </div>
        </div>
        ${await loadAnimeSeasons(anime.id)}
    `;
}

async function loadAnimeSeasons(tvId) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/${tvId}?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        
        if (!data.seasons || data.seasons.length === 0) {
            return '<p>No seasons available</p>';
        }
        
        let html = '<h4>Seasons</h4><div class="season-selector">';
        
        data.seasons.forEach((season, index) => {
            if (season.season_number > 0) {
                html += `<button class="season-btn ${index === 0 ? 'active' : ''}" onclick="loadAnimeSeason(${tvId}, ${season.season_number}, event)">
                    Season ${season.season_number}
                </button>`;
            }
        });
        
        html += '</div><div id="episodesContainer"></div>';
        
        setTimeout(() => {
            if (data.seasons.length > 0) {
                const firstSeason = data.seasons.find(s => s.season_number > 0);
                if (firstSeason) {
                    loadAnimeSeason(tvId, firstSeason.season_number, null);
                }
            }
        }, 100);
        
        return html;
    } catch (error) {
        console.error('Error loading seasons:', error);
        return '<p>Failed to load seasons</p>';
    }
}

async function loadAnimeSeason(tvId, seasonNumber, event) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        
        document.querySelectorAll('.season-btn').forEach(btn => btn.classList.remove('active'));
        if (event) {
            event.target.classList.add('active');
        }
        
        let html = '<div class="episodes-grid">';
        
        data.episodes.forEach(episode => {
            const thumbnail = episode.still_path ? `${CONFIG.TMDB_IMAGE_BASE_URL}${episode.still_path}` : '';
            html += `
                <div class="episode-card" onclick="playAnime('${tvId}', ${episode.episode_number})">
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

function playAnime(id, episode) {
    currentVideoInfo = {
        id,
        type: 'anime',
        season: 1,
        episode,
        totalEpisodes: null
    };
    
    const videoPlayer = document.getElementById('videoPlayer');
    const playerTitle = document.getElementById('playerTitle');
    const prevBtn = document.getElementById('prevEpisodeBtn');
    const nextBtn = document.getElementById('nextEpisodeBtn');
    
    playerTitle.textContent = `${currentContent.name} - Episode ${episode}`;
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    
    const embedUrl = `${CONFIG.VIDSRC_BASE_URL}/anime/tmdb${id}/${episode}/sub`;
    videoPlayer.src = embedUrl;
    document.getElementById('videoPlayerModal').classList.add('active');
    
    if (currentUser) {
        trackProgress(id, 'anime', 1, episode);
    }
}

function playAnimeWithType(id, episode, type = 'sub') {
    currentVideoInfo = {
        id,
        type: 'anime',
        season: 1,
        episode,
        totalEpisodes: null
    };
    
    const videoPlayer = document.getElementById('videoPlayer');
    const playerTitle = document.getElementById('playerTitle');
    const prevBtn = document.getElementById('prevEpisodeBtn');
    const nextBtn = document.getElementById('nextEpisodeBtn');
    
    playerTitle.textContent = `${currentContent.name} - Episode ${episode} (${type.toUpperCase()})`;
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    
    const embedUrl = `${CONFIG.VIDSRC_BASE_URL}/anime/tmdb${id}/${episode}/${type}`;
    videoPlayer.src = embedUrl;
    document.getElementById('videoPlayerModal').classList.add('active');
    
    if (currentUser) {
        trackProgress(id, 'anime', 1, episode);
    }
}

async function searchAnime(query) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/search/tv?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}&with_genres=16&with_original_language=ja`);
        const data = await response.json();
        return data.results.map(item => ({ ...item, source: 'tmdb' }));
    } catch (error) {
        console.error('Error searching anime:', error);
        return [];
    }
}