const AI_API_URL = "http://localhost:3000/api/ai/chat";

const aiMascot = document.getElementById("aiMascot");
const aiChatBox = document.getElementById("aiChatBox");
const aiClose = document.getElementById("aiClose");
const aiGreeting = document.getElementById("aiGreeting");

const aiChatContent = document.getElementById("aiChatContent");
const aiUserInput = document.getElementById("aiUserInput");
const aiSend = document.getElementById("aiSend");

if (
  !aiMascot ||
  !aiChatBox ||
  !aiClose ||
  !aiChatContent ||
  !aiUserInput ||
  !aiSend
) {
  console.error("Không tìm thấy các thành phần HTML của chatbot.");
} else {
  function openAIChat() {
    aiChatBox.classList.add("active");

    if (aiGreeting) {
      aiGreeting.style.display = "none";
    }

    aiUserInput.focus();
  }

  function closeAIChat() {
    aiChatBox.classList.remove("active");

    if (aiGreeting) {
      aiGreeting.style.display = "block";
    }
  }

  aiMascot.addEventListener("click", openAIChat);
  aiClose.addEventListener("click", closeAIChat);

  function addMessage(content, sender) {
    const messageDiv = document.createElement("div");

    messageDiv.classList.add("ai-message");

    if (sender === "user") {
      messageDiv.classList.add("ai-user-message");
    } else {
      messageDiv.classList.add("ai-bot-message");
    }

    messageDiv.textContent = content;

    aiChatContent.appendChild(messageDiv);

    aiChatContent.scrollTop = aiChatContent.scrollHeight;

    return messageDiv;
  }

  async function sendAIMessage() {
    const message = aiUserInput.value.trim();

    if (!message) {
      return;
    }

    addMessage(message, "user");

    aiUserInput.value = "";

    const loadingMessage = addMessage("🤖 Mình đang suy nghĩ...", "bot");

    aiSend.disabled = true;
    aiUserInput.disabled = true;

    try {
      const response = await fetch(AI_API_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể nhận câu trả lời từ AI.");
      }

      loadingMessage.textContent =
        data.reply || "Mình chưa có câu trả lời cho câu hỏi này.";
    } catch (error) {
      console.error("LỖI CHATBOT:", error);

      if (error.name === "TimeoutError") {
        loadingMessage.textContent =
          "⏳ AI phản hồi quá lâu. Bạn vui lòng thử lại nhé!";
      } else {
        loadingMessage.textContent = "⚠️ Lỗi: " + error.message;
      }
    } finally {
      aiSend.disabled = false;
      aiUserInput.disabled = false;
      aiUserInput.focus();

      aiChatContent.scrollTop = aiChatContent.scrollHeight;
    }
  }

  aiSend.addEventListener("click", sendAIMessage);

  aiUserInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendAIMessage();
    }
  });
}
