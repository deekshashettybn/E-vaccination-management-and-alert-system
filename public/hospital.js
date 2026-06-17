const childCount = document.getElementById("childCount");
const doneCount = document.getElementById("doneCount");
const overdueCount = document.getElementById("overdueCount");
const hospitalChildrenContainer = document.getElementById("hospitalChildrenContainer");
const searchInput = document.getElementById("searchInput");

let allChildren = [];
let vaccineChart = null;

loadHospitalData();

async function loadHospitalData() {
  const response = await fetch("/hospital/children");
  allChildren = await response.json();
  displayChildList(allChildren);
  updateStats(allChildren);
}

function updateStats(children) {
  let totalDone = 0;
  let totalOverdue = 0;
  let totalPending = 0;
  const today = new Date();

  children.forEach((child) => {
    child.vaccines.forEach((vaccine) => {
      const dueDate = new Date(vaccine.dueDate);

      if (vaccine.status === "Done") {
        totalDone++;
      } else if (dueDate < today) {
        totalOverdue++;
      } else {
        totalPending++;
      }
    });
  });

  childCount.innerText = children.length;
  doneCount.innerText = totalDone;
  overdueCount.innerText = totalOverdue;

  updateChart(totalDone, totalPending, totalOverdue);
}

function displayChildList(children) {
  if (children.length === 0) {
    hospitalChildrenContainer.innerHTML = "<p>No children registered yet.</p>";
    return;
  }

  let childCards = "";

  children.forEach((child, index) => {
    childCards += `
      <div class="hospital-child-card" onclick="showChildVaccines(${index})">
        <h3>👶 ${child.childName}</h3>
        <p><strong>Gender:</strong> ${child.gender}</p>
        <p><strong>DOB:</strong> ${new Date(child.dob).toLocaleDateString()}</p>
        <p><strong>Parent Phone:</strong> ${child.parentPhone}</p>
        <button class="view-btn">View Vaccines</button>
      </div>
    `;
  });

  hospitalChildrenContainer.innerHTML = `
    <h2>Registered Children</h2>
    <div class="hospital-child-grid">
      ${childCards}
    </div>
  `;
}

function showChildVaccines(index) {
  const child = allChildren[index];
  let vaccineRows = "";

  child.vaccines.forEach((vaccine, vaccineIndex) => {
    const dueDate = new Date(vaccine.dueDate);
    const today = new Date();

    let currentStatus = vaccine.status;

    if (currentStatus !== "Done" && dueDate < today) {
      currentStatus = "Overdue";
    }

    vaccineRows += `
      <tr>
        <td>${vaccine.vaccineName}</td>
        <td>${dueDate.toLocaleDateString()}</td>

        <td>
          <span class="${
            currentStatus === "Done"
              ? "status-done"
              : currentStatus === "Overdue"
              ? "status-overdue"
              : "status-pending"
          }">
            ${currentStatus}
          </span>
        </td>

        <td>
          ${
            vaccine.status !== "Done"
              ? (
        dueDate > today
          ? `<span class="future-text">Not Available Yet</span>`
          : `<button onclick="hospitalMarkDone('${child._id}', ${vaccineIndex})" class="done-btn">
              Mark Done
            </button>`
      )
              : `<a href="/certificate/${child._id}/${vaccineIndex}" class="cert-btn">
                  Certificate
                </a>`
          }
        </td>
      </tr>
    `;
  });

  hospitalChildrenContainer.innerHTML = `
    <button onclick="displayChildList(allChildren)" class="back-btn">← Back to Children</button>

    <div class="child-card">
      <h2>👶 ${child.childName}'s Vaccination Details</h2>
      <p><strong>Gender:</strong> ${child.gender}</p>
      <p><strong>DOB:</strong> ${new Date(child.dob).toLocaleDateString()}</p>
      <p><strong>Weight:</strong> ${child.weight} kg</p>
      <p><strong>Parent Phone:</strong> ${child.parentPhone}</p>

      <table class="vaccine-table">
        <thead>
          <tr>
            <th>Vaccine</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${vaccineRows}
        </tbody>
      </table>
    </div>
  `;
}

async function hospitalMarkDone(childId, vaccineIndex) {
  const confirmUpdate = confirm("Are you sure you want to mark this vaccine as done?");
  if (!confirmUpdate) return;

  const response = await fetch(`/mark-done/${childId}/${vaccineIndex}`, {
    method: "PUT"
  });

  const result = await response.json();
  alert(result.message);

  await loadHospitalData();

  const updatedChildIndex = allChildren.findIndex((child) => child._id === childId);
  if (updatedChildIndex !== -1) {
    showChildVaccines(updatedChildIndex);
  }
}

function updateChart(done, pending, overdue) {
  const ctx = document.getElementById("vaccineChart");
  if (!ctx) return;

  if (vaccineChart) {
    vaccineChart.destroy();
  }

  vaccineChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending", "Overdue"],
      datasets: [
        {
          data: [done, pending, overdue],
          backgroundColor: ["#28a745", "#00aeea", "#d62828"]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

searchInput.addEventListener("input", () => {
  const searchText = searchInput.value.toLowerCase();

  const filteredChildren = allChildren.filter((child) => {
    return (
      child.childName.toLowerCase().includes(searchText) ||
      child.parentPhone.includes(searchText)
    );
  });

  displayChildList(filteredChildren);
  updateStats(filteredChildren);
});

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}