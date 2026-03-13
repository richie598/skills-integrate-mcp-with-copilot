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
      try {
        const response = await fetch("/logout", {
          method: "POST",
          headers: authHeaders(),
        });
        if (!response.ok) {
          // Optionally log server-side logout failure for debugging
          console.error("Logout request failed with status", response.status);
        }
      } catch (error) {
        // Ensure client-side logout still occurs even if the network request fails
        console.error("Network error during logout:", error);
      } finally {
        sessionStorage.removeItem("authToken");
        updateAuthUI(null);
      }
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
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
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

        // Build activity card content using DOM APIs to avoid injecting untrusted HTML
        const titleEl = document.createElement("h4");
        titleEl.textContent = name;

        const descriptionEl = document.createElement("p");
        descriptionEl.textContent = details.description;

        const scheduleEl = document.createElement("p");
        const scheduleStrong = document.createElement("strong");
        scheduleStrong.textContent = "Schedule:";
        scheduleEl.appendChild(scheduleStrong);
        scheduleEl.appendChild(document.createTextNode(" " + details.schedule));

        const availabilityEl = document.createElement("p");
        const availabilityStrong = document.createElement("strong");
        availabilityStrong.textContent = "Availability:";
        availabilityEl.appendChild(availabilityStrong);
        availabilityEl.appendChild(
          document.createTextNode(" " + spotsLeft + " spots left")
        );

        const participantsContainer = document.createElement("div");
        participantsContainer.className = "participants-container";

        if (details.participants.length > 0) {
          const participantsSection = document.createElement("div");
          participantsSection.className = "participants-section";

          const participantsHeader = document.createElement("h5");
          participantsHeader.textContent = "Participants:";
          participantsSection.appendChild(participantsHeader);

          const participantsListEl = document.createElement("ul");
          participantsListEl.className = "participants-list";

          details.participants.forEach((email) => {
            const li = document.createElement("li");

            const emailSpan = document.createElement("span");
            emailSpan.className = "participant-email";
            emailSpan.textContent = email;
            li.appendChild(emailSpan);

            if (isLoggedIn()) {
              const deleteBtn = document.createElement("button");
              deleteBtn.className = "delete-btn";
              deleteBtn.textContent = "❌";
              deleteBtn.dataset.activity = name;
              deleteBtn.dataset.email = email;
              li.appendChild(deleteBtn);
            }

            participantsListEl.appendChild(li);
          });

          participantsSection.appendChild(participantsListEl);
          participantsContainer.appendChild(participantsSection);
        } else {
          const noParticipantsP = document.createElement("p");
          const em = document.createElement("em");
          em.textContent = "No participants yet";
          noParticipantsP.appendChild(em);
          participantsContainer.appendChild(noParticipantsP);
        }

        activityCard.appendChild(titleEl);
        activityCard.appendChild(descriptionEl);
        activityCard.appendChild(scheduleEl);
        activityCard.appendChild(availabilityEl);
        activityCard.appendChild(participantsContainer);

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

// ---- Animated Git-branch background ----
(function () {
  const canvas = document.getElementById("git-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Lime-green palette for branch lanes
  const LANE_COLORS = ["#388e3c", "#4caf50", "#76ff03", "#8bc34a", "#2e7d32"];
  const LANE_SPACING = 40; // px between lanes
  const COMMIT_RADIUS = 5;
  const SCROLL_SPEED = 0.4; // px per frame

  let W, H, numLanes;
  let scrollOffset = 0;

  // Each commit: { lane, y, id }
  // Each edge:   { fromId, toId }  (connects two commits)
  const commits = [];
  const edges = [];

  function buildGraph() {
    commits.length = 0;
    edges.length = 0;

    numLanes = Math.max(3, Math.floor(W / LANE_SPACING / 3));
    const rowSpacing = 60;
    const rows = Math.ceil(H / rowSpacing) + 10;

    // Start all lanes with an initial commit
    const headIds = [];
    for (let lane = 0; lane < numLanes; lane++) {
      const id = commits.length;
      commits.push({ lane, y: -rowSpacing * (rows + 2) + lane * 15 });
      headIds.push(id);
    }

    for (let row = 1; row < rows * 3; row++) {
      const y = -rowSpacing * (rows + 2) + row * rowSpacing;
      for (let lane = 0; lane < numLanes; lane++) {
        const id = commits.length;
        commits.push({ lane, y });

        // Connect to same-lane previous commit
        edges.push({ fromId: headIds[lane], toId: id });

        // Occasionally add a branch from a neighboring lane
        if (Math.random() < 0.08 && numLanes > 1) {
          const neighborLane = lane === 0 ? 1 : lane - 1;
          edges.push({ fromId: headIds[neighborLane], toId: id });
        }

        headIds[lane] = id;
      }
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildGraph();
  }

  function laneX(lane) {
    // Center the lanes in the viewport
    const totalWidth = (numLanes - 1) * LANE_SPACING;
    const startX = (W - totalWidth) / 2;
    return startX + lane * LANE_SPACING;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    scrollOffset = (scrollOffset + SCROLL_SPEED) % (60 * 3); // loop every ~180px

    // Draw edges
    edges.forEach(({ fromId, toId }) => {
      const a = commits[fromId];
      const b = commits[toId];
      const y1 = a.y + scrollOffset;
      const y2 = b.y + scrollOffset;
      if (y1 > H + 20 || y2 < -20) return;

      const color = LANE_COLORS[a.lane % LANE_COLORS.length];
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.moveTo(laneX(a.lane), y1);
      // Bezier curve for branch/merge lines
      if (a.lane !== b.lane) {
        ctx.bezierCurveTo(
          laneX(a.lane), y1 + 20,
          laneX(b.lane), y2 - 20,
          laneX(b.lane), y2
        );
      } else {
        ctx.lineTo(laneX(b.lane), y2);
      }
      ctx.stroke();
    });

    // Draw commit dots
    commits.forEach((c) => {
      const y = c.y + scrollOffset;
      if (y < -10 || y > H + 10) return;
      const color = LANE_COLORS[c.lane % LANE_COLORS.length];
      ctx.beginPath();
      ctx.arc(laneX(c.lane), y, COMMIT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
})();
