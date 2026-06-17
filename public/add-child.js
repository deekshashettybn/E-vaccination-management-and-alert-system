const childForm = document.getElementById("childForm");
const message = document.getElementById("message");

const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  window.location.href = "login.html";
}

childForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const childData = {
    parentPhone: user.phone,
    childName: document.getElementById("childName").value,
    dob: document.getElementById("dob").value,
    gender: document.getElementById("gender").value,
    weight: document.getElementById("weight").value
  };

  const response = await fetch("/add-child", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(childData)
  });

  const result = await response.json();

  message.innerText = result.message;

  if (response.ok) {
    message.style.color = "green";
    childForm.reset();
  } else {
    message.style.color = "red";
  }
});