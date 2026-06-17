const verifyResult = document.getElementById("verifyResult");

const params = new URLSearchParams(window.location.search);
const childId = params.get("childId");
const vaccineIndex = params.get("vaccineIndex");

async function verifyCertificate() {
  if (!childId || vaccineIndex === null) {
    verifyResult.innerHTML = `<p style="color:red;">Invalid verification link</p>`;
    return;
  }

  const response = await fetch(`/verify-certificate/${childId}/${vaccineIndex}`);
  const data = await response.json();

  if (!response.ok) {
    verifyResult.innerHTML = `<p style="color:red;">${data.message}</p>`;
    return;
  }

  verifyResult.innerHTML = `
    <h3 style="color:green;">✅ ${data.message}</h3>
    <p><strong>Child Name:</strong> ${data.childName}</p>
    <p><strong>Gender:</strong> ${data.gender}</p>
    <p><strong>Date of Birth:</strong> ${new Date(data.dob).toLocaleDateString()}</p>
    <p><strong>Vaccine:</strong> ${data.vaccineName}</p>
    <p><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</p>
    <p><strong>Date Given:</strong> ${new Date(data.dateGiven).toLocaleDateString()}</p>
    <p><strong>Status:</strong> ${data.status}</p>
  `;
}

verifyCertificate();