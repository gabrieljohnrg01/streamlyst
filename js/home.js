const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3'; 
const BASE_URL = 'https://api.themoviedb.org/3'; 
const IMG_URL = 'https://image.tmdb.org/t/p/original'; 
let currentItem; 

// AniList GraphQL endpoint
const ANILIST_URL = 'https://graphql.anilist.co';

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

// Simple function to get just the AniList ID
async function getAniListId(tmdbItem) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
      }
    }
  `;

  const variables = {
    search: tmdbItem.name || tmdbItem.title
  };

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        variables: variables
      })
    });

    const data = await response.json();
    
    if (data.data && data.data.Media) {
      return data.data.Media.id;
    }
    
    return null;
  } catch (error) {
    console.warn('Error fetching AniList ID:', error);
    return null;
  }
}

// Enhanced function to get seasons only from the "Seasons" episode group
async function fetchAllSeasons(id) {
  try {
    let allSeasons = [];
    
    // Try to get episode groups and look specifically for "Seasons"
    try {
      const episodeGroupsRes = await fetch(`${BASE_URL}/tv/${id}/episode_groups?api_key=${API_KEY}`);
      const episodeGroupsData = await episodeGroupsRes.json();
      
      if (episodeGroupsData.results && episodeGroupsData.results.length > 0) {
        // Look for episode group specifically named "Seasons"
        const seasonsGroup = episodeGroupsData.results.find(group => group.name === 'Seasons');
        
        if (seasonsGroup) {
          try {
            const groupDetailsRes = await fetch(`${BASE_URL}/tv/episode_group/${seasonsGroup.id}?api_key=${API_KEY}`);
            const groupDetails = await groupDetailsRes.json();
            
            // Extract seasons from the "Seasons" episode group
            if (groupDetails.groups) {
              groupDetails.groups.forEach((seasonGroup, index) => {
                // Try to extract season number from the group name or use index + 1
                let seasonNumber = index + 1;
                if (seasonGroup.name && seasonGroup.name.match(/season\s*(\d+)/i)) {
                  seasonNumber = parseInt(seasonGroup.name.match(/season\s*(\d+)/i)[1]);
                }
                
                // Skip specials (season 0) and groups that might be specials
                const isSpecial = seasonNumber === 0 || 
                                 seasonGroup.name.toLowerCase().includes('special') ||
                                 seasonGroup.name.toLowerCase().includes('ova') ||
                                 seasonGroup.name.toLowerCase().includes('movie');
                
                if (!isSpecial && seasonGroup.episodes && seasonGroup.episodes.length > 0) {
                  allSeasons.push({
                    season_number: seasonNumber,
                    name: seasonGroup.name || `Season ${seasonNumber}`,
                    episode_count: seasonGroup.episodes.length,
                    air_date: seasonGroup.episodes[0]?.air_date,
                    poster_path: seasonGroup.episodes[0]?.still_path,
                    overview: `Season ${seasonNumber}`,
                    id: `group_${seasonNumber}`,
                    episodes: seasonGroup.episodes
                  });
                }
              });
              
              // Sort seasons by season number
              allSeasons.sort((a, b) => a.season_number - b.season_number);
              
              // If we found seasons from the "Seasons" episode group, return them
              if (allSeasons.length > 0) {
                return allSeasons;
              }
            }
          } catch (error) {
            console.warn('Error fetching "Seasons" episode group details:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Error fetching episode groups:', error);
    }
    
    // Fallback: If no "Seasons" episode group found, use basic TV details
    const tvDetails = await fetchTVDetails(id);
    return tvDetails.seasons
      .filter(season => season.season_number > 0) // Exclude specials (season 0)
      .sort((a, b) => a.season_number - b.season_number);
      
  } catch (error) {
    console.error('Error fetching all seasons:', error);
    return [];
  }
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
  const isAnime = item.original_language === 'ja' && item.genre_ids && item.genre_ids.includes(16);
   
  if (isMovie) { 
    // For movies, load player directly 
    loadPlayer(); 
  } else if (isTVShow) { 
    // For anime, just get the AniList ID for playing
    if (isAnime) {
      const anilistId = await getAniListId(item);
      if (anilistId) {
        item.anilistId = anilistId;
        console.log(`Found AniList ID: ${anilistId} for ${item.name}`);
      }
    }
    
    // Load seasons/episodes using TMDB data
    await loadTVSeasons(item); 
  } 
   
  document.getElementById('modal').style.display = 'flex'; 
} 
 
async function loadTVSeasons(item) { 
  try { 
    // Use TMDB data for all season/episode information
    const allSeasons = await fetchAllSeasons(item.id);
     
    if (allSeasons.length === 0) { 
      // If no seasons found, just load the player 
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
            ${allSeasons.map(season =>  
              `<option value="${season.season_number}">Season ${season.season_number}${season.name && season.name !== `Season ${season.season_number}` ? ' - ' + season.name : ''}</option>` 
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
     
    // Store seasons data for later use
    container.seasonsData = allSeasons;
     
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
  const seasonsContainer = document.getElementById('seasons-container');
   
  try { 
    // Check if we have cached season data first
    let seasonData = null;
    if (seasonsContainer && seasonsContainer.seasonsData) {
      const cachedSeason = seasonsContainer.seasonsData.find(s => s.season_number == seasonNumber);
      if (cachedSeason && cachedSeason.episodes) {
        seasonData = { episodes: cachedSeason.episodes };
      }
    }
    
    // If no cached data, fetch from API
    if (!seasonData) {
      const res = await fetch(`${BASE_URL}/tv/${currentItem.id}/season/${seasonNumber}?api_key=${API_KEY}`); 
      seasonData = await res.json(); 
    }
     
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
      let episodeCount = 12; // default
      
      // Try to get episode count from cached season data
      if (seasonsContainer && seasonsContainer.seasonsData) {
        const cachedSeason = seasonsContainer.seasonsData.find(s => s.season_number == seasonNumber);
        if (cachedSeason && cachedSeason.episode_count) {
          episodeCount = cachedSeason.episode_count;
        }
      } else if (seasonData.episode_count) {
        episodeCount = seasonData.episode_count;
      }
      
      episodeCount = Math.min(50, Math.max(1, episodeCount)); // Cap at 50 episodes
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
  const isAnime = currentItem.original_language === 'ja' && currentItem.genre_ids && currentItem.genre_ids.includes(16);
   
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
     
    // Check if it's anime and we have AniList ID
    if (isAnime && currentItem.anilistId) { 
      // Use AniList ID for anime playback - modify URL structure as needed
      const embedURL = `https://vidsrc.cc/v2/embed/anime/ani${currentItem.anilistId}/${episode}/sub?autoPlay=false`; 
      document.getElementById('modal-video').src = embedURL; 
      console.log(`Loading anime with AniList ID: ${currentItem.anilistId}, Episode: ${episode}`);
    } else if (isAnime) {
      // Fallback to TMDB ID for anime if no AniList ID found
      const embedURL = `https://vidsrc.cc/v2/embed/anime/${currentItem.id}/${episode}/sub?autoPlay=false`; 
      document.getElementById('modal-video').src = embedURL; 
      console.log(`Loading anime with TMDB ID: ${currentItem.id}, Episode: ${episode}`);
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