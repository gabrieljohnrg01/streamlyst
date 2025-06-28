import { createCard } from './components.js';
import { fetchTopMovies, fetchTopTV, fetchTopAnime } from './api.js';
import { initAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  initAuth();

  const movies = await fetchTopMovies();
  const tv = await fetchTopTV();
  const anime = await fetchTopAnime();

  const moviesList = document.getElementById('moviesList');
  const tvList = document.getElementById('tvList');
  const animeList = document.getElementById('animeList');

  movies.forEach(item => moviesList.appendChild(createCard(item)));
  tv.forEach(item => tvList.appendChild(createCard(item)));
  anime.forEach(item => animeList.appendChild(createCard(item)));
});
