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
  let allResults = []const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3'; const BASE_URL = 'https://api.themoviedb.org/3'; const IMG_URL = 'https://image.tmdb.org/t/p/original'; let currentItem;

async function fetchTrending(type) { const res = await fetch(${BASE_URL}/trending/${type}/week?api_key=${API_KEY}); const data = await res.json();

const filteredResults = data.results.filter(item => { const isJapanese = item.original_language === 'ja'; const isAnimation = item.genre_ids && item.genre_ids.includes(16); return !(isJapanese && isAnimation); });

return filteredResults; }

async function fetchTrendingAnime() { const res = await fetch(${BASE_URL}/trending/tv/week?api_key=${API_KEY}); const data = await res.json();

const animeResults = data.results.filter(item => { const isJapanese = item.original_language === 'ja'; const isAnimation = item.genre_ids && item.genre_ids.includes(16); return isJapanese && isAnimation; });

// Group by name to avoid duplicate seasons const seenTitles = new Set(); const grouped = animeResults.filter(item => { if (seenTitles.has(item.name)) return false; seenTitles.add(item.name); return true; });

return grouped.map(anime => ({ id: anime.id, name: anime.name, title: anime.name, overview: anime.overview || 'No description available', poster_path: anime.poster_path ? ${IMG_URL}${anime.poster_path} : '', backdrop_path: anime.backdrop_path ? ${IMG_URL}${anime.backdrop_path} : '', vote_average: anime.vote_average || 0, media_type: 'anime', original_language: anime.original_language, genre_ids: anime.genre_ids || [], genres: [], episodes: anime.episode_count || 0, status: anime.status || 'UNKNOWN', studios: [] })); }

async function loadAnimeEpisodes(item) { try { const res = await fetch(${BASE_URL}/tv/${item.id}?api_key=${API_KEY}); const tvDetails = await res.json();

const regularSeasons = tvDetails.seasons.filter(season => season.season_number > 0);
if (regularSeasons.length === 0) {
  loadPlayer();
  return;
}

const container = document.createElement('div');
container.id = 'seasons-container';

const seasonOptions = regularSeasons.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('');

container.innerHTML = `
  <div class="seasons-episodes">
    <div class="season-selector">
      <label>Season: </label>
      <select id="season-select" onchange="loadEpisodes()">
        ${seasonOptions}
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

const videoContainer = document.querySelector('.modal-video-container');
videoContainer.parentNode.insertBefore(container, videoContainer);

await loadEpisodes();

} catch (error) { console.error('Error loading TMDB anime seasons:', error); createDefaultAnimeEpisodes(12); loadPlayer(); } }

async function loadEpisodes() { const seasonNumber = document.getElementById('season-select').value; const episodeSelect = document.getElementById('episode-select');

try { const res = await fetch(${BASE_URL}/tv/${currentItem.id}/season/${seasonNumber}?api_key=${API_KEY}); const seasonData = await res.json();

if (seasonData.episodes && seasonData.episodes.length > 0) { 
  episodeSelect.innerHTML = ''; 
  seasonData.episodes.forEach(episode => { 
    const option = document.createElement('option'); 
    option.value = episode.episode_number; 
    option.textContent = `Episode ${episode.episode_number}${episode.name ? ': ' + episode.name : ''}`; 
    episodeSelect.appendChild(option); 
  }); 
} else { 
  episodeSelect.innerHTML = ''; 
  const episodeCount = Math.min(24, Math.max(1, seasonData.episode_count || 12)); 
  for (let i = 1; i <= episodeCount; i++) { 
    const option = document.createElement('option'); 
    option.value = i; 
    option.textContent = `Episode ${i}`; 
    episodeSelect.appendChild(option); 
  } 
} 

loadPlayer();

} catch (error) { console.error('Error loading episodes:', error); episodeSelect.innerHTML = ''; for (let i = 1; i <= 12; i++) { const option = document.createElement('option'); option.value = i; option.textContent = Episode ${i}; episodeSelect.appendChild(option); } loadPlayer(); } }



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

    function showDetails(item) {
      currentItem = item;
      document.getElementById('modal-title').textContent = item.title || item.name;
      document.getElementById('modal-description').textContent = item.overview;
      document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
      document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
      changeServer();
      document.getElementById('modal').style.display = 'flex';
    }

    function changeServer() {
      const server = document.getElementById('server').value;
      const type = currentItem.media_type === "movie" ? "movie" : "tv";
      let embedURL = "";

      if (server === "vidsrc.cc") {
        embedURL = `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}`;
      } else if (server === "vidsrc.me") {
        embedURL = `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}`;
      } else if (server === "player.videasy.net") {
        embedURL = `https://player.videasy.net/${type}/${currentItem.id}`;
      }

      document.getElementById('modal-video').src = embedURL;
    }

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