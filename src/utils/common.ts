import { message } from 'antd';

/**
 * @description: 睡眠函数
 * @param {number} ms 睡眠时间，单位毫秒
 * @return {Promise<void>}
 */
export function sleep(ms: number): Promise<void> {
    try {
        return new Promise(resolve => setTimeout(resolve, ms));
    } catch (error) {
        console.error('sleep error:', error);
        return Promise.reject(error);
    }
}

/**
 * @description: 从 chrome.storage.local 中获取数据
 * @param {string} key
 * @return {Promise<any>}
 */
export async function getLocalStorageData(key: string): Promise<any> {
    try {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    } catch (error) {
        console.error('getLocalStorageData error:', error);
        return Promise.reject(error);
    }
}

/**
 * @description: 获取当前时间戳
 * @return {string} yyyyMMdd_HHmmss
 */
export function getCurrentTimestamp(): string {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    } catch (error) {
        console.error('getCurrentTimestamp error:', error);
        return '';
    }
}

/**
 * @description: 复制文本到剪贴板
 * @param {string} targetText
 * @return {Promise<void>}
 */
export async function copy(targetText: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(targetText);
        message.success('复制成功');
    } catch (error) {
        console.error('复制失败:', error);
        message.error('复制失败');
    }
}

/**
 * @description: 模拟点击
 * @param {HTMLElement} element
 * @param {object} init
 * @return {void}
 */
export function simulateClick(element: HTMLElement, init = {}): void {
    try {
        const clientRect = element.getBoundingClientRect();
        const clientX = clientRect.left;
        const clientY = clientRect.top;
        const position = { clientX: clientX, clientY: clientY };
        Object.assign(init, position);
        let mouseEvent = new MouseEvent("click", init);
        element.dispatchEvent(mouseEvent);
    } catch (error) {
        console.error('simulateClick error:', error);
    }
}

export function getFileExtensionByObjType(obj_type: number): string {
    switch (obj_type) {
        case 8: // 问卷、多维表
            return 'xlsx';
        case 3: // 简单表格
            return 'xlsx';
        case 30: // 幻灯片
            return 'pptx';
        case 2:
        case 22: // 文档、文档画板
            return 'docx';
        case 11: // 思维笔记
            return 'mm';
        default:
            return 'pdf';
    }
}

export function getFileTypeByObjType(obj_type: number): string {
    switch (obj_type) {
        case 8: // 多维表
            return 'bitable';
        case 3: // 简单表格
            return 'sheet';
        case 30: // 幻灯片
            return 'slides';
        case 2:
            return 'doc';
        case 22: // 文档、文档画板
            return 'docx';
        case 11: // 思维笔记
            return 'mindnote';
        default:
            return '';
    }
}