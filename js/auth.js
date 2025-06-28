import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://fxjfjuuewhecnyvpdwtc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4amZqdXVld2hlY255dnBkd3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODc4NjAsImV4cCI6MjA2NjY2Mzg2MH0.Znwtrg4_srPFF6DV8beEE1Mvvi5RoyUzqYr1QaCnghQ';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            authContainer.style.display = 'none';
            mainContainer.style.display = 'block';
            // Load user data and watchlist
            loadUserData();
        } else {
            renderAuthForms();
        }
    });

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            authContainer.style.display = 'none';
            mainContainer.style.display = 'block';
            loadUserData();
        } else if (event === 'SIGNED_OUT') {
            authContainer.style.display = 'flex';
            mainContainer.style.display = 'none';
            renderAuthForms();
        }
    });

    // Logout functionality
    document.getElementById('logout-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error logging out:', error.message);
    });
});

function renderAuthForms() {
    const authContainer = document.getElementById('auth-container');
    authContainer.innerHTML = `
        <div class="auth-form">
            <div class="auth-tabs">
                <div class="auth-tab active" data-tab="login">Login</div>
                <div class="auth-tab" data-tab="register">Register</div>
            </div>
            <div id="login-form">
                <div class="form-group">
                    <label for="login-email">Email</label>
                    <input type="email" id="login-email" placeholder="Enter your email">
                </div>
                <div class="form-group">
                    <label for="login-password">Password</label>
                    <input type="password" id="login-password" placeholder="Enter your password">
                </div>
                <div id="login-error" class="error-message"></div>
                <button id="login-button">Login</button>
                <p class="switch-form">Don't have an account? <a href="#" id="show-register">Register</a></p>
            </div>
            <div id="register-form" style="display: none;">
                <div class="form-group">
                    <label for="register-email">Email</label>
                    <input type="email" id="register-email" placeholder="Enter your email">
                </div>
                <div class="form-group">
                    <label for="register-password">Password</label>
                    <input type="password" id="register-password" placeholder="Create a password">
                </div>
                <div class="form-group">
                    <label for="register-confirm-password">Confirm Password</label>
                    <input type="password" id="register-confirm-password" placeholder="Confirm your password">
                </div>
                <div id="register-error" class="error-message"></div>
                <button id="register-button">Register</button>
                <p class="switch-form">Already have an account? <a href="#" id="show-login">Login</a></p>
            </div>
        </div>
    `;

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.auth-tab.active').classList.remove('active');
            tab.classList.add('active');
            
            if (tab.dataset.tab === 'login') {
                document.getElementById('login-form').style.display = 'block';
                document.getElementById('register-form').style.display = 'none';
            } else {
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('register-form').style.display = 'block';
            }
        });
    });

    // Form link switching
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tab[data-tab="register"]').click();
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tab[data-tab="login"]').click();
    });

    // Login functionality
    document.getElementById('login-button')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        
        if (!email || !password) {
            errorElement.textContent = 'Please fill in all fields';
            return;
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            errorElement.textContent = error.message;
        }
    });

    // Register functionality
    document.getElementById('register-button')?.addEventListener('click', async () => {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const errorElement = document.getElementById('register-error');
        
        if (!email || !password || !confirmPassword) {
            errorElement.textContent = 'Please fill in all fields';
            return;
        }
        
        if (password !== confirmPassword) {
            errorElement.textContent = 'Passwords do not match';
            return;
        }
        
        if (password.length < 6) {
            errorElement.textContent = 'Password must be at least 6 characters';
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) {
            errorElement.textContent = error.message;
        } else {
            errorElement.textContent = 'Registration successful! Please check your email for confirmation.';
            document.getElementById('register-form').reset();
            document.querySelector('.auth-tab[data-tab="login"]').click();
        }
    });
}

async function loadUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        // Update UI with user info if needed
        console.log('User loaded:', user.email);
    }
}