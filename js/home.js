const API_KEY = 'fc5229ddcee9e96a1be1b8f8535063a3'; 
const BASE_URL = 'https://api.themoviedb.org/3'; 
const IMG_URL = 'https://image.tmdb.org/t/p/original'; 
const ANILIST_URL = 'https://graphql.anilist.co';
let currentItem; 

async function fetchTrending(type) { 
  const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`); 
  const data = await res.json(); 

  const filteredResults = data.results.filter(item => {
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
        media(type: ANIME, sort: TRENDING_DESC, status_in: [RELEASING, NOT_YET_RELEASED, FINISHED]) {
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
              relationType(version: 2)
              node {
                id
                title {
                  romaji
                  english
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    const mediaList = data.data.Page.media;

    const seenFranchises = new Set();
    const grouped = [];

    for (const anime of mediaList) {
      const original = anime.relations.edges.find(edge =>
        ['PREQUEL', 'ORIGINAL'].includes(edge.relationType)
      );

      const franchiseKey = original?.node?.title?.romaji || anime.title.romaji;

      if (seenFranchises.has(franchiseKey)) continue;

      seenFranchises.add(franchiseKey);

      grouped.push({
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
      });
    }

    return grouped;

  } catch (error) {
    console.error('Error fetching anime from AniList:', error);
    return [];
  }
}

async function loadAnimeEpisodes(item) {
  try {
    const animeDetails = await fetchAnimeDetails(item.id);

    if (!animeDetails) {
      createDefaultAnimeEpisodes(item.episodes || 12);
      loadPlayer();
      return;
    }

    const seasons = [
      { id: animeDetails.id, title: animeDetails.title.romaji }
    ];

    if (animeDetails.relations && animeDetails.relations.edges.length > 0) {
      const relatedSeasons = animeDetails.relations.edges.filter(edge =>
        ['SEQUEL', 'PREQUEL'].includes(edge.relationType)
      ).map(edge => ({
        id: edge.node.id,
        title: edge.node.title.romaji || edge.node.title.english
      }));

      const seen = new Set();
      for (const s of [...relatedSeasons, ...seasons]) {
        if (!seen.has(s.id)) {
          seasons.push(s);
          seen.add(s.id);
        }
      }
    }

    seasons.sort((a, b) => a.id - b.id);

    const container = document.createElement('div');
    container.id = 'seasons-container';

    const seasonOptions = seasons.map(s => `<option value="${s.id}">${s.title}</option>`).join('');

    container.innerHTML = `
      <div class="seasons-episodes">
        <div class="season-selector">
          <label>Season: </label>
          <select id="season-select" onchange="loadAnimeSeasonEpisodes()">
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

    window.currentAnimeSeasons = seasons;
    await loadAnimeSeasonEpisodes();

  } catch (error) {
    console.error('Error loading anime seasons:', error);
    createDefaultAnimeEpisodes(item.episodes || 12);
    loadPlayer();
  }
}

async function loadAnimeSeasonEpisodes() {
  const select = document.getElementById('season-select');
  const episodeSelect = document.getElementById('episode-select');
  const animeId = parseInt(select.value);

  try {
    const animeDetails = await fetchAnimeDetails(animeId);

    if (!animeDetails || !animeDetails.episodes) {
      createDefaultAnimeEpisodes(12);
      return;
    }

    currentItem.id = animeId;

    episodeSelect.innerHTML = '';
    for (let i = 1; i <= animeDetails.episodes; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Episode ${i}`;
      episodeSelect.appendChild(option);
    }

    loadPlayer();
  } catch (error) {
    console.error('Error loading episodes for selected season:', error);
    createDefaultAnimeEpisodes(12);
  }
}
