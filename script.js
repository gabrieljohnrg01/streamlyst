// Configuration
// Configuration
const CONFIG = {
    TMDB_API_KEY: import.meta.env.VITE_TMDB_API_KEY,
    TMDB_BASE_URL: import.meta.env.VITE_TMDB_BASE_URL,
    TMDB_IMAGE_BASE_URL: import.meta.env.VITE_TMDB_IMAGE_BASE_URL,
    ANILIST_API_URL: import.meta.env.VITE_ANILIST_API_URL,
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VIDSRC_BASE_URL: import.meta.env.VITE_VIDSRC_BASE_URL
};

// Initialize Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Global variables
let currentUser = null;
let currentContent = null;
let currentCategory = 'trending';
let watchlist = [];

// Video player state
let currentVideoInfo = {
    id: null,
    type: null,
    season: 1,
    episode: 1,
    totalEpisodes: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    // Check for email confirmation or password recovery
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    
    if (type === 'recovery') {
        // This is a password reset link
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
            const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });
            
            if (error) {
                console.error('Error setting session:', error);
                showError('Invalid or expired link');
            } else {
                // Redirect to password update page
                showUpdatePassword();
                // Clean the URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }
    
    // Check for existing user session
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session?.user) {
        currentUser = session.user;
        updateAuthUI();
        await loadWatchlist();
    }
    
    // Load initial content
    loadTrendingContent();
    
    // Setup search
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            updateAuthUI();
            loadWatchlist();
            closeAuthModal();
            showSuccessMessage('Logged in successfully!');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            watchlist = [];
            updateAuthUI();
            showSuccessMessage('Logged out successfully!');
        }
    });
});

// Authentication functions
function showAuthModal(type) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const buttonText = document.getElementById('authButtonText');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitch');
    const extraLinks = document.getElementById('authExtraLinks');
    
    if (type === 'login') {
        title.textContent = 'Login';
        buttonText.textContent = 'Login';
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Register';
        switchLink.onclick = () => showAuthModal('register');
        
        extraLinks.innerHTML = `
            <a href="#" onclick="showPasswordReset()" style="color: #3b82f6; text-decoration: none;">
                Forgot password?
            </a>
        `;
    } else if (type === 'register') {
        title.textContent = 'Register';
        buttonText.textContent = 'Register';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Login';
        switchLink.onclick = () => showAuthModal('login');
        
        extraLinks.innerHTML = '';
    } else if (type === 'reset') {
        title.textContent = 'Reset Password';
        buttonText.textContent = 'Send Reset Link';
        switchText.textContent = 'Remember your password?';
        switchLink.textContent = 'Login';
        switchLink.onclick = () => showAuthModal('login');
        
        extraLinks.innerHTML = '';
    }
    
    modal.classList.add('active');
    
    // Setup form submission
    document.getElementById('authForm').onsubmit = (e) => {
        e.preventDefault();
        if (type === 'reset') {
            handlePasswordReset();
        } else {
            handleAuth(type);
        }
    };
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.getElementById('authForm').reset();
}

async function handleAuth(type) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        if (type === 'register') {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: email.split('@')[0]
                    }
                }
            });
            
            if (error) throw error;
            showSuccessMessage('Account created successfully! Please check your email for confirmation.');
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showError(error.message);
    }
}

async function showPasswordReset() {
    showAuthModal('reset');
}

async function handlePasswordReset() {
    const email = document.getElementById('email').value;
    
    try {
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email);
        
        if (error) throw error;
        
        showSuccessMessage('Password reset link sent to your email');
        closeAuthModal();
    } catch (error) {
        console.error('Password reset error:', error);
        showError(error.message);
    }
}

function showUpdatePassword() {
    const modal = document.getElementById('contentModal');
    const title = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    title.textContent = 'Update Password';
    modalContent.innerHTML = `
        <form id="passwordUpdateForm" style="max-width: 400px; margin: 0 auto;">
            <div class="form-group">
                <label for="newPassword">New Password</label>
                <input type="password" id="newPassword" required minlength="6">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                Update Password
            </button>
        </form>
    `;
    
    modal.classList.add('active');
    
    document.getElementById('passwordUpdateForm').onsubmit = async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        
        try {
            const { data, error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });
            
            if (error) throw error;
            
            showSuccessMessage('Password updated successfully!');
            closeModal();
        } catch (error) {
            console.error('Password update error:', error);
            showError(error.message);
        }
    };
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
        showError('Failed to logout');
    }
}

function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const userInitial = document.getElementById('userInitial');
    
    if (currentUser) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'block';
        userInitial.textContent = currentUser.email.charAt(0).toUpperCase();
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
}

function toggleDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('active');
}

// Content loading functions
async function loadTrendingContent() {
    showLoading();
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/trending/all/week?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        displayContent(data.results);
    } catch (error) {
        console.error('Error loading trending content:', error);
        showError('Failed to load trending content');
    }
}

async function loadMovies() {
    showLoading();
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        // Filter out anime content from the TMDB results
        const filteredMovies = data.results.filter(item => item.media_type !== 'anime');
        displayContent(filteredMovies, 'movie');
    } catch (error) {
        console.error('Error loading movies:', error);
        showError('Failed to load movies');
    }
}

async function loadTVShows() {
    showLoading();
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/popular?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        // Filter out anime content from the TMDB results
        const filteredTVShows = data.results.filter(item => item.media_type !== 'anime');
        displayContent(filteredTVShows, 'tv');
    } catch (error) {
        console.error('Error loading TV shows:', error);
        showError('Failed to load TV shows');
    }
}

async function loadAnime() {
    showLoading();
    try {
        const query = `
            query {
                Page(page: 1, perPage: 20) {
                    media(type: ANIME, sort: POPULARITY_DESC) {
                        id
                        title {
                            romaji
                            english
                        }
                        coverImage {
                            large
                        }
                        description
                        episodes
                        status
                        genres
                        averageScore
                    }
                }
            }
        `;
        
        const response = await fetch(CONFIG.ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        displayAnimeContent(data.data.Page.media);
    } catch (error) {
        console.error('Error loading anime:', error);
        showError('Failed to load anime');
    }
}

function displayContent(content, type = null) {
    const grid = document.getElementById('contentGrid');
    const loading = document.getElementById('loadingSpinner');
    
    loading.style.display = 'none';
    grid.innerHTML = '';
    
    content.forEach(item => {
        const contentType = type || (item.media_type || (item.title ? 'movie' : 'tv'));
        const card = createContentCard(item, contentType);
        grid.appendChild(card);
    });
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

function createContentCard(item, type) {
    const card = document.createElement('div');
    card.className = 'content-card';
    
    const title = item.title || item.name;
    const poster = item.poster_path ? `${CONFIG.TMDB_IMAGE_BASE_URL}${item.poster_path}` : null;
    const year = item.release_date || item.first_air_date ? new Date(item.release_date || item.first_air_date).getFullYear() : 'N/A';
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
    
    card.onclick = () => showContentDetail(item, type);
    return card;
}

function createAnimeCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    
    const title = item.title.english || item.title.romaji;
    const poster = item.coverImage.large;
    const episodes = item.episodes || 'N/A';
    const score = item.averageScore ? (item.averageScore / 10).toFixed(1) : 'N/A';
    
    card.innerHTML = `
        <img src="${poster}" alt="${title}" class="card-image">
        <div class="card-content">
            <div class="card-title">${title}</div>
            <div class="card-info">${episodes} eps • ⭐ ${score}</div>
        </div>
    `;
    
    card.onclick = () => showAnimeDetail(item);
    return card;
}

// Content detail functions
async function showContentDetail(content, type) {
    currentContent = { ...content, type };
    const modal = document.getElementById('contentModal');
    const title = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    title.textContent = content.title || content.name;
    modal.classList.add('active');
    
    try {
        let detailData;
        if (type === 'movie') {
            const response = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${content.id}?api_key=${CONFIG.TMDB_API_KEY}`);
            detailData = await response.json();
        } else {
            const response = await fetch(`${CONFIG.TMDB_BASE_URL}/tv/${content.id}?api_key=${CONFIG.TMDB_API_KEY}`);
            detailData = await response.json();
        }
        
        await displayContentDetail(detailData, type);
    } catch (error) {
        console.error('Error loading content details:', error);
        modalContent.innerHTML = '<p>Failed to load content details</p>';
    }
}

async function showAnimeDetail(anime) {
    currentContent = { ...anime, type: 'anime' };
    const modal = document.getElementById('contentModal');
    const title = document.getElementById('modalTitle');
    
    title.textContent = anime.title.english || anime.title.romaji;
    modal.classList.add('active');
    
    displayAnimeDetail(anime);
}

async function displayContentDetail(content, type) {
    const modalContent = document.getElementById('modalContent');
    const isInWatchlist = watchlist.some(item => item.content_id === content.id.toString() && item.content_type === type);
    
    let html = `
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            <img src="${content.poster_path ? CONFIG.TMDB_IMAGE_BASE_URL + content.poster_path : ''}" 
                 alt="${content.title || content.name}" 
                 style="width: 200px; height: 300px; object-fit: cover; border-radius: 0.5rem;">
            <div style="flex: 1;">
                <h3>${content.title || content.name}</h3>
                <p style="color: #94a3b8; margin: 1rem 0;">${content.overview}</p>
                <div style="display: flex; gap: 1rem; margin: 1rem 0;">
                    <span>⭐ ${content.vote_average ? content.vote_average.toFixed(1) : 'N/A'}</span>
                    <span>📅 ${content.release_date || content.first_air_date || 'N/A'}</span>
                    ${content.runtime ? `<span>⏱️ ${content.runtime}min</span>` : ''}
                </div>
                <div style="margin: 1rem 0;">
                    <button class="btn btn-primary" onclick="playContent('${content.id}', '${type}', 1, 1)" style="margin-right: 1rem;">
                        ▶️ Play ${type === 'movie' ? 'Movie' : 'Episode 1'}
                    </button>
                    <button class="watchlist-btn ${isInWatchlist ? 'added' : ''}" onclick="toggleWatchlist(${content.id}, '${type}')">
                        ${isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    if (type === 'tv') {
        html += await loadTVSeasons(content.id);
    }
    
    modalContent.innerHTML = html;
}

function displayAnimeDetail(anime) {
    const modalContent = document.getElementById('modalContent');
    const isInWatchlist = watchlist.some(item => item.content_id === anime.id.toString() && item.content_type === 'anime');
    
    const description = anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available';
    
    modalContent.innerHTML = `
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            <img src="${anime.coverImage.large}" 
                 alt="${anime.title.english || anime.title.romaji}" 
                 style="width: 200px; height: 300px; object-fit: cover; border-radius: 0.5rem;">
            <div style="flex: 1;">
                <h3>${anime.title.english || anime.title.romaji}</h3>
                <p style="color: #94a3b8; margin: 1rem 0;">${description}</p>
                <div style="display: flex; gap: 1rem; margin: 1rem 0;">
                    <span>⭐ ${anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'}</span>
                    <span>📺 ${anime.episodes || 'N/A'} episodes</span>
                    <span>📊 ${anime.status}</span>
                </div>
                <div style="margin: 1rem 0;">
                    <span style="color: #3b82f6; margin-right: 1rem;">Genres: ${anime.genres.join(', ')}</span>
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
        ${loadAnimeEpisodes(anime)}
    `;
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

function loadAnimeEpisodes(anime) {
    if (!anime.episodes || anime.episodes === 0) {
        return '<p>No episodes available</p>';
    }
    
    let html = '<h4>Episodes</h4><div class="episodes-grid">';
    
    for (let i = 1; i <= Math.min(anime.episodes, 50); i++) {
        html += `
            <div class="episode-card" onclick="playAnime('${anime.id}', ${i})">
                <h5>Episode ${i}</h5>
                <p style="color: #94a3b8; font-size: 0.9rem;">Click to watch episode ${i}</p>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Video player functions
function playContent(id, type, season = 1, episode = 1) {
    currentVideoInfo = {
        id,
        type,
        season,
        episode,
        totalEpisodes: null
    };
    
    const videoPlayer = document.getElementById('videoPlayer');
    const playerTitle = document.getElementById('playerTitle');
    const prevBtn = document.getElementById('prevEpisodeBtn');
    const nextBtn = document.getElementById('nextEpisodeBtn');
    
    let embedUrl;
    if (type === 'movie') {
        embedUrl = `${CONFIG.VIDSRC_BASE_URL}/movie/${id}`;
        playerTitle.textContent = currentContent.title || currentContent.name;
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else if (type === 'tv') {
        embedUrl = `${CONFIG.VIDSRC_BASE_URL}/tv/${id}/${season}/${episode}`;
        playerTitle.textContent = `${currentContent.name} - S${season}E${episode}`;
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
    }
    
    videoPlayer.src = embedUrl;
    document.getElementById('videoPlayerModal').classList.add('active');
    
    // Track progress
    if (currentUser) {
        trackProgress(id, type, season, episode);
    }
}

function playAnime(id, episode) {
    currentVideoInfo = {
        id,
        type: 'anime',
        season: 1,
        episode,
        totalEpisodes: currentContent.episodes
    };
    
    const videoPlayer = document.getElementById('videoPlayer');
    const playerTitle = document.getElementById('playerTitle');
    const prevBtn = document.getElementById('prevEpisodeBtn');
    const nextBtn = document.getElementById('nextEpisodeBtn');
    
    playerTitle.textContent = `${currentContent.title.english || currentContent.title.romaji} - Episode ${episode}`;
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    
    // For anime, we'll use a different approach since vidsrc.cc might not have anime
    // You can integrate with other anime streaming sources here
    const embedUrl = `${CONFIG.VIDSRC_BASE_URL}/anime/ani${id}/${episode}/sub`;
    
    videoPlayer.src = embedUrl;
    document.getElementById('videoPlayerModal').classList.add('active');
    
    // Track progress
    if (currentUser) {
        trackProgress(id, 'anime', 1, episode);
    }
}

function closeVideoPlayer() {
    document.getElementById('videoPlayerModal').classList.remove('active');
    document.getElementById('videoPlayer').src = '';
}

function nextEpisode() {
    if (currentVideoInfo.type === 'tv' || currentVideoInfo.type === 'anime') {
        const nextEpisode = currentVideoInfo.episode + 1;
        
        // For TV shows, we might need to check if there's a next episode
        if (currentVideoInfo.type === 'anime' && currentVideoInfo.totalEpisodes && nextEpisode > currentVideoInfo.totalEpisodes) {
            showSuccessMessage('No more episodes available');
            return;
        }
        
        if (currentVideoInfo.type === 'tv') {
            playContent(currentVideoInfo.id, 'tv', currentVideoInfo.season, nextEpisode);
        } else {
            playAnime(currentVideoInfo.id, nextEpisode);
        }
    }
}

function prevEpisode() {
    if (currentVideoInfo.type === 'tv' || currentVideoInfo.type === 'anime') {
        const prevEpisode = currentVideoInfo.episode - 1;
        if (prevEpisode < 1) {
            showSuccessMessage('This is the first episode');
            return;
        }
        
        if (currentVideoInfo.type === 'tv') {
            playContent(currentVideoInfo.id, 'tv', currentVideoInfo.season, prevEpisode);
        } else {
            playAnime(currentVideoInfo.id, prevEpisode);
        }
    }
}

// Search functionality
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    showLoading();
    
    try {
        // Search movies and TV shows
        const tmdbResponse = await fetch(`${CONFIG.TMDB_BASE_URL}/search/multi?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        const tmdbData = await tmdbResponse.json();
        
        // Search anime
        const animeQuery = `
            query ($search: String) {
                Page(page: 1, perPage: 10) {
                    media(search: $search, type: ANIME) {
                        id
                        title {
                            romaji
                            english
                        }
                        coverImage {
                            large
                        }
                        description
                        episodes
                        status
                        genres
                        averageScore
                    }
                }
            }
        `;
        
        const animeResponse = await fetch(CONFIG.ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: animeQuery,
                variables: { search: query }
            })
        });
        
        const animeData = await animeResponse.json();
        
        // Combine and display results
        const combinedResults = [
            ...tmdbData.results.map(item => ({ ...item, source: 'tmdb' })),
            ...animeData.data.Page.media.map(item => ({ ...item, source: 'anilist' }))
        ];
        
        displaySearchResults(combinedResults);
    } catch (error) {
        console.error('Error performing search:', error);
        showError('Search failed. Please try again.');
    }
}

function displaySearchResults(results) {
    const grid = document.getElementById('contentGrid');
    const loading = document.getElementById('loadingSpinner');
    
    loading.style.display = 'none';
    grid.innerHTML = '';
    
    if (results.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #94a3b8; grid-column: 1 / -1;">No results found</p>';
        return;
    }
    
    results.forEach(item => {
        let card;
        if (item.source === 'anilist') {
            card = createAnimeCard(item);
        } else {
            const type = item.media_type || (item.title ? 'movie' : 'tv');
            card = createContentCard(item, type);
        }
        grid.appendChild(card);
    });
}

// Category functions
function showCategory(category) {
    currentCategory = category;
    
    // Update active category button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    switch (category) {
        case 'trending':
            loadTrendingContent();
            break;
        case 'movies':
            loadMovies();
            break;
        case 'tv':
            loadTVShows();
            break;
        case 'anime':
            loadAnime();
            break;
    }
}

function showHome() {
    currentCategory = 'trending';
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.category-btn').classList.add('active');
    loadTrendingContent();
}

// Watchlist functions
async function toggleWatchlist(contentId, type) {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    const existingIndex = watchlist.findIndex(item => 
        item.content_id === contentId.toString() && item.content_type === type
    );
    
    try {
        if (existingIndex > -1) {
            // Remove from watchlist
            const { error } = await supabaseClient
                .from('watchlist')
                .delete()
                .eq('id', watchlist[existingIndex].id);
                
            if (error) throw error;
            
            watchlist.splice(existingIndex, 1);
            showSuccessMessage('Removed from watchlist');
        } else {
            // Add to watchlist
            const content = {
                content_id: contentId.toString(),
                content_type: type,
                title: currentContent.title || currentContent.name || 
                      (currentContent.title && (currentContent.title.english || currentContent.title.romaji)),
                poster: currentContent.poster_path || currentContent.coverImage?.large,
                user_id: currentUser.id
            };
            
            const { data, error } = await supabaseClient
                .from('watchlist')
                .insert([content])
                .select();
                
            if (error) throw error;
            
            watchlist.push(data[0]);
            showSuccessMessage('Added to watchlist');
        }
        
        // Update button text
        const button = event.target;
        const isInWatchlist = watchlist.some(item => 
            item.content_id === contentId.toString() && item.content_type === type
        );
        button.textContent = isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist';
        button.classList.toggle('added', isInWatchlist);
    } catch (error) {
        console.error('Error updating watchlist:', error);
        showError('Failed to update watchlist');
    }
}

async function showWatchlist() {
    if (!currentUser) {
        showAuthModal('login');
        return;
    }
    
    const grid = document.getElementById('contentGrid');
    const loading = document.getElementById('loadingSpinner');
    
    loading.style.display = 'none';
    grid.innerHTML = '';
    
    if (watchlist.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #94a3b8; grid-column: 1 / -1;">Your watchlist is empty</p>';
        return;
    }
    
    watchlist.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        
        card.innerHTML = `
            ${item.poster ? 
                `<img src="${item.poster.startsWith('http') ? item.poster : CONFIG.TMDB_IMAGE_BASE_URL + item.poster}" 
                      alt="${item.title}" class="card-image">` : 
                `<div class="card-image">No Image</div>`
            }
            <div class="card-content">
                <div class="card-title">${item.title}</div>
                <div class="card-info">${item.content_type.toUpperCase()} • Added ${new Date(item.created_at).toLocaleDateString()}</div>
                <button class="btn btn-secondary" onclick="removeFromWatchlist('${item.id}')" 
                        style="margin-top: 0.5rem; width: 100%;">
                    Remove
                </button>
            </div>
        `;
        
        // Add click handler for the card (excluding the button)
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                // We need to fetch the full content details when clicked
                if (item.content_type === 'anime') {
                    fetchAnimeDetails(item.content_id).then(showAnimeDetail);
                } else {
                    fetchContentDetails(item.content_id, item.content_type).then(data => {
                        showContentDetail(data, item.content_type);
                    });
                }
            }
        });
        
        grid.appendChild(card);
    });
}

async function removeFromWatchlist(watchlistId) {
    try {
        const { error } = await supabaseClient
            .from('watchlist')
            .delete()
            .eq('id', watchlistId);
            
        if (error) throw error;
        
        watchlist = watchlist.filter(item => item.id !== watchlistId);
        showWatchlist(); // Refresh the display
        showSuccessMessage('Removed from watchlist');
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        showError('Failed to remove from watchlist');
    }
}

async function loadWatchlist() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('watchlist')
            .select('*')
            .eq('user_id', currentUser.id);
            
        if (error) throw error;
        
        watchlist = data || [];
    } catch (error) {
        console.error('Error loading watchlist:', error);
        showError('Failed to load watchlist');
    }
}

// Progress tracking
async function trackProgress(contentId, type, season, episode) {
    if (!currentUser) return;
    
    try {
        // Check if progress already exists
        const { data: existing, error: fetchError } = await supabaseClient
            .from('progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('content_id', contentId.toString())
            .eq('content_type', type)
            .single();
            
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        
        if (existing) {
            // Update existing progress
            const { error } = await supabaseClient
                .from('progress')
                .update({
                    season,
                    episode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
                
            if (error) throw error;
        } else {
            // Create new progress
            const { error } = await supabaseClient
                .from('progress')
                .insert([{
                    user_id: currentUser.id,
                    content_id: contentId.toString(),
                    content_type: type,
                    season,
                    episode,
                    title: currentContent.title || currentContent.name || 
                          (currentContent.title && (currentContent.title.english || currentContent.title.romaji))
                }]);
                
            if (error) throw error;
        }
    } catch (error) {
        console.error('Error tracking progress:', error);
    }
}

// Helper functions to fetch full content details
async function fetchContentDetails(contentId, type) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/${type}/${contentId}?api_key=${CONFIG.TMDB_API_KEY}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching content details:', error);
        return null;
    }
}

async function fetchAnimeDetails(animeId) {
    try {
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    title {
                        romaji
                        english
                    }
                    coverImage {
                        large
                    }
                    description
                    episodes
                    status
                    genres
                    averageScore
                }
            }
        `;
        
        const response = await fetch(CONFIG.ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: { id: parseInt(animeId) }
            })
        });
        
        const data = await response.json();
        return data.data.Media;
    } catch (error) {
        console.error('Error fetching anime details:', error);
        return null;
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('contentGrid').innerHTML = '';
}

function showError(message) {
    const grid = document.getElementById('contentGrid');
    const loading = document.getElementById('loadingSpinner');
    
    loading.style.display = 'none';
    grid.innerHTML = `<p style="text-align: center; color: #ef4444; grid-column: 1 / -1;">${message}</p>`;
}

function showSuccessMessage(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #10b981, #059669);
        color: white;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

function closeModal() {
    document.getElementById('contentModal').classList.remove('active');
}

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.classList.remove('active');
            if (modal.id === 'videoPlayerModal') {
                document.getElementById('videoPlayer').src = '';
            }
        }
    });
    
    // Close user dropdown when clicking outside
    if (!e.target.closest('.user-menu')) {
        document.getElementById('userDropdown').classList.remove('active');
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);