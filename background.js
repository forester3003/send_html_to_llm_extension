// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendToLLM") {
      const { apiKey, endpoint, prompt } = request;
      if (!apiKey || !endpoint) {
          sendResponse({ error: "APIキーまたはエンドポイントが設定されていません" });
          return;
      }

      chrome.storage.local.get(['apiConfig'], (result) => {
          const model = result.apiConfig.model || 'gpt-4o-mini'; // デフォルトを設定

          fetch(endpoint, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                  model: model,
                  messages: [{ role: "user", content: prompt }]
              })
          })
          .then(response => response.json())
          .then(data => sendResponse({ response: data.choices[0].message.content }))
          .catch(error => sendResponse({ error: error.message }));
      });

      return true;
  }

  // 🔹 拡張機能のオン/オフ制御
  if (request.action === "enable") {
      chrome.storage.local.set({ extensionEnabled: true }, injectContentScript);
  } else if (request.action === "disable") {
      chrome.storage.local.set({ extensionEnabled: false }, removeContentScript);
  }
});

// 🔹 content.js を現在のタブに注入
function injectContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"]
      });
  });
}

// 🔹 content.js の影響を削除
function removeContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
              document.getElementById("my-overlay")?.remove();
          }
      });
  });
}

// 🔹 タブが更新されたときに拡張機能の状態をチェック
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
      chrome.storage.local.get(["extensionEnabled"], (result) => {
          if (result.extensionEnabled) {
              chrome.scripting.executeScript({
                  target: { tabId },
                  files: ["content.js"]
              });
          }
      });
  }
});
