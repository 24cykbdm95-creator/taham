
const chat = document.getElementById("chat");
const userInput = document.getElementById("userInput");

async function sendMessage() {
    const soru = userInput.value.trim();

    if (!soru) {
        alert("Lütfen bir soru yaz.");
        return;
    }

    addMessage(soru, "user-message");
    userInput.value = "";

    const loading = document.createElement("div");
    loading.className = "bot-message";
    loading.textContent = "TAHAM bilgi havuzunda aranıyor...";
    chat.appendChild(loading);

    try {
        const response = await fetch("/api/soru", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ soru })
        });

        const data = await response.json();

        loading.replaceChildren();

        const title = document.createElement("strong");
        title.textContent = data.baslik || "TAHAM Bilgilendirme";

        const answer = document.createElement("p");
        answer.textContent = data.cevap;

        const link = document.createElement("a");
        link.href = data.link;
        link.textContent = "Resmî kuruma git";
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        loading.append(title, answer, link);

    } catch (error) {
        loading.textContent = "Bilgi havuzuna ulaşılamadı. Sunucuyu kontrol edin.";
    }

    chat.scrollTop = chat.scrollHeight;
}

function addMessage(message, className) {
    const div = document.createElement("div");
    div.className = className;
    div.textContent = message;
    chat.appendChild(div);
}

function askExample(question) {
    userInput.value = question;
    sendMessage();
}

userInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
