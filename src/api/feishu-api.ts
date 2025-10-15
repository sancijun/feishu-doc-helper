import { v4 as uuidv4 } from 'uuid';
import {getFileExtensionByObjType, getFileTypeByObjType, sleep} from '../utils/common'
import type {
    FeishuFile,
    FeishuFolder,
    WikiSpace,
    WikiNode,
    WikiTreeResponse,
    FeishuApiResponse,
    ExportTaskResponse,
    ExportResultResponse
} from '../types/feishu';


/**
 * @description 通用的GET请求函数，用于获取JSON数据
 * @param url 请求的URL
 * @returns 返回响应的JSON数据
 */
async function getJson(url: string) {
    console.log(`[getJson] fetching url: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });
        if (!response.ok) {
            console.error(`[getJson] HTTP error! status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`[getJson] received data:`, data);
        return data;
    } catch (error) {
        console.error('[getJson] error:', error);
        throw error;
    }
}

/**
 * @description 从Cookie中获取指定字段的值
 * @param fieldName 要获取的Cookie字段名
 * @returns 返回Cookie字段的值，如果不存在则返回null
 */
export async function getCookies(fieldName: string): Promise<string | null> {
    console.log(`[getCookies] getting cookie: ${fieldName}`);
    return new Promise((resolve) => {
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'getCookies',
                fieldName: fieldName,
                url: window.location.href
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[getCookies] error:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    const fieldValue = response?.fieldValue || null;
                    console.log(`[getCookies] received cookie value: ${fieldValue}`);
                    resolve(fieldValue);
                }
            });
        } else {
            console.warn('[getCookies] chrome.runtime.sendMessage is not available. Falling back to document.cookie.');
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {});
            const cookieValue = cookies[fieldName] || null;
            console.log(`[getCookies] received cookie value from document.cookie: ${cookieValue}`);
            resolve(cookieValue);
        }
    });
}

// ==================飞书API接口函数=================

/**
 * @description 获取知识库列表
 * @returns 返回知识库空间列表
 */
export async function fetchWikiSpaces(): Promise<WikiSpace[]> {
    console.log('[fetchWikiSpaces] fetching wiki spaces');
    try {
        await sleep(500);
        const json = await getJson(`${window.location.origin}/space/api/wiki/v2/space/get/?size=40`);
        if (json && json.code === 0 && json.data && json.data.spaces) {
            console.log('[fetchWikiSpaces] successfully fetched wiki spaces:', json.data.spaces);
            return json.data.spaces;
        }
        console.warn('[fetchWikiSpaces] failed to fetch wiki spaces or no spaces found:', json);
        return [];
    } catch (error) {
        console.error('[fetchWikiSpaces] error:', error);
        return [];
    }
}

/**
 * @description 获取知识库子节点
 * @param spaceId 知识库ID
 * @param wikiToken 节点Token
 * @returns 返回知识库子节点信息
 */
export async function fetchWikiNodeChildren(spaceId: string, wikiToken: string): Promise<WikiTreeResponse | null> {
    console.log(`[fetchWikiNodeChildren] fetching wiki children for spaceId: ${spaceId}, wikiToken: ${wikiToken}`);
    try {
        await sleep(500);
        const url = `${window.location.origin}/space/api/wiki/v2/tree/get_info/?space_id=${spaceId}&wiki_token=${wikiToken}`;
        const json = await getJson(url);
        console.log('[fetchWikiNodeChildren] successfully fetched wiki children:', json);
        return json;
    } catch (error) {
        console.error('[fetchWikiNodeChildren] error:', error);
        return null;
    }
}

/**
 * @description 获取我的空间文件夹
 * @returns 返回我的空间文件夹数据
 */
export async function fetchFolders() {
    console.log('[fetchFolders] fetching folders');
    try {
        await sleep(500);
        const json = await getJson(`${window.location.origin}/space/api/explorer/v3/my_space/folder/?asc=1&rank=5&length=50`);
        console.log('[fetchFolders] successfully fetched folders:', json.data);
        return json.data;
    } catch (error) {
        console.error('[fetchFolders] error:', error);
        return null;
    }
}

/**
 * @description 获取共享空间文件夹
 * @returns 返回共享空间文件夹数据
 */
export async function fetchShareFolders() {
    console.log('[fetchShareFolders] fetching share folders');
    try {
        await sleep(500);
        const json = await getJson(`${window.location.origin}/space/api/explorer/v2/share/folder/list/?asc=0&rank=3&hidden=0&length=50`);
        console.log('[fetchShareFolders] successfully fetched share folders:', json.data);
        return json.data;
    } catch (error) {
        console.error('[fetchShareFolders] error:', error);
        return null;
    }
}

/**
 * @description 获取子文件夹列表
 * @param obj_token 父文件夹的obj_token
 * @returns 返回子文件夹列表
 */
export async function fetchChildrenList(obj_token: string) {
    console.log(`[fetchChildrenList] fetching children list for obj_token: ${obj_token}`);
    try {
        await sleep(500);
        const json = await getJson(`${window.location.origin}/space/api/explorer/v3/children/list/?asc=1&rank=5&token=${obj_token}`);
        console.log('[fetchChildrenList] successfully fetched children list:', json);
        return json;
    } catch (error) {
        console.error('[fetchChildrenList] error:', error);
        return null;
    }
}

/**
 * @description 获取我的空间文件列表
 * @returns 返回我的空间文件列表
 */
export async function fetchMySpaceFileList() {
    console.log('[fetchMySpaceFileList] fetching my space file list');
    try {
        await sleep(500);
        const json = await getJson(`${window.location.origin}/space/api/explorer/v3/my_space/obj/`);
        console.log('[fetchMySpaceFileList] successfully fetched my space file list:', json);
        return json;
    } catch (error) {
        console.error('[fetchMySpaceFileList] error:', error);
        return null;
    }
}

/**
 * @description 创建导出任务
 * @param data 包含token和type的对象
 * @returns 返回导出任务的ticket，如果失败则返回null
 */
export async function createExportTask(data: { token: string; obj_type: number }): Promise<string | null> {
    console.log('[createExportTask] creating export task with data:', data);
    try {
        await sleep(500);
        const requestId = 'bbAtOlQGYEbs-' + uuidv4().replace(/-/g, '');
        
        const requestData = {
            "token": data.token,
            "type": getFileTypeByObjType(data.obj_type),
            "file_extension": getFileExtensionByObjType(data.obj_type),
            "event_source": 1,
            "need_comment": false
        };
        
        let resp = await fetch(`${window.location.origin}/space/api/export/create/?synced_block_host_token=${data.token}&synced_block_host_type=${getFileTypeByObjType(data.obj_type)}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "zh-CN,zh;q=0.9",
                "content-type": "application/json",
                "context": `${requestId};os=mac;app_version=1.0.13.3784;os_version=10.15.7;platform=web`,
                "doc-biz": "Lark",
                "pragma": "no-cache",
                "request-id": requestId,
                "rpc-persist-lane-c-lark-uid": "0",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-csrftoken": await getCookies('_csrf_token'),
                "x-request-id": requestId,
                "x-tt-trace-id": requestId
            },
            "referrer": window.location.href,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": JSON.stringify(requestData),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });
        if (!resp.ok) {
            console.error(`[createExportTask] HTTP error! status: ${resp.status}`);
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        let json = await resp.json();
        console.log('[createExportTask] response:', json);
        const ticket = json?.data?.ticket || null;
        console.log(`[createExportTask] created task with ticket: ${ticket}`);
        return ticket;
    } catch (error) {
        console.error('[createExportTask] error:', error);
        return null;
    }
}

/**
 * @description 获取导出结果
 * @param ticket 导出任务的ticket
 * @param token 文件token
 * @param obj_type 对象类型
 * @param type 文件类型
 * @returns 返回导出结果
 */
export async function fetchExportResult(ticket: string, obj_token: string, obj_type: number) {
    console.log(`[fetchExportResult] fetching export result for ticket: ${ticket}`);
    await sleep(2000);
    if (!ticket) {
        console.warn('[fetchExportResult] ticket is null');
        return null;
    }
    try {
        const result = await getJson(`${window.location.origin}/space/api/export/result/${ticket}?token=${obj_token}&type=${getFileTypeByObjType(obj_type)}&synced_block_host_token=${obj_token}&synced_block_host_type=${getFileTypeByObjType(obj_type)}`);
        console.log('[fetchExportResult] successfully fetched export result:', result);
        return result;
    } catch (error) {
        console.error('[fetchExportResult] error:', error);
        return null;
    }
}

/**
 * @description 等待导出结果
 * @param ticket 导出任务的ticket
 * @param token 文件token
 * @param obj_type 对象类型
 * @param fileExtension 文件类型
 * @returns 返回包含下载URL和文件类型的对象，如果失败则返回null
 */
export async function waitForExportResult(ticket: string, token: string, obj_type: number): Promise<{ url: string; type: string } | null> {
    console.log(`[waitForExportResult] waiting for export result for ticket: ${ticket}`);
    let file_token;
    let resp;
    for (let retryCount = 0; retryCount < 15 && !file_token; retryCount++) {
        console.log(`[waitForExportResult] retry count: ${retryCount}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            resp = await fetchExportResult(ticket, token, obj_type);
            file_token = resp?.data?.result?.file_token;
        } catch (error) {
            console.error(`[waitForExportResult] error on retry ${retryCount}:`, error);
        }
    }

    if (file_token) {
        const result = {
            url: `https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/all/${file_token}/?synced_block_host_token=${token}&synced_block_host_type=${getFileTypeByObjType(obj_type)}`,
            type: resp?.data?.result?.file_extension || getFileExtensionByObjType(obj_type)
        };
        console.log('[waitForExportResult] successfully got export result:', result);
        return result;
    }
    
    console.warn('[waitForExportResult] failed to get export result after multiple retries');
    return null;
}

/**
 * @description 下载文件
 * @param url 文件下载URL
 * @param type 文件类型
 * @returns 返回Blob对象，如果失败则返回null
 */
export async function download(url: string, type?: string): Promise<Blob | null> {
    console.log(`[download] downloading file from url: ${url}`);
    try {
        await sleep(500);
        const response = await fetch(url, {
            "headers": {},
            "referrer": window.location.href,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        });
        
        if (!response.ok) {
            console.error(`[download] HTTP error! status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('[download] successfully downloaded file as blob:', blob);
        return blob;
    } catch (error) {
        console.error('[download] error:', error);
        return null;
    }
}
