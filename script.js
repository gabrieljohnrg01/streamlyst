const supabaseUrl = 'https://fxjfjuuewhecnyvpdwtc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4amZqdXVld2hlY255dnBkd3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODc4NjAsImV4cCI6MjA2NjY2Mzg2MH0.Znwtrg4_srPFF6DV8beEE1Mvvi5RoyUzqYr1QaCnghQ';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value.trim();
    const username = document.getElementById('registerUsername').value.trim().toLowerCase();
    const password = document.getElementById('registerPassword').value;

    if (username.includes(' ')) {
        alert('Username should not contain spaces.');
        return;
    }

    // Check if username already exists
    const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

    if (existing) {
        alert('Username already taken.');
        return;
    }

    // Register user
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        alert(error.message);
        return;
    }

    const userId = data.user.id;

    // Insert into profiles
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: userId, username: username });

    if (profileError) {
        alert(profileError.message);
    } else {
        alert('Registration successful! You can now log in.');
    }
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    let emailToUse = identifier;

    if (!identifier.includes('@')) {
        // It's a username
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', identifier)
            .single();

        if (error || !profile) {
            alert('Username not found.');
            return;
        }

        // Get associated email
        const { data: userData, error: userError } = await supabase
            .from('auth.users')
            .select('email')
            .eq('id', profile.id)
            .single();

        if (userError || !userData) {
            alert('User record not found.');
            return;
        }

        emailToUse = userData.email;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
    });

    if (signInError) {
        alert(signInError.message);
    } else {
        alert('Login successful!');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert(error.message);
    } else {
        alert('Logged out.');
        location.reload();
    }
});

// Session persistence
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
    }
});