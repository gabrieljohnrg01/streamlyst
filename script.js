const supabaseUrl = 'https://fxjfjuuewhecnyvpdwtc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4amZqdXVld2hlY255dnBkd3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODc4NjAsImV4cCI6MjA2NjY2Mzg2MH0.Znwtrg4_srPFF6DV8beEE1Mvvi5RoyUzqYr1QaCnghQ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
if (loginBtn) loginBtn.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'github' });
});
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

// Load watchlist on dashboard
if (document.getElementById('watchlist')) {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) location.href = '/';
        const user = session.user;
        const { data, error } = await supabase.from('watchlist').select('*').eq('user_id', user.id);
        const container = document.getElementById('watchlist');
        if (data) {
            data.forEach(item => {
                const div = document.createElement('div');
                div.textContent = `Video: ${item.video_id}`;
                container.appendChild(div);
            });
        }
    });
}

// Load iframe with vidsrc.cc link and track progress
if (document.getElementById('videoFrame')) {
    const urlParams = new URLSearchParams(window.location.search);
    const vid = urlParams.get('vid');
    document.getElementById('videoFrame').src = `https://vidsrc.to/embed/movie/${vid}`;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) location.href = '/';
        const user = session.user;
        setInterval(async () => {
            const progress = Math.random(); // Replace with real progress if API available
            await supabase.from('watch_progress').insert({ user_id: user.id, video_id: vid, progress });
        }, 60000); // Every 60 seconds
    });

    document.getElementById('addWatchlistBtn').addEventListener('click', async () => {
        const { data, error } = await supabase.from('watchlist').insert({ user_id: supabase.auth.user().id, video_id: vid });
        if (!error) alert('Added to watchlist!');
    });
}
