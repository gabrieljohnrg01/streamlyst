document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
});

async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;
    
    const searchSection = document.getElementById('search-section');
    const searchGrid = document.getElementById('search-grid');
    searchGrid.innerHTML = '<div class="loading">Searching...</div>';
    showSection('search-section');
    
    try {
        // Search across movies, TV shows, and anime
        const [movies, tvShows, anime] = await Promise.all([
            searchMedia(query, 'movie'),
            searchMedia(query, 'tv'),
            searchAnime(query)
        ]);
        
        const allResults = [...movies, ...tvShows, ...anime];
        
        if (allResults.length === 0) {
            searchGrid.innerHTML = '<div class="no-results">No results found for your search.</div>';
            return;
        }
        
        renderMediaGrid(allResults, searchGrid);
    } catch (error) {
        console.error('Error performing search:', error);
        searchGrid.innerHTML = '<div class="error">Failed to perform search. Please try again.</div>';
    }
}