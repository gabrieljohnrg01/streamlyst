// Anime-related functions

async function loadAnime() {
    showLoading();
    try {
        const query = `
            query {
                Page(page: 1, perPage: 20) {
                    media(type: ANIME, sort: POPULARITY_DESC, status_in: [FINISHED, RELEASING, NOT_YET_RELEASED]) {
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
                        duration
                        status
                        genres
                        averageScore
                        format
                        nextAiringEpisode {
                            episode
                        }
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
    
    const title = item.title.english || item.title.romaji;
    const poster = item.coverImage.large;
    
    // Better episode count logic
    let episodes;
    if (item.episodes) {
        episodes = item.episodes;
    } else if (item.nextAiringEpisode && item.nextAiringEpisode.episode) {
        // For ongoing anime, use next airing episode - 1
        episodes = item.nextAiringEpisode.episode - 1;
    } else if (item.status === 'RELEASING') {
        episodes = 'Ongoing';
    } else {
        episodes = 'Unknown';
    }
    
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

async function showAnimeDetail(anime) {
    currentContent = { ...anime, type: 'anime' };
    const modal = document.getElementById('contentModal');
    const title = document.getElementById('modalTitle');
    
    title.textContent = anime.title.english || anime.title.romaji;
    modal.classList.add('active');
    
    await displayAnimeDetail(anime);
}

async function displayAnimeDetail(anime) {
    const modalContent = document.getElementById('modalContent');
    const isInWatchlist = watchlist.some(item => item.content_id === anime.id.toString() && item.content_type === 'anime');
    
    const description = anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available';
    
    // Better episode count logic
    let episodeDisplay;
    if (anime.episodes) {
        episodeDisplay = anime.episodes;
    } else if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode) {
        episodeDisplay = anime.nextAiringEpisode.episode - 1;
    } else if (anime.status === 'RELEASING') {
        episodeDisplay = 'Ongoing';
    } else {
        episodeDisplay = 'Unknown';
    }
    
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
                    <span>📺 ${episodeDisplay} episodes</span>
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
        ${await loadAnimeEpisodes(anime)}
    `;
}

async function loadAnimeEpisodes(anime, page = 1) {
    // First, fetch detailed anime data with streaming episodes
    let detailedAnime = anime;
    if (!anime.streamingEpisodes) {
        const fetchedAnime = await fetchAnimeDetails(anime.id);
        if (fetchedAnime) {
            detailedAnime = { ...anime, ...fetchedAnime };
            // Update the current content with detailed info
            currentContent = { ...currentContent, ...fetchedAnime };
        }
    }
    
    // Get the actual episode count from AniList data
    let episodeCount = null;
    
    if (detailedAnime.episodes && detailedAnime.episodes > 0) {
        episodeCount = detailedAnime.episodes;
    } else if (detailedAnime.nextAiringEpisode && detailedAnime.nextAiringEpisode.episode) {
        // For ongoing anime, use next airing episode - 1
        episodeCount = detailedAnime.nextAiringEpisode.episode - 1;
    }
    
    // If we still don't have episode count, check the status
    if (!episodeCount) {
        if (detailedAnime.status === 'FINISHED') {
            return '<h4>Episodes</h4><p style="color: #94a3b8;">Loading episode information...</p>';
        } else if (detailedAnime.status === 'RELEASING') {
            return '<h4>Episodes</h4><p style="color: #94a3b8;">This anime is currently airing. Episode count may be incomplete.</p>';
        } else {
            return '<h4>Episodes</h4><p style="color: #94a3b8;">Episode information not available from AniList.</p>';
        }
    }
    
    const episodesPerPage = 50; // Reduced for better performance with thumbnails
    const totalPages = Math.ceil(episodeCount / episodesPerPage);
    const startEpisode = (page - 1) * episodesPerPage + 1;
    const endEpisode = Math.min(page * episodesPerPage, episodeCount);
    
    let html = `
        <h4>Episodes</h4>
        <div class="episodes-pagination" style="display: flex; justify-content: space-between; align-items: center; margin: 1rem 0; padding: 1rem; background: #1e293b; border-radius: 0.5rem;">
            <div style="color: #94a3b8;">
                Showing episodes ${startEpisode}-${endEpisode} of ${episodeCount}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="pagination-btn ${page === 1 ? 'disabled' : ''}" 
                        onclick="loadEpisodePage(${detailedAnime.id}, ${page - 1})" 
                        ${page === 1 ? 'disabled' : ''}
                        style="padding: 0.5rem 1rem; background: ${page === 1 ? '#374151' : '#3b82f6'}; color: white; border: none; border-radius: 0.25rem; cursor: ${page === 1 ? 'not-allowed' : 'pointer'};">
                    Previous
                </button>
                <span style="color: #94a3b8; margin: 0 1rem;">
                    Page ${page} of ${totalPages}
                </span>
                <button class="pagination-btn ${page === totalPages ? 'disabled' : ''}" 
                        onclick="loadEpisodePage(${detailedAnime.id}, ${page + 1})" 
                        ${page === totalPages ? 'disabled' : ''}
                        style="padding: 0.5rem 1rem; background: ${page === totalPages ? '#374151' : '#3b82f6'}; color: white; border: none; border-radius: 0.25rem; cursor: ${page === totalPages ? 'not-allowed' : 'pointer'};">
                    Next
                </button>
            </div>
        </div>
        <div class="episodes-grid">`;
    
    for (let i = startEpisode; i <= endEpisode; i++) {
        // Get thumbnail and title from streaming episodes if available
        let thumbnailUrl = detailedAnime.coverImage.large; // Default fallback
        let episodeTitle = `Episode ${i}`;
        
        if (detailedAnime.streamingEpisodes && detailedAnime.streamingEpisodes.length > 0) {
            // Try to find matching episode by various methods
            let matchedEpisode = null;
            
            // Method 1: Direct index match (episode i corresponds to index i-1)
            if (detailedAnime.streamingEpisodes[i - 1]) {
                matchedEpisode = detailedAnime.streamingEpisodes[i - 1];
            }
            
            // Method 2: Search by episode number in title
            if (!matchedEpisode) {
                matchedEpisode = detailedAnime.streamingEpisodes.find(ep => {
                    if (!ep.title) return false;
                    
                    // Look for episode number patterns in title
                    const episodePatterns = [
                        new RegExp(`episode\\s*${i}\\b`, 'i'),
                        new RegExp(`ep\\s*${i}\\b`, 'i'),
                        new RegExp(`\\b${i}\\b`),
                        new RegExp(`#${i}\\b`),
                        new RegExp(`第${i}話`, 'i') // Japanese episode format
                    ];
                    
                    return episodePatterns.some(pattern => pattern.test(ep.title));
                });
            }
            
            // Method 3: Search by URL pattern (some services include episode numbers in URLs)
            if (!matchedEpisode) {
                matchedEpisode = detailedAnime.streamingEpisodes.find(ep => {
                    if (!ep.url) return false;
                    return ep.url.includes(`episode-${i}`) || ep.url.includes(`ep${i}`) || ep.url.includes(`/${i}/`);
                });
            }
            
            if (matchedEpisode) {
                if (matchedEpisode.thumbnail) {
                    thumbnailUrl = matchedEpisode.thumbnail;
                }
                if (matchedEpisode.title) {
                    episodeTitle = matchedEpisode.title;
                }
            }
        }
        
        html += `
            <div class="episode-card" onclick="playAnime('${detailedAnime.id}', ${i})" style="display: flex; flex-direction: column; background: #1e293b; border-radius: 0.5rem; overflow: hidden; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;">
                <div style="position: relative; width: 100%; height: 140px; overflow: hidden;">
                    <img src="${thumbnailUrl}" 
                         alt="${episodeTitle}" 
                         style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s ease;"
                         onerror="this.src='${detailedAnime.coverImage.large}'" 
                         loading="lazy">
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 0.5rem;">
                        <div style="color: white; font-size: 0.9rem; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">Episode ${i}</div>
                    </div>
                    <div style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.7); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem;">
                        ${i}/${episodeCount}
                    </div>
                </div>
                <div style="padding: 0.75rem;">
                    <h5 style="margin: 0 0 0.5rem 0; color: white; font-size: 0.95rem; font-weight: 600; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${episodeTitle}</h5>
                    <p style="color: #94a3b8; font-size: 0.8rem; margin: 0; opacity: 0.8;">Click to watch episode ${i}</p>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    
    // Add CSS for episode cards hover effect
    html += `
        <style>
            .episode-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
            }
            .episode-card:hover img {
                transform: scale(1.05);
            }
            .episodes-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 1.5rem;
                margin-top: 1rem;
            }
            @media (max-width: 768px) {
                .episodes-grid {
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 1rem;
                }
            }
        </style>
    `;
    
    return html;
}

async function loadEpisodePage(animeId, page) {
    // Find the current anime in currentContent
    if (currentContent && currentContent.id === animeId) {
        const modalContent = document.getElementById('modalContent');
        const currentHTML = modalContent.innerHTML;
        const episodesIndex = currentHTML.indexOf('<h4>Episodes</h4>');
        
        if (episodesIndex !== -1) {
            const beforeEpisodes = currentHTML.substring(0, episodesIndex);
            modalContent.innerHTML = beforeEpisodes + await loadAnimeEpisodes(currentContent, page);
        }
    }
}

function playAnime(id, episode) {
    currentVideoInfo = {
        id,
        type: 'anime',
        season: 1,
        episode,
        totalEpisodes: currentContent.episodes || (currentContent.nextAiringEpisode ? currentContent.nextAiringEpisode.episode - 1 : 1)
    };
    
    const videoPlayer = document.getElementById('videoPlayer');
    const playerTitle = document.getElementById('playerTitle');
    const prevBtn = document.getElementById('prevEpisodeBtn');
    const nextBtn = document.getElementById('nextEpisodeBtn');
    
    playerTitle.textContent = `${currentContent.title.english || currentContent.title.romaji} - Episode ${episode}`;
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    
    // For anime, we'll use a different approach since vidsrc.cc might not have anime
    const embedUrl = `${CONFIG.VIDSRC_BASE_URL}/anime/ani${id}/${episode}/sub`;
    
    videoPlayer.src = embedUrl;
    document.getElementById('videoPlayerModal').classList.add('active');
    
    // Track progress
    if (currentUser) {
        trackProgress(id, 'anime', 1, episode);
    }
}

async function searchAnime(query) {
    try {
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
        
        const response = await fetch(CONFIG.ANILIST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: animeQuery,
                variables: { search: query }
            })
        });
        
        const data = await response.json();
        return data.data.Page.media.map(item => ({ ...item, source: 'anilist' }));
    } catch (error) {
        console.error('Error searching anime:', error);
        return [];
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
                    duration
                    status
                    genres
                    averageScore
                    format
                    nextAiringEpisode {
                        episode
                    }
                    streamingEpisodes {
                        title
                        thumbnail
                        url
                    }
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