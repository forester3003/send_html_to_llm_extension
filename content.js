// content.js
/**
 * Chrome拡張機能：HTML要素選択ツール
 * 
 * 機能：
 * - ページ上の要素を選択して情報を表示
 * - 選択した要素にテンプレートを適用してLLMに送信
 * - レスポンスの表示とコピー
 */

// 状態管理
const state = {
    selectedElement: null,
    overlay: null,
    isDragging: false,
    currentX: 0,
    currentY: 0,
    initialX: 0,
    initialY: 0,
    isSelectionMode: true,
    isShowingElement: true,
    selectedTemplateIndex: 0
  };
  
  // 定数
  const CONSTANTS = {
    SELECTED_STYLE: {
      backgroundColor: 'rgba(255, 255, 0, 0.3)',
      border: '2px solid red'
    },
    OVERLAY_STYLE: {
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
    },
    INFO_DIV_STYLE: {
      color: "black",
      overflow: "auto",
      maxHeight: "180px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }
  };
  
  /**
   * メイン初期化関数
   */
  function initialize() {
    createOverlay();
    setupEventListeners();
  }
  
  /**
   * オーバーレイを作成する関数
   */
  function createOverlay() {
    if (state.overlay) return;
    
    state.overlay = document.createElement("div");
    state.overlay.id = "my-overlay";
    Object.assign(state.overlay.style, CONSTANTS.OVERLAY_STYLE);
    
    state.overlay.innerHTML = `
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
    
    document.body.appendChild(state.overlay);
  
    // 初期位置を設定
    state.currentX = window.innerWidth - 410;
    state.currentY = 10;
    state.overlay.style.left = `${state.currentX}px`;
    state.overlay.style.top = `${state.currentY}px`;
    state.overlay.style.right = "auto";
  
    setupOverlayButtons();
    setupInfoDivStyle();
  }
  
  /**
   * オーバーレイのボタン設定
   */
  function setupOverlayButtons() {
    // モード切替ボタン
    const toggleButton = document.getElementById("toggle-mode");
    toggleButton.addEventListener("click", toggleSelectionMode);
  
    // プロンプトテンプレートボタン
    const promptButton = document.getElementById("prompt-template");
    promptButton.addEventListener("click", toggleTemplateView);
  
    // 送信ボタン
    const sendButton = document.getElementById("send-button");
    sendButton.addEventListener("click", handleSendButtonClick);
  }
  
  /**
   * 選択モードの切り替え
   */
  function toggleSelectionMode() {
    state.isSelectionMode = !state.isSelectionMode;
    document.getElementById("toggle-mode").textContent = `選択モード: ${state.isSelectionMode ? "ON" : "OFF"}`;
  }
  
  /**
   * 表示モード（要素情報/テンプレート）の切り替え
   */
  function toggleTemplateView() {
    state.isShowingElement = !state.isShowingElement;
    const promptButton = document.getElementById("prompt-template");
    promptButton.textContent = state.isShowingElement ? "テンプレート" : "要素の情報";
    document.getElementById("overlay-title").textContent = state.isShowingElement ? "要素の情報" : "テンプレート";
  
    if (state.isShowingElement) {
      updateOverlayText(state.selectedElement ? state.selectedElement.outerHTML : "要素が選択されていません");
    } else {
      loadAndDisplayTemplates();
    }
  }
  
  /**
   * テンプレートの読み込みと表示
   */
  function loadAndDisplayTemplates() {
    chrome.storage.local.get(['promptTemplates'], (result) => {
      const templates = result.promptTemplates || [];
      if (templates.length === 0) {
        updateOverlayText("テンプレートが登録されていません");
        return;
      }
  
      const templateList = createTemplateList(templates);
      const infoDiv = document.getElementById("element-info");
      infoDiv.innerHTML = "";
      infoDiv.appendChild(templateList);
    });
  }
  
  /**
   * テンプレートリストの作成
   * @param {Array} templates テンプレート配列
   * @returns {HTMLElement} テンプレートリスト要素
   */
  function createTemplateList(templates) {
    const templateList = document.createElement("div");
    templateList.style.maxHeight = "180px";
    templateList.style.overflowY = "auto";
  
    templates.forEach((template, index) => {
      const templateDiv = createTemplateItem(template, index);
      templateList.appendChild(templateDiv);
    });
  
    return templateList;
  }
  
  /**
   * テンプレート項目の作成
   * @param {Object} template テンプレート情報
   * @param {number} index テンプレートのインデックス
   * @returns {HTMLElement} テンプレート項目要素
   */
  function createTemplateItem(template, index) {
    const templateDiv = document.createElement("div");
    Object.assign(templateDiv.style, {
      padding: "5px",
      cursor: "pointer",
      borderBottom: "1px solid #ddd",
      overflow: "hidden",
      display: "-webkit-box",
      webkitBoxOrient: "vertical",
      webkitLineClamp: "2", // 2行で省略
      textOverflow: "ellipsis",
      whiteSpace: "pre-wrap"
    });
    
    templateDiv.textContent = template.text;
  
    if (index === state.selectedTemplateIndex) {
      templateDiv.style.backgroundColor = "#e0e0e0";
    }
  
    templateDiv.addEventListener("click", () => {
      state.selectedTemplateIndex = index;
      updateTemplateSelection(templateDiv, index);
    });
  
    return templateDiv;
  }
  
  /**
   * テンプレート選択状態の更新
   * @param {HTMLElement} selectedDiv 選択されたテンプレート要素
   * @param {number} selectedIndex 選択されたインデックス
   */
  function updateTemplateSelection(selectedDiv, selectedIndex) {
    const templateList = selectedDiv.parentElement;
    Array.from(templateList.children).forEach((child, i) => {
      child.style.backgroundColor = i === selectedIndex ? "#e0e0e0" : "transparent";
      child.style.webkitLineClamp = i === selectedIndex ? "unset" : "2"; // 選択時は全文表示
    });
  }
  
  /**
   * 送信ボタンクリック時の処理
   */
  function handleSendButtonClick() {
    if (!state.selectedElement) {
      updateOverlayText("要素が選択されていません");
      document.getElementById("overlay-title").textContent = "エラー";
      return;
    }
  
    chrome.storage.local.get(['promptTemplates', 'apiConfig'], (result) => {
      const templates = result.promptTemplates || [];
      const apiConfig = result.apiConfig || {};
      
      if (templates.length === 0 || state.selectedTemplateIndex < 0) {
        updateOverlayText("テンプレートが登録されていません");
        document.getElementById("overlay-title").textContent = "エラー";
        return;
      }
  
      const template = templates[state.selectedTemplateIndex].text;
      const cleanHtml = cleanElementHtml(state.selectedElement);
      const promptText = template.replace("${inputHtml}", cleanHtml);
  
      showPromptModal(promptText, (editedPrompt) => {
        if (editedPrompt === null) return; // キャンセル時は送信しない
  
        sendPromptToLLM(editedPrompt, apiConfig);
      });
    });
  }
  
  /**
   * プロンプトをLLMに送信
   * @param {string} prompt 送信するプロンプト
   * @param {Object} apiConfig API設定
   */
  function sendPromptToLLM(prompt, apiConfig) {
    chrome.runtime.sendMessage({
      action: "sendToLLM",
      apiKey: apiConfig.apiKey,
      endpoint: apiConfig.endpoint,
      prompt: prompt
    }, (response) => {
      if (response.error) {
        updateOverlayText(`エラー: ${response.error}`);
        document.getElementById("overlay-title").textContent = "エラー";
      } else {
        displayLLMResponse(response.response);
      }
    });
  }
  
  /**
   * 情報表示エリアのスタイル設定
   */
  function setupInfoDivStyle() {
    const infoDiv = document.getElementById("element-info");
    Object.assign(infoDiv.style, CONSTANTS.INFO_DIV_STYLE);
  }
  
  /**
   * イベントリスナーの設定
   */
  function setupEventListeners() {
    // ドラッグ機能をヘッダーに限定
    const header = document.getElementById("overlay-header");
    header.addEventListener("mousedown", startDragging);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDragging);
  
    // 要素選択用のクリックイベントリスナー
    document.addEventListener("click", handleElementSelection);
  
    // ページのクリックイベントを制御
    document.addEventListener("click", handlePageClick, true);
  
    // キーイベントリスナー
    document.addEventListener("keydown", handleKeyNavigation);
  }
  
  /**
   * ドラッグ開始処理
   * @param {Event} event マウスイベント
   */
  function startDragging(event) {
    if (event.target.tagName === "BUTTON") return;
    
    state.isDragging = true;
    state.initialX = event.clientX - state.currentX;
    state.initialY = event.clientY - state.currentY;
    state.overlay.style.cursor = "grabbing";
  }
  
  /**
   * ドラッグ中処理
   * @param {Event} event マウスイベント
   */
  function drag(event) {
    if (!state.isDragging) return;
    
    event.preventDefault();
    state.currentX = event.clientX - state.initialX;
    state.currentY = event.clientY - state.initialY;
    state.overlay.style.left = `${state.currentX}px`;
    state.overlay.style.top = `${state.currentY}px`;
  }
  
  /**
   * ドラッグ終了処理
   */
  function stopDragging() {
    state.isDragging = false;
    state.overlay.style.cursor = "move";
  }
  
  /**
   * 要素選択処理
   * @param {Event} event クリックイベント
   */
  function handleElementSelection(event) {
    if (!state.isSelectionMode) return;
    if (state.overlay && state.overlay.contains(event.target)) return;
  
    clearSelectedElementStyle();
    
    state.selectedElement = event.target;
    applySelectedElementStyle();
    
    if (state.isShowingElement) {
      updateOverlayText(state.selectedElement.outerHTML);
      document.getElementById("overlay-title").textContent = "要素の情報";
    }
  }
  
  /**
   * ページクリック処理
   * @param {Event} event クリックイベント
   */
  function handlePageClick(event) {
    if (!state.isSelectionMode) {
      if (event.target !== state.selectedElement && 
          !state.overlay?.contains(event.target)) {
        clearSelectedElementStyle();
        state.selectedElement = null;
      }
      return;
    }
  
    if (state.overlay && !state.overlay.contains(event.target)) {
      event.preventDefault();
    }
  }
  
  /**
   * キーボードナビゲーション処理
   * @param {KeyboardEvent} event キーボードイベント
   */
  function handleKeyNavigation(event) {
    if (!state.isSelectionMode || !state.selectedElement) return;
  
    let newElement = null;
    switch (event.key) {
      case "ArrowLeft":
        newElement = state.selectedElement.parentElement;
        break;
      case "ArrowRight":
        newElement = state.selectedElement.children[0];
        break;
      case "ArrowUp":
        newElement = state.selectedElement.previousElementSibling;
        break;
      case "ArrowDown":
        newElement = state.selectedElement.nextElementSibling;
        break;
    }
  
    if (newElement) {
      clearSelectedElementStyle();
      state.selectedElement = newElement;
      applySelectedElementStyle();
      
      if (state.isShowingElement) {
        updateOverlayText(state.selectedElement.outerHTML);
        document.getElementById("overlay-title").textContent = "要素の情報";
      }
    }
  }
  
  /**
   * 選択要素のスタイルをクリア
   */
  function clearSelectedElementStyle() {
    if (state.selectedElement) {
      Object.assign(state.selectedElement.style, {
        backgroundColor: "",
        border: ""
      });
    }
  }
  
  /**
   * 選択要素にスタイルを適用
   */
  function applySelectedElementStyle() {
    if (state.selectedElement) {
      Object.assign(state.selectedElement.style, CONSTANTS.SELECTED_STYLE);
    }
  }
  
  /**
   * オーバーレイをテキストで更新
   * @param {string} text 表示するテキスト
   */
  function updateOverlayText(text) {
    const infoDiv = document.getElementById("element-info");
    if (infoDiv) {
      infoDiv.innerHTML = ""; // 子要素をクリア
      infoDiv.textContent = text;
    }
  }
  
  /**
   * オーバーレイをHTMLで更新
   * @param {string} html 表示するHTML
   */
  function updateOverlayHtml(html) {
    const infoDiv = document.getElementById("element-info");
    if (infoDiv) {
      infoDiv.innerHTML = ""; // 子要素をクリア
      infoDiv.innerHTML = html;
    }
  }
  
  /**
   * プロンプト確認モーダルを表示
   * @param {string} initialText 初期テキスト
   * @param {Function} callback コールバック関数
   */
  function showPromptModal(initialText, callback) {
    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById("prompt-modal");
    if (existingModal) {
      existingModal.remove();
    }
  
    // モーダルの作成
    const modal = createModalElement();
    modal.appendChild(createModalTitle());
    
    const textarea = createModalTextarea(initialText);
    modal.appendChild(textarea);
    
    const buttonContainer = createModalButtonContainer(modal, textarea, callback);
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
  
  /**
   * モーダル要素を作成
   * @returns {HTMLElement} モーダル要素
   */
  function createModalElement() {
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
    
    return modal;
  }
  
  /**
   * モーダルタイトルを作成
   * @returns {HTMLElement} タイトル要素
   */
  function createModalTitle() {
    const title = document.createElement("h2");
    title.textContent = "送信前の確認";
    title.style.margin = "0 0 10px 0";
    return title;
  }
  
  /**
   * モーダルテキストエリアを作成
   * @param {string} initialText 初期テキスト
   * @returns {HTMLElement} テキストエリア要素
   */
  function createModalTextarea(initialText) {
    const textarea = document.createElement("textarea");
    textarea.style.width = "100%";
    textarea.style.height = "180px";
    textarea.style.resize = "none";
    textarea.value = initialText;
    return textarea;
  }
  
  /**
   * モーダルボタンコンテナを作成
   * @param {HTMLElement} modal モーダル要素
   * @param {HTMLElement} textarea テキストエリア要素
   * @param {Function} callback コールバック関数
   * @returns {HTMLElement} ボタンコンテナ要素
   */
  function createModalButtonContainer(modal, textarea, callback) {
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
    
    return buttonContainer;
  }
  
  /**
   * LLM応答を表示する関数
   * @param {string} responseText 応答テキスト
   */
  function displayLLMResponse(responseText) {
    updateOverlayHtml(`
      <pre style="white-space: pre-wrap; word-break: break-word; margin: 0; padding: 0; line-height: 1.2;">${responseText}</pre>
      <button id="copy-response" style="font-size: 12px; display: block; margin-left: auto;">コピー</button>
    `);
    document.getElementById("overlay-title").textContent = "LLM応答";
  
    // コピー機能を追加
    document.getElementById("copy-response").addEventListener("click", () => {
      navigator.clipboard.writeText(responseText)
        .then(() => {
          alert("コピーしました！");
        })
        .catch(err => {
          console.error("コピー失敗:", err);
        });
    });
  }
  
  /**
   * HTML要素から不要な属性を削除
   * @param {HTMLElement} element クリーンにする要素
   * @returns {string} クリーンなHTML
   */
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
  
  // 初期化実行
  initialize();