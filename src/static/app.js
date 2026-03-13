document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const authBtn = document.getElementById("auth-btn");
  const authUsername = document.getElementById("auth-username");
  const teacherName = document.getElementById("teacher-name");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginCancel = document.getElementById("login-cancel");
  const loginError = document.getElementById("login-error");

  // --- Auth helpers ---

  function getToken() {
    return sessionStorage.getItem("authToken");
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function updateAuthUI(username) {
    if (username) {
      authUsername.textContent = `👤 ${username}`;
      authUsername.classList.remove("hidden");
      authBtn.textContent = "Logout";
      teacherName.textContent = username;
      signupContainer.classList.remove("hidden");
    } else {
      authUsername.classList.add("hidden");
      authBtn.textContent = "👤 Login";
      teacherName.textContent = "";
      signupContainer.classList.add("hidden");
    }
    // Refresh activity list so delete buttons appear/disappear
    fetchActivities();
  }

  // --- Login modal ---

  authBtn.addEventListener("click", async () => {
    if (isLoggedIn()) {
      // Logout
      await fetch("/logout", {
        method: "POST",
        headers: authHeaders(),
      });
      sessionStorage.removeItem("authToken");
      updateAuthUI(null);
    } else {
      loginModal.classList.remove("hidden");
      document.getElementById("login-username").focus();
    }
  });

  loginCancel.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginError.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const result = await response.json();

      if (response.ok) {
        sessionStorage.setItem("authToken", result.token);
        loginModal.classList.add("hidden");
        loginError.classList.add("hidden");
        loginForm.reset();
        updateAuthUI(result.username);
      } else {
        loginError.textContent = result.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch {
      loginError.textContent = "Login failed. Please try again.";
      loginError.classList.remove("hidden");
    }
  });

  // Close modal on backdrop click
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      loginModal.classList.add("hidden");
      loginError.classList.add("hidden");
      loginForm.reset();
    }
  });

  // --- Activities ---

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map(
                      (email) =>
                        `<li>
                          <span class="participant-email">${email}</span>
                          ${isLoggedIn() ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}
                        </li>`
                    )
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // --- Initialize ---
  // Restore session if token exists in sessionStorage
  const existingToken = getToken();
  if (existingToken) {
    fetch("/auth/status", { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          updateAuthUI(data.username);
        } else {
          sessionStorage.removeItem("authToken");
          fetchActivities();
        }
      })
      .catch(() => fetchActivities());
  } else {
    fetchActivities();
  }
});
