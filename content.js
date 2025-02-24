// content.js
let selectedElement = null;
let overlay = null;
let isDragging = false;
let currentX, currentY, initialX, initialY;
let isSelectionMode = true;
let isShowingElement = true;
let selectedTemplateIndex = 0; // 選択中のテンプレートインデックス

// 選択中の要素に適用するスタイル
const selectedStyle = {
    backgroundColor: 'rgba(255, 255, 0, 0.3)',
    border: '2px solid red'
};

// オーバーレイを作成する関数
function createOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "my-overlay";
    Object.assign(overlay.style, {
        position: "fixed",
        top: "10px",
        right: "10px",
        width: "400px",
        height: "250px",
        backgroundColor: "white",
        border: "1px solid black",
        zIndex: "10000",
        padding: "10px",
        boxSizing: "border-box"
    });
    overlay.innerHTML = `
        <h1 id="overlay-header" style="font-size: 16px; margin: 0 0 10px 0; cursor: move; color: black; display: flex; justify-content: space-between; align-items: center;">
            <span id="overlay-title">要素の情報</span>
            <div>
                <button id="toggle-mode" style="font-size: 12px; padding: 2px 5px;">選択モード: ON</button>
                <button id="prompt-template" style="font-size: 12px; padding: 2px 5px; margin-left: 5px;">テンプレート</button>
                <button id="send-button" style="font-size: 12px; padding: 2px 5px; margin-left: 5px;">送信</button>
            </div>
        </h1>
        <div id="element-info"></div>
    `;
    document.body.appendChild(overlay);

    // 初期位置を設定
    currentX = window.innerWidth - 410;
    currentY = 10;
    overlay.style.left = `${currentX}px`;
    overlay.style.top = `${currentY}px`;
    overlay.style.right = "auto";

    // モード切替ボタン
    const toggleButton = document.getElementById("toggle-mode");
    toggleButton.addEventListener("click", () => {
        isSelectionMode = !isSelectionMode;
        toggleButton.textContent = `選択モード: ${isSelectionMode ? "ON" : "OFF"}`;
    });

    // プロンプトテンプレートボタン
    const promptButton = document.getElementById("prompt-template");
    promptButton.addEventListener("click", () => {
      isShowingElement = !isShowingElement;
      promptButton.textContent = isShowingElement ? "テンプレート" : "要素の情報";
      document.getElementById("overlay-title").textContent = isShowingElement ? "要素の情報" : "テンプレート";
  
      if (isShowingElement) {
          updateOverlay(selectedElement ? selectedElement.outerHTML : "要素が選択されていません");
      } else {
          chrome.storage.local.get(['promptTemplates'], (result) => {
              const templates = result.promptTemplates || [];
              if (templates.length === 0) {
                  updateOverlay("テンプレートが登録されていません");
                  return;
              }
  
              const templateList = document.createElement("div");
              templateList.style.maxHeight = "180px";
              templateList.style.overflowY = "auto";
  
              templates.forEach((template, index) => {
                  const templateDiv = document.createElement("div");
                  templateDiv.style.padding = "5px";
                  templateDiv.style.cursor = "pointer";
                  templateDiv.style.borderBottom = "1px solid #ddd";
                  templateDiv.style.overflow = "hidden";
                  templateDiv.style.display = "-webkit-box";
                  templateDiv.style.webkitBoxOrient = "vertical";
                  templateDiv.style.webkitLineClamp = "2"; // 2行で省略
                  templateDiv.style.textOverflow = "ellipsis";
                  templateDiv.style.whiteSpace = "pre-wrap";
                  templateDiv.textContent = template.text;
  
                  if (index === selectedTemplateIndex) {
                      templateDiv.style.backgroundColor = "#e0e0e0";
                  }
  
                  templateDiv.addEventListener("click", () => {
                      selectedTemplateIndex = index;
                      Array.from(templateList.children).forEach((child, i) => {
                          child.style.backgroundColor = i === index ? "#e0e0e0" : "transparent";
                          child.style.webkitLineClamp = i === index ? "unset" : "2"; // 選択時は全文表示
                      });
                  });
  
                  templateList.appendChild(templateDiv);
              });
  
              const infoDiv = document.getElementById("element-info");
              infoDiv.innerHTML = "";
              infoDiv.appendChild(templateList);
          });
      }
    });

    // 送信ボタン
    const sendButton = document.getElementById("send-button");
    sendButton.addEventListener("click", () => {
      if (!selectedElement) {
          updateOverlay("要素が選択されていません");
          document.getElementById("overlay-title").textContent = "エラー";
          return;
      }
  
      chrome.storage.local.get(['promptTemplates', 'apiConfig'], (result) => {
          const templates = result.promptTemplates || [];
          const apiConfig = result.apiConfig || {};
          if (templates.length === 0 || selectedTemplateIndex < 0) {
              updateOverlay("テンプレートが登録されていません");
              document.getElementById("overlay-title").textContent = "エラー";
              return;
          }
  
          const template = templates[selectedTemplateIndex].text;
  
          // 選択した要素のクリーンなHTMLを取得
          const cleanHtml = cleanElementHtml(selectedElement); // 不要な属性を除外
  
          // プロンプトを生成
          const promptText = template.replace("${inputHtml}", cleanHtml);
  
          // モーダルウィンドウを作成して表示
          showPromptModal(promptText, (editedPrompt) => {
              if (editedPrompt === null) return; // キャンセル時は送信しない
  
              // background.js に送信
              chrome.runtime.sendMessage({
                  action: "sendToLLM",
                  apiKey: apiConfig.apiKey,
                  endpoint: apiConfig.endpoint,
                  prompt: editedPrompt
              }, (response) => {
                  if (response.error) {
                      updateOverlay(`エラー: ${response.error}`);
                      document.getElementById("overlay-title").textContent = "エラー";
                  } else {
                      // updateOverlay(response.response);
                      displayLLMResponse(response.response);
                      document.getElementById("overlay-title").textContent = "LLM応答";
                  }
              });
          });
      });
    });

    // ドラッグ機能をh1に限定
    const header = document.getElementById("overlay-header");
    header.addEventListener("mousedown", startDragging);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDragging);

    // 初期状態で内容エリアのスタイルを設定
    const infoDiv = document.getElementById("element-info");
    Object.assign(infoDiv.style, {
        color: "black",
        overflow: "auto",
        maxHeight: "180px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
    });
}

// ドラッグ開始
function startDragging(event) {
    if (event.target.tagName === "BUTTON") return;
    isDragging = true;
    initialX = event.clientX - currentX;
    initialY = event.clientY - currentY;
    overlay.style.cursor = "grabbing";
}

// ドラッグ中
function drag(event) {
    if (!isDragging) return;
    event.preventDefault();
    currentX = event.clientX - initialX;
    currentY = event.clientY - initialY;
    overlay.style.left = `${currentX}px`;
    overlay.style.top = `${currentY}px`;
}

// ドラッグ終了
function stopDragging() {
    isDragging = false;
    overlay.style.cursor = "move";
}

// オーバーレイを更新(テキスト)
function updateOverlay(html) {
    const infoDiv = document.getElementById("element-info");
    if (infoDiv) {
        infoDiv.innerHTML = ""; // 子要素をクリア
        infoDiv.textContent = html;
    }
}

// オーバーレイを更新(HTML)
function updateOverlayHtml(html) {
  const infoDiv = document.getElementById("element-info");
  if (infoDiv) {
      infoDiv.innerHTML = ""; // 子要素をクリア
      infoDiv.innerHTML = html;
  }
}

// ページ読み込み時にオーバーレイを表示
createOverlay();

// 要素選択用のクリックイベントリスナー
document.addEventListener("click", (event) => {
    if (!isSelectionMode) return;

    if (overlay && overlay.contains(event.target)) return;

    if (selectedElement) {
        Object.assign(selectedElement.style, {
            backgroundColor: "",
            border: ""
        });
    }
    selectedElement = event.target;
    Object.assign(selectedElement.style, selectedStyle);
    if (isShowingElement) {
        updateOverlay(selectedElement.outerHTML);
        document.getElementById("overlay-title").textContent = "要素の情報";
    }
});

// ページのクリックイベントを制御
document.addEventListener(
    "click",
    (event) => {
        if (!isSelectionMode) {
            if (event.target !== selectedElement && !overlay?.contains(event.target)) {
                if (selectedElement) {
                    Object.assign(selectedElement.style, {
                        backgroundColor: "",
                        border: ""
                    });
                    selectedElement = null;
                }
            }
            return;
        }

        if (overlay && !overlay.contains(event.target)) {
            event.preventDefault();
        }
    },
    true
);

// キーイベントリスナー
document.addEventListener("keydown", (event) => {
    if (!isSelectionMode || !selectedElement) return;

    let newElement = null;
    switch (event.key) {
        case "ArrowLeft":
            newElement = selectedElement.parentElement;
            break;
        case "ArrowRight":
            newElement = selectedElement.children[0];
            break;
        case "ArrowUp":
            newElement = selectedElement.previousElementSibling;
            break;
        case "ArrowDown":
            newElement = selectedElement.nextElementSibling;
            break;
    }

    if (newElement) {
        Object.assign(selectedElement.style, {
            backgroundColor: "",
            border: ""
        });
        selectedElement = newElement;
        Object.assign(selectedElement.style, selectedStyle);
        if (isShowingElement) {
            updateOverlay(selectedElement.outerHTML);
            document.getElementById("overlay-title").textContent = "要素の情報";
        }
    }
});

function showPromptModal(initialText, callback) {
  // 既存のモーダルがあれば削除
  const existingModal = document.getElementById("prompt-modal");
  if (existingModal) {
      existingModal.remove();
  }

  // モーダルの作成
  const modal = document.createElement("div");
  modal.id = "prompt-modal";
  Object.assign(modal.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "500px",
      height: "300px",
      backgroundColor: "white",
      border: "1px solid black",
      zIndex: "10001",
      padding: "10px",
      boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
      display: "flex",
      flexDirection: "column"
  });

  // タイトル
  const title = document.createElement("h2");
  title.textContent = "送信前の確認";
  title.style.margin = "0 0 10px 0";
  modal.appendChild(title);

  // テキストエリア
  const textarea = document.createElement("textarea");
  textarea.style.width = "100%";
  textarea.style.height = "180px";
  textarea.style.resize = "none";
  textarea.value = initialText;
  modal.appendChild(textarea);

  // ボタンエリア
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "space-between";
  buttonContainer.style.marginTop = "10px";

  // キャンセルボタン
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "キャンセル";
  cancelButton.style.flex = "1";
  cancelButton.style.marginRight = "5px";
  cancelButton.addEventListener("click", (event) => {
      event.stopPropagation(); // 要素選択を防ぐ
      document.body.removeChild(modal);
      callback(null);
  });

  // 送信ボタン
  const sendButton = document.createElement("button");
  sendButton.textContent = "送信";
  sendButton.style.flex = "1";
  sendButton.addEventListener("click", (event) => {
      event.stopPropagation(); // 要素選択を防ぐ
      callback(textarea.value);
      document.body.removeChild(modal);
  });

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(sendButton);
  modal.appendChild(buttonContainer);

  // モーダルのクリックを無視するようにする
  modal.addEventListener("click", (event) => {
      event.stopPropagation(); // 要素選択の発生を防ぐ
  });

  textarea.addEventListener("click", (event) => {
      event.stopPropagation(); // クリック時の選択防止
  });

  // モーダルを追加
  document.body.appendChild(modal);
}

// LLM応答を表示する関数
function displayLLMResponse(responseText) {
  updateOverlayHtml(`
      <pre style="white-space: pre-wrap; word-break: break-word; margin: 0; padding: 0; line-height: 1.2;">${responseText}</pre>
      <button id="copy-response" style="font-size: 12px; display: block; margin-left: auto;">コピー</button>
  `);
  document.getElementById("overlay-title").textContent = "LLM応答";

  // コピー機能を追加
  document.getElementById("copy-response").addEventListener("click", () => {
      navigator.clipboard.writeText(responseText).then(() => {
          alert("コピーしました！");
      }).catch(err => {
          console.error("コピー失敗:", err);
      });
  });
}

function cleanElementHtml(element) {
  if (!element) return "";

  // クローンを作成して元の要素を変更しないようにする
  let clone = element.cloneNode(true);

  // 再帰的に不要な属性を削除
  function removeUnnecessaryAttributes(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
          // 削除する属性リスト
          const attributesToRemove = ["class", "id", "style"];
          
          // `data-` で始まる属性も削除
          Array.from(node.attributes).forEach(attr => {
              if (attributesToRemove.includes(attr.name) || attr.name.startsWith("data-")) {
                  node.removeAttribute(attr.name);
              }
          });

          // 子要素にも適用
          node.childNodes.forEach(removeUnnecessaryAttributes);
      }
  }

  removeUnnecessaryAttributes(clone);

  return clone.outerHTML;
}
