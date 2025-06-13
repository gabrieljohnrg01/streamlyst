const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;
let currentSection = 'home';

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  init();
  setupNavigation();
  setupEventListeners();
});

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const section = this.dataset.section;
      if (section === currentSection) return;
      
      // Update active state
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
      this.classList.add('active');
      currentSection = section;
      
      // Show loading state
      document.querySelector('.content-container').innerHTML = '<div class="loading">Loading...</div>';
      
      // Load appropriate content
      switch(section) {
        case 'movies':
          loadMovies();
          break;
        case 'tv':
          loadTVShows();
          break;
        case 'anime':
          loadAnime();
          break;
        default:
          loadHomePage();
      }
    });
  });
}

function setupEventListeners() {
  // Banner buttons
  document.querySelector('.play-btn').addEventListener('click', function() {
    const bannerTitle = document.getElementById('banner-title').textContent;
    const items = Array.from(document.querySelectorAll('.content-list img'));
    const item = items.find(img => img.alt === bannerTitle);
    if (item) item.click();
  });

  document.querySelector('.info-btn').addEventListener('click', function() {
    const bannerTitle = document.getElementById('banner-title').textContent;
    const items = Array.from(document.querySelectorAll('.content-list img'));
    const item = items.find(img => img.alt === bannerTitle);
    if (item) item.click();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (document.getElementById('modal').style.display === 'flex') {
        closeModal();
      } else if (document.getElementById('search-modal').style.display === 'flex') {
        closeSearchModal();
      }
    }
    
    // Ctrl+K or Cmd+K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }
  });
}

async function loadHomePage() {
  try {
    const [movies, tvShows, anime] = await Promise.all([
      fetchTrending('movie'),
      fetchTrending('tv'),
      fetchTrendingAnime()
    ]);

    const container = document.querySelector('.content-container');
    container.innerHTML = `
      <div class="content-row">
        <h2 class="row-title"><span>Trending Movies</span></h2>
        <div class="content-list" id="movies-list"></div>
      </div>
      <div class="content-row">
        <h2 class="row-title"><span>Trending TV Shows</span></h2>
        <div class="content-list" id="tvshows-list"></div>
      </div>
      <div class="content-row">
        <h2 class="row-title"><span>Popular Anime</span></h2>
        <div class="content-list" id="anime-list"></div>
      </div>
    `;

    // Set random banner from trending movies
    if (movies.length > 0) {
      displayBanner(movies[Math.floor(Math.random() * movies.length)]);
    }

    // Display content lists
    displayList(movies, 'movies-list');
    displayList(tvShows, 'tvshows-list');
    displayList(anime, 'anime-list');
  } catch (error) {
    showError('Failed to load home page content');
  }
}

async function loadMovies() {
  try {
    const movies = await fetchTrending('movie');
    displaySectionContent('Trending Movies', movies, 'movies-list');
  } catch (error) {
    showError('Failed to load movies');
  }
}

async function loadTVShows() {
  try {
    const tvShows = await fetchTrending('tv');
    displaySectionContent('Trending TV Shows', tvShows, 'tvshows-list');
  } catch (error) {
    showError('Failed to load TV shows');
  }
}

async function loadAnime() {
  try {
    const anime = await fetchTrendingAnime();
    displaySectionContent('Popular Anime', anime, 'anime-list');
  } catch (error) {
    showError('Failed to load anime');
  }
}

function displaySectionContent(title, items, listId) {
  const container = document.querySelector('.content-container');
  container.innerHTML = `
    <div class="content-row">
      <h2 class="row-title"><span>${title}</span></h2>
      <div class="content-list" id="${listId}"></div>
    </div>
  `;
  displayList(items, listId);
}

function showError(message) {
  const container = document.querySelector('.content-container');
  container.innerHTML = `<div class="error">${message}. <button onclick="location.reload()">Try Again</button></div>`;
}

async function fetchTrending(type) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
    const data = await res.json();
    return data.results.filter(item => item.poster_path);
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
}

async function fetchTrendingAnime() {
  try {
    let allResults = [];
    for (let page = 1; page <= 3; page++) {
      const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
      const data = await res.json();
      const filtered = data.results.filter(item => 
        (item.original_language === 'ja' || item.origin_country?.includes('JP')) && 
        item.genre_ids.includes(16) &&
        item.poster_path
      );
      allResults = [...allResults, ...filtered];
    }
    return allResults.slice(0, 20); // Limit to 20 items
  } catch (error) {
    console.error('Error fetching anime:', error);
    return [];
  }
}

async function fetchItemDetails(item) {
  try {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const res = await fetch(`${BASE_URL}/${type}/${item.id}?api_key=${API_KEY}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching item details:', error);
    return item; // Return original item if details fetch fails
  }
}

function displayBanner(item) {
  const banner = document.getElementById('banner');
  const title = document.getElementById('banner-title');
  
  if (item && item.backdrop_path) {
    banner.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%), url(${IMG_URL}${item.backdrop_path})`;
    title.textContent = item.title || item.name;
  }
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  items.slice(0, 20).forEach(item => {
    if (!item.poster_path) return;
    
    const card = document.createElement('div');
    card.className = 'content-card';
    
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.loading = 'lazy';
    
    card.appendChild(img);
    card.addEventListener('click', () => showDetails(item));
    container.appendChild(card);
  });
}

async function showDetails(item) {
  try {
    // Show loading state
    document.getElementById('modal-title').textContent = 'Loading...';
    document.getElementById('modal-description').textContent = '';
    document.getElementById('seasons-container').style.display = 'none';
    document.getElementById('episodes-container').style.display = 'none';
    
    // Fetch additional details
    const details = await fetchItemDetails(item);
    currentItem = details;
    
    // Update modal content
    document.getElementById('modal-title').textContent = details.title || details.name;
    document.getElementById('modal-description').textContent = details.overview || 'No description available.';
    
    // Set rating stars
    const rating = Math.round((details.vote_average || 0) / 2);
    document.getElementById('modal-rating').innerHTML = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    
    // Set year
    const releaseDate = details.release_date || details.first_air_date;
    if (releaseDate) {
      document.getElementById('modal-year').textContent = new Date(releaseDate).getFullYear();
    }
    
    // Set runtime (for movies) or episode runtime (for TV)
    if (details.runtime) {
      document.getElementById('modal-runtime').textContent = `${details.runtime} min`;
    } else if (details.episode_run_time?.length > 0) {
      document.getElementById('modal-runtime').textContent = `${details.episode_run_time[0]} min/episode`;
    }
    
    // Set genres
    const genresContainer = document.getElementById('modal-genres');
    genresContainer.innerHTML = '';
    if (details.genres?.length > 0) {
      details.genres.slice(0, 5).forEach(genre => {
        const span = document.createElement('span');
        span.textContent = genre.name;
        genresContainer.appendChild(span);
      });
    }
    
    // Set poster image
    const posterUrl = details.poster_path ? `${IMG_URL}${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Image';
    document.getElementById('modal-image').src = posterUrl;
    
    // Set up play button in modal
    document.querySelector('.modal-play-btn').onclick = () => {
      changeServer();
      document.querySelector('.modal-video-container').scrollIntoView({ behavior: 'smooth' });
    };
    
    // Load seasons if it's a TV show
    if (details.number_of_seasons > 0) {
      await loadSeasons(details.id);
    }
    
    // Open modal
    document.getElementById('modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Load default server
    changeServer();
  } catch (error) {
    console.error('Error showing details:', error);
    alert('Failed to load details. Please try again.');
  }
}

async function loadSeasons(tvId) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
    const data = await res.json();
    
    const seasonsContainer = document.getElementById('seasons-container');
    const seasonsList = document.getElementById('seasons-list');
    
    seasonsList.innerHTML = '';
    seasonsContainer.style.display = 'block';
    
    data.seasons.forEach(season => {
      if (season.season_number === 0) return; // Skip special seasons
      
      const seasonCard = document.createElement('div');
      seasonCard.className = 'season-card';
      seasonCard.dataset.seasonNumber = season.season_number;
      
      seasonCard.innerHTML = `
        <img src="${season.poster_path ? `${IMG_URL}${season.poster_path}` : 'https://via.placeholder.com/150x225?text=No+Image'}" 
             alt="Season ${season.season_number}" class="season-poster">
        <div class="season-info">
          <h4>Season ${season.season_number}</h4>
          <p>${season.episode_count} episodes</p>
        </div>
      `;
      
      seasonCard.addEventListener('click', () => loadEpisodes(tvId, season.season_number));
      seasonsList.appendChild(seasonCard);
    });
    
    // Load first season by default
    if (data.seasons.length > 0) {
      const firstSeason = data.seasons.find(s => s.season_number === 1) || data.seasons[0];
      loadEpisodes(tvId, firstSeason.season_number);
    }
  } catch (error) {
    console.error('Error loading seasons:', error);
    document.getElementById('seasons-container').innerHTML = '<p>Failed to load seasons</p>';
  }
}

async function loadEpisodes(tvId, seasonNumber) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`);
    const data = await res.json();
    
    const episodesContainer = document.getElementById('episodes-container');
    const episodesList = document.getElementById('episodes-list');
    
    episodesList.innerHTML = '';
    episodesContainer.style.display = 'block';
    
    // Update active season
    document.querySelectorAll('.season-card').forEach(card => {
      card.classList.toggle('active', parseInt(card.dataset.seasonNumber) === seasonNumber);
    });
    
    data.episodes.forEach(episode => {
      const episodeCard = document.createElement('div');
      episodeCard.className = 'episode-card';
      
      episodeCard.innerHTML = `
        <img src="${episode.still_path ? `${IMG_URL}${episode.still_path}` : 'https://via.placeholder.com/300x169?text=No+Image'}" 
             alt="${episode.name}" class="episode-poster">
        <div class="episode-info">
          <span class="episode-number">Episode ${episode.episode_number}</span>
          <h4>${episode.name}</h4>
          <p>${episode.overview || 'No description available.'}</p>
        </div>
      `;
      
      episodesList.appendChild(episodeCard);
    });
  } catch (error) {
    console.error('Error loading episodes:', error);
    document.getElementById('episodes-container').innerHTML = '<p>Failed to load episodes</p>';
  }
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
  document.body.style.overflow = 'auto';
}

function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
  document.body.style.overflow = 'hidden';
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = `
    <div class="search-placeholder">
      <i class="fas fa-search"></i>
      <p>Search for your favorite content</p>
    </div>
  `;
  document.getElementById('search-input').value = '';
  document.body.style.overflow = 'auto';
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) {
    document.getElementById('search-results').innerHTML = `
      <div class="search-placeholder">
        <i class="fas fa-search"></i>
        <p>Search for your favorite content</p>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
    const data = await res.json();

    const container = document.getElementById('search-results');
    container.innerHTML = '';
    
    if (data.results.length === 0) {
      container.innerHTML = `
        <div class="search-placeholder">
          <i class="fas fa-exclamation-circle"></i>
          <p>No results found for "${query}"</p>
        </div>
      `;
      return;
    }

    data.results.slice(0, 20).forEach(item => {
      if (!item.poster_path) return;
      
      const card = document.createElement('div');
      card.className = 'search-card';
      
      const img = document.createElement('img');
      img.src = `${IMG_URL}${item.poster_path}`;
      img.alt = item.title || item.name;
      img.loading = 'lazy';
      
      card.appendChild(img);
      card.addEventListener('click', () => {
        closeSearchModal();
        showDetails(item);
      });
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error searching:', error);
    document.getElementById('search-results').innerHTML = `
      <div class="search-placeholder">
        <i class="fas fa-exclamation-circle"></i>
        <p>Error loading results. Please try again.</p>
      </div>
    `;
  }
}

// Initialize the home page
function init() {
  loadHomePage();
}
