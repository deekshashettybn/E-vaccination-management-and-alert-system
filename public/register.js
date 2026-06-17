const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userData = {
    role: document.getElementById("role").value,
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    email: document.getElementById("email").value,
    password: document.getElementById("password").value
  };

  const response = await fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(userData)
  });

  const result = await response.json();

  message.innerText = result.message;

  if (response.ok) {
    message.style.color = "green";
    registerForm.reset();
  } else {
    message.style.color = "red";
  }
});