document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const timetableGrid = document.getElementById("timetable-grid");
  const timetableView = document.getElementById("timetable-view");
  const listView = document.getElementById("list-view");
  const timetableViewBtn = document.getElementById("timetable-view-btn");
  const listViewBtn = document.getElementById("list-view-btn");
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
  const detailEmpty = document.getElementById("timetable-detail-empty");
  const detailContent = document.getElementById("timetable-detail-content");
  const detailName = document.getElementById("detail-name");
  const detailDescription = document.getElementById("detail-description");
  const detailSchedule = document.getElementById("detail-schedule");
  const detailAvailability = document.getElementById("detail-availability");
  const detailSignupBtn = document.getElementById("detail-signup-btn");

  const weekdays = [
    { key: "Monday", shortLabel: "Mon" },
    { key: "Tuesday", shortLabel: "Tue" },
    { key: "Wednesday", shortLabel: "Wed" },
    { key: "Thursday", shortLabel: "Thu" },
    { key: "Friday", shortLabel: "Fri" },
  ];

  let activitiesCache = {};
  let selectedActivityName = null;

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

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  function setView(viewName) {
    const showingTimetable = viewName === "timetable";
    timetableView.classList.toggle("hidden", !showingTimetable);
    listView.classList.toggle("hidden", showingTimetable);
    timetableViewBtn.classList.toggle("active", showingTimetable);
    listViewBtn.classList.toggle("active", !showingTimetable);
    timetableViewBtn.setAttribute("aria-pressed", String(showingTimetable));
    listViewBtn.setAttribute("aria-pressed", String(!showingTimetable));
  }

  function normalizeDayName(dayText) {
    const cleaned = dayText.trim().replace(/\.$/, "").toLowerCase();
    const singular = cleaned.endsWith("s") ? cleaned.slice(0, -1) : cleaned;
    const match = weekdays.find((day) => day.key.toLowerCase().startsWith(singular));
    return match ? match.key : null;
  }

  function parseTimeToMinutes(timeText) {
    const match = timeText.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
      return Number.POSITIVE_INFINITY;
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3].toUpperCase();

    if (hours === 12) {
      hours = 0;
    }

    if (meridiem === "PM") {
      hours += 12;
    }

    return hours * 60 + minutes;
  }

  function parseSchedule(scheduleText) {
    const timeMatch = scheduleText.match(
      /(\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M)$/i
    );

    if (!timeMatch) {
      return [];
    }

    const timeRange = timeMatch[1].replace(/\s+/g, " ").trim();
    const startTime = timeRange.split("-")[0].trim();
    const startMinutes = parseTimeToMinutes(startTime);
    const dayText = scheduleText.slice(0, timeMatch.index).replace(/,\s*$/, "");
    const rawDays = dayText.split(/\s*,\s*|\s+and\s+/i);

    return rawDays
      .map(normalizeDayName)
      .filter(Boolean)
      .map((day) => ({ day, timeRange, startMinutes }));
  }

  function selectActivity(activityName) {
    selectedActivityName = activityName;
    renderTimetable();
    renderDetailPanel();
  }

  function focusSignupForActivity(activityName) {
    if (!activityName || !isLoggedIn()) {
      return;
    }

    activitySelect.value = activityName;
    signupContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("email").focus();
  }

  function renderDetailPanel() {
    const activity = activitiesCache[selectedActivityName];

    if (!activity) {
      detailEmpty.classList.remove("hidden");
      detailContent.classList.add("hidden");
      return;
    }

    const spotsLeft = activity.max_participants - activity.participants.length;

    detailEmpty.classList.add("hidden");
    detailContent.classList.remove("hidden");
    detailName.textContent = selectedActivityName;
    detailDescription.textContent = activity.description;
    detailSchedule.textContent = activity.schedule;
    detailAvailability.textContent = `${spotsLeft} spots left`;
    detailSignupBtn.disabled = !isLoggedIn();
    detailSignupBtn.textContent = isLoggedIn()
      ? "Register This Activity"
      : "Teacher Login Required to Register";
  }

  function renderListView() {
    activitiesList.innerHTML = "";

    Object.entries(activitiesCache).forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;

      const titleEl = document.createElement("h4");
      titleEl.textContent = name;

      const descriptionEl = document.createElement("p");
      descriptionEl.textContent = details.description;

      const scheduleEl = document.createElement("p");
      const scheduleStrong = document.createElement("strong");
      scheduleStrong.textContent = "Schedule:";
      scheduleEl.appendChild(scheduleStrong);
      scheduleEl.appendChild(document.createTextNode(` ${details.schedule}`));

      const availabilityEl = document.createElement("p");
      const availabilityStrong = document.createElement("strong");
      availabilityStrong.textContent = "Availability:";
      availabilityEl.appendChild(availabilityStrong);
      availabilityEl.appendChild(document.createTextNode(` ${spotsLeft} spots left`));

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
            deleteBtn.type = "button";
            deleteBtn.textContent = "X";
            deleteBtn.dataset.activity = name;
            deleteBtn.dataset.email = email;
            deleteBtn.addEventListener("click", handleUnregister);
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
    });
  }

  function renderTimetable() {
    timetableGrid.innerHTML = "";

    const slotsByTime = new Map();

    Object.entries(activitiesCache).forEach(([name, details]) => {
      parseSchedule(details.schedule).forEach((entry) => {
        if (!slotsByTime.has(entry.timeRange)) {
          slotsByTime.set(entry.timeRange, {
            startMinutes: entry.startMinutes,
            days: {},
          });
        }

        const slot = slotsByTime.get(entry.timeRange);
        if (!slot.days[entry.day]) {
          slot.days[entry.day] = [];
        }
        slot.days[entry.day].push(name);
      });
    });

    const orderedSlots = Array.from(slotsByTime.entries()).sort(
      (left, right) => left[1].startMinutes - right[1].startMinutes
    );

    if (orderedSlots.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.textContent = "No timetable data is available yet.";
      timetableGrid.appendChild(emptyState);
      return;
    }

    const timeHeader = document.createElement("div");
    timeHeader.className = "timetable-header timetable-time-header";
    timeHeader.textContent = "Time";
    timetableGrid.appendChild(timeHeader);

    weekdays.forEach((day) => {
      const header = document.createElement("div");
      header.className = "timetable-header";
      header.textContent = day.shortLabel;
      timetableGrid.appendChild(header);
    });

    orderedSlots.forEach(([timeRange, slot]) => {
      const timeCell = document.createElement("div");
      timeCell.className = "timetable-time-cell";
      timeCell.textContent = timeRange;
      timetableGrid.appendChild(timeCell);

      weekdays.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "timetable-cell";

        const activitiesForCell = (slot.days[day.key] || []).sort((left, right) =>
          left.localeCompare(right)
        );

        if (activitiesForCell.length === 0) {
          const emptyPill = document.createElement("span");
          emptyPill.className = "timetable-empty";
          emptyPill.textContent = "-";
          cell.appendChild(emptyPill);
        } else {
          activitiesForCell.forEach((activityName) => {
            const activityButton = document.createElement("button");
            activityButton.type = "button";
            activityButton.className = "timetable-activity";
            if (selectedActivityName === activityName) {
              activityButton.classList.add("selected");
            }
            activityButton.textContent = activityName;
            activityButton.addEventListener("click", () => selectActivity(activityName));
            cell.appendChild(activityButton);
          });
        }

        timetableGrid.appendChild(cell);
      });
    });
  }

  function renderActivityViews() {
    const activityNames = Object.keys(activitiesCache);
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    activityNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });

    if (selectedActivityName && !activitiesCache[selectedActivityName]) {
      selectedActivityName = null;
    }

    renderListView();
    renderTimetable();
    renderDetailPanel();
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();
      activitiesCache = activities;
      renderActivityViews();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      timetableGrid.innerHTML =
        "<p>Failed to load the timetable. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function updateAuthUI(username) {
    if (username) {
      authUsername.textContent = `Teacher: ${username}`;
      authUsername.classList.remove("hidden");
      authBtn.textContent = "Logout";
      teacherName.textContent = username;
      signupContainer.classList.remove("hidden");
    } else {
      authUsername.classList.add("hidden");
      authBtn.textContent = "Login";
      teacherName.textContent = "";
      signupContainer.classList.add("hidden");
    }

    renderActivityViews();
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
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  detailSignupBtn.addEventListener("click", () => {
    if (!selectedActivityName) {
      return;
    }

    if (!isLoggedIn()) {
      loginModal.classList.remove("hidden");
      document.getElementById("login-username").focus();
      return;
    }

    focusSignupForActivity(selectedActivityName);
  });

  timetableViewBtn.addEventListener("click", () => setView("timetable"));
  listViewBtn.addEventListener("click", () => setView("list"));

  authBtn.addEventListener("click", async () => {
    if (isLoggedIn()) {
      try {
        const response = await fetch("/logout", {
          method: "POST",
          headers: authHeaders(),
        });
        if (!response.ok) {
          console.error("Logout request failed with status", response.status);
        }
      } catch (error) {
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

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginError.classList.add("hidden");
      loginForm.reset();
    }
  });

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
        showMessage(result.message, "success");
        signupForm.reset();
        selectedActivityName = activity;
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  setView("timetable");

  const existingToken = getToken();
  if (existingToken) {
    fetch("/auth/status", { headers: authHeaders() })
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated) {
          updateAuthUI(data.username);
        } else {
          sessionStorage.removeItem("authToken");
        }
        fetchActivities();
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
