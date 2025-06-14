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
    banner.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
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
    
    // Fetch additional details
    const details = await fetchItemDetails(item);
    currentItem = details;
    
    // Update modal content
    document.getElementById('modal-title').textContent = details.title || details.name;
    document.getElementById('modal-description').textContent = details.overview || 'No description available.';
    
    // Set poster image
    const posterUrl = details.poster_path ? `${IMG_URL}${details.poster_path}` : 'https://via.placeholder.com/300x450?text=No+Image';
    document.getElementById('modal-image').src = posterUrl;
    
    // Open modal
    document.getElementById('modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
  } catch (error) {
    console.error('Error showing details:', error);
    alert('Failed to load details. Please try again.');
  }
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
  document.body.style.overflow = 'hidden';
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-input').value = '';
  document.body.style.overflow = 'auto';
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

    try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
    const data = await res.json();

    const container = document.getElementById('search-results');
    container.innerHTML = '';
    
    if (data.results.length === 0) {
      container.innerHTML = `<p>No results found for "${query}"</p>`;
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
    document.getElementById('search-results').innerHTML = `<p>Error loading results. Please try again.</p>`;
  }
}

// Initialize the home page
function init() {
  loadHomePage();
}
