async function loadMovies() {
    showLoading();
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}`);
        const data = await response.json();
        
        // Filter out anime movies
        const filteredMovies = data.results.filter(movie => {
            // Exclude Japanese animation movies
            if (movie.original_language === 'ja' && movie.genre_ids?.includes(16)) {
                return false;
            }
            return true;
        });
        
        displayContent(filteredMovies, 'movie');
    } catch (error) {
        console.error('Error loading movies:', error);
        showError('Failed to load movies');
    }
}

async function fetchMovieDetails(movieId) {
    try {
        const response = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movieId}?api_key=${CONFIG.TMDB_API_KEY}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}