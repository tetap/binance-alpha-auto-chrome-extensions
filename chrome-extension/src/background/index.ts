import 'webextension-polyfill';

chrome.action.onClicked.addListener(async tab => {
  // 将 side panel 与当前 tab 绑定，并显示
  await chrome.sidePanel.open({ tabId: tab.id! });
});
