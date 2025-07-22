// Configuration
const CONFIG = {
    TMDB_API_KEY: 'fc5229ddcee9e96a1be1b8f8535063a3',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
    ANILIST_API_URL: 'https://graphql.anilist.co',
    SUPABASE_URL: 'https://mxqvyptzqueqltyqogyk.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cXZ5cHR6cXVlcWx0eXFvZ3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMDY1OTgsImV4cCI6MjA2NjY4MjU5OH0.96gJO6hi8Bmhn4ak2WYFX-elAJGkALfVfGGm_BGMUeI',
    VIDSRC_BASE_URL: 'https://vidsrc.cc/v2/embed'
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
            detailData = await fetchMovieDetails(content.id);
        } else {
            detailData = await fetchTVShowDetails(content.id);
        }
        
        await displayContentDetail(detailData, type);
    } catch (error) {
        console.error('Error loading content details:', error);
        modalContent.innerHTML = '<p>Failed to load content details</p>';
    }
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
    } else if (type === 'anime') {
        embedUrl = `${CONFIG.VIDSRC_BASE_URL}/anime/tmdb${id}/${episode}/sub`;
        playerTitle.textContent = `${currentContent.name} - Episode ${episode}`;
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
    }
    
    videoPlayer.src = embedUrl;
    document.getElementById('videoPlayerModal').classList.add('active');
    
    if (currentUser) {
        trackProgress(id, type, season, episode);
    }
}

function closeVideoPlayer() {
    document.getElementById('videoPlayerModal').classList.remove('active');
    document.getElementById('videoPlayer').src = '';
}

function nextEpisode() {
    if (currentVideoInfo.type === 'tv') {
        const nextEpisode = currentVideoInfo.episode + 1;
        playContent(currentVideoInfo.id, 'tv', currentVideoInfo.season, nextEpisode);
    } else if (currentVideoInfo.type === 'anime') {
        const nextEpisode = currentVideoInfo.episode + 1;
        if (currentVideoInfo.totalEpisodes && nextEpisode > currentVideoInfo.totalEpisodes) {
            showSuccessMessage('No more episodes available');
            return;
        }
        playAnime(currentVideoInfo.id, nextEpisode);
    }
}


function prevEpisode() {
    if (currentVideoInfo.type === 'tv') {
        const prevEpisode = currentVideoInfo.episode - 1;
        if (prevEpisode < 1) {
            showSuccessMessage('This is the first episode');
            return;
        }
        playContent(currentVideoInfo.id, 'tv', currentVideoInfo.season, prevEpisode);
    } else if (currentVideoInfo.type === 'anime') {
        const prevEpisode = currentVideoInfo.episode - 1;
        if (prevEpisode < 1) {
            showSuccessMessage('This is the first episode');
            return;
        }
        playAnime(currentVideoInfo.id, prevEpisode);
    }
}

// Search functionality
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    showLoading();
    
    try {
        // Search movies and TV shows from TMDB
        const tmdbResponse = await fetch(`${CONFIG.TMDB_BASE_URL}/search/multi?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        const tmdbData = await tmdbResponse.json();
        
        // Search anime separately
        const animeResults = await searchAnime(query);
        
        // Combine and display results
        const combinedResults = [...tmdbData.results, ...animeResults];
        
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
        
        // Update button text - find the button that was clicked
        const isInWatchlist = watchlist.some(item => 
            item.content_id === contentId.toString() && item.content_type === type
        );
        
        // Update all watchlist buttons for this content
        const buttons = document.querySelectorAll('.watchlist-btn');
        buttons.forEach(button => {
            // Check if this button is for the current content
            const buttonOnClick = button.getAttribute('onclick');
            if (buttonOnClick && buttonOnClick.includes(`'${contentId}'`) && buttonOnClick.includes(`'${type}'`)) {
                button.textContent = isInWatchlist ? '✓ In Watchlist' : '+ Add to Watchlist';
                button.classList.toggle('added', isInWatchlist);
            }
        });
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