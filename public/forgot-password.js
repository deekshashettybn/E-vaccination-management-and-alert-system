const forgotForm = document.getElementById("forgotForm");
const resetForm = document.getElementById("resetForm");
const message = document.getElementById("message");

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = document.getElementById("phone").value.trim();

  message.innerText = "Sending OTP...";
  message.style.color = "blue";

  const response = await fetch("/send-reset-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ phone })
  });

  const result = await response.json();

  message.innerText = result.message;

  if (response.ok) {
    message.style.color = "green";
    forgotForm.style.display = "none";
    resetForm.style.display = "block";
  } else {
    message.style.color = "red";
  }
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = document.getElementById("phone").value.trim();
  const otp = document.getElementById("otp").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();

  message.innerText = "Resetting password...";
  message.style.color = "blue";

  const response = await fetch("/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ phone, otp, newPassword })
  });

  const result = await response.json();

  message.innerText = result.message;

  if (response.ok) {
    message.style.color = "green";

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } else {
    message.style.color = "red";
  }
});