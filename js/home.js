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

// Function to get AniList data with episode information
async function getAniListData(anilistId) {
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        episodes
        status
        format
        relations {
          edges {
            node {
              id
              title {
                romaji
                english
              }
              episodes
              status
              format
            }
            relationType
          }
        }
      }
    }
  `;

  const variables = { id: anilistId };

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
    return data.data?.Media || null;
  } catch (error) {
    console.warn('Error fetching AniList data:', error);
    return null;
  }
}

// Function to calculate episode offset for multi-season anime
async function calculateEpisodeOffset(tmdbItem, targetSeason) {
  try {
    const allSeasons = await fetchAllSeasons(tmdbItem.id);
    let episodeOffset = 0;
    
    // Calculate total episodes from all previous seasons
    for (let i = 0; i < allSeasons.length; i++) {
      const season = allSeasons[i];
      if (season.season_number < targetSeason) {
        // Get actual episode count for this season
        try {
          const seasonData = await fetch(`${BASE_URL}/tv/${tmdbItem.id}/season/${season.season_number}?api_key=${API_KEY}`);
          const seasonDetails = await seasonData.json();
          episodeOffset += seasonDetails.episodes ? seasonDetails.episodes.length : (season.episode_count || 0);
        } catch {
          episodeOffset += season.episode_count || 12; // fallback
        }
      } else {
        break;
      }
    }
    
    return episodeOffset;
  } catch (error) {
    console.warn('Error calculating episode offset:', error);
    return 0;
  }
}

// Function to get AniList ID for a specific season
async function getAniListIdForSeason(tmdbItem, seasonNumber) {
  // Create search query for specific season
  let searchTitle = tmdbItem.name || tmdbItem.title;
  
  // Add season info to search if it's not season 1
  if (seasonNumber > 1) {
    // Try different season formats
    const seasonFormats = [
      `${searchTitle} Season ${seasonNumber}`,
      `${searchTitle} S${seasonNumber}`,
      `${searchTitle} ${seasonNumber}nd Season`,
      `${searchTitle} ${seasonNumber}rd Season`,
      `${searchTitle} ${seasonNumber}th Season`,
      `${searchTitle} Part ${seasonNumber}`,
      `${searchTitle} ${romanNumerals[seasonNumber] || seasonNumber}`
    ];
    
    // Try each format until we find a match
    for (const searchQuery of seasonFormats) {
      const anilistId = await searchAniList(searchQuery);
      if (anilistId) {
        return anilistId;
      }
    }
  }
  
  // For season 1 or if no specific season found, search with base title
  return await searchAniList(searchTitle);
}

// Helper function to search AniList
async function searchAniList(searchQuery) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
      }
    }
  `;

  const variables = {
    search: searchQuery
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
    console.warn('Error searching AniList:', error);
    return null;
  }
}

// Enhanced function to determine anime type and episode mapping
async function getAnimeEpisodeMapping(tmdbItem, seasonNumber, episodeNumber) {
  const baseTitle = tmdbItem.name || tmdbItem.title;
  
  // First, try to find the main AniList entry
  const mainAniListId = await searchAniList(baseTitle);
  if (!mainAniListId) {
    return { useAniList: false, anilistId: null, episodeNumber: episodeNumber };
  }
  
  // Get AniList data to understand the anime structure
  const anilistData = await getAniListData(mainAniListId);
  if (!anilistData) {
    return { useAniList: false, anilistId: null, episodeNumber: episodeNumber };
  }
  
  // Check if this is a long-running anime (like One Piece, Naruto, etc.)
  const isLongRunning = anilistData.episodes > 100 || anilistData.status === 'RELEASING';
  
  if (isLongRunning) {
    // For long-running anime, calculate the absolute episode number
    const episodeOffset = await calculateEpisodeOffset(tmdbItem, seasonNumber);
    const absoluteEpisode = episodeOffset + parseInt(episodeNumber);
    
    return {
      useAniList: true,
      anilistId: mainAniListId,
      episodeNumber: absoluteEpisode,
      isLongRunning: true
    };
  } else {
    // For seasonal anime, try to find specific season entries
    if (seasonNumber > 1) {
      // Look for sequel entries in AniList relations
      const sequels = anilistData.relations?.edges?.filter(edge => 
        edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL'
      ) || [];
      
      // Try to find the specific season
      const seasonAniListId = await getAniListIdForSeason(tmdbItem, seasonNumber);
      if (seasonAniListId && seasonAniListId !== mainAniListId) {
        return {
          useAniList: true,
          anilistId: seasonAniListId,
          episodeNumber: episodeNumber,
          isLongRunning: false
        };
      }
    }
    
    // Default to main entry for season 1 or if no specific season found
    return {
      useAniList: true,
      anilistId: mainAniListId,
      episodeNumber: episodeNumber,
      isLongRunning: false
    };
  }
}

// Roman numerals for season search
const romanNumerals = {
  1: 'I',
  2: 'II', 
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X'
};

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
  document.getElementById('modal-rating').innerHTML = 'â˜…'.repeat(Math.round(item.vote_average / 2)); 
   
  // Determine content type properly 
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.release_date); 
  const isTVShow = item.media_type === 'tv' || (!item.media_type && item.first_air_date); 
   
  if (isMovie) { 
    // For movies, load player directly 
    loadPlayer(); 
  } else if (isTVShow) { 
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
 
// Enhanced loadEpisodes function with better episode handling
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
    
    episodeSelect.innerHTML = '';
    
    if (seasonData.episodes && seasonData.episodes.length > 0) {
      // Use actual episode data
      seasonData.episodes.forEach(episode => {
        const option = document.createElement('option');
        option.value = episode.episode_number;
        option.textContent = `Episode ${episode.episode_number}${episode.name ? ': ' + episode.name : ''}`;
        episodeSelect.appendChild(option);
      });
    } else {
      // Fallback: create default episodes
      let episodeCount = 12; // default
      
      if (seasonsContainer && seasonsContainer.seasonsData) {
        const cachedSeason = seasonsContainer.seasonsData.find(s => s.season_number == seasonNumber);
        if (cachedSeason && cachedSeason.episode_count) {
          episodeCount = cachedSeason.episode_count;
        }
      } else if (seasonData.episode_count) {
        episodeCount = seasonData.episode_count;
      }
      
      episodeCount = Math.min(50, Math.max(1, episodeCount));
      for (let i = 1; i <= episodeCount; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Episode ${i}`;
        episodeSelect.appendChild(option);
      }
    }
    
    // For anime, show additional info about episode mapping
    const isAnime = currentItem.original_language === 'ja' && currentItem.genre_ids && currentItem.genre_ids.includes(16);
    if (isAnime && parseInt(seasonNumber) > 1) {
      // Calculate and display absolute episode numbers for reference
      const episodeOffset = await calculateEpisodeOffset(currentItem, parseInt(seasonNumber));
      if (episodeOffset > 0) {
        // Update episode options to show absolute episode numbers
        Array.from(episodeSelect.options).forEach(option => {
          const episodeNum = parseInt(option.value);
          const absoluteEp = episodeOffset + episodeNum;
          option.textContent += ` (Abs: ${absoluteEp})`;
        });
      }
    }
    
    loadPlayer();
    
  } catch (error) {
    console.error('Error loading episodes:', error);
    // Fallback
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
 
// Enhanced loadPlayer function with better anime handling
function loadPlayer() {
  const isMovie = currentItem.media_type === 'movie' || (!currentItem.media_type && currentItem.release_date);
  const isAnime = currentItem.original_language === 'ja' && currentItem.genre_ids && currentItem.genre_ids.includes(16);
  
  if (isMovie) {
    const embedURL = `https://vidsrc.cc/v2/embed/movie/${currentItem.id}?autoPlay=false&poster=false`;
    document.getElementById('modal-video').src = embedURL;
  } else {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    
    const season = seasonSelect ? parseInt(seasonSelect.value) : 1;
    const episode = episodeSelect ? parseInt(episodeSelect.value) : 1;
    
    if (isAnime) {
      // Use the enhanced anime episode mapping
      getAnimeEpisodeMapping(currentItem, season, episode).then(mapping => {
        let embedURL;
        
        if (mapping.useAniList && mapping.anilistId) {
          if (mapping.isLongRunning) {
            // For long-running anime, use absolute episode number
            embedURL = `https://vidsrc.cc/v2/embed/anime/ani${mapping.anilistId}/${mapping.episodeNumber}/sub?autoPlay=false`;
            console.log(`Loading long-running anime - AniList ID: ${mapping.anilistId}, Absolute Episode: ${mapping.episodeNumber}`);
          } else {
            // For seasonal anime, use the specific season's AniList ID
            embedURL = `https://vidsrc.cc/v2/embed/anime/ani${mapping.anilistId}/${mapping.episodeNumber}/sub?autoPlay=false`;
            console.log(`Loading seasonal anime - AniList ID: ${mapping.anilistId}, Episode: ${mapping.episodeNumber}`);
          }
        } else {
          // Fallback to TMDB
          embedURL = `https://vidsrc.cc/v2/embed/anime/${currentItem.id}/${episode}/sub?autoPlay=false`;
          console.log(`Fallback to TMDB - ID: ${currentItem.id}, Episode: ${episode}`);
        }
        
        document.getElementById('modal-video').src = embedURL;
      }).catch(error => {
        console.error('Error in anime episode mapping:', error);
        // Fallback to TMDB
        const embedURL = `https://vidsrc.cc/v2/embed/anime/${currentItem.id}/${episode}/sub?autoPlay=false`;
        document.getElementById('modal-video').src = embedURL;
      });
    } else {
      // Regular TV show
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