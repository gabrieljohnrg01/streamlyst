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
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: TRENDING_DESC, status_in: [RELEASING, FINISHED]) {
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
              node {
                id
                title {
                  romaji
                  english
                  native
                }
                type
                format
                episodes
                status
                startDate {
                  year
                }
              }
              relationType
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
    const animeList = data.data.Page.media;

    // Group anime by base title to consolidate seasons
    const consolidatedAnime = consolidateAnimeSeasons(animeList);

    return consolidatedAnime;
  } catch (error) {
    console.error('Error fetching anime from AniList:', error);
    return [];
  }
}

function consolidateAnimeSeasons(animeList) {
  const animeGroups = new Map();

  animeList.forEach(anime => {
    const baseTitle = getBaseTitle(anime.title);
    const key = baseTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (!animeGroups.has(key)) {
      // Create new group with the main anime
      animeGroups.set(key, {
        mainAnime: anime,
        seasons: [anime],
        allRelatedIds: new Set([anime.id])
      });
    } else {
      // Add to existing group
      const group = animeGroups.get(key);
      group.seasons.push(anime);
      group.allRelatedIds.add(anime.id);
    }
  });

  // Now process relations to find additional seasons
  animeList.forEach(anime => {
    const baseTitle = getBaseTitle(anime.title);
    const key = baseTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    if (animeGroups.has(key)) {
      const group = animeGroups.get(key);
      
      // Look for sequel/prequel relations
      anime.relations.edges.forEach(edge => {
        if (edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL') {
          const relatedAnime = edge.node;
          if (relatedAnime.type === 'ANIME' && !group.allRelatedIds.has(relatedAnime.id)) {
            // Add related season
            group.seasons.push({
              id: relatedAnime.id,
              title: relatedAnime.title,
              episodes: relatedAnime.episodes,
              status: relatedAnime.status,
              startDate: relatedAnime.startDate,
              // Inherit other properties from main anime
              description: anime.description,
              averageScore: anime.averageScore,
              coverImage: anime.coverImage,
              bannerImage: anime.bannerImage,
              genres: anime.genres,
              studios: anime.studios
            });
            group.allRelatedIds.add(relatedAnime.id);
          }
        }
      });
    }
  });

  // Convert groups to consolidated anime entries
  return Array.from(animeGroups.values()).map(group => {
    // Sort seasons by start date
    const sortedSeasons = group.seasons.sort((a, b) => {
      const aYear = a.startDate?.year || 0;
      const bYear = b.startDate?.year || 0;
      return aYear - bYear;
    });

    const mainAnime = group.mainAnime;
    
    return {
      id: mainAnime.id,
      name: mainAnime.title.english || mainAnime.title.romaji,
      title: mainAnime.title.english || mainAnime.title.romaji,
      overview: mainAnime.description ? mainAnime.description.replace(/<[^>]*>/g, '') : 'No description available',
      poster_path: mainAnime.coverImage.large,
      backdrop_path: mainAnime.bannerImage,
      vote_average: mainAnime.averageScore ? mainAnime.averageScore / 10 : 0,
      media_type: 'anime',
      original_language: 'ja',
      genre_ids: [16],
      genres: mainAnime.genres,
      status: mainAnime.status,
      studios: mainAnime.studios.nodes.map(studio => studio.name),
      // Add seasons data
      seasons: sortedSeasons.map((season, index) => ({
        id: season.id,
        season_number: index + 1,
        name: `Season ${index + 1}`,
        episode_count: season.episodes,
        air_date: season.startDate ? `${season.startDate.year}-${season.startDate.month || 1}-${season.startDate.day || 1}` : null,
        overview: season.description || mainAnime.description,
        poster_path: season.coverImage?.large || mainAnime.coverImage.large
      }))
    };
  });
}

function getBaseTitle(titleObj) {
  const title = titleObj.english || titleObj.romaji;
  // Remove common season indicators
  return title.replace(/\s+(Season|S)\s*\d+/gi, '')
              .replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\s*$/gi, '')
              .replace(/\s+2nd\s+Season/gi, '')
              .replace(/\s+3rd\s+Season/gi, '')
              .replace(/\s+\d+(st|nd|rd|th)\s+Season/gi, '')
              .replace(/:\s*Part\s*\d+/gi, '')
              .replace(/\s*-\s*Part\s*\d+/gi, '')
              .trim();
}

async function searchAnime(query) {
  const searchQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 20) {
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
          relations {
            edges {
              node {
                id
                title {
                  romaji
                  english
                  native
                }
                type
                format
                episodes
                status
                startDate {
                  year
                }
              }
              relationType
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
    const animeList = data.data.Page.media;

    // Consolidate search results too
    const consolidatedResults = consolidateAnimeSeasons(animeList);

    return consolidatedResults;
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
        relations {
          edges {
            node {
              id
              title {
                romaji
                english
                native
              }
              type
              format
              episodes
              status
              startDate {
                year
              }
            }
            relationType
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
    // For anime, load seasons/episodes like TV shows
    await loadAnimeSeasons(item);
  } else if (isTVShow) { 
    // For TV shows, load seasons/episodes 
    await loadTVSeasons(item); 
  } 

  document.getElementById('modal').style.display = 'flex'; 
} 

async function loadAnimeSeasons(item) {
  try {
    // Use the consolidated seasons data if available
    if (item.seasons && item.seasons.length > 0) {
      const seasons = item.seasons;
      
      // Create seasons container similar to TV shows
      const container = document.createElement('div');
      container.id = 'seasons-container';
      
      container.innerHTML = `
        <div class="seasons-episodes">
          <div class="season-selector">
            <label>Season: </label>
            <select id="season-select" onchange="loadAnimeEpisodes()">
              ${seasons.map(season => 
                `<option value="${season.season_number}" data-anime-id="${season.id}">Season ${season.season_number}</option>`
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
      await loadAnimeEpisodes();
    } else {
      // Fallback: single season anime
      createDefaultAnimeEpisodes(item.episodes || 12);
      loadPlayer();
    }

  } catch (error) {
    console.error('Error loading anime seasons:', error);
    createDefaultAnimeEpisodes(item.episodes || 12);
    loadPlayer();
  }
}

async function loadAnimeEpisodes() {
  const seasonSelect = document.getElementById('season-select');
  const episodeSelect = document.getElementById('episode-select');
  
  if (!seasonSelect || !episodeSelect) return;

  const selectedOption = seasonSelect.options[seasonSelect.selectedIndex];
  const animeId = selectedOption.getAttribute('data-anime-id');
  const seasonNumber = selectedOption.value;

  try {
    // Get episode count for the selected season
    let episodeCount = 12; // default
    
    if (currentItem.seasons) {
      const season = currentItem.seasons.find(s => s.season_number == seasonNumber);
      if (season && season.episode_count) {
        episodeCount = season.episode_count;
      }
    }

    // Populate episode selector
    episodeSelect.innerHTML = '';
    for (let i = 1; i <= episodeCount; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Episode ${i}`;
      episodeSelect.appendChild(option);
    }

    // Update currentItem to use the selected season's anime ID
    if (animeId) {
      currentItem.selectedSeasonId = animeId;
    }

    // Load first episode by default
    loadPlayer();

  } catch (error) {
    console.error('Error loading anime episodes:', error);
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
    // Anime player - use selected season's ID if available
    const episodeSelect = document.getElementById('episode-select'); 
    const episode = episodeSelect ? episodeSelect.value : 1;
    
    // Use the selected season's anime ID if available, otherwise use main ID
    const animeId = currentItem.selectedSeasonId || currentItem.id;
    
 