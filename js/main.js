document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section);
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            link.classList.add('active');
            
            // Load content for the section
            if (section === 'home') loadTrendingContent();
            else if (section === 'movies') loadMovies();
            else if (section === 'tv') loadTVShows();
            else if (section === 'anime') loadAnime();
            else if (section === 'watchlist') loadWatchlist();
        });
    });
    
    // Back button
    document.getElementById('back-button')?.addEventListener('click', () => {
        const previousSection = document.querySelector('.content-section.active').dataset.previousSection || 'home';
        showSection(previousSection);
    });
    
    // Player back button
    document.getElementById('player-back-button')?.addEventListener('click', () => {
        showSection('details-section');
    });
    
    // Initial load
    if (document.querySelector('.content-section.active').id === 'home-section') {
        loadTrendingContent();
    }
});

function showSection(sectionId) {
    // Store current section as previous for back button
    const currentSection = document.querySelector('.content-section.active');
    if (currentSection && currentSection.id !== 'details-section' && currentSection.id !== 'player-section') {
        document.querySelectorAll('.content-section').forEach(section => {
            section.dataset.previousSection = currentSection.id;
        });
    }
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(`${sectionId}-section`).classList.add('active');
}

async function loadTrendingContent() {
    const grid = document.getElementById('trending-grid');
    grid.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        // Fetch trending movies, TV shows, and anime
        const [movies, tvShows, anime] = await Promise.all([
            fetchTrending('movie'),
            fetchTrending('tv'),
            fetchAnimeTrending()
        ]);
        
        // Combine and sort by popularity
        const allContent = [...movies, ...tvShows, ...anime]
            .sort((a, b) => (b.popularity || b.trending) - (a.popularity || a.trending))
            .slice(0, 20);
        
        renderMediaGrid(allContent, grid);
    } catch (error) {
        console.error('Error loading trending content:', error);
        grid.innerHTML = '<div class="error">Failed to load content. Please try again.</div>';
    }
}

async function loadMovies() {
    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const movies = await fetchPopular('movie');
        renderMediaGrid(movies, grid);
    } catch (error) {
        console.error('Error loading movies:', error);
        grid.innerHTML = '<div class="error">Failed to load movies. Please try again.</div>';
    }
}

async function loadTVShows() {
    const grid = document.getElementById('tv-grid');
    grid.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const tvShows = await fetchPopular('tv');
        renderMediaGrid(tvShows, grid);
    } catch (error) {
        console.error('Error loading TV shows:', error);
        grid.innerHTML = '<div class="error">Failed to load TV shows. Please try again.</div>';
    }
}

async function loadAnime() {
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const anime = await fetchAnimePopular();
        renderMediaGrid(anime, grid);
    } catch (error) {
        console.error('Error loading anime:', error);
        grid.innerHTML = '<div class="error">Failed to load anime. Please try again.</div>';
    }
}

function renderMediaGrid(items, gridElement) {
    gridElement.innerHTML = '';
    
    items.forEach(item => {
        const mediaCard = document.createElement('div');
        mediaCard.className = 'media-card';
        mediaCard.dataset.id = item.id;
        mediaCard.dataset.type = item.media_type || item.type;
        
        const posterPath = item.poster_path || item.coverImage?.large || '';
        const title = item.title || item.name || item.title?.userPreferred || 'Untitled';
        const year = item.release_date?.substring(0, 4) || item.startDate?.year || '';

        mediaCard.innerHTML = `
            <div class="media-poster-container">
                ${posterPath ? 
                    `<img src="${posterPath}" alt="${title}" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'300\' viewBox=\'0 0 200 300\'%3E%3Crect fill=\'%23222\' width=\'200\' height=\'300\'/%3E%3Ctext fill=\'%23fff\' font-family=\'sans-serif\' font-size=\'16\' dy=\'0.35em\' text-anchor=\'middle\' x=\'100\' y=\'150\'%3ENo Image%3C/text%3E%3C/svg%3E'">` : 
                    `<div class="no-poster">No Image</div>`
                }
            </div>
            <div class="media-info">
                <h3>${title}</h3>
                <p>${year}</p>
            </div>
            <div class="media-type">${item.media_type?.toUpperCase() || item.type?.toUpperCase() || 'MOVIE'}</div>
        `;
        
        mediaCard.addEventListener('click', () => showMediaDetails(item.id, item.media_type || item.type));
        gridElement.appendChild(mediaCard);
    });
}

async function showMediaDetails(id, type) {
    const detailsSection = document.getElementById('details-section');
    detailsSection.innerHTML = '<div class="loading">Loading...</div>';
    showSection('details-section');
    
    try {
        let details;
        if (type === 'movie' || type === 'tv') {
            details = await fetchMediaDetails(id, type);
        } else if (type === 'anime') {
            details = await fetchAnimeDetails(id);
        }
        
        renderMediaDetails(details, type);
    } catch (error) {
        console.error('Error loading media details:', error);
        detailsSection.innerHTML = '<div class="error">Failed to load details. Please try again.</div>';
    }
}

function renderMediaDetails(details, type) {
    const detailsSection = document.getElementById('media-details');
    
    let posterPath, title, overview, year, genres;
    let seasonsHtml = '';
    let isInWatchlist = false; // You would check this against the user's watchlist
    
    if (type === 'movie') {
        posterPath = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
        title = details.title;
        overview = details.overview;
        year = details.release_date?.substring(0, 4);
        genres = details.genres?.map(g => g.name).join(', ');
    } else if (type === 'tv') {
        posterPath = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
        title = details.name;
        overview = details.overview;
        year = details.first_air_date?.substring(0, 4);
        genres = details.genres?.map(g => g.name).join(', ');
        
        // Seasons dropdown
        if (details.seasons && details.seasons.length > 0) {
            seasonsHtml = `
                <div class="seasons-container">
                    <div class="season-selector">
                        <select id="season-select">
                            ${details.seasons.map(season => `
                                <option value="${season.season_number}">Season ${season.season_number}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="episodes-container" id="episodes-container">
                        <!-- Episodes will be loaded here when season is selected -->
                    </div>
                </div>
            `;
            
            // Load first season episodes by default
            loadSeasonEpisodes(id, details.seasons[0].season_number);
        }
    } else if (type === 'anime') {
        posterPath = details.coverImage?.large || 'https://via.placeholder.com/500x750?text=No+Image';
        title = details.title?.userPreferred || details.title?.romaji || 'Untitled';
        overview = details.description;
        year = details.startDate?.year;
        genres = details.genres?.join(', ');
        
        // Anime episodes
        if (details.episodes && details.episodes.length > 0) {
            seasonsHtml = `
                <div class="episodes-container">
                    <h3>Episodes</h3>
                    <div class="episodes-grid" id="episodes-grid">
                        ${details.episodes.map(episode => `
                            <div class="episode-card" data-episode="${episode.number}">
                                <img src="${episode.thumbnail || posterPath}" alt="Episode ${episode.number}">
                                <div class="episode-info">
                                    <h3>Episode ${episode.number}: ${episode.title || 'Untitled'}</h3>
                                    <p>${episode.description || 'No description available'}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    detailsSection.innerHTML = `
        <div class="detail-poster">
            ${posterPath ? 
                `<img src="${posterPath}" alt="${title}" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'500\' height=\'750\' viewBox=\'0 0 500 750\'%3E%3Crect fill=\'%23222\' width=\'500\' height=\'750\'/%3E%3Ctext fill=\'%23fff\' font-family=\'sans-serif\' font-size=\'24\' dy=\'0.35em\' text-anchor=\'middle\' x=\'250\' y=\'375\'%3ENo Image Available%3C/text%3E%3C/svg%3E'">` : 
                `<div class="no-poster-large">No Image Available</div>`
            }
        </div>
        <div class="detail-content">
            <h1>${title} ${year ? `(${year})` : ''}</h1>
            <div class="detail-meta">
                ${genres ? `<span><i class="fas fa-tag"></i> ${genres}</span>` : ''}
            </div>
            <div class="detail-overview">
                <h3>Overview</h3>
                <p>${overview || 'No overview available.'}</p>
            </div>
            <div class="detail-actions">
                <button class="play-button" id="play-button" data-id="${id}" data-type="${type}">
                    <i class="fas fa-play"></i> Play
                </button>
                <button class="watchlist-button" id="watchlist-button" data-id="${id}" data-type="${type}">
                    <i class="fas ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i> ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
            </div>
            ${seasonsHtml}
        </div>
    `;
    
    // Add event listeners
    document.getElementById('play-button')?.addEventListener('click', (e) => {
        const id = e.target.closest('button').dataset.id;
        const type = e.target.closest('button').dataset.type;
        playMedia(id, type);
    });
    
    document.getElementById('watchlist-button')?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        const id = button.dataset.id;
        const type = button.dataset.type;
        toggleWatchlist(id, type, button);
    });
    
    if (type === 'tv') {
        document.getElementById('season-select')?.addEventListener('change', (e) => {
            const seasonNumber = e.target.value;
            loadSeasonEpisodes(id, seasonNumber);
        });
    } else if (type === 'anime') {
        document.querySelectorAll('.episode-card')?.forEach(card => {
            card.addEventListener('click', () => {
                const episodeNumber = card.dataset.episode;
                playMedia(id, type, episodeNumber);
            });
        });
    }
}

async function loadSeasonEpisodes(seriesId, seasonNumber) {
    const episodesContainer = document.getElementById('episodes-container');
    episodesContainer.innerHTML = '<div class="loading">Loading episodes...</div>';
    
    try {
        const episodes = await fetchTVSeason(seriesId, seasonNumber);
        
        if (episodes.length === 0) {
            episodesContainer.innerHTML = '<div class="no-episodes">No episodes available for this season.</div>';
            return;
        }
        
        let episodesHtml = `
            <h3>Episodes</h3>
            <div class="episodes-grid">
                ${episodes.map(episode => `
                    <div class="episode-card" data-episode="${episode.episode_number}">
                        <img src="${episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : 'https://via.placeholder.com/300x169?text=No+Image'}" alt="Episode ${episode.episode_number}">
                        <div class="episode-info">
                            <h3>Episode ${episode.episode_number}: ${episode.name || 'Untitled'}</h3>
                            <p>${episode.overview || 'No description available'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        episodesContainer.innerHTML = episodesHtml;
        
        // Add click event to episodes
        document.querySelectorAll('.episode-card')?.forEach(card => {
            card.addEventListener('click', () => {
                const episodeNumber = card.dataset.episode;
                playMedia(seriesId, 'tv', episodeNumber, seasonNumber);
            });
        });
    } catch (error) {
        console.error('Error loading season episodes:', error);
        episodesContainer.innerHTML = '<div class="error">Failed to load episodes. Please try again.</div>';
    }
}