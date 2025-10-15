
import { analytics } from './utils/baidu-analytics';

// 扩展安装时的统计上报
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 扩展首次安装
    analytics.trackInstall().catch(console.warn);
    analytics.trackPageView('/extension/installed', 'Extension Installed').catch(console.warn);
  } else if (details.reason === 'update') {
    // 扩展更新
    analytics.trackPageView(`/extension/updated/${details.previousVersion}-to-${chrome.runtime.getManifest().version}`, `扩展更新-${details.previousVersion}-to-${chrome.runtime.getManifest().version}`).catch(console.warn);
  }
});

// 扩展启动时的统计上报
chrome.runtime.onStartup.addListener(() => {
  analytics.trackPageView('/extension/startup', '扩展启动').catch(console.warn);
});

/**
 * @description 监听来自内容脚本的消息
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[background.ts] Received message:', msg);
    let tabId: number | undefined;
    if (sender && sender.tab) tabId = sender.tab.id;

    switch (msg.type) {
        case 'getCookies':
            if (!msg.fieldName || !msg.url) {
                console.error('[background.ts] Invalid getCookies message:', msg);
                sendResponse({ error: 'Invalid parameters for getCookies' });
                return false; // 同步返回false表示不会异步发送响应
            }
            getCookies(msg.fieldName, msg.url).then((content) => {
                console.log(`[background.ts] Sending cookie response for ${msg.fieldName}:`, content);
                sendResponse({ fieldValue: content });
            }).catch(error => {
                console.error('[background.ts] Error getting cookies:', error);
                sendResponse({ error: error.message });
            });
            return true; // 异步返回响应

        case 'fetch':
            if (!msg.url) {
                console.error('[background.ts] Invalid fetch message: URL is missing');
                sendResponse({ error: 'URL is required for fetch' });
                return false;
            }
            console.log(`[background.ts] Fetching URL: ${msg.url}`);
            fetch(msg.url, msg.init).then(resp => {
                if (!resp.ok) {
                    console.error(`[background.ts] Fetch failed with status: ${resp.status}`);
                    throw new Error(`Fetch failed with status: ${resp.status}`);
                }
                console.log('[background.ts] Fetch response:', resp);
                let contentType = msg.init?.headers?.['content-type'] || resp.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    return resp.json();
                } else if (contentType?.includes('text/plain')) {
                    return resp.text();
                } else {
                    return resp.blob(); // 默认处理为二进制数据
                }
            }).then(data => {
                console.log('[background.ts] Sending fetch data response:', data);
                sendResponse({ data: data });
            }).catch(error => {
                console.error('[background.ts] Fetch error:', error);
                sendResponse({ error: error.message });
            });
            return true; // 异步返回响应

        default:
            console.warn('[background.ts] Unknown message type:', msg.type);
            sendResponse({ error: `Unknown message type: ${msg.type}` });
            return false;
    }
});

/**
 * @description 向内容脚本发送消息
 * @param sendMsg 包含tabId和message的对象
 * @returns 返回一个Promise，解析为内容脚本的响应
 */
async function sendMessage(sendMsg: { tabId?: number; message: any; }) {
    console.log('[background.ts] Sending message:', sendMsg);
    return new Promise((resolve, reject) => {
        const callbackHandler = (response: any) => {
            if (chrome.runtime.lastError) {
                console.error('[background.ts] sendMessage error:', chrome.runtime.lastError);
                return reject(chrome.runtime.lastError);
            }
            if (response) {
                console.log('[background.ts] Received response for message:', response);
                return resolve(response);
            }
        }

        if (sendMsg.tabId !== undefined) {
            chrome.tabs.sendMessage(sendMsg.tabId, sendMsg.message, callbackHandler);
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || tabs.length === 0 || !tabs[0].id) {
                    console.error('[background.ts] No active tab found to send message.');
                    return reject(new Error('No active tab found'));
                }
                chrome.tabs.sendMessage(tabs[0].id, sendMsg.message, callbackHandler);
            });
        }
    }).catch((error) => {
        console.error('[background.ts] sendMessage promise rejected:', error);
    });
}

/**
 * @description 从本地存储中获取数据
 * @param key 要获取的数据的键
 * @returns 返回一个Promise，解析为存储的数据
 */
async function getLocalStorageData(key: string | string[] | { [key: string]: any; } | null) {
    console.log(`[background.ts] Getting local storage data for key:`, key);
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            console.log(`[background.ts] Got local storage data:`, result);
            resolve(result);
        });
    });
}

/**
 * @description 暂停执行指定的毫秒数
 * @param ms 暂停的毫秒数
 * @returns 返回一个在指定时间后解析的Promise
 */
function sleep(ms: number): Promise<void> {
    console.log(`[background.ts] Sleeping for ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @description 获取指定URL的Cookie
 * @param fieldName Cookie的名称
 * @param url Cookie所在的URL
 * @returns 返回一个Promise，解析为Cookie的值，如果不存在则为null
 */
async function getCookies(fieldName: string, url: string): Promise<string | null> {
    console.log(`[background.ts] Getting cookie '${fieldName}' for URL '${url}'`);
    return new Promise((resolve, reject) => {
        chrome.cookies.get({ name: fieldName, url: url }, (cookie) => {
            if (chrome.runtime.lastError) {
                console.error('[background.ts] getCookies error:', chrome.runtime.lastError);
                return reject(chrome.runtime.lastError);
            }
            const fieldValue = cookie ? cookie.value : null;
            console.log(`[background.ts] Got cookie value: ${fieldValue}`);
            resolve(fieldValue);
        });
    });
}