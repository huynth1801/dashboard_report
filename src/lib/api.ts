export const getToken = () => localStorage.getItem("google_token");
export const clearToken = () => localStorage.removeItem("google_token");
export const setToken = (token: string) => localStorage.setItem("google_token", token);

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getToken();

  // Redirect to login if no token and it's an API call
  if (!token) {
    if (url.startsWith("/api/")) {
      console.warn("No token found for API request to", url);
      // Let it fail or handle redirect in the UI via 401
    }
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized - please login again.");
  }

  return response;
}
