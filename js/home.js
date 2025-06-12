const API_KEY = 'a1e72fd93ed59f56e6332813b9f8dcae';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;

// Add scroll event for navbar
window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

async function fetchTrending(type) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
    const data = await res.json();
    return data.results;
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
        item.genre_ids.includes(16)
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
    
    // Set up play button
    document.querySelector('.play-btn').onclick = () => {
      showDetails(item);
      document.querySelector('.modal-play-btn').click();
    };
    
    // Set up info button
    document.querySelector('.info-btn').onclick = () => showDetails(item);
  }
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  items.slice(0, 10).forEach(item => {
    if (!item.poster_path) return;
    
    const card = document.createElement('div');
    card.className = 'content-card';
    
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.loading = 'lazy';
    
    card.appendChild(img);
    card.onclick = () => showDetails(item);
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
      card.onclick = () => {
        closeSearchModal();
        showDetails(item);
      };
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

// Initialize the app
async function init() {
  try {
    const [movies, tvShows, anime] = await Promise.all([
      fetchTrending('movie'),
      fetchTrending('tv'),
      fetchTrendingAnime()
    ]);

    // Set random banner from trending movies
    if (movies.length > 0) {
      displayBanner(movies[Math.floor(Math.random() * movies.length)]);
    }

    // Display content lists
    displayList(movies, 'movies-list');
    displayList(tvShows, 'tvshows-list');
    displayList(anime, 'anime-list');
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Failed to load content. Please refresh the page.');
  }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Add keyboard shortcuts
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