// options.js

// テンプレートとAPI設定をchrome.storage.localから読み込む
function loadData(callback) {
  chrome.storage.local.get(['promptTemplates', 'apiConfig'], (result) => {
      const templates = result.promptTemplates || [];
      const apiConfig = result.apiConfig || {};
      callback(templates, apiConfig);
  });

// モデル設定保存
document.getElementById('saveModelButton').addEventListener('click', () => {
    const model = document.getElementById('modelSelect').value;
    chrome.storage.local.get(['apiConfig'], (result) => {
        const apiConfig = result.apiConfig || {};
        apiConfig.model = model;
        chrome.storage.local.set({ apiConfig }, () => {
            alert('モデルが保存されました');
        });
    });
});
}

// テンプレートリストを更新
function renderTemplates(templates) {
  const templateList = document.getElementById('templateList');
  templateList.innerHTML = '';

  templates.forEach((template, index) => {
      const li = document.createElement('li');
      li.textContent = template.text;
      li.title = template.text; // ツールチップで全文表示
      li.dataset.index = index;

      // クリックで全文表示
      li.addEventListener('click', () => {
          if (li.style.whiteSpace === 'normal') {
              li.style.whiteSpace = 'nowrap';
              li.style.overflow = 'hidden';
              li.style.textOverflow = 'ellipsis';
              li.style.display = '-webkit-box';
              li.style.webkitLineClamp = '2';
          } else {
              li.style.whiteSpace = 'normal';
              li.style.overflow = 'visible';
              li.style.textOverflow = 'unset';
              li.style.display = 'block';
          }
      });

      // 編集・削除ボタン
      const actions = document.createElement('span');
      actions.classList.add('template-actions');

      const editButton = document.createElement('button');
      editButton.textContent = '✏️';
      editButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const newText = prompt('テンプレートを編集', template.text);
          if (newText !== null) {
              templates[index].text = newText;
              saveTemplates(templates);
          }
      });

      const deleteButton = document.createElement('button');
      deleteButton.textContent = '🗑️';
      deleteButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('このテンプレートを削除しますか？')) {
              templates.splice(index, 1);
              saveTemplates(templates);
          }
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      li.appendChild(actions);
      templateList.appendChild(li);
  });
}

// テンプレートを保存
function saveTemplates(templates) {
  chrome.storage.local.set({ promptTemplates: templates }, () => {
      renderTemplates(templates);
  });
}

// 初回データロード
loadData((templates, apiConfig) => {
  renderTemplates(templates);

  // API設定を入力フィールドに反映
    document.getElementById('apiEndpoint').value = apiConfig.endpoint || '';
    document.getElementById('apiKey').value = apiConfig.apiKey || '';
    document.getElementById('modelSelect').value = apiConfig.model || 'gpt-4'; // デフォルトを設定
});

// 「追加」ボタンのクリックイベント
document.getElementById('addTemplateButton').addEventListener('click', () => {
  const newTemplateText = document.getElementById('newTemplate').value;
  if (newTemplateText) {
      chrome.storage.local.get(['promptTemplates'], (result) => {
          const templates = result.promptTemplates || [];
          templates.push({ text: newTemplateText });
          saveTemplates(templates);
          document.getElementById('newTemplate').value = '';
      });
  }
});

// 「${inputHtml}」をカーソル位置に挿入
document.getElementById('insertVariableButton').addEventListener('click', () => {
  const textarea = document.getElementById('newTemplate');
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const text = textarea.value;

  textarea.value = text.substring(0, startPos) + '${inputHtml}' + text.substring(endPos);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = startPos + '${inputHtml}'.length;
});

// 検索フィルター
document.getElementById('searchTemplate').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  chrome.storage.local.get(['promptTemplates'], (result) => {
      const templates = result.promptTemplates || [];
      const filteredTemplates = templates.filter(t => t.text.toLowerCase().includes(searchTerm));
      renderTemplates(filteredTemplates);
  });
});

// API設定保存
document.getElementById('saveApiConfigButton').addEventListener('click', () => {
  const endpoint = document.getElementById('apiEndpoint').value;
  const apiKey = document.getElementById('apiKey').value;
  chrome.storage.local.set({ apiConfig: { endpoint, apiKey } }, () => {
      alert('設定が保存されました');
  });
});
