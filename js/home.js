const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;

async function fetchTrending(type) {
  const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
  const data = await res.json();
  return data.results;
}

async function fetchTrendingAnime() {
  let allResults = [];

  // Fetch from multiple pages to get more anime (max 3 pages for demo)
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    const filtered = data.results.filter(item =>
      item.original_language === 'ja' && item.genre_ids.includes(16)
    );
    allResults = allResults.concat(filtered);
  }

  return allResults;
}

async function fetchTVDetails(id) {
  const res = await fetch(`${BASE_URL}/tv/${id}?api_key=${API_KEY}`);
  const data = await res.json();
  return data;
}

function displayBanner(item) {
  document.getElementById('banner').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('banner-title').textContent = item.title || item.name;
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach(item => {
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
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
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
  
  // Determine content type properly
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.release_date);
  const isTVShow = item.media_type === 'tv' || (!item.media_type && item.first_air_date);
  
  if (isMovie) {
    // For movies, load player directly
    loadPlayer();
  } else if (isTVShow) {
    // For TV shows and anime, load seasons/episodes
    await loadTVSeasons(item);
  }
  
  document.getElementById('modal').style.display = 'flex';
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
  // Determine if it's a movie or TV show
  const isMovie = currentItem.media_type === 'movie' || (!currentItem.media_type && currentItem.release_date);
  
  if (isMovie) {
    // Movie player
    const embedURL = `https://vidsrc.cc/v2/embed/movie/${currentItem.id}?autoPlay=false&poster=false`;
    document.getElementById('modal-video').src = embedURL;
  } else {
    // TV Show or Anime player
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    
    const season = seasonSelect ? seasonSelect.value : 1;
    const episode = episodeSelect ? episodeSelect.value : 1;
    
    // Check if it's anime (Japanese language) - use sub only
    if (currentItem.original_language === 'ja' && currentItem.genre_ids && currentItem.genre_ids.includes(16)) {
      // Use anime endpoint for Japanese anime content with sub only
      const embedURL = `https://vidsrc.cc/v2/embed/anime/tmdb${currentItem.id}/${episode}/sub?autoPlay=false`;
      document.getElementById('modal-video').src = embedURL;
    } else {
      // Regular TV show endpoint
      const embedURL = `https://vidsrc.cc/v2/embed/tv/${currentItem.id}/${season}/${episode}?autoPlay=false&poster=false`;
      document.getElementById('modal-video').src = embedURL;
    }
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

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
}

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

  const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
  const data = await res.json();

  const container = document.getElementById('search-results');
  container.innerHTML = '';
  data.results.forEach(item => {
    if (!item.poster_path) return;
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.onclick = () => {
      closeSearchModal();
      showDetails(item);
    };
    container.appendChild(img);
  });
}

async function init() {
  const movies = await fetchTrending('movie');
  const tvShows = await fetchTrending('tv');
  const anime = await fetchTrendingAnime();

  displayBanner(movies[Math.floor(Math.random() * movies.length)]);
  displayList(movies, 'movies-list');
  displayList(tvShows, 'tvshows-list');
  displayList(anime, 'anime-list');
}

init();
