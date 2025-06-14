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
        relations {
          edges {
            relationType
            node {
              id
              type
              title {
                romaji
                english
                native
              }
              episodes
              coverImage {
                large
              }
              status
            }
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

async function getAllAnimeSeasonsAndSequels(mainAnime) {
  try {
    // Find all related anime (sequels, prequels, seasons)
    const relatedAnime = [];
    const processedIds = new Set();
    
    // Add the main anime first
    relatedAnime.push({
      id: mainAnime.id,
      title: mainAnime.title.english || mainAnime.title.romaji,
      episodes: mainAnime.episodes || 12,
      seasonNumber: 1,
      relationType: 'MAIN'
    });
    processedIds.add(mainAnime.id);

    // Process relations recursively
    if (mainAnime.relations && mainAnime.relations.edges) {
      const sequelTypes = ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'ALTERNATIVE'];
      let seasonCounter = 1;
      
      // Sort relations to prioritize sequels
      const sortedRelations = mainAnime.relations.edges.sort((a, b) => {
        const priority = { 'PREQUEL': 1, 'SEQUEL': 2, 'SIDE_STORY': 3, 'ALTERNATIVE': 4 };
        return (priority[a.relationType] || 5) - (priority[b.relationType] || 5);
      });

      for (const edge of sortedRelations) {
        const relation = edge.node;
        
        if (relation.type === 'ANIME' && 
            sequelTypes.includes(edge.relationType) && 
            !processedIds.has(relation.id) &&
            relation.status !== 'NOT_YET_RELEASED') {
          
          seasonCounter++;
          relatedAnime.push({
            id: relation.id,
            title: relation.title.english || relation.title.romaji,
            episodes: relation.episodes || 12,
            seasonNumber: edge.relationType === 'PREQUEL' ? 0 : seasonCounter,
            relationType: edge.relationType
          });
          processedIds.add(relation.id);
        }
      }
    }

    // Sort by season number and filter out prequels from main seasons
    const mainSeasons = relatedAnime
      .filter(anime => anime.relationType !== 'PREQUEL')
      .sort((a, b) => a.seasonNumber - b.seasonNumber);
    
    // Re-number seasons to be consecutive
    mainSeasons.forEach((season, index) => {
      season.seasonNumber = index + 1;
    });

    return mainSeasons;
  } catch (error) {
    console.error('Error getting anime seasons:', error);
    return [{
      id: mainAnime.id,
      title: mainAnime.title.english || mainAnime.title.romaji,
      episodes: mainAnime.episodes || 12,
      seasonNumber: 1,
      relationType: 'MAIN'
    }];
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
    
    if (!animeDetails) {
      createDefaultAnimeEpisodes(item.episodes || 12);
      loadPlayer();
      return;
    }

    // Get all seasons/sequels
    const allSeasons = await getAllAnimeSeasonsAndSequels(animeDetails);
    
    // Store all seasons data globally for the player
    currentItem.allSeasons = allSeasons;

    // Create seasons and episodes container for anime
    const container = document.createElement('div');
    container.id = 'seasons-container';
    
    // Create season selector if there are multiple seasons
    let seasonSelector = '';
    if (allSeasons.length > 1) {
      seasonSelector = `
        <div class="season-selector">
          <label>Season: </label>
          <select id="season-select" onchange="loadAnimeEpisodesForSeason()">
            ${allSeasons.map(season => 
              `<option value="${season.seasonNumber}" data-anime-id="${season.id}">
                Season ${season.seasonNumber}${season.title !== item.title ? ` - ${season.title}` : ''}
              </option>`
            ).join('')}
          </select>
        </div>
      `;
    }
    
    // Create episode selector for first season
    const firstSeason = allSeasons[0];
    const episodeCount = firstSeason.episodes || 12;
    let episodeOptions = '';
    
    for (let i = 1; i <= episodeCount; i++) {
      episodeOptions += `<option value="${i}">Episode ${i}</option>`;
    }
    
    container.innerHTML = `
      <div class="seasons-episodes">
        ${seasonSelector}
        <div class="episode-selector">
          <label>Episode: </label>
          <select id="episode-select" onchange="loadPlayer()">
            ${episodeOptions}
          </select>
        </div>
      </div>
    `;
    
    // Insert before the video player
    const videoContainer = document.querySelector('.modal-video-container');
    videoContainer.parentNode.insertBefore(container, videoContainer);
    
    // Load first episode by default
    loadPlayer();
    
  } catch (error) {
    console.error('Error loading anime episodes:', error);
    createDefaultAnimeEpisodes(item.episodes || 12);
    loadPlayer();
  }
}

async function loadAnimeEpisodesForSeason() {
  const seasonSelect = document.getElementById('season-select');
  const episodeSelect = document.getElementById('episode-select');
  
  if (!seasonSelect || !currentItem.allSeasons) return;
  
  const selectedSeasonNumber = parseInt(seasonSelect.value);
  const selectedSeason = currentItem.allSeasons.find(s => s.seasonNumber === selectedSeasonNumber);
  
  if (!selectedSeason) return;
  
  // Update episode selector for the selected season
  const episodeCount = selectedSeason.episodes || 12;
  episodeSelect.innerHTML = '';
  
  for (let i = 1; i <= episodeCount; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Episode ${i}`;
    episodeSelect.appendChild(option);
  }
  
  // Load first episode of the new season
  loadPlayer();
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
    // Anime player - determine which season/anime ID to use
    const episodeSelect = document.getElementById('episode-select'); 
    const seasonSelect = document.getElementById('season-select');
    const episode = episodeSelect ? episodeSelect.value : 1; 
    
    let animeId = currentItem.id; // Default to main anime ID
    
    // If we have multiple seasons and a season selector
    if (seasonSelect && currentItem.allSeasons) {
      const selectedSeasonNumber = parseInt(seasonSelect.value);
      const selectedSeason = currentItem.allSeasons.find(s => s.seasonNumber === selectedSeasonNumber);
      if (selectedSeason) {
        animeId = selectedSeason.id;
      }
    }
    
    // For anime from AniList, use the anime endpoint with correct season's AniList ID
    const embedURL = `https://vidsrc.cc/v2/embed/anime/anilist${animeId}/${episode}/sub?autoPlay=false`; 
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
 
// Listen for
