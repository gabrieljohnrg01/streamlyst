export function initAuth() {
  document.getElementById('loginBtn').addEventListener('click', () => {
    alert('Login clicked! (Hook this up to Supabase)');
  });

  document.getElementById('registerBtn').addEventListener('click', () => {
    alert('Register clicked! (Hook this up to Supabase)');
  });
}
