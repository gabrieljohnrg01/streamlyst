const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3'; 
const BASE_URL = 'https://api.themoviedb.org/3'; 
const IMG_URL = 'https://image.tmdb.org/t/p/original'; 
const ANILIST_URL = 'https://graphql.anilist.co';
let currentItem;
let currentSeasonData = {}; // Store season data for quick access
 
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
    
    // Transform AniList data to match TMDB format for compatibility
    return data.data.Page.media.map(anime => ({
      id: anime.id,
      name: anime.title.english || anime.title.romaji,
      title: anime.title.english || anime.title.romaji,
      overview: anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available',
      poster_path: anime.coverImage.large,
      backdrop_path: anime.bannerImage,
      vote_average: anime.averageScore ? anime.averageScore / 10 : 0,
      media_type: 'anime',
      original_language: 'ja',
      genre_ids: [16], // Animation genre ID
      genres: anime.genres,
      episodes: anime.episodes,
      status: anime.status,
      studios: anime.studios.nodes.map(studio => studio.name)
    }));
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
    
    return data.data.Page.media.map(anime => ({
      id: anime.id,
      name: anime.title.english || anime.title.romaji,
      title: anime.title.english || anime.title.romaji,
      overview: anime.description ? anime.description.replace(/<[^>]*>/g, '') : 'No description available',
      poster_path: anime.coverImage.large,
      backdrop_path: anime.bannerImage,
      vote_average: anime.averageScore ? anime.averageScore / 10 : 0,
      media_type: 'anime',
      original_language: 'ja',
      genre_ids: [16],
      genres: anime.genres,
      episodes: anime.episodes,
      status: anime.status,
      studios: anime.studios.nodes.map(studio => studio.name)
    }));
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

async function fetchSeasonDetails(tvId, seasonNumber) {
  const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`);
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

function updateModalContent(title, description, posterUrl, backdropUrl) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-description').textContent = description;
  document.getElementById('modal-image').src = posterUrl;
  
  // Update backdrop if available
  if (backdropUrl) {
    const modalContent = document.querySelector('.modal-content');
    modalContent.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${backdropUrl})`;
    modalContent.style.backgroundSize = 'cover';
    modalContent.style.backgroundPosition = 'center';
  }
}
 
async function showDetails(item) { 
  currentItem = item; 
  currentSeasonData = {}; // Reset season data
   
  // Clean up any existing season/episode selectors first 
  const existingContainer = document.getElementById('seasons-container'); 
  if (existingContainer) { 
    existingContainer.remove(); 
  } 
   
  // Set initial content
  const initialTitle = item.title || item.name;
  const initialDescription = item.overview;
  const initialPosterUrl = item.poster_path ? 
    (item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL}${item.poster_path}`) :
    'https://via.placeholder.com/300x450?text=No+Image';
  const initialBackdropUrl = item.backdrop_path ? 
    (item.backdrop_path.startsWith('http') ? item.backdrop_path : `${IMG_URL}${item.backdrop_path}`) :
    (item.bannerImage || '');

  updateModalContent(initialTitle, initialDescription, initialPosterUrl, initialBackdropUrl);
  
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2)); 
   
  // Determine content type properly 
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.release_date); 
  const isTVShow = item.media_type === 'tv' || (!item.media_type && item.first_air_date); 
  const isAnime = item.media_type === 'anime';
   
  if (isMovie) { 
    // For movies, load player directly 
    loadPlayer(); 
  } else if (isAnime) {
    // For anime, load episodes
    await loadAnimeEpisodes(item);
  } else if (isTVShow) { 
    // For TV shows, load seasons/episodes 
    await loadTVSeasons(item); 
  } 
   
  document.getElementById('modal').style.display = 'flex'; 
} 

async function loadAnimeEpisodes(item) {
  try {
    const animeDetails = await fetchAnimeDetails(item.id);
    
    if (!animeDetails || !animeDetails.episodes) {
      // Fallback: create default episodes
      createDefaultAnimeEpisodes(item.episodes || 12);
      loadPlayer();
      return;
    }

    // Create episodes container for anime
    const container = document.createElement('div');
    container.id = 'seasons-container';
    
    const episodeCount = animeDetails.episodes || 12;
    let episodeOptions = '';
    
    for (let i = 1; i <= episodeCount; i++) {
      episodeOptions += `<option value="${i}">Episode ${i}</option>`;
    }
    
    container.innerHTML = `
      <div class="seasons-episodes">
        <div class="episode-selector">
          <label>Episode: </label>
          <select id="episode-select" onchange="updateAnimeEpisodeContent()">
            ${episodeOptions}
          </select>
        </div>
      </div>
    `;
    
    // Insert before the video player
    const videoContainer = document.querySelector('.modal-video-container');
    videoContainer.parentNode.insertBefore(container, videoContainer);
    
    // Load first episode by default
    updateAnimeEpisodeContent();
    
  } catch (error) {
    console.error('Error loading anime episodes:', error);
    createDefaultAnimeEpisodes(item.episodes || 12);
    loadPlayer();
  }
}

function createDefaultAnimeEpisodes(episodeCount) {
  const container = document.createElement('div');
  container.id = 'seasons-container';
  
  let episodeOptions = '';
  for (let i = 1; i <= episodeCount; i++) {
    episodeOptions += `<option value="${i}">Episode ${i}</option>`;
  }
  
  container.innerHTML = `
    <div class="seasons-episodes">
      <div class="episode-selector">
        <label>Episode: </label>
        <select id="episode-select" onchange="updateAnimeEpisodeContent()">
          ${episodeOptions}
        </select>
      </div>
    </div>
  `;
  
  const videoContainer = document.querySelector('.modal-video-container');
  videoContainer.parentNode.insertBefore(container, videoContainer);
}

function updateAnimeEpisodeContent() {
  const episodeSelect = document.getElementById('episode-select');
  const episodeNumber = episodeSelect ? episodeSelect.value : 1;
  
  // For anime, we'll keep the original title and description since episode-specific data isn't readily available
  // But we could enhance this by fetching episode details if needed
  const episodeTitle = `${currentItem.title || currentItem.name} - Episode ${episodeNumber}`;
  
  // Update modal with episode-specific title while keeping original description
  document.getElementById('modal-title').textContent = episodeTitle;
  
  // Load the player for the selected episode
  loadPlayer();
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
          <select id="episode-select" onchange="updateEpisodeContent()"> 
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
    const seasonData = await fetchSeasonDetails(currentItem.id, seasonNumber);
    currentSeasonData[seasonNumber] = seasonData; // Store season data
     
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
     
    // Update content for first episode of the season
    updateEpisodeContent(); 
     
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
    updateEpisodeContent();
  } 
}

function updateEpisodeContent() {
  const seasonSelect = document.getElementById('season-select');
  const episodeSelect = document.getElementById('episode-select');
  
  if (!seasonSelect || !episodeSelect) return;
  
  const seasonNumber = seasonSelect.value;
  const episodeNumber = episodeSelect.value;
  
  // Get season data
  const seasonData = currentSeasonData[seasonNumber];
  
  if (seasonData && seasonData.episodes) {
    // Find the specific episode
    const episode = seasonData.episodes.find(ep => ep.episode_number == episodeNumber);
    
    if (episode) {
      // Update modal content with episode-specific information
      const episodeTitle = `${currentItem.title || currentItem.name} - S${seasonNumber}E${episodeNumber}${episode.name ? ': ' + episode.name : ''}`;
      const episodeDescription = episode.overview || currentItem.overview || 'No description available';
      const episodePoster = episode.still_path ? `${IMG_URL}${episode.still_path}` : 
        (currentItem.poster_path ? 
          (currentItem.poster_path.startsWith('http') ? currentItem.poster_path : `${IMG_URL}${currentItem.poster_path}`) :
          'https://via.placeholder.com/300x450?text=No+Image');
      
      // Use episode still as backdrop if available, otherwise use original backdrop
      const episodeBackdrop = episode.still_path ? `${IMG_URL}${episode.still_path}` :
        (currentItem.backdrop_path ? 
          (currentItem.backdrop_path.startsWith('http') ? currentItem.backdrop_path : `${IMG_URL}${currentItem.backdrop_path}`) :
          '');
      
      updateModalContent(episodeTitle, episodeDescription, episodePoster, episodeBackdrop);
    } else {
      // Fallback to season/show info
      const seasonTitle = `${currentItem.title || currentItem.name} - Season ${seasonNumber} Episode ${episodeNumber}`;
      const seasonDescription = seasonData.overview || currentItem.overview || 'No description available';
      const seasonPoster = seasonData.poster_path ? `${IMG_URL}${seasonData.poster_path}` :
        (currentItem.poster_path ? 
          (currentItem.poster_path.startsWith('http') ? currentItem.poster_path : `${IMG_URL}${currentItem.poster_path}`) :
          'https://via.placeholder.com/300x450?text=No+Image');
      
      updateModalContent(seasonTitle, seasonDescription, seasonPoster, null);
    }
  } else {
    // No season data available, use basic formatting
    const basicTitle = `${currentItem.title || currentItem.name} - S${seasonNumber}E${episodeNumber}`;
    const basicDescription = currentItem.overview || 'No description available';
    const basicPoster = currentItem.poster_path ? 
      (currentItem.poster_path.startsWith('http') ? currentItem.poster_path : `${IMG_URL}${currentItem.poster_path}`) :
      'https://via.placeholder.com/300x450?text=No+Image';
    
    updateModalContent(basicTitle, basicDescription, basicPoster, null);
  }
  
  // Load the player for the selected episode
  loadPlayer();
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
    // Anime player - use AniList ID with anime endpoint
    const episodeSelect = document.getElementById('episode-select'); 
    const episode = episodeSelect ? episodeSelect.value : 1; 
    
    // For anime from AniList, use the anime endpoint with AniList ID
    const embedURL = `https://vidsrc.cc/v2/embed/anime/anilist${currentItem.id}/${episode}/sub?autoPlay=false`; 
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
   
  // Clean up seasons container and reset modal styling
  const seasonsContainer = document.getElementById('seasons-container'); 
  if (seasonsContainer) { 
    seasonsContainer.remove(); 
  }
  
  // Reset modal background
  const modalContent = document.querySelector('.modal-content');
  modalContent.style.backgroundImage = '';
  
  // Reset season data
  currentSeasonData = {};
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