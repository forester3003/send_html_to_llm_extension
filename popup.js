document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("toggle-extension");

    // 保存された状態を取得
    chrome.storage.local.get(["extensionEnabled"], (result) => {
        toggle.checked = result.extensionEnabled ?? false; // デフォルトは OFF
    });

    // チェックボックス変更時の処理
    toggle.addEventListener("change", () => {
        const enabled = toggle.checked;
        chrome.storage.local.set({ extensionEnabled: enabled });

        // background.js に通知
        chrome.runtime.sendMessage({ action: enabled ? "enable" : "disable" });
    });
});
