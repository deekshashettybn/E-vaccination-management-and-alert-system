const user = JSON.parse(localStorage.getItem("user"));

const childrenContainer = document.getElementById("childrenContainer");
const reminderContainer = document.getElementById("reminderContainer");
const calendarContainer = document.getElementById("calendarContainer");

const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

if (!user) {
  window.location.href = "login.html";
} else {
  document.getElementById("welcomeText").innerText =
    `Hello ${user.name}, you are logged in as ${user.role}`;

  loadChildren();
}

async function loadChildren() {
  const response = await fetch(`/children/${user.phone}`);
  const children = await response.json();

  childrenContainer.innerHTML = "";
  reminderContainer.innerHTML = "";
  calendarContainer.innerHTML = "";

  let totalVaccines = 0;
  let completedVaccines = 0;
  let upcomingVaccines = [];

  if (children.length === 0) {
    childrenContainer.innerHTML = "<p>No child details added yet.</p>";
    progressFill.style.width = "0%";
    progressText.innerText = "0% Vaccination Completed";
    return;
  }

  children.forEach((child) => {
    const childCard = document.createElement("div");
    childCard.className = "child-card";

    let vaccinesHTML = "";

    child.vaccines.forEach((vaccine, index) => {
      totalVaccines++;

      if (vaccine.status === "Done") {
        completedVaccines++;
      }

      const today = new Date();
      const dueDateObj = new Date(vaccine.dueDate);

      if (vaccine.status === "Pending" && dueDateObj < today) {
        vaccine.status = "Overdue";
      }

      const diffDays = Math.ceil(
        (dueDateObj - today) / (1000 * 60 * 60 * 24)
      );

      if (vaccine.status !== "Done") {
        if (diffDays <= 3 && diffDays >= 0) {
          reminderContainer.innerHTML += `
            <div class="reminder-card upcoming-reminder">
              🔔 Upcoming Vaccine:
              <strong>${vaccine.vaccineName}</strong>
              for ${child.childName}
              in ${diffDays} day(s)
            </div>
          `;
        }

        if (diffDays < 0) {
          reminderContainer.innerHTML += `
            <div class="reminder-card overdue-reminder">
              ⚠️ Overdue Vaccine:
              <strong>${vaccine.vaccineName}</strong>
              for ${child.childName}
            </div>
          `;
        }

        upcomingVaccines.push({
          childName: child.childName,
          vaccineName: vaccine.vaccineName,
          dueDate: dueDateObj,
          diffDays
        });
      }

      vaccinesHTML += `
        <tr>
          <td>${vaccine.vaccineName}</td>
          <td>${dueDateObj.toLocaleDateString()}</td>

          <td>
            <span class="${
              vaccine.status === "Done"
                ? "status-done"
                : vaccine.status === "Overdue"
                ? "status-overdue"
                : "status-pending"
            }">
              ${vaccine.status}
            </span>
          </td>

          <td>
            ${
              vaccine.status === "Done"
                ? `<a href="/certificate/${child._id}/${index}" class="cert-btn">
                    Download Certificate
                  </a>`
                : `<span class="waiting-text">Waiting for hospital update</span>`
            }
          </td>
        </tr>
      `;
    });

    childCard.innerHTML = `
      <h3>👶 ${child.childName}</h3>
      <p><strong>DOB:</strong> ${new Date(child.dob).toLocaleDateString()}</p>
      <p><strong>Gender:</strong> ${child.gender}</p>
      <p><strong>Weight:</strong> ${child.weight} kg</p>

      <table class="vaccine-table">
        <thead>
          <tr>
            <th>Vaccine</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Certificate</th>
          </tr>
        </thead>

        <tbody>
          ${vaccinesHTML}
        </tbody>
      </table>
    `;

    childrenContainer.appendChild(childCard);
  });

  const progressPercent =
    totalVaccines === 0
      ? 0
      : Math.round((completedVaccines / totalVaccines) * 100);

  progressFill.style.width = `${progressPercent}%`;
  progressText.innerText = `${progressPercent}% Vaccination Completed`;

  upcomingVaccines.sort((a, b) => a.dueDate - b.dueDate);

  upcomingVaccines.forEach((vaccine) => {
    calendarContainer.innerHTML += `
      <div class="calendar-card ${vaccine.diffDays <= 3 ? "urgent-calendar" : ""}">
        <h4>${vaccine.vaccineName}</h4>
        <p>👶 ${vaccine.childName}</p>
        <p>📅 ${vaccine.dueDate.toLocaleDateString()}</p>
        <p>
          ${vaccine.diffDays >= 0
            ? `Due in ${vaccine.diffDays} day(s)`
            : `Overdue`}
        </p>
      </div>
    `;
  });

  if (calendarContainer.innerHTML === "") {
    calendarContainer.innerHTML = `
      <div class="calendar-card">
        ✅ No upcoming vaccines
      </div>
    `;
  }

  if (reminderContainer.innerHTML === "") {
    reminderContainer.innerHTML = `
      <div class="reminder-card upcoming-reminder">
        ✅ No upcoming or overdue vaccines right now.
      </div>
    `;
  }
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}