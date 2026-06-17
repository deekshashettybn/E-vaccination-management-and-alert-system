const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  message.innerText = "Checking...";
  message.style.color = "blue";

  const loginData = {
    phone: document.getElementById("phone").value.trim(),
    password: document.getElementById("password").value.trim()
  };

  try {

    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(loginData)
    });

    const result = await response.json();

    message.innerText = result.message;

    if (response.ok) {

      message.style.color = "green";

      localStorage.setItem("user", JSON.stringify(result.user));

      setTimeout(() => {

        if (result.user.role === "Hospital") {

          window.location.href = "hospital.html";

        } else {

          window.location.href = "dashboard.html";

        }

      }, 800);

    } else {

      message.style.color = "red";

    }

  } catch (error) {

    console.log(error);

    message.innerText = "Backend not connected";
    message.style.color = "red";

  }
});