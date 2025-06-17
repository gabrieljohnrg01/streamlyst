const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3'; 
const BASE_URL = 'https://api.themoviedb.org/3'; 
const IMG_URL = 'https://image.tmdb.org/t/p/original'; 
const ANILIST_URL = 'https://graphql.anilist.co';
let currentItem; 

async function fetchTrending(type) { 
  const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`); 
  const data = await res.json(); 

  // Filter out anime from TMDB results
  const filteredResults = data.results.filter(item => {
    // Remove Japanese content with animation genre (anime)
    const isJapanese = item.original_language === 'ja';
    const isAnimation = item.genre_ids && item.genre_ids.includes(16);
    return !(isJapanese && isAnimation);
  });

  return filteredResults; 
} 

async function searchTMDBAnime(animeTitle) {
  try {
    const res = await fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(animeTitle)}`);
    const data = await res.json();
    
    // Look for anime matches (Japanese + Animation genre)
    const animeMatches = data.results.filter(item => {
      const isJapanese = item.original_language === 'ja';
      const isAnimation = item.genre_ids && item.genre_ids.includes(16);
      return isJapanese && isAnimation;
    });

    return animeMatches[0] || null; // Return first match or null
  } catch (error) {
    console.error('Error searching TMDB for anime:', error);
    return null;
  }
}

async function fetchTrendingAnime() {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(type: ANIME, sort: TRENDING_DESC, status: RELEASING) {
          id
          title {
            romaji
            english
            native
          }
          description
          episodes
          averageScore
          coverImage {
            large
            medium
          }
          bannerImage
          genres
          status
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          studios {
            nodes {
              name
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                title {
                  romaji
                  english
                  native
                }
                type
                format
                status
                episodes
                coverImage {
                  large
                  medium
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    const animeList = [];

    // Group anime by series (combining seasons)
    const seriesGroups = new Map();

    for (const anime of data.data.Page.media) {
      // Try to get TMDB thumbnail
      const tmdbMatch = await searchTMDBAnime(anime.title.english || anime.title.romaji);
      
      // Create base anime object
      const animeObj = {
        id: anime.id,
        name: anime.title.english || anime.title.romaji,
        title: anime.title.english || anime.title.romaji,
        overview: anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available',
        poster_path: tmdbMatch ? tmdbMatch.poster_path : anime.coverImage.large,
        backdrop_path: tmdbMatch ? tmdbMatch.backdrop_path : anime.bannerImage,
        vote_average: anime.averageScore ? anime.averageScore / 10 : 0,
        media_type: 'anime',
        original_language: 'ja',
        genre_ids: [16],
        genres: anime.genres,
        episodes: anime.episodes,
        status: anime.status,
        studios: anime.studios.nodes.map(studio => studio.name),
        anilist_id: anime.id,
        tmdb_id: tmdbMatch ? tmdbMatch.id : null,
        seasons: []
      };

      // Check for related seasons/sequels
      const baseTitle = anime.title.english || anime.title.romaji;
      const seriesKey = baseTitle.replace(/\s*(Season|S)\s*\d+|\s*(II|III|IV|V|VI|VII|VIII|IX|X)+|\s*\d+(st|nd|rd|th)\s*Season/gi, '').trim();

      if (seriesGroups.has(seriesKey)) {
        // Add as season to existing series
        const existingSeries = seriesGroups.get(seriesKey);
        existingSeries.seasons.push({
          season_number: existingSeries.seasons.length + 1,
          name: baseTitle,
          episodes: anime.episodes,
          anilist_id: anime.id,
          tmdb_season_number: tmdbMatch ? 1 : null
        });
      } else {
        // Create new series entry
        animeObj.seasons.push({
          season_number: 1,
          name: baseTitle,
          episodes: anime.episodes,
          anilist_id: anime.id,
          tmdb_season_number: tmdbMatch ? 1 : null
        });
        seriesGroups.set(seriesKey, animeObj);
      }
    }

    return Array.from(seriesGroups.values());
  } catch (error) {
    console.error('Error fetching anime from AniList:', error);
    return [];
  }
}

async function searchAnime(query) {
  const searchQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(type: ANIME, search: $search) {
          id
          title {
            romaji
            english
            native
          }
          description
          episodes
          averageScore
          coverImage {
            large
            medium
          }
          bannerImage
          genres
          status
          studios {
            nodes {
              name
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: searchQuery,
        variables: { search: query }
      })
    });

    const data = await response.json();
    const results = [];

    for (const anime of data.data.Page.media) {
      // Try to get TMDB thumbnail for search results too
      const tmdbMatch = await searchTMDBAnime(anime.title.english || anime.title.romaji);
      
      results.push({
        id: anime.id,
        name: anime.title.english || anime.title.romaji,
        title: anime.title.english || anime.title.romaji,
        overview: anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available',
        poster_path: tmdbMatch ? tmdbMatch.poster_path : anime.coverImage.large,
        backdrop_path: tmdbMatch ? tmdbMatch.backdrop_path : anime.bannerImage,
        vote_average: anime.averageScore ? anime.averageScore / 10 : 0,
        media_type: 'anime',
        original_language: 'ja',
        genre_ids: [16],
        genres: anime.genres,
        episodes: anime.episodes,
        status: anime.status,
        studios: anime.studios.nodes.map(studio => studio.name),
        anilist_id: anime.id,
        tmdb_id: tmdbMatch ? tmdbMatch.id : null,
        seasons: [{
          season_number: 1,
          name: anime.title.english || anime.title.romaji,
          episodes: anime.episodes,
          anilist_id: anime.id,
          tmdb_season_number: tmdbMatch ? 1 : null
        }]
      });
    }

    return results;
  } catch (error) {
    console.error('Error searching anime on AniList:', error);
    return [];
  }
}

async function fetchTVDetails(id) { 
  const res = await fetch(`${BASE_URL}/tv/${id}?api_key=${API_KEY}`); 
  const data = await res.json(); 
  return data; 
} 

async function fetchAnimeDetails(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        description
        episodes
        averageScore
        coverImage {
          large
          medium
        }
        bannerImage
        genres
        status
        studios {
          nodes {
            name
          }
        }
        streamingEpisodes {
          title
          thumbnail
          url
        }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        variables: { id: parseInt(id) }
      })
    });

    const data = await response.json();
    return data.data.Media;
  } catch (error) {
    console.error('Error fetching anime details from AniList:', error);
    return null;
  }
}

async function fetchAnimeEpisodes(anilistId, tmdbId, seasonNumber) {
  // Try to get episode titles from TMDB first if available
  if (tmdbId && seasonNumber) {
    try {
      const res = await fetch(`${BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${API_KEY}`);
      const seasonData = await res.json();
      
      if (seasonData.episodes && seasonData.episodes.length > 0) {
        return seasonData.episodes.map(ep => ({
          episode_number: ep.episode_number,
          name: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching TMDB episode data:', error);
    }
  }

  // Fallback: Try AniList or create default episodes
  try {
    const animeDetails = await fetchAnimeDetails(anilistId);
    const episodeCount = animeDetails?.episodes || 12;
    
    // Create default episode list with generic titles
    const episodes = [];
    for (let i = 1; i <= episodeCount; i++) {
      episodes.push({
        episode_number: i,
        name: `Episode ${i}`,
        overview: ''
      });
    }
    
    return episodes;
  } catch (error) {
    console.error('Error creating default episodes:', error);
    return [];
  }
}

function displayBanner(item) { 
  const backdropUrl = item.backdrop_path ? 
    (item.backdrop_path.startsWith('http') ? item.backdrop_path : `${IMG_URL}${item.backdrop_path}`) :
    (item.bannerImage || '');

  document.getElementById('banner').style.backgroundImage = `url(${backdropUrl})`; 
  document.getElementById('banner-title').textContent = item.title || item.name; 
} 

function displayList(items, containerId) { 
  const container = document.getElementById(containerId); 
  container.innerHTML = ''; 
  items.forEach(item => { 
    const img = document.createElement('img'); 

    // Handle different image URL formats
    if (item.poster_path) {
      img.src = item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL}${item.poster_path}`;
    } else {
      img.src = 'https://via.placeholder.com/300x450?text=No+Image';
    }

    img.alt = item.title || item.name; 
    img.onclick = () => showDetails(item); 
    container.appendChild(img); 
  }); 
} 

async function showDetails(item) { 
  currentItem = item; 

  // Clean up any existing season/episode selectors first 
  const existingContainer = document.getElementById('seasons-container'); 
  if (existingContainer) { 
    existingContainer.remove(); 
  } 

  document.getElementById('modal-title').textContent = item.title || item.name; 
  document.getElementById('modal-description').textContent = item.overview; 

  // Handle different image URL formats
  const posterUrl = item.poster_path ? 
    (item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL}${item.poster_path}`) :
    'https://via.placeholder.com/300x450?text=No+Image';
  document.getElementById('modal-image').src = posterUrl;

  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2)); 

  // Determine content type properly 
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.release_date); 
  const isTVShow = item.media_type === 'tv' || (!item.media_type && item.first_air_date); 
  const isAnime = item.media_type === 'anime';

  if (isMovie) { 
    // For movies, load player directly 
    loadPlayer(); 
  } else if (isAnime) {
    // For anime, load seasons and episodes
    await loadAnimeSeasons(item);
  } else if (isTVShow) { 
    // For TV shows, load seasons/episodes 
    await loadTVSeasons(item); 
  } 

  document.getElementById('modal').style.display = 'flex'; 
} 

async function loadAnimeSeasons(item) {
  try {
    // Create seasons container for anime
    const container = document.createElement('div');
    container.id = 'seasons-container';

    let seasonOptions = '';
    let episodeOptions = '';

    if (item.seasons && item.seasons.length > 0) {
      // Multi-season anime
      item.seasons.forEach((season, index) => {
        seasonOptions += `<option value="${index}" data-anilist-id="${season.anilist_id}" data-tmdb-id="${season.tmdb_season_number || ''}">${season.name}</option>`;
      });

      // Load episodes for first season
      const firstSeason = item.seasons[0];
      const episodes = await fetchAnimeEpisodes(firstSeason.anilist_id, item.tmdb_id, firstSeason.tmdb_season_number);
      
      episodes.forEach(episode => {
        episodeOptions += `<option value="${episode.episode_number}" data-name="${episode.name}">${episode.name}</option>`;
      });

      container.innerHTML = `
        <div class="seasons-episodes">
          <div class="season-selector">
            <label>Season: </label>
            <select id="season-select" onchange="loadAnimeEpisodes()">
              ${seasonOptions}
            </select>
          </div>
          <div class="episode-selector">
            <label>Episode: </label>
            <select id="episode-select" onchange="loadPlayer()">
              ${episodeOptions}
            </select>
          </div>
        </div>
      `;
    } else {
      // Single season anime - fallback
      const episodes = await fetchAnimeEpisodes(item.id, item.tmdb_id, 1);
      
      episodes.forEach(episode => {
        episodeOptions += `<option value="${episode.episode_number}" data-name="${episode.name}">${episode.name}</option>`;
      });

      container.innerHTML = `
        <div class="seasons-episodes">
          <div class="episode-selector">
            <label>Episode: </label>
            <select id="episode-select" onchange="loadPlayer()">
              ${episodeOptions}
            </select>
          </div>
        </div>
      `;
    }

    // Insert before the video player
    const videoContainer = document.querySelector('.modal-video-container');
    videoContainer.parentNode.insertBefore(container, videoContainer);

    // Load first episode by default
    loadPlayer();

  } catch (error) {
    console.error('Error loading anime seasons:', error);
    createDefaultAnimeEpisodes(item.episodes || 12);
    loadPlayer();
  }
}

async function loadAnimeEpisodes() {
  const seasonSelect = document.getElementById('season-select');
  const episodeSelect = document.getElementById('episode-select');
  
  if (!seasonSelect) return;

  const selectedOption = seasonSelect.options[seasonSelect.selectedIndex];
  const anilistId = selectedOption.getAttribute('data-anilist-id');
  const tmdbSeasonNumber = selectedOption.getAttribute('data-tmdb-id');
  
  try {
    const episodes = await fetchAnimeEpisodes(
      parseInt(anilistId), 
      currentItem.tmdb_id, 
      tmdbSeasonNumber ? parseInt(tmdbSeasonNumber) : null
    );

    episodeSelect.innerHTML = '';
    episodes.forEach(episode => {
      const option = document.createElement('option');
      option.value = episode.episode_number;
      option.setAttribute('data-name', episode.name);
      option.textContent = episode.name;
      episodeSelect.appendChild(option);
    });

    // Load first episode of new season
    loadPlayer();

  } catch (error) {
    console.error('Error loading anime episodes:', error);
    // Fallback: create default episodes
    episodeSelect.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.setAttribute('data-name', `Episode ${i}`);
      option.textContent = `Episode ${i}`;
      episodeSelect.appendChild(option);
    }
    loadPlayer();
  }
}

function createDefaultAnimeEpisodes(episodeCount) {
  const container = document.createElement('div');
  container.id = 'seasons-container';

  let episodeOptions = '';
  for (let i = 1; i <= episodeCount; i++) {
    episodeOptions += `<option value="${i}" data-name="Episode ${i}">Episode ${i}</option>`;
  }

  container.innerHTML = `
    <div class="seasons-episodes">
      <div class="episode-selector">
        <label>Episode: </label>
        <select id="episode-select" onchange="loadPlayer()">
          ${episodeOptions}
        </select>
      </div>
    </div>
  `;

  const videoContainer = document.querySelector('.modal-video-container');
  videoContainer.parentNode.insertBefore(container, videoContainer);
}

async function loadTVSeasons(item) { 
  try { 
    const tvDetails = await fetchTVDetails(item.id); 

    // Filter out specials (season 0) and only show actual seasons 
    const regularSeasons = tvDetails.seasons.filter(season => season.season_number > 0); 

    if (regularSeasons.length === 0) { 
      // If no regular seasons, just load the player 
      loadPlayer(); 
      return; 
    } 

    // Create seasons container 
    const container = document.createElement('div'); 
    container.id = 'seasons-container'; 
    container.innerHTML = ` 
      <div class="seasons-episodes"> 
        <div class="season-selector"> 
          <label>Season: </label> 
          <select id="season-select" onchange="loadEpisodes()"> 
            ${regularSeasons.map(season =>  
              `<option value="${season.season_number}">Season ${season.season_number}</option>` 
            ).join('')} 
          </select> 
        </div> 
        <div class="episode-selector"> 
          <label>Episode: </label> 
          <select id="episode-select" onchange="loadPlayer()"> 
            <option value="1">Episode 1</option> 
          </select> 
        </div> 
      </div> 
    `; 

    // Insert before the video player 
    const videoContainer = document.querySelector('.modal-video-container'); 
    videoContainer.parentNode.insertBefore(container, videoContainer); 

    // Load episodes for first season 
    await loadEpisodes(); 

  } catch (error) { 
    console.error('Error loading TV details:', error); 
    // Fallback: just load the player 
    loadPlayer(); 
  } 
} 

async function loadEpisodes() { 
  const seasonNumber = document.getElementById('season-select').value; 
  const episodeSelect = document.getElementById('episode-select'); 

  try { 
    const res = await fetch(`${BASE_URL}/tv/${currentItem.id}/season/${seasonNumber}?api_key=${API_KEY}`); 
    const seasonData = await res.json(); 

    if (seasonData.episodes && seasonData.episodes.length > 0) { 
      episodeSelect.innerHTML = ''; 
      seasonData.episodes.forEach(episode => { 
        const option = document.createElement('option'); 
        option.value = episode.episode_number; 
        option.textContent = `Episode ${episode.episode_number}${episode.name ? ': ' + episode.name : ''}`; 
        episodeSelect.appendChild(option); 
      }); 
    } else { 
      // Fallback: create default episodes based on episode count 
      episodeSelect.innerHTML = ''; 
      const episodeCount = Math.min(24, Math.max(1, seasonData.episode_count || 12)); 
      for (let i = 1; i <= episodeCount; i++) { 
        const option = document.createElement('option'); 
        option.value = i; 
        option.textContent = `Episode ${i}`; 
        episodeSelect.appendChild(option); 
      } 
    } 

    // Load first episode by default 
    loadPlayer(); 

  } catch (error) { 
    console.error('Error loading episodes:', error); 
    // Fallback: create default episodes 
    episodeSelect.innerHTML = ''; 
    for (let i = 1; i <= 12; i++) { 
      const option = document.createElement('option'); 
      option.value = i; 
      option.textContent = `Episode ${i}`; 
      episodeSelect.appendChild(option); 
    } 
    loadPlayer(); 
  } 
} 

function loadPlayer() { 
  // Determine if it's a movie, TV show, or anime
  const isMovie = currentItem.media_type === 'movie' || (!currentItem.media_type && currentItem.release_date); 
  const isAnime = currentItem.media_type === 'anime';

  if (isMovie) { 
    // Movie player 
    const embedURL = `https://vidsrc.cc/v2/embed/movie/${currentItem.id}?autoPlay=false&poster=false`; 
    document.getElementById('modal-video').src = embedURL; 
  } else if (isAnime) {
    // Anime player
    const episodeSelect = document.getElementById('episode-select'); 
    const seasonSelect = document.getElementById('season-select');
    const episode = episodeSelect ? episodeSelect.value : 1; 

    let anilistId = currentItem.anilist_id || currentItem.id;
    
    // If there are multiple seasons, get the AniList ID for the selected season
    if (seasonSelect && currentItem.seasons) {
      const selectedSeasonIndex = seasonSelect.selectedIndex;
      const selectedSeason = currentItem.seasons[selectedSeasonIndex];
      if (selectedSeason) {
        anilistId = selectedSeason.anilist_id;
      }
    }

    // For anime from AniList, use the anime endpoint with AniList ID
    const embedURL = `https://vidsrc.cc/v2/embed/anime/ani${anilistId}/${episode}/sub?autoPlay=false`; 
    document.getElementById('modal-video').src = embedURL;
  } else { 
    // TV Show player 
    const seasonSelect = document.getElementById('season-select'); 
    const episodeSelect = document.getElementById('episode-select'); 

    const season = seasonSelect ? seasonSelect.value : 1; 
    const episode = episodeSelect ? episodeSelect.value : 1; 

    // Regular TV show endpoint 
    const embedURL = `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${season}/${episode}?autoPlay=false&poster=false`; 
    document.getElementById('modal-video').src = embedURL; 
  } 
} 

function closeModal() { 
  document.getElementById('modal').style.display = 'none'; 
  document.getElementById('modal-video').src = ''; 

  // Clean up seasons container 
  const seasonsContainer = document.getElementById('seasons-container'); 
  if (seasonsContainer) { 
    seasonsContainer.remove(); 
  } 
} 

// Listen for player events 
window.addEventListener('message', (event) => { 
  if (event.origin !== 'https://vidsrc.cc') return; 

  if (event.data && event.data.type === 'PLAYER_EVENT') { 
    const { event: eventType, currentTime, duration, tmdbId } = event.data.data; 

    // You can add custom logic here for tracking or UI updates 
    console.log(`Player ${eventType} - ${Math.round(currentTime)}s / ${Math.round(duration)}s`); 

    // Example: Update a progress indicator or save watch progress 
    if (eventType === 'time') { 
      // Save progress to localStorage or send to backend 
      const progress = (currentTime / duration) * 100; 
      console.log(`Watch progress: ${Math.round(progress)}%`); 
    } 
  } 
}); 

function openSearchModal() { 
  document.getElementById('search-modal').style.display = 'flex'; 
  document.getElementById('search-input').focus(); 
} 

function closeSearchModal() { 
  document.getElementById('search-modal').style.display = 'none'; 
  document.getElementById('search-results').innerHTML = ''; 
} 

async function searchTMDB() { 
  const query = document.getElementById('search-input').value; 
  if (!query.trim()) { 
    document.getElementById('search-results').innerHTML = ''; 
    return; 
  } 

  // Search both TMDB and AniList
  const [tmdbResults, animeResults] = await Promise.all([
    searchTMDBContent(query),
    searchAnime(query)
  ]);

  // Combine results
  const allResults = [...tmdbResults, ...animeResults];

  const container = document.getElementById('search-results'); 
  container.innerHTML = ''; 
  allResults.forEach(item => { 
    if (!item.poster_path) return; 
    const img = document.createElement('img'); 
    img.src = item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name; 
    img.onclick = () => { 
      closeSearchModal(); 
      showDetails(item); 
    }; 
    container.appendChild(img); 
  }); 
}

async function searchTMDBContent(query) {
  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
    const data = await res.json();

    // Filter out anime from TMDB search results
    return data.results.filter(item => {
      if (!item.poster_path) return false;
      const isJapanese = item.original_language === 'ja';
      const isAnimation = item.genre_ids && item.genre_ids.includes(16);
      return !(isJapanese && isAnimation);
    });
  } catch (error) {
    console.error('Error searching TMDB:', error);
    return [];
  }
}

async function init() { 
  const movies = await fetchTrending('movie'); 
  const tvShows = await fetchTrending('tv'); 
  const anime = await fetchTrendingAnime(); 

  // Use a mix of content for banner, prioritizing movies
  const bannerContent = [...movies, ...tvShows];
  if (bannerContent.length > 0) {
    displayBanner(bannerContent[Math.floor(Math.random() * bannerContent.length)]);
  }

  displayList(movies, 'movies-list'); 
  displayList(tvShows, 'tvshows-list'); 
  displayList(anime, 'anime-list'); 
} 

init();